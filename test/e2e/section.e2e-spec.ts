import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { clearDatabase } from '../utils/prisma.test-utils';
import { randomBytes, scryptSync } from 'node:crypto';
import { ErrorCodes } from '@core/domain/error-codes';

function t(h: number, m: number): Date {
  return new Date(Date.UTC(1970, 0, 1, h, m, 0));
}

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
    data: { name: `Section Role ${suffix}`, isEditable: true },
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
      email: `sec-op-${suffix}@test.edu`,
      password: `${salt}:${hash}`,
      firstName: 'Operator',
      lastName: suffix,
      ci: `sec-op-ci-${suffix}`,
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
    .send({ email: `sec-op-${suffix}@test.edu`, password: 'operator_password' })
    .expect(200);

  return loginRes.body.data.accessToken as string;
}

describe('Sections', () => {
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

  const tag = (): string => randomBytes(4).toString('hex');

  async function seedData(t?: string): Promise<{
    termId: string;
    closedTermId: string;
    courseId: string;
    teacherId: string;
    studentId: string;
  }> {
    const suffix = t ?? tag();

    const term = await prisma.term.create({
      data: {
        name: `Spring 2026 ${suffix}`,
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-07-31'),
        status: 'ACTIVE',
      },
    });

    const closedTerm = await prisma.term.create({
      data: {
        name: `Fall 2025 ${suffix}`,
        startDate: new Date('2025-08-01'),
        endDate: new Date('2025-12-31'),
        status: 'CLOSED',
      },
    });

    const program = await prisma.program.create({
      data: {
        name: `Engineering ${suffix}`,
        termType: 'SEMESTER',
        totalCredits: 200,
      },
    });

    const course = await prisma.course.create({
      data: {
        programId: program.id,
        code: `MATH101-${suffix}`,
        name: `Calculus I ${suffix}`,
        credits: 5,
        termLevel: 1,
      },
    });

    const teacherRole = await prisma.role.create({
      data: { name: `teacher-${suffix}`, isEditable: true },
    });

    const teacherSalt = randomBytes(16).toString('hex');
    const teacherHash = scryptSync('pass', teacherSalt, 64).toString('hex');

    const teacher = await prisma.user.create({
      data: {
        email: `teacher-${suffix}@test.edu`,
        password: `${teacherSalt}:${teacherHash}`,
        firstName: 'Prof',
        lastName: suffix,
        ci: `teacher-ci-${suffix}`,
      },
    });

    const teacherProfile = await prisma.adminProfile.create({
      data: { userId: teacher.id },
    });

    await prisma.adminRole.create({
      data: { adminProfileId: teacherProfile.id, roleId: teacherRole.id },
    });

    const studentSalt = randomBytes(16).toString('hex');
    const studentHash = scryptSync('pass', studentSalt, 64).toString('hex');

    const student = await prisma.user.create({
      data: {
        email: `student-${suffix}@test.edu`,
        password: `${studentSalt}:${studentHash}`,
        firstName: 'Student',
        lastName: suffix,
        ci: `student-ci-${suffix}`,
      },
    });

    return {
      termId: term.id,
      closedTermId: closedTerm.id,
      courseId: course.id,
      teacherId: teacherProfile.id,
      studentId: student.id,
    };
  }

  describe('POST /sections', () => {
    it('creates a section without schedules', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['section.create', 'section.read'],
        'create-simple',
      );

      const { termId, courseId, teacherId } = await seedData();

      const response = await request(app.getHttpServer())
        .post('/sections')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'M1', capacity: 30, courseId, termId, teacherId })
        .expect(201);

      expect(response.body.data.name).toBe('M1');
      expect(response.body.data.capacity).toBe(30);

      const saved = await prisma.courseSection.findUnique({
        where: { id: response.body.data.id },
      });
      expect(saved).not.toBeNull();
    });

    it('creates a section with schedules in the same transaction', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['section.create', 'section.read'],
        'create-comp',
      );

      const { termId, courseId, teacherId } = await seedData();

      const response = await request(app.getHttpServer())
        .post('/sections')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'M1',
          capacity: 30,
          courseId,
          termId,
          teacherId,
          schedules: [
            {
              dayOfWeek: 'MONDAY',
              startTime: '08:00',
              endTime: '10:00',
              roomIdentifier: 'A1',
            },
          ],
        })
        .expect(201);

      expect(response.body.data.schedules).toHaveLength(1);
      expect(response.body.data.schedules[0].dayOfWeek).toBe('MONDAY');

      const schedules = await prisma.sectionSchedule.findMany({
        where: { sectionId: response.body.data.id },
      });
      expect(schedules).toHaveLength(1);
      expect(schedules[0].roomIdentifier).toBe('A1');
    });

    it('rejects section creation in a closed term', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['section.create', 'section.read'],
        'create-closed',
      );

      const { closedTermId, courseId, teacherId } = await seedData();

      const response = await request(app.getHttpServer())
        .post('/sections')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Late Section',
          capacity: 30,
          courseId,
          termId: closedTermId,
          teacherId,
        })
        .expect(422);

      expect(response.body).toMatchObject({
        statusCode: 422,
        errorCode: ErrorCodes.ERR_SECTION_CLOSED_TERM,
        path: '/sections',
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    it('rejects section creation for a soft-deleted course', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['section.create', 'section.read'],
        'create-deleted-course',
      );

      const { termId, courseId, teacherId } = await seedData();

      await prisma.course.update({
        where: { id: courseId },
        data: { deletedAt: new Date() },
      });

      const response = await request(app.getHttpServer())
        .post('/sections')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Ghost Section',
          capacity: 30,
          courseId,
          termId,
          teacherId,
        })
        .expect(422);

      expect(response.body).toMatchObject({
        statusCode: 422,
        errorCode: ErrorCodes.ERR_SECTION_CREATION_FAILED,
        path: '/sections',
      });
      expect(response.body).toHaveProperty('timestamp');

      const sections = await prisma.courseSection.findMany({
        where: { courseId },
      });
      expect(sections).toHaveLength(0);
    });

    it('rejects capacity below 1', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['section.create', 'section.read'],
        'create-cap',
      );

      const { termId, courseId, teacherId } = await seedData();

      const response = await request(app.getHttpServer())
        .post('/sections')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Bad', capacity: 0, courseId, termId, teacherId })
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        errorCode: ErrorCodes.ERR_VALIDATION_FAILED,
        path: '/sections',
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    it('rejects capacity above 150', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['section.create', 'section.read'],
        'create-cap2',
      );

      const { termId, courseId, teacherId } = await seedData();

      const response = await request(app.getHttpServer())
        .post('/sections')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Big', capacity: 200, courseId, termId, teacherId })
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        errorCode: ErrorCodes.ERR_VALIDATION_FAILED,
        path: '/sections',
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    it('rejects creation if the assigned teacher is actually a student', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['section.create', 'section.read'],
        'create-bad-role',
      );

      const { termId, courseId, studentId } = await seedData();

      const response = await request(app.getHttpServer())
        .post('/sections')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Hacked Section',
          capacity: 30,
          courseId,
          termId,
          teacherId: studentId,
        })
        .expect(422);

      expect(response.body).toMatchObject({
        statusCode: 422,
        errorCode: ErrorCodes.ERR_SECTION_CREATION_FAILED,
        path: '/sections',
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('POST /sections/:id/schedules', () => {
    async function seedSection(prisma: PrismaService): Promise<{
      sectionId: string;
      teacherId: string;
      termId: string;
    }> {
      const { termId, courseId, teacherId } = await seedData();

      const section = await prisma.courseSection.create({
        data: {
          courseId,
          termId,
          teacherId,
          name: 'Collision Test',
          capacity: 30,
        },
      });

      return { sectionId: section.id, teacherId, termId };
    }

    it('adds a schedule successfully', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['section.schedule', 'section.read'],
        'sch-ok',
      );

      const { sectionId } = await seedSection(prisma);

      const response = await request(app.getHttpServer())
        .post(`/sections/${sectionId}/schedules`)
        .set('Authorization', `Bearer ${token}`)
        .send({ dayOfWeek: 'TUESDAY', startTime: '10:00', endTime: '12:00' })
        .expect(201);

      expect(response.body.data.dayOfWeek).toBe('TUESDAY');
    });

    it('rejects inverted time range (start > end)', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['section.schedule', 'section.read'],
        'sch-inv',
      );

      const { sectionId } = await seedSection(prisma);

      const response = await request(app.getHttpServer())
        .post(`/sections/${sectionId}/schedules`)
        .set('Authorization', `Bearer ${token}`)
        .send({ dayOfWeek: 'MONDAY', startTime: '12:00', endTime: '10:00' })
        .expect(409);

      expect(response.body).toMatchObject({
        statusCode: 409,
        errorCode: ErrorCodes.ERR_SECTION_SCHEDULE_CONFLICT,
        path: `/sections/${sectionId}/schedules`,
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    it('detects partial teacher overlap', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['section.schedule', 'section.read'],
        'sch-part',
      );

      const { sectionId, teacherId, termId } = await seedSection(prisma);

      const otherSection = await prisma.courseSection.create({
        data: {
          courseId: (await prisma.course.findFirstOrThrow()).id,
          termId,
          teacherId,
          name: 'Other',
          capacity: 30,
        },
      });

      await prisma.sectionSchedule.create({
        data: {
          sectionId: otherSection.id,
          dayOfWeek: 'MONDAY',
          startTime: t(8, 0),
          endTime: t(10, 0),
        },
      });

      const response = await request(app.getHttpServer())
        .post(`/sections/${sectionId}/schedules`)
        .set('Authorization', `Bearer ${token}`)
        .send({ dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '11:00' })
        .expect(409);

      expect(response.body).toMatchObject({
        statusCode: 409,
        errorCode: ErrorCodes.ERR_SECTION_SCHEDULE_CONFLICT,
        path: `/sections/${sectionId}/schedules`,
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    it('detects full teacher containment', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['section.schedule', 'section.read'],
        'sch-full',
      );

      const { sectionId, teacherId, termId } = await seedSection(prisma);

      const otherSection = await prisma.courseSection.create({
        data: {
          courseId: (await prisma.course.findFirstOrThrow()).id,
          termId,
          teacherId,
          name: 'Full Block',
          capacity: 30,
        },
      });

      await prisma.sectionSchedule.create({
        data: {
          sectionId: otherSection.id,
          dayOfWeek: 'MONDAY',
          startTime: t(8, 0),
          endTime: t(12, 0),
        },
      });

      const response = await request(app.getHttpServer())
        .post(`/sections/${sectionId}/schedules`)
        .set('Authorization', `Bearer ${token}`)
        .send({ dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '10:00' })
        .expect(409);

      expect(response.body).toMatchObject({
        statusCode: 409,
        errorCode: ErrorCodes.ERR_SECTION_SCHEDULE_CONFLICT,
        path: `/sections/${sectionId}/schedules`,
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    it('detects room collision', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['section.schedule', 'section.read'],
        'sch-room',
      );

      const { sectionId, teacherId, termId } = await seedSection(prisma);

      const otherSection = await prisma.courseSection.create({
        data: {
          courseId: (await prisma.course.findFirstOrThrow()).id,
          termId,
          teacherId,
          name: 'Room Occupier',
          capacity: 30,
        },
      });

      await prisma.sectionSchedule.create({
        data: {
          sectionId: otherSection.id,
          dayOfWeek: 'TUESDAY',
          startTime: t(14, 0),
          endTime: t(16, 0),
          roomIdentifier: 'Lab-1',
        },
      });

      const response = await request(app.getHttpServer())
        .post(`/sections/${sectionId}/schedules`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          dayOfWeek: 'TUESDAY',
          startTime: '14:00',
          endTime: '16:00',
          roomIdentifier: 'Lab-1',
        })
        .expect(409);

      expect(response.body).toMatchObject({
        statusCode: 409,
        errorCode: ErrorCodes.ERR_SECTION_SCHEDULE_CONFLICT,
        path: `/sections/${sectionId}/schedules`,
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    it('allows adjacent time blocks (no collision)', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['section.schedule', 'section.read'],
        'sch-adj',
      );

      const { sectionId, teacherId, termId } = await seedSection(prisma);

      const otherSection = await prisma.courseSection.create({
        data: {
          courseId: (await prisma.course.findFirstOrThrow()).id,
          termId,
          teacherId,
          name: 'Adjacent',
          capacity: 30,
        },
      });

      await prisma.sectionSchedule.create({
        data: {
          sectionId: otherSection.id,
          dayOfWeek: 'WEDNESDAY',
          startTime: t(8, 0),
          endTime: t(10, 0),
        },
      });

      await request(app.getHttpServer())
        .post(`/sections/${sectionId}/schedules`)
        .set('Authorization', `Bearer ${token}`)
        .send({ dayOfWeek: 'WEDNESDAY', startTime: '10:00', endTime: '12:00' })
        .expect(201);
    });

    it('allows same time across different terms (no collision)', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['section.schedule', 'section.read'],
        'sch-term',
      );

      const { termId, teacherId, courseId } = await seedData();

      const otherTerm = await prisma.term.create({
        data: {
          name: 'Summer 2027',
          startDate: new Date('2027-01-01'),
          endDate: new Date('2027-03-31'),
          status: 'ACTIVE',
        },
      });

      const fallSection = await prisma.courseSection.create({
        data: { courseId, termId, teacherId, name: 'Fall', capacity: 30 },
      });

      const springSection = await prisma.courseSection.create({
        data: {
          courseId,
          termId: otherTerm.id,
          teacherId,
          name: 'Spring',
          capacity: 30,
        },
      });

      await prisma.sectionSchedule.create({
        data: {
          sectionId: fallSection.id,
          dayOfWeek: 'THURSDAY',
          startTime: t(8, 0),
          endTime: t(10, 0),
        },
      });

      await request(app.getHttpServer())
        .post(`/sections/${springSection.id}/schedules`)
        .set('Authorization', `Bearer ${token}`)
        .send({ dayOfWeek: 'THURSDAY', startTime: '08:00', endTime: '10:00' })
        .expect(201);
    });
  });

  describe('GET /sections', () => {
    it('filters by termId', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['section.read'],
        'filter-term',
      );

      const { termId, courseId, teacherId } = await seedData();

      await prisma.courseSection.create({
        data: { courseId, termId, teacherId, name: 'In Term', capacity: 30 },
      });

      const { termId: otherTermId } = await seedData();

      await prisma.courseSection.create({
        data: {
          courseId,
          termId: otherTermId,
          teacherId,
          name: 'Other Term',
          capacity: 30,
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/sections?termId=${termId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('In Term');
    });

    it('filters by courseId', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['section.read'],
        'filter-course',
      );

      const { termId, courseId, teacherId } = await seedData();

      await prisma.courseSection.create({
        data: { courseId, termId, teacherId, name: 'Math Sec', capacity: 30 },
      });

      const otherProgram = await prisma.program.create({
        data: { name: 'Physics', termType: 'SEMESTER', totalCredits: 120 },
      });

      const otherCourse = await prisma.course.create({
        data: {
          programId: otherProgram.id,
          code: 'PHY101',
          name: 'Physics I',
          credits: 4,
          termLevel: 1,
        },
      });

      await prisma.courseSection.create({
        data: {
          courseId: otherCourse.id,
          termId,
          teacherId,
          name: 'Physics Sec',
          capacity: 30,
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/sections?courseId=${courseId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Math Sec');
    });

    it('filters by termId + teacherId combined', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['section.read'],
        'filter-comp',
      );

      const { termId, courseId, teacherId } = await seedData();

      const otherTeacherSalt = randomBytes(16).toString('hex');
      const otherTeacherHash = scryptSync(
        'pass',
        otherTeacherSalt,
        64,
      ).toString('hex');

      const otherTeacher = await prisma.user.create({
        data: {
          email: 'other-teacher@test.edu',
          password: `${otherTeacherSalt}:${otherTeacherHash}`,
          firstName: 'Other',
          lastName: 'Teacher',
          ci: 'other-t-ci',
        },
      });

      await prisma.courseSection.create({
        data: {
          courseId,
          termId,
          teacherId,
          name: 'My Section',
          capacity: 30,
        },
      });

      const otherTeacherProfile = await prisma.adminProfile.create({
        data: { userId: otherTeacher.id },
      });

      await prisma.courseSection.create({
        data: {
          courseId,
          termId,
          teacherId: otherTeacherProfile.id,
          name: 'Other Teacher',
          capacity: 30,
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/sections?termId=${termId}&teacherId=${teacherId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('My Section');
    });
  });

  describe('PATCH /sections/:id', () => {
    it('increases capacity successfully', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['section.update', 'section.read'],
        'patch-cap',
      );

      const { termId, courseId, teacherId } = await seedData();

      const section = await prisma.courseSection.create({
        data: { courseId, termId, teacherId, name: 'Flex', capacity: 30 },
      });

      const response = await request(app.getHttpServer())
        .patch(`/sections/${section.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ capacity: 40 })
        .expect(200);

      expect(response.body.data.capacity).toBe(40);
    });

    it('rejects modification when section is in a closed term', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['section.update', 'section.read'],
        'patch-closed',
      );

      const { closedTermId, courseId, teacherId } = await seedData();

      const section = await prisma.courseSection.create({
        data: {
          courseId,
          termId: closedTermId,
          teacherId,
          name: 'Frozen',
          capacity: 30,
        },
      });

      const response = await request(app.getHttpServer())
        .patch(`/sections/${section.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Should Fail' })
        .expect(422);

      expect(response.body).toMatchObject({
        statusCode: 422,
        errorCode: ErrorCodes.ERR_SECTION_UPDATE_FAILED,
        path: `/sections/${section.id}`,
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('DELETE /sections/:id', () => {
    it('cascades deletes to schedules', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['section.delete', 'section.read'],
        'del-cascade',
      );

      const { termId, courseId, teacherId } = await seedData();

      const section = await prisma.courseSection.create({
        data: { courseId, termId, teacherId, name: 'Cascade', capacity: 30 },
      });

      await prisma.sectionSchedule.createMany({
        data: [
          {
            sectionId: section.id,
            dayOfWeek: 'MONDAY',
            startTime: t(8, 0),
            endTime: t(10, 0),
          },
          {
            sectionId: section.id,
            dayOfWeek: 'WEDNESDAY',
            startTime: t(8, 0),
            endTime: t(10, 0),
          },
          {
            sectionId: section.id,
            dayOfWeek: 'FRIDAY',
            startTime: t(8, 0),
            endTime: t(10, 0),
          },
        ],
      });

      await request(app.getHttpServer())
        .delete(`/sections/${section.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const deleted = await prisma.courseSection.findUnique({
        where: { id: section.id },
      });
      expect(deleted?.deletedAt).not.toBeNull();

      const schedules = await prisma.sectionSchedule.findMany({
        where: { sectionId: section.id },
      });
      expect(schedules).toHaveLength(0);
    });

    it('rejects deletion in a closed term', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['section.delete', 'section.read'],
        'del-closed',
      );

      const { closedTermId, courseId, teacherId } = await seedData();

      const section = await prisma.courseSection.create({
        data: {
          courseId,
          termId: closedTermId,
          teacherId,
          name: 'Historic',
          capacity: 30,
        },
      });

      const response = await request(app.getHttpServer())
        .delete(`/sections/${section.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(422);

      expect(response.body).toMatchObject({
        statusCode: 422,
        errorCode: ErrorCodes.ERR_SECTION_CLOSED_TERM,
        path: `/sections/${section.id}`,
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('DELETE /sections/:id/schedules/:scheduleId', () => {
    it('removes a single schedule block', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['section.schedule', 'section.read'],
        'del-sch',
      );

      const { termId, courseId, teacherId } = await seedData();

      const section = await prisma.courseSection.create({
        data: { courseId, termId, teacherId, name: 'Section', capacity: 30 },
      });

      const schedule = await prisma.sectionSchedule.create({
        data: {
          sectionId: section.id,
          dayOfWeek: 'MONDAY',
          startTime: t(8, 0),
          endTime: t(10, 0),
        },
      });

      await request(app.getHttpServer())
        .delete(`/sections/${section.id}/schedules/${schedule.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const remaining = await prisma.sectionSchedule.count({
        where: { sectionId: section.id },
      });
      expect(remaining).toBe(0);
    });
  });
});
