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
    permissionCodes.map((code) =>
      prisma.permission.create({
        data: { code, module: code.split('.')[0], description: code },
      }),
    ),
  );

  const role = await prisma.role.create({
    data: { name: `Operator Role ${suffix}`, isEditable: true },
  });

  await prisma.rolePermission.createMany({
    data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
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

  await prisma.userRole.create({
    data: { userId: user.id, roleId: role.id },
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

  describe('PUT /courses/:courseId/prerequisites', () => {
    it('replaces old prereqs and stores a requiredCourseId', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['course.update'],
        'prereq',
      );

      const program = await prisma.program.create({
        data: { name: 'Engineering', termType: 'SEMESTER', totalCredits: 200 },
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
        ['course.update'],
        'credits',
      );

      const program = await prisma.program.create({
        data: { name: 'Engineering', termType: 'SEMESTER', totalCredits: 200 },
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
        data: { name: 'Engineering', termType: 'SEMESTER', totalCredits: 200 },
      });

      const medicine = await prisma.program.create({
        data: { name: 'Medicine', termType: 'SEMESTER', totalCredits: 300 },
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

      expect(response.body.data).toHaveLength(2);
      const codes: string[] = response.body.data.map(
        (c: { code: string }) => c.code,
      );
      expect(codes).toEqual(expect.arrayContaining(['MATH101', 'PHY101']));
      expect(codes).not.toContain('ANAT101');
    });
  });
});
