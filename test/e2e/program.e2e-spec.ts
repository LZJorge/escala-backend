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
      email: `prog-op-${suffix}@test.edu`,
      password: `${salt}:${hash}`,
      firstName: 'Operator',
      lastName: suffix,
      ci: `prog-op-ci-${suffix}`,
    },
  });

  await prisma.userRole.create({
    data: { userId: user.id, roleId: role.id },
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
          totalCredits: 120,
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
        totalCredits: 120,
      });

      const courses = response.body.data.courses as Array<{
        code: string;
        credits: number;
        termLevel: number;
        prerequisites: Array<{
          requiredCourseId: string;
          requiredCredits: number | null;
        }>;
      }>;

      expect(courses).toHaveLength(2);

      const cs101 = courses.find((c) => c.code === 'CS101');
      expect(cs101).toMatchObject({ credits: 4, termLevel: 1 });
      expect(cs101!.prerequisites).toEqual([]);

      const cs201 = courses.find((c) => c.code === 'CS201');
      expect(cs201).toMatchObject({ credits: 4, termLevel: 2 });
      expect(cs201!.prerequisites).toEqual([
        { requiredCourseId: courseA.id, requiredCredits: null },
      ]);
    });
  });

  describe('DELETE /programs/:id', () => {
    it('soft-deletes the program and preserves associated courses', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['program.delete'],
        'deleter',
      );

      const program = await prisma.program.create({
        data: { name: 'To Delete', termType: 'SEMESTER', totalCredits: 60 },
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
