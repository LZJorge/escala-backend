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
      email: `crs-op-${suffix}@test.edu`,
      password: `${salt}:${hash}`,
      firstName: 'Operator',
      lastName: suffix,
      ci: `crs-op-ci-${suffix}`,
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
    .send({ email: `crs-op-${suffix}@test.edu`, password: 'operator_password' })
    .expect(200);

  return loginRes.body.data.accessToken as string;
}

describe('Courses', () => {
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

  async function seedProgram(): Promise<{
    programId: string;
    courses: Array<{ id: string; code: string; termLevel: number }>;
  }> {
    const program = await prisma.program.create({
      data: {
        name: `Pensum ${tag()}`,
        termType: 'SEMESTER',
      },
    });

    const courses: Array<{ id: string; code: string; termLevel: number }> = [];
    for (let level = 1; level <= 3; level++) {
      const course = await prisma.course.create({
        data: {
          programId: program.id,
          code: `C${level}-${tag()}`,
          name: `Course Level ${level}`,
          credits: 3,
          termLevel: level,
        },
      });
      courses.push({ id: course.id, code: course.code, termLevel: level });
    }

    return { programId: program.id, courses };
  }

  describe('PUT /courses/:courseId/prerequisites', () => {
    it('replaces old prereqs and stores a requiredCourseId', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['course.update', 'course.read'],
        'prereq',
      );

      const program = await prisma.program.create({
        data: { name: 'Engineering', termType: 'SEMESTER' },
      });

      const math = await prisma.course.create({
        data: {
          programId: program.id,
          code: 'MATH101',
          name: 'Calculus I',
          credits: 5,
          termLevel: 1,
        },
      });

      const physics = await prisma.course.create({
        data: {
          programId: program.id,
          code: 'PHY101',
          name: 'Physics I',
          credits: 4,
          termLevel: 1,
        },
      });

      const advanced = await prisma.course.create({
        data: {
          programId: program.id,
          code: 'MATH201',
          name: 'Calculus II',
          credits: 5,
          termLevel: 2,
        },
      });

      await prisma.coursePrerequisite.create({
        data: { courseId: advanced.id, requiredCourseId: math.id },
      });

      await request(app.getHttpServer())
        .put(`/courses/${advanced.id}/prerequisites`)
        .set('Authorization', `Bearer ${token}`)
        .send({ prerequisites: [{ requiredCourseId: physics.id }] })
        .expect(200);

      const prereqs = await prisma.coursePrerequisite.findMany({
        where: { courseId: advanced.id },
      });

      expect(prereqs).toHaveLength(1);
      expect(prereqs[0].requiredCourseId).toBe(physics.id);
      expect(prereqs[0].requiredCredits).toBeNull();
    });

    it('stores a prerequisite with requiredCredits only', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['course.update', 'course.read'],
        'credits',
      );

      const program = await prisma.program.create({
        data: { name: 'Engineering', termType: 'SEMESTER' },
      });

      const course = await prisma.course.create({
        data: {
          programId: program.id,
          code: 'ADV300',
          name: 'Advanced Topics',
          credits: 3,
          termLevel: 3,
        },
      });

      await request(app.getHttpServer())
        .put(`/courses/${course.id}/prerequisites`)
        .set('Authorization', `Bearer ${token}`)
        .send({ prerequisites: [{ requiredCredits: 30 }] })
        .expect(200);

      const prereqs = await prisma.coursePrerequisite.findMany({
        where: { courseId: course.id },
      });

      expect(prereqs).toHaveLength(1);
      expect(prereqs[0].requiredCourseId).toBeNull();
      expect(prereqs[0].requiredCredits).toBe(30);
    });

    it('clears all prerequisites with an empty array', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['course.update', 'course.read'],
        'clear',
      );

      const { courses } = await seedProgram();
      const [c1, c2] = courses;

      await prisma.coursePrerequisite.create({
        data: { courseId: c2.id, requiredCourseId: c1.id },
      });

      await request(app.getHttpServer())
        .put(`/courses/${c2.id}/prerequisites`)
        .set('Authorization', `Bearer ${token}`)
        .send({ prerequisites: [] })
        .expect(200);

      const prereqs = await prisma.coursePrerequisite.findMany({
        where: { courseId: c2.id },
      });

      expect(prereqs).toHaveLength(0);
    });

    it('returns 422 when an entry has neither course nor credits', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['course.update', 'course.read'],
        'empty-entry',
      );

      const { courses } = await seedProgram();
      const [c2] = courses;

      const response = await request(app.getHttpServer())
        .put(`/courses/${c2.id}/prerequisites`)
        .set('Authorization', `Bearer ${token}`)
        .send({ prerequisites: [{}] })
        .expect(422);

      expect(response.body.errorCode).toBe('ERR_COURSE_PREREQ_INVALID');
    });

    it('returns 422 when a course is its own prerequisite', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['course.update', 'course.read'],
        'self',
      );

      const { courses } = await seedProgram();
      const [c2] = courses;

      await request(app.getHttpServer())
        .put(`/courses/${c2.id}/prerequisites`)
        .set('Authorization', `Bearer ${token}`)
        .send({ prerequisites: [{ requiredCourseId: c2.id }] })
        .expect(422);
    });

    it('returns 422 when the prerequisite belongs to another program', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['course.update', 'course.read'],
        'cross-program',
      );

      const { courses } = await seedProgram();
      const otherProgram = await prisma.program.create({
        data: {
          name: `Foreign ${tag()}`,
          termType: 'SEMESTER',
        },
      });
      const foreignCourse = await prisma.course.create({
        data: {
          programId: otherProgram.id,
          code: `F-${tag()}`,
          name: 'Foreign Course',
          credits: 3,
          termLevel: 1,
        },
      });
      const [c2] = courses;

      await request(app.getHttpServer())
        .put(`/courses/${c2.id}/prerequisites`)
        .set('Authorization', `Bearer ${token}`)
        .send({ prerequisites: [{ requiredCourseId: foreignCourse.id }] })
        .expect(422);
    });

    it('returns 422 when the prerequisite course does not exist', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['course.update', 'course.read'],
        'missing',
      );

      const { courses } = await seedProgram();
      const [c2] = courses;

      await request(app.getHttpServer())
        .put(`/courses/${c2.id}/prerequisites`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          prerequisites: [
            { requiredCourseId: '00000000-0000-4000-8000-000000000000' },
          ],
        })
        .expect(422);
    });

    it('returns 422 when the prerequisite is in the same term level', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['course.update', 'course.read'],
        'same-level',
      );

      const { courses } = await seedProgram();
      const [c1, c2] = courses;

      await request(app.getHttpServer())
        .put(`/courses/${c1.id}/prerequisites`)
        .set('Authorization', `Bearer ${token}`)
        .send({ prerequisites: [{ requiredCourseId: c2.id }] })
        .expect(422);
    });

    it('returns 422 when the prerequisite is in a later term level', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['course.update', 'course.read'],
        'later-level',
      );

      const { courses } = await seedProgram();
      const [c1, c3] = courses;

      await request(app.getHttpServer())
        .put(`/courses/${c1.id}/prerequisites`)
        .set('Authorization', `Bearer ${token}`)
        .send({ prerequisites: [{ requiredCourseId: c3.id }] })
        .expect(422);
    });

    it('returns 422 when prerequisites would create a cycle via legacy data', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['course.update', 'course.read'],
        'cycle',
      );

      const { courses } = await seedProgram();
      const [c1, c3] = courses;

      await prisma.coursePrerequisite.create({
        data: { courseId: c1.id, requiredCourseId: c3.id },
      });

      await request(app.getHttpServer())
        .put(`/courses/${c3.id}/prerequisites`)
        .set('Authorization', `Bearer ${token}`)
        .send({ prerequisites: [{ requiredCourseId: c1.id }] })
        .expect(422);
    });

    it('accepts a mixed entry with course and credits together', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['course.update', 'course.read'],
        'mixed',
      );

      const { courses } = await seedProgram();
      const [c1, c2] = courses;

      await request(app.getHttpServer())
        .put(`/courses/${c2.id}/prerequisites`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          prerequisites: [{ requiredCourseId: c1.id, requiredCredits: 20 }],
        })
        .expect(200);

      const prereqs = await prisma.coursePrerequisite.findMany({
        where: { courseId: c2.id },
      });

      expect(prereqs).toHaveLength(1);
      expect(prereqs[0].requiredCourseId).toBe(c1.id);
      expect(prereqs[0].requiredCredits).toBe(20);
    });

    it('deduplicates repeated prerequisite entries in the payload', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['course.update', 'course.read'],
        'dedupe',
      );

      const { courses } = await seedProgram();
      const [c1, c2] = courses;

      const response = await request(app.getHttpServer())
        .put(`/courses/${c2.id}/prerequisites`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          prerequisites: [
            { requiredCourseId: c1.id },
            { requiredCourseId: c1.id },
          ],
        })
        .expect(200);

      expect(response.body.data.prerequisiteCount).toBe(1);

      const prereqs = await prisma.coursePrerequisite.findMany({
        where: { courseId: c2.id },
      });

      expect(prereqs).toHaveLength(1);
      expect(prereqs[0].requiredCourseId).toBe(c1.id);
    });
  });

  describe('PATCH /courses/:courseId (term level invariants)', () => {
    it('returns 200 when moving a course with no dependencies', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['course.update', 'course.read'],
        'move-free',
      );

      const { courses } = await seedProgram();
      const [c1] = courses;

      const response = await request(app.getHttpServer())
        .patch(`/courses/${c1.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ termLevel: 3 })
        .expect(200);

      expect(response.body.data.termLevel).toBe(3);
    });

    it('returns 422 when moving a course before its own prerequisite', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['course.update', 'course.read'],
        'move-before-prereq',
      );

      const { courses } = await seedProgram();
      const [c1, c2] = courses;

      await prisma.coursePrerequisite.create({
        data: { courseId: c2.id, requiredCourseId: c1.id },
      });

      const response = await request(app.getHttpServer())
        .patch(`/courses/${c2.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ termLevel: 1 })
        .expect(422);

      expect(response.body.errorCode).toBe('ERR_COURSE_UPDATE_FAILED');
    });

    it('returns 422 when moving a course to a level equal to a dependent course', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['course.update', 'course.read'],
        'move-to-dependent',
      );

      const { courses } = await seedProgram();
      const [c1, c2] = courses;

      await prisma.coursePrerequisite.create({
        data: { courseId: c2.id, requiredCourseId: c1.id },
      });

      await request(app.getHttpServer())
        .patch(`/courses/${c1.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ termLevel: 2 })
        .expect(422);
    });

    it('returns 200 when moving a prerequisite while dependents remain later', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['course.update', 'course.read'],
        'move-prereq-valid',
      );

      const { courses } = await seedProgram();
      const [c1, , c3] = courses;

      await prisma.coursePrerequisite.create({
        data: { courseId: c3.id, requiredCourseId: c1.id },
      });

      const response = await request(app.getHttpServer())
        .patch(`/courses/${c1.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ termLevel: 2 })
        .expect(200);

      expect(response.body.data.termLevel).toBe(2);
    });

    it('returns 422 when renaming to a code already used in the program', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['course.update', 'course.read'],
        'patch-dup-code',
      );

      const { courses } = await seedProgram();
      const [c1, c2] = courses;

      const response = await request(app.getHttpServer())
        .patch(`/courses/${c2.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ code: c1.code })
        .expect(422);

      expect(response.body.errorCode).toBe('ERR_COURSE_UPDATE_FAILED');
    });

    it('returns 404 when the course does not exist', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['course.update', 'course.read'],
        'patch-404',
      );

      await request(app.getHttpServer())
        .patch('/courses/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Ghost' })
        .expect(404);
    });
  });

  describe('DELETE /courses/:courseId', () => {
    it('removes prerequisites of other courses that referenced it', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['course.delete', 'course.read'],
        'del-cascade',
      );

      const { courses } = await seedProgram();
      const [c1, c2] = courses;

      await prisma.coursePrerequisite.create({
        data: { courseId: c2.id, requiredCourseId: c1.id },
      });

      await request(app.getHttpServer())
        .delete(`/courses/${c1.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const leftovers = await prisma.coursePrerequisite.findMany({
        where: {
          OR: [{ courseId: c1.id }, { requiredCourseId: c1.id }],
        },
      });

      expect(leftovers).toHaveLength(0);
    });

    it('keeps existing sections when the course is soft-deleted', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['course.delete', 'course.read', 'section.create'],
        'del-keeps-sections',
      );

      const program = await prisma.program.create({
        data: {
          name: `Sec Prog ${tag()}`,
          termType: 'SEMESTER',
        },
      });
      const course = await prisma.course.create({
        data: {
          programId: program.id,
          code: `SEC-${tag()}`,
          name: 'Course With Sections',
          credits: 3,
          termLevel: 1,
        },
      });
      const term = await prisma.term.create({
        data: {
          programId: program.id,
          name: `Term ${tag()}`,
          startDate: new Date('2026-03-01'),
          endDate: new Date('2026-07-31'),
          status: 'ACTIVE',
        },
      });

      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync('pass', salt, 64).toString('hex');
      const teacherUser = await prisma.user.create({
        data: {
          email: `teacher-${tag()}@test.edu`,
          password: `${salt}:${hash}`,
          firstName: 'Prof',
          lastName: tag(),
          ci: `teacher-ci-${tag()}`,
        },
      });
      const teacherProfile = await prisma.adminProfile.create({
        data: { userId: teacherUser.id },
      });

      const section = await prisma.courseSection.create({
        data: {
          courseId: course.id,
          termId: term.id,
          teacherId: teacherProfile.id,
          name: 'Existing Section',
          capacity: 30,
        },
      });

      await request(app.getHttpServer())
        .delete(`/courses/${course.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const savedSection = await prisma.courseSection.findUnique({
        where: { id: section.id },
      });

      expect(savedSection).not.toBeNull();
      expect(savedSection?.deletedAt).toBeNull();
    });

    it('returns 404 when the course does not exist', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['course.delete', 'course.read'],
        'del-404',
      );

      await request(app.getHttpServer())
        .delete('/courses/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('POST /courses (program and code validation)', () => {
    it('creates a course in an active program', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['course.create', 'course.read'],
        'create-ok',
      );

      const program = await prisma.program.create({
        data: {
          name: `Pensum ${tag()}`,
          termType: 'SEMESTER',
        },
      });

      const response = await request(app.getHttpServer())
        .post('/courses')
        .set('Authorization', `Bearer ${token}`)
        .send({
          programId: program.id,
          code: `NEW-${tag()}`,
          name: 'Brand New Course',
          credits: 3,
          termLevel: 1,
        })
        .expect(201);

      expect(response.body.data.programId).toBe(program.id);
      expect(response.body.data.code).toMatch(/^NEW-/);
    });

    it('returns 404 instead of 500 when the program does not exist', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['course.create', 'course.read'],
        'create-no-prog',
      );

      const response = await request(app.getHttpServer())
        .post('/courses')
        .set('Authorization', `Bearer ${token}`)
        .send({
          programId: '00000000-0000-4000-8000-000000000000',
          code: 'GHOST101',
          name: 'Ghost Course',
          credits: 3,
          termLevel: 1,
        })
        .expect(404);

      expect(response.body.errorCode).toBe('ERR_PROGRAM_NOT_FOUND');
    });

    it('returns 404 when the program is soft-deleted', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['course.create', 'course.read'],
        'create-deleted-prog',
      );

      const program = await prisma.program.create({
        data: {
          name: `Doomed ${tag()}`,
          termType: 'SEMESTER',
        },
      });

      await prisma.program.update({
        where: { id: program.id },
        data: { deletedAt: new Date() },
      });

      await request(app.getHttpServer())
        .post('/courses')
        .set('Authorization', `Bearer ${token}`)
        .send({
          programId: program.id,
          code: 'GHOST102',
          name: 'Ghost Course',
          credits: 3,
          termLevel: 1,
        })
        .expect(404);
    });

    it('returns 422 when the code already exists in the program', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['course.create', 'course.read'],
        'create-dup-code',
      );

      const program = await prisma.program.create({
        data: {
          name: `Dup ${tag()}`,
          termType: 'SEMESTER',
        },
      });

      await prisma.course.create({
        data: {
          programId: program.id,
          code: 'DUP101',
          name: 'Original',
          credits: 3,
          termLevel: 1,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/courses')
        .set('Authorization', `Bearer ${token}`)
        .send({
          programId: program.id,
          code: 'DUP101',
          name: 'Duplicate',
          credits: 3,
          termLevel: 1,
        })
        .expect(422);

      expect(response.body.errorCode).toBe('ERR_COURSE_CREATION_FAILED');

      const count = await prisma.course.count({
        where: { programId: program.id, code: 'DUP101' },
      });
      expect(count).toBe(1);
    });

    it('allows the same code in a different program', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['course.create', 'course.read'],
        'create-same-code-other',
      );

      const programA = await prisma.program.create({
        data: {
          name: `Pensum A ${tag()}`,
          termType: 'SEMESTER',
        },
      });
      const programB = await prisma.program.create({
        data: {
          name: `Pensum B ${tag()}`,
          termType: 'SEMESTER',
        },
      });

      await prisma.course.create({
        data: {
          programId: programA.id,
          code: 'SHARED',
          name: 'Course A',
          credits: 3,
          termLevel: 1,
        },
      });

      await request(app.getHttpServer())
        .post('/courses')
        .set('Authorization', `Bearer ${token}`)
        .send({
          programId: programB.id,
          code: 'SHARED',
          name: 'Course B',
          credits: 3,
          termLevel: 1,
        })
        .expect(201);
    });
  });

  describe('GET /courses/by-program/:programId', () => {
    it('returns only courses from the specified program', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['course.read'],
        'byprog',
      );

      const engineering = await prisma.program.create({
        data: { name: 'Engineering', termType: 'SEMESTER' },
      });

      const medicine = await prisma.program.create({
        data: { name: 'Medicine', termType: 'SEMESTER' },
      });

      await prisma.course.create({
        data: {
          programId: engineering.id,
          code: 'MATH101',
          name: 'Calculus I',
          credits: 5,
          termLevel: 1,
        },
      });

      await prisma.course.create({
        data: {
          programId: engineering.id,
          code: 'PHY101',
          name: 'Physics I',
          credits: 4,
          termLevel: 1,
        },
      });

      await prisma.course.create({
        data: {
          programId: medicine.id,
          code: 'ANAT101',
          name: 'Anatomy',
          credits: 6,
          termLevel: 1,
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/courses/by-program/${engineering.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const data = response.body.data as Array<{ code: string }>;
      expect(data).toHaveLength(2);
      const codes = data.map((c: { code: string }) => c.code);
      expect(codes).toEqual(expect.arrayContaining(['MATH101', 'PHY101']));
      expect(codes).not.toContain('ANAT101');
    });
  });
});
