import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { clearDatabase } from '../utils/prisma.test-utils';
import { randomBytes, scryptSync } from 'node:crypto';

async function loginWithPermissions(
  app: INestApplication,
  prisma: PrismaService,
  permissionCodes: string[],
  suffix: string,
): Promise<string> {
  const permissions = await Promise.all(
    permissionCodes.map((code: string) =>
      prisma.permission.create({
        data: { code, module: code.split('.')[0], description: code },
      }),
    ),
  );

  const role = await prisma.role.create({
    data: { name: `Operator Role ${suffix}`, isEditable: true },
  });

  await prisma.rolePermission.createMany({
    data: permissions.map((p: { id: string }) => ({
      roleId: role.id,
      permissionId: p.id,
    })),
  });

  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync('operator_password', salt, 64).toString('hex');

  const user = await prisma.user.create({
    data: {
      email: `prog-op-${suffix}@test.edu`,
      password: `${salt}:${hash}`,
      firstName: 'Operator',
      lastName: suffix,
      ci: `prog-op-ci-${suffix}`,
    },
  });

  const adminProfile = await prisma.adminProfile.create({
    data: { userId: user.id },
  });

  await prisma.adminRole.create({
    data: { adminProfileId: adminProfile.id, roleId: role.id },
  });

  const loginRes = await request(app.getHttpServer())
    .post('/auth/login')
    .send({
      email: `prog-op-${suffix}@test.edu`,
      password: 'operator_password',
    })
    .expect(200);

  return loginRes.body.data.accessToken as string;
}

