import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { RedisService } from '@core/infrastructure/cache/redis.service';
import { AUTH_REPOSITORY } from '@modules/auth/domain/auth.repository';
import { PrismaServiceMock } from '../utils/mocks/prisma.mock';
import { RedisServiceMock } from '../utils/mocks/redis.mock';
import { ErrorCodes } from '@core/domain/error-codes';

const VALID_SALT = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const VALID_PASSWORD = 'password123';
const VALID_HASH =
  '3122d1dd0646fdad8330dbe454bcef4366840dd47b6fca5b8bd16ade0e69b46120b9fa7283d933c4218d1cdca8dfdda66e1040570fbd0ce0e9d9e5e748746dbe';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prismaMock: PrismaServiceMock;
  let redisMock: RedisServiceMock;
  let authRepositoryMock: {
    findByEmail: jest.Mock;
    findSuperAdminByEmail: jest.Mock;
  };

  beforeAll(async () => {
    prismaMock = new PrismaServiceMock();
    redisMock = new RedisServiceMock();
    authRepositoryMock = {
      findByEmail: jest.fn(),
      findSuperAdminByEmail: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(RedisService)
      .useValue(redisMock)
      .overrideProvider(AUTH_REPOSITORY)
      .useValue(authRepositoryMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/login', () => {
    const loginUrl = '/auth/login';

    it('returns 200 with JWT for valid super admin credentials', async () => {
      authRepositoryMock.findSuperAdminByEmail.mockResolvedValue({
        id: 'super-admin-id',
        email: 'admin@escala.app',
        password: `${VALID_SALT}:${VALID_HASH}`,
      });
      authRepositoryMock.findByEmail.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .post(loginUrl)
        .send({ email: 'admin@escala.app', password: VALID_PASSWORD })
        .expect(200);

      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data.user.roleType).toBe('SUPER_ADMIN');
    });

    it('returns 200 with JWT for valid regular user credentials', async () => {
      authRepositoryMock.findSuperAdminByEmail.mockResolvedValue(null);
      authRepositoryMock.findByEmail.mockResolvedValue({
        id: 'user-id',
        email: 'user@institution.edu',
        password: `${VALID_SALT}:${VALID_HASH}`,
        firstName: 'Regular',
        lastName: 'User',
        ci: '11111111',
        phone: null,
      });

      const response = await request(app.getHttpServer())
        .post(loginUrl)
        .send({ email: 'user@institution.edu', password: VALID_PASSWORD })
        .expect(200);

      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data.user.roleType).toBe('USER');
    });

    it('returns 401 when email does not exist', async () => {
      authRepositoryMock.findSuperAdminByEmail.mockResolvedValue(null);
      authRepositoryMock.findByEmail.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .post(loginUrl)
        .send({ email: 'nonexistent@test.com', password: VALID_PASSWORD })
        .expect(401);

      expect(response.body).toMatchObject({
        errorCode: ErrorCodes.SEC_AUTH_INVALID_CREDENTIALS,
        statusCode: 401,
      });
      expect(response.body.message).toContain('Invalid email or password');
    });

    it('returns 401 when password is incorrect', async () => {
      authRepositoryMock.findSuperAdminByEmail.mockResolvedValue({
        id: 'super-admin-id',
        email: 'admin@escala.app',
        password: `${VALID_SALT}:${VALID_HASH}`,
      });

      const response = await request(app.getHttpServer())
        .post(loginUrl)
        .send({ email: 'admin@escala.app', password: 'wrong-password' })
        .expect(401);

      expect(response.body).toMatchObject({
        errorCode: ErrorCodes.SEC_AUTH_INVALID_CREDENTIALS,
        statusCode: 401,
      });
      expect(response.body.message).toContain('Invalid email or password');
    });

    it('returns 400 when email is empty', async () => {
      const response = await request(app.getHttpServer())
        .post(loginUrl)
        .send({ email: '', password: VALID_PASSWORD })
        .expect(400);

      expect(response.body).toMatchObject({
        errorCode: ErrorCodes.ERR_VALIDATION_FAILED,
        statusCode: 400,
      });
      expect(response.body.details).toBeDefined();
      expect(Array.isArray(response.body.details)).toBe(true);
    });
  });
});
