import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { clearDatabase } from '../utils/prisma.test-utils';
import { randomBytes, scryptSync } from 'node:crypto';
import { ErrorCodes } from '@core/domain/error-codes';

describe('Institution', () => {
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

  describe('GET /institution', () => {
    it('returns institution data without authentication', async () => {
      await prisma.institution.create({
        data: {
          name: 'Test University',
          contactEmail: 'contact@test.edu',
        },
      });

      const response = await request(app.getHttpServer())
        .get('/institution')
        .expect(200);

      expect(response.body.data).toMatchObject({
        name: 'Test University',
        contactEmail: 'contact@test.edu',
      });
    });
  });

  describe('PATCH /institution', () => {
    it('updates the institution name when authenticated as super admin', async () => {
      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync('test_password', salt, 64).toString('hex');

      await prisma.superAdmin.create({
        data: {
          email: 'admin@test.edu',
          password: `${salt}:${hash}`,
          mustChangePassword: false,
        },
      });

      await prisma.institution.create({
        data: {
          name: 'Original University',
          contactEmail: 'original@test.edu',
        },
      });

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@test.edu', password: 'test_password' })
        .expect(200);

      const token: string = loginResponse.body.data.accessToken;

      const response = await request(app.getHttpServer())
        .patch('/institution')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated University' })
        .expect(200);

      expect(response.body.data.name).toBe('Updated University');
    });

    it('returns 401 when no token is provided', async () => {
      const response = await request(app.getHttpServer())
        .patch('/institution')
        .send({ name: 'Hacked University' })
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        errorCode: ErrorCodes.SEC_AUTH_TOKEN_MISSING,
        path: '/institution',
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    it('returns 403 when a regular user tries to update', async () => {
      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync('user_password', salt, 64).toString('hex');

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
        .send({ email: 'user@test.edu', password: 'user_password' })
        .expect(200);

      const token: string = loginResponse.body.data.accessToken;

      const response = await request(app.getHttpServer())
        .patch('/institution')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Hacked University' })
        .expect(403);

      expect(response.body).toMatchObject({
        statusCode: 403,
        errorCode: ErrorCodes.SEC_AUTH_SUPER_ADMIN_REQUIRED,
        path: '/institution',
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});