describe('Programs', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    prisma = app.get(PrismaService);
    await app.init();
  });

  afterEach(async () => {
    await clearDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /programs/:id/pensum', () => {
    it('returns the program with courses and prerequisites nested', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['program.read'],
        'pensum',
      );

      const program = await prisma.program.create({
        data: {
          name: 'Computer Science',
          termType: 'SEMESTER',
        },
      });

      const courseA = await prisma.course.create({
        data: {
          programId: program.id,
          code: 'CS101',
          name: 'Intro to CS',
          credits: 4,
          termLevel: 1,
        },
      });

      const courseB = await prisma.course.create({
        data: {
          programId: program.id,
          code: 'CS201',
          name: 'Data Structures',
          credits: 4,
          termLevel: 2,
        },
      });

      await prisma.coursePrerequisite.create({
        data: {
          courseId: courseB.id,
          requiredCourseId: courseA.id,
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/programs/${program.id}/pensum`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        name: 'Computer Science',
        termType: 'SEMESTER',
        totalCredits: 8,
      });

      type CourseView = {
        code: string;
        credits: number;
        termLevel: number;
        prerequisites: Array<{
          requiredCourseId: string;
          requiredCredits: number | null;
        }>;
      };

      const courses = response.body.data.courses as Array<CourseView>;

      expect(courses).toHaveLength(2);

      const cs101 = courses.find((c: CourseView) => c.code === 'CS101');
      expect(cs101).toMatchObject({ credits: 4, termLevel: 1 });
      expect(cs101!.prerequisites).toEqual([]);

      const cs201 = courses.find((c: CourseView) => c.code === 'CS201');
      expect(cs201).toMatchObject({ credits: 4, termLevel: 2 });
      expect(cs201!.prerequisites).toEqual([
        { requiredCourseId: courseA.id, requiredCredits: null },
      ]);
    });
  });

  const tag = (): string => randomBytes(4).toString('hex');

  async function createStudent(ci: string, programId: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync('student_password', salt, 64).toString('hex');
    const user = await prisma.user.create({
      data: {
        email: `${ci}@test.edu`,
        password: `${salt}:${hash}`,
        firstName: 'Student',
        lastName: ci,
        ci: `stu-ci-${ci}`,
      },
    });
    const profile = await prisma.studentProfile.create({
      data: { userId: user.id, programId },
    });

    return profile.id;
  }

  describe('GET /programs/:id/summary', () => {
    it('aggregates pensum, section, and enrollment metadata', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['program.read'],
        'summary',
      );

      const program = await prisma.program.create({
        data: {
          name: 'Systems Engineering',
          termType: 'SEMESTER',
        },
      });
      const otherProgram = await prisma.program.create({
        data: { name: 'Other', termType: 'SEMESTER' },
      });

      const c1 = await prisma.course.create({
        data: {
          programId: program.id,
          code: 'SYS101',
          name: 'Intro',
          credits: 4,
          termLevel: 1,
        },
      });
      await prisma.course.create({
        data: {
          programId: program.id,
          code: 'SYS102',
          name: 'Math',
          credits: 5,
          termLevel: 1,
        },
      });
      const c3 = await prisma.course.create({
        data: {
          programId: program.id,
          code: 'SYS201',
          name: 'Advanced',
          credits: 5,
          termLevel: 2,
        },
      });
      await prisma.course.create({
        data: {
          programId: program.id,
          code: 'SYS-OLD',
          name: 'Removed',
          credits: 3,
          termLevel: 1,
          deletedAt: new Date(),
        },
      });
      const foreignCourse = await prisma.course.create({
        data: {
          programId: otherProgram.id,
          code: 'OTH101',
          name: 'Foreign',
          credits: 3,
          termLevel: 1,
        },
      });

      const term = await prisma.term.create({
        data: {
          programId: otherProgram.id,
          name: `Term ${tag()}`,
          startDate: new Date('2026-03-01'),
          endDate: new Date('2026-07-31'),
          status: 'ACTIVE',
        },
      });

      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync('teacher_password', salt, 64).toString('hex');
      const teacherUser = await prisma.user.create({
        data: {
          email: `teacher-${tag()}@test.edu`,
          password: `${salt}:${hash}`,
          firstName: 'Prof',
          lastName: tag(),
          ci: `teacher-ci-${tag()}`,
        },
      });
      const teacher = await prisma.adminProfile.create({
        data: { userId: teacherUser.id },
      });

      const student1 = await createStudent('s1', program.id);
      const student2 = await createStudent('s2', program.id);

      const sectionA = await prisma.courseSection.create({
        data: {
          courseId: c1.id,
          termId: term.id,
          teacherId: teacher.id,
          name: 'Sec A',
          capacity: 30,
        },
      });
      const sectionB = await prisma.courseSection.create({
        data: {
          courseId: c3.id,
          termId: term.id,
          teacherId: teacher.id,
          name: 'Sec B',
          capacity: 30,
        },
      });
      const foreignSection = await prisma.courseSection.create({
        data: {
          courseId: foreignCourse.id,
          termId: term.id,
          teacherId: teacher.id,
          name: 'Sec F',
          capacity: 30,
        },
      });

      await prisma.coursePrerequisite.create({
        data: { courseId: c3.id, requiredCourseId: c1.id },
      });

      await prisma.enrollment.createMany({
        data: [
          { sectionId: sectionA.id, studentId: student1, status: 'ENROLLED' },
          { sectionId: sectionA.id, studentId: student2, status: 'ENROLLED' },
          { sectionId: sectionB.id, studentId: student2, status: 'ENROLLED' },
          { sectionId: sectionB.id, studentId: student1, status: 'DROPPED' },
          {
            sectionId: foreignSection.id,
            studentId: student1,
            status: 'ENROLLED',
          },
        ],
      });

      await prisma.transcript.createMany({
        data: [
          {
            studentId: student1,
            courseId: c1.id,
            termId: term.id,
            finalGrade: 4.5,
            status: 'PASSED',
          },
          {
            studentId: student2,
            courseId: c3.id,
            termId: term.id,
            finalGrade: 3.8,
            status: 'PASSED',
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .get(`/programs/${program.id}/summary`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data).toEqual({
        programId: program.id,
        name: 'Systems Engineering',
        termType: 'SEMESTER',
        totalCredits: 14,
        allocatedCredits: 14,
        courseCount: 3,
        totalTermLevels: 2,
        prerequisiteChainsCount: 1,
        sectionCount: 2,
        studentCount: 2,
        dropoutCount: 1,
        activeTeachersCount: 1,
        totalCapacity: 60,
        availableSpots: 58,
        historicalTranscriptsCount: 2,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('returns 404 for a soft-deleted program', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['program.read'],
        'summary-404',
      );

      const program = await prisma.program.create({
        data: { name: 'Ghost', termType: 'SEMESTER' },
      });

      await prisma.program.update({
        where: { id: program.id },
        data: { deletedAt: new Date() },
      });

      await request(app.getHttpServer())
        .get(`/programs/${program.id}/summary`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('DELETE /programs/:id', () => {
    it('soft-deletes the program and preserves associated courses', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['program.delete', 'program.read'],
        'deleter',
      );

      const program = await prisma.program.create({
        data: { name: 'To Delete', termType: 'SEMESTER' },
      });

      await prisma.course.create({
        data: {
          programId: program.id,
          code: 'DEL101',
          name: 'Disposable',
          credits: 3,
          termLevel: 1,
        },
      });

      await request(app.getHttpServer())
        .delete(`/programs/${program.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const deleted = await prisma.program.findUnique({
        where: { id: program.id },
      });
      expect(deleted?.deletedAt).not.toBeNull();

      const courses = await prisma.course.findMany({
        where: { programId: program.id, deletedAt: null },
      });
      expect(courses).toHaveLength(1);
      expect(courses[0].code).toBe('DEL101');
    });
  });
});
