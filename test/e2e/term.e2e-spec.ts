import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { clearDatabase } from '../utils/prisma.test-utils';
import { randomBytes, scryptSync } from 'node:crypto';
import { ErrorCodes } from '@core/domain/error-codes';

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
    data: { name: `Term Role ${suffix}`, isEditable: true },
  });

  await prisma.rolePermission.createMany({
    data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
  });

  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync('operator_password', salt, 64).toString('hex');

  const user = await prisma.user.create({
    data: {
      email: `trm-op-${suffix}@test.edu`,
      password: `${salt}:${hash}`,
      firstName: 'Operator',
      lastName: suffix,
      ci: `trm-op-ci-${suffix}`,
    },
  });

  await prisma.userRole.create({
    data: { userId: user.id, roleId: role.id },
  });

  const loginRes = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email: `trm-op-${suffix}@test.edu`, password: 'operator_password' })
    .expect(200);

  return loginRes.body.data.accessToken as string;
}

describe('Terms', () => {
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

  describe('POST /terms', () => {
    it('creates a term with UPCOMING status by default', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['term.create'],
        'create-ok',
      );

      const response = await request(app.getHttpServer())
        .post('/terms')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Semester 2026-I',
          startDate: '2026-03-01',
          endDate: '2026-07-31',
        })
        .expect(201);

      expect(response.body.data).toMatchObject({
        name: 'Semester 2026-I',
        status: 'UPCOMING',
      });
    });

    it('rejects when endDate is before startDate', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['term.create'],
        'create-bad-dates',
      );

      const response = await request(app.getHttpServer())
        .post('/terms')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Bad Term',
          startDate: '2026-07-31',
          endDate: '2026-03-01',
        })
        .expect(422);

      expect(response.body).toMatchObject({
        statusCode: 422,
        errorCode: ErrorCodes.ERR_TERM_CREATION_FAILED,
        path: '/terms',
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    it('rejects requests without term.create permission', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['term.read'],
        'create-no-perm',
      );

      const response = await request(app.getHttpServer())
        .post('/terms')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Semester 2026-I',
          startDate: '2026-03-01',
          endDate: '2026-07-31',
        })
        .expect(403);

      expect(response.body).toMatchObject({
        statusCode: 403,
        errorCode: ErrorCodes.SEC_AUTH_INSUFFICIENT_PERMISSIONS,
        path: '/terms',
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /terms and GET /terms/:id', () => {
    it('filters terms by status query param', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['term.read'],
        'list-filter',
      );

      await prisma.term.create({
        data: {
          name: 'Upcoming Term',
          startDate: new Date('2026-09-01'),
          endDate: new Date('2026-12-31'),
          status: 'UPCOMING',
        },
      });

      await prisma.term.create({
        data: {
          name: 'Active Term',
          startDate: new Date('2026-03-01'),
          endDate: new Date('2026-07-31'),
          status: 'ACTIVE',
        },
      });

      const response = await request(app.getHttpServer())
        .get('/terms?status=ACTIVE')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Active Term');
    });

    it('returns 404 for non-existent term ID', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['term.read'],
        'get-notfound',
      );

      const response = await request(app.getHttpServer())
        .get('/terms/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        errorCode: ErrorCodes.ERR_TERM_NOT_FOUND,
        path: '/terms/00000000-0000-0000-0000-000000000000',
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    it('returns the active term via GET /terms/active', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['term.read'],
        'get-active',
      );

      await prisma.term.create({
        data: {
          name: 'Current Semester',
          startDate: new Date('2026-03-01'),
          endDate: new Date('2026-07-31'),
          status: 'ACTIVE',
        },
      });

      const response = await request(app.getHttpServer())
        .get('/terms/active')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        name: 'Current Semester',
        status: 'ACTIVE',
      });
    });
  });

  describe('PATCH /terms/:id', () => {
    it('updates term name when status is UPCOMING', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['term.update'],
        'patch-ok',
      );

      const term = await prisma.term.create({
        data: {
          name: 'Old Name',
          startDate: new Date('2026-03-01'),
          endDate: new Date('2026-07-31'),
          status: 'UPCOMING',
        },
      });

      const response = await request(app.getHttpServer())
        .patch(`/terms/${term.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Name' })
        .expect(200);

      expect(response.body.data.name).toBe('New Name');
    });

    it('rejects update when term is CLOSED', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['term.update'],
        'patch-closed',
      );

      const term = await prisma.term.create({
        data: {
          name: 'Closed Term',
          startDate: new Date('2025-03-01'),
          endDate: new Date('2025-07-31'),
          status: 'CLOSED',
        },
      });

      const response = await request(app.getHttpServer())
        .patch(`/terms/${term.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Should Not Work' })
        .expect(422);

      expect(response.body).toMatchObject({
        statusCode: 422,
        errorCode: ErrorCodes.ERR_TERM_UPDATE_FAILED,
        path: `/terms/${term.id}`,
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('PATCH /terms/:id/status', () => {
    it('transitions from UPCOMING to ACTIVE', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['term.close'],
        'status-activate',
      );

      const term = await prisma.term.create({
        data: {
          name: 'Spring 2026',
          startDate: new Date('2026-03-01'),
          endDate: new Date('2026-07-31'),
          status: 'UPCOMING',
        },
      });

      const response = await request(app.getHttpServer())
        .patch(`/terms/${term.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'ACTIVE' })
        .expect(200);

      expect(response.body.data.status).toBe('ACTIVE');
    });

    it('rejects skipping from UPCOMING directly to CLOSED', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['term.close'],
        'status-skip',
      );

      const term = await prisma.term.create({
        data: {
          name: 'Spring 2026',
          startDate: new Date('2026-03-01'),
          endDate: new Date('2026-07-31'),
          status: 'UPCOMING',
        },
      });

      const response = await request(app.getHttpServer())
        .patch(`/terms/${term.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'CLOSED' })
        .expect(422);

      expect(response.body).toMatchObject({
        statusCode: 422,
        errorCode: ErrorCodes.ERR_TERM_CLOSE_FAILED,
        path: `/terms/${term.id}/status`,
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    it('rejects activating a second term while another is ACTIVE', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['term.close'],
        'status-conflict',
      );

      await prisma.term.create({
        data: {
          name: 'Active Spring',
          startDate: new Date('2026-03-01'),
          endDate: new Date('2026-07-31'),
          status: 'ACTIVE',
        },
      });

      const second = await prisma.term.create({
        data: {
          name: 'Summer 2026',
          startDate: new Date('2026-08-01'),
          endDate: new Date('2026-12-31'),
          status: 'UPCOMING',
        },
      });

      const response = await request(app.getHttpServer())
        .patch(`/terms/${second.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'ACTIVE' })
        .expect(409);

      expect(response.body).toMatchObject({
        statusCode: 409,
        errorCode: ErrorCodes.ERR_TERM_ALREADY_ACTIVE,
        path: `/terms/${second.id}/status`,
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('DELETE /terms/:id', () => {
    it('soft-deletes an upcoming term', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['term.delete'],
        'delete-ok',
      );

      const term = await prisma.term.create({
        data: {
          name: 'To Delete',
          startDate: new Date('2026-09-01'),
          endDate: new Date('2026-12-31'),
          status: 'UPCOMING',
        },
      });

      await request(app.getHttpServer())
        .delete(`/terms/${term.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const deleted = await prisma.term.findUnique({ where: { id: term.id } });
      expect(deleted?.deletedAt).not.toBeNull();
    });

    it('blocks deletion when term has sections', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['term.delete'],
        'delete-blocked',
      );

      const term = await prisma.term.create({
        data: {
          name: 'Protected',
          startDate: new Date('2026-09-01'),
          endDate: new Date('2026-12-31'),
          status: 'UPCOMING',
        },
      });

      const program = await prisma.program.create({
        data: { name: 'Engineering', termType: 'SEMESTER', totalCredits: 200 },
      });

      const course = await prisma.course.create({
        data: {
          programId: program.id,
          code: 'CS101',
          name: 'Intro',
          credits: 4,
          termLevel: 1,
        },
      });

      const teacher = await prisma.user.create({
        data: {
          email: 'section-teacher@test.edu',
          password: 'na',
          firstName: 'Teacher',
          lastName: 'One',
          ci: 'sct-ci',
        },
      });

      await prisma.courseSection.create({
        data: {
          courseId: course.id,
          termId: term.id,
          teacherId: teacher.id,
          name: 'Section A',
          capacity: 30,
        },
      });

      const response = await request(app.getHttpServer())
        .delete(`/terms/${term.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(422);

      expect(response.body).toMatchObject({
        statusCode: 422,
        errorCode: ErrorCodes.ERR_TERM_DELETE_FAILED,
        path: `/terms/${term.id}`,
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});
