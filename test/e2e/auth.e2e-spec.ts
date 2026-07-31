import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { clearDatabase } from '../utils/prisma.test-utils';
import { randomBytes, scryptSync } from 'node:crypto';
import { ErrorCodes } from '@core/domain/error-codes';

describe('Auth', () => {
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

  describe('POST /auth/login', () => {
    it('returns a JWT for valid super admin credentials', async () => {
      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync('test_password', salt, 64).toString('hex');

      await prisma.superAdmin.create({
        data: {
          email: 'admin@test.edu',
          password: `${salt}:${hash}`,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@test.edu', password: 'test_password' })
        .expect(200);

      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.user).toMatchObject({
        email: 'admin@test.edu',
        roleType: 'SUPER_ADMIN',
        mustChangePassword: true,
      });
    });

    it('returns a JWT for valid normal user credentials', async () => {
      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync('user_password', salt, 64).toString('hex');

      await prisma.user.create({
        data: {
          email: 'user@test.edu',
          password: `${salt}:${hash}`,
          firstName: 'Normal',
          lastName: 'User',
          ci: '12345678',
        },
      });

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'user@test.edu', password: 'user_password' })
        .expect(200);

      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.user).toMatchObject({
        email: 'user@test.edu',
        roleType: 'USER',
      });
    });

    it('returns 401 for a wrong password', async () => {
      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync('correct_password', salt, 64).toString('hex');

      await prisma.superAdmin.create({
        data: {
          email: 'admin@test.edu',
          password: `${salt}:${hash}`,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@test.edu', password: 'wrong_password' })
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        errorCode: ErrorCodes.SEC_AUTH_INVALID_CREDENTIALS,
        path: '/auth/login',
      });
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('message');
    });

    it('returns 401 for a non-existent email', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'ghost@test.edu', password: 'anything' })
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        errorCode: ErrorCodes.SEC_AUTH_INVALID_CREDENTIALS,
        path: '/auth/login',
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    it('returns 400 for empty credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: '', password: '' })
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        errorCode: ErrorCodes.ERR_VALIDATION_FAILED,
        path: '/auth/login',
      });
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('details');
    });

    it('returns 400 when email field is missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ password: 'test' })
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        errorCode: ErrorCodes.ERR_VALIDATION_FAILED,
        path: '/auth/login',
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    it('returns 400 when email has wrong type', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 123, password: 'test' })
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        errorCode: ErrorCodes.ERR_VALIDATION_FAILED,
        path: '/auth/login',
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('SuperAdmin password change flow', () => {
    const hashPassword = (password: string): string => {
      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync(password, salt, 64).toString('hex');
      return `${salt}:${hash}`;
    };

    const seedSuperAdmin = async (
      password: string,
      mustChangePassword: boolean,
    ): Promise<void> => {
      await prisma.superAdmin.create({
        data: {
          email: 'admin@test.edu',
          password: hashPassword(password),
          mustChangePassword,
        },
      });
    };

    const seedInstitution = async (): Promise<void> => {
      await prisma.institution.create({
        data: {
          name: 'Test University',
          contactEmail: 'contact@test.edu',
        },
      });
    };

    const login = async (password: string): Promise<string> => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@test.edu', password })
        .expect(200);
      return response.body.data.accessToken as string;
    };

    describe('when mustChangePassword is true', () => {
      it('login returns the flag in the user payload', async () => {
        await seedSuperAdmin('OldPass123!', true);

        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'admin@test.edu', password: 'OldPass123!' })
          .expect(200);

        expect(response.body.data.user.mustChangePassword).toBe(true);
      });

      it('blocks access to protected endpoints', async () => {
        await seedSuperAdmin('OldPass123!', true);
        await seedInstitution();
        const token = await login('OldPass123!');

        const response = await request(app.getHttpServer())
          .patch('/institution')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'Hacked University' })
          .expect(422);

        expect(response.body).toMatchObject({
          statusCode: 422,
          errorCode: ErrorCodes.SEC_AUTH_PASSWORD_CHANGE_REQUIRED,
        });
      });

      it('blocks any authenticated endpoint, not only super-admin guarded ones', async () => {
        await seedSuperAdmin('OldPass123!', true);
        const token = await login('OldPass123!');

        const response = await request(app.getHttpServer())
          .get('/users/me')
          .set('Authorization', `Bearer ${token}`)
          .expect(422);

        expect(response.body).toMatchObject({
          statusCode: 422,
          errorCode: ErrorCodes.SEC_AUTH_PASSWORD_CHANGE_REQUIRED,
        });
      });

      it('allows only the change-password endpoint', async () => {
        await seedSuperAdmin('OldPass123!', true);
        await seedInstitution();
        const token = await login('OldPass123!');

        const response = await request(app.getHttpServer())
          .post('/auth/change-superadmin-password')
          .set('Authorization', `Bearer ${token}`)
          .send({ newPassword: 'NewPass456!' })
          .expect(200);

        expect(response.body.data.user.mustChangePassword).toBe(false);
        expect(response.body.data.accessToken).toBeDefined();
      });

      it('rotates the password: old one stops working, new one works', async () => {
        await seedSuperAdmin('OldPass123!', true);
        await seedInstitution();
        const token = await login('OldPass123!');

        await request(app.getHttpServer())
          .post('/auth/change-superadmin-password')
          .set('Authorization', `Bearer ${token}`)
          .send({ newPassword: 'NewPass456!' })
          .expect(200);

        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'admin@test.edu', password: 'OldPass123!' })
          .expect(401);

        const newLogin = await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'admin@test.edu', password: 'NewPass456!' })
          .expect(200);

        expect(newLogin.body.data.user.mustChangePassword).toBe(false);
      });

      it('the old token stays blocked after the password change', async () => {
        await seedSuperAdmin('OldPass123!', true);
        await seedInstitution();
        const oldToken = await login('OldPass123!');

        await request(app.getHttpServer())
          .post('/auth/change-superadmin-password')
          .set('Authorization', `Bearer ${oldToken}`)
          .send({ newPassword: 'NewPass456!' })
          .expect(200);

        const response = await request(app.getHttpServer())
          .patch('/institution')
          .set('Authorization', `Bearer ${oldToken}`)
          .send({ name: 'Hacked University' })
          .expect(422);

        expect(response.body).toMatchObject({
          statusCode: 422,
          errorCode: ErrorCodes.SEC_AUTH_PASSWORD_CHANGE_REQUIRED,
        });
      });

      it('a regular user token cannot use the change-password endpoint', async () => {
        const salt = randomBytes(16).toString('hex');
        const hash = scryptSync('UserPass123!', salt, 64).toString('hex');

        await prisma.user.create({
          data: {
            email: 'user@test.edu',
            password: `${salt}:${hash}`,
            firstName: 'Regular',
            lastName: 'User',
            ci: '87654321',
          },
        });

        const loginResponse = await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'user@test.edu', password: 'UserPass123!' })
          .expect(200);

        const token: string = loginResponse.body.data.accessToken;

        const response = await request(app.getHttpServer())
          .post('/auth/change-superadmin-password')
          .set('Authorization', `Bearer ${token}`)
          .send({ newPassword: 'NewPass456!' })
          .expect(403);

        expect(response.body).toMatchObject({
          statusCode: 403,
          errorCode: ErrorCodes.SEC_AUTH_SUPER_ADMIN_REQUIRED,
        });
      });

      it('rejects a weak new password', async () => {
        await seedSuperAdmin('OldPass123!', true);
        const token = await login('OldPass123!');

        const response = await request(app.getHttpServer())
          .post('/auth/change-superadmin-password')
          .set('Authorization', `Bearer ${token}`)
          .send({ newPassword: 'weak' })
          .expect(400);

        expect(response.body).toMatchObject({
          statusCode: 400,
          errorCode: ErrorCodes.ERR_VALIDATION_FAILED,
        });
        expect(response.body.details).toBeDefined();
      });
    });

    describe('when mustChangePassword is false', () => {
      it('login returns the flag as false', async () => {
        await seedSuperAdmin('AlreadyChanged1!', false);

        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'admin@test.edu', password: 'AlreadyChanged1!' })
          .expect(200);

        expect(response.body.data.user.mustChangePassword).toBe(false);
      });

      it('allows access to protected endpoints', async () => {
        await seedSuperAdmin('AlreadyChanged1!', false);
        await seedInstitution();
        const token = await login('AlreadyChanged1!');

        const response = await request(app.getHttpServer())
          .patch('/institution')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'Updated University' })
          .expect(200);

        expect(response.body.data.name).toBe('Updated University');
      });
    });
  });
});
