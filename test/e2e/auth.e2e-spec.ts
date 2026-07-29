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
});
