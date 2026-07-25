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
        data: { code, module: code.split('.')[0]!, description: code },
      }),
    ),
  );

  const role = await prisma.role.create({
    data: { name: `Test Role ${suffix}`, isEditable: true },
  });

  await prisma.rolePermission.createMany({
    data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
  });

  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync('operator_password', salt, 64).toString('hex');

  const user = await prisma.user.create({
    data: {
      email: `operator-${suffix}@test.edu`,
      password: `${salt}:${hash}`,
      firstName: 'Operator',
      lastName: suffix,
      ci: `operator-ci-${suffix}`,
    },
  });

  await prisma.userRole.create({
    data: { userId: user.id, roleId: role.id },
  });

  const loginResponse = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email: `operator-${suffix}@test.edu`, password: 'operator_password' })
    .expect(200);

  return loginResponse.body.data.accessToken as string;
}

describe('Users', () => {
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

  describe('GET /users/me', () => {
    it('returns limited data for super admin', async () => {
      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync('test_password', salt, 64).toString('hex');

      await prisma.superAdmin.create({
        data: {
          email: 'admin@test.edu',
          password: `${salt}:${hash}`,
        },
      });

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@test.edu', password: 'test_password' })
        .expect(200);

      const token: string = loginResponse.body.data.accessToken;

      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        email: 'admin@test.edu',
        type: 'SUPER_ADMIN',
      });
      expect(response.body.data.permissions).toEqual(['*']);
      expect(response.body.data.firstName).toBeUndefined();
    });

    it('returns full profile for a regular user', async () => {
      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync('user_password', salt, 64).toString('hex');

      await prisma.user.create({
        data: {
          email: 'user@test.edu',
          password: `${salt}:${hash}`,
          firstName: 'Regular',
          lastName: 'User',
          ci: 'user-ci',
        },
      });

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'user@test.edu', password: 'user_password' })
        .expect(200);

      const token: string = loginResponse.body.data.accessToken;

      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        email: 'user@test.edu',
        firstName: 'Regular',
        lastName: 'User',
        type: 'USER',
      });
      expect(response.body.data.roles).toEqual([]);
      expect(response.body.data.permissions).toEqual([]);
    });
  });

  describe('POST /users', () => {
    it('creates a user when authenticated with user.create permission', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['user.create'],
        'creator',
      );

      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'newuser@test.edu',
          password: 'new_password',
          firstName: 'New',
          lastName: 'User',
          ci: 'new-ci',
        })
        .expect(201);

      expect(response.body.data).toMatchObject({
        email: 'newuser@test.edu',
        firstName: 'New',
        lastName: 'User',
      });
      expect(response.body.data.id).toBeDefined();

      const saved = await prisma.user.findUnique({
        where: { email: 'newuser@test.edu' },
      });
      expect(saved).not.toBeNull();
      expect(saved!.password).toContain(':');
      expect(saved!.firstName).toBe('New');
    });

    it('returns 403 without user.create permission', async () => {
      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync('user_password', salt, 64).toString('hex');

      await prisma.user.create({
        data: {
          email: 'noperm@test.edu',
          password: `${salt}:${hash}`,
          firstName: 'No',
          lastName: 'Perm',
          ci: 'noperm-ci',
        },
      });

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'noperm@test.edu', password: 'user_password' })
        .expect(200);

      const token: string = loginResponse.body.data.accessToken;

      await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'shouldfail@test.edu',
          password: 'test',
          firstName: 'Should',
          lastName: 'Fail',
          ci: 'fail-ci',
        })
        .expect(403);
    });
  });

  describe('POST /users/:userId/roles', () => {
    it('assigns a role to a user', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['role.assign'],
        'assigner',
      );

      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync('target_password', salt, 64).toString('hex');

      const targetUser = await prisma.user.create({
        data: {
          email: 'target@test.edu',
          password: `${salt}:${hash}`,
          firstName: 'Target',
          lastName: 'User',
          ci: 'target-ci',
        },
      });

      const targetRole = await prisma.role.create({
        data: { name: 'Target Role', isEditable: true },
      });

      await request(app.getHttpServer())
        .post(`/users/${targetUser.id}/roles`)
        .set('Authorization', `Bearer ${token}`)
        .send({ roleId: targetRole.id })
        .expect(201);

      const userRole = await prisma.userRole.findUnique({
        where: {
          userId_roleId: {
            userId: targetUser.id,
            roleId: targetRole.id,
          },
        },
      });
      expect(userRole).not.toBeNull();
    });
  });

  describe('Duplicate prevention', () => {
    it('returns 422 when creating a user with an existing email', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['user.create'],
        'dup-email-operator',
      );

      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync('existing_password', salt, 64).toString('hex');

      await prisma.user.create({
        data: {
          email: 'existing@test.edu',
          password: `${salt}:${hash}`,
          firstName: 'Existing',
          lastName: 'User',
          ci: 'existing-ci',
        },
      });

      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'existing@test.edu',
          password: 'new_password',
          firstName: 'Duplicate',
          lastName: 'Email',
          ci: 'different-ci',
        })
        .expect(422);

      expect(response.body.error.message).toContain('Email already in use');
    });

    it('returns 422 when creating a user with an existing CI', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['user.create'],
        'dup-ci-operator',
      );

      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync('existing_password', salt, 64).toString('hex');

      await prisma.user.create({
        data: {
          email: 'existing@test.edu',
          password: `${salt}:${hash}`,
          firstName: 'Existing',
          lastName: 'User',
          ci: 'dup-ci',
        },
      });

      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'different@test.edu',
          password: 'new_password',
          firstName: 'Duplicate',
          lastName: 'CI',
          ci: 'dup-ci',
        })
        .expect(422);

      expect(response.body.error.message).toContain('CI already in use');
    });
  });
});
