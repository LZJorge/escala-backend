import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { RedisService } from '@core/infrastructure/cache/redis.service';
import { AUTH_REPOSITORY } from '@modules/auth/domain/auth.repository';
import { PrismaServiceMock } from '../utils/mocks/prisma.mock';
import { RedisServiceMock } from '../utils/mocks/redis.mock';

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
    findInstitutionById: jest.Mock;
  };

  beforeAll(async () => {
    prismaMock = new PrismaServiceMock();
    redisMock = new RedisServiceMock();
    authRepositoryMock = {
      findByEmail: jest.fn(),
      findInstitutionById: jest.fn(),
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

    it('returns 200 with JWT for valid global credentials (super admin, no institutionId)', async () => {
      const userRecord = {
        id: 'super-admin-id',
        email: 'admin@escala.app',
        passwordHash: `${VALID_SALT}:${VALID_HASH}`,
        firstName: 'Super',
        lastName: 'Admin',
        ci: '00000000',
        phone: null,
        isSuperAdmin: true,
        institutionId: null,
      };
      authRepositoryMock.findByEmail.mockResolvedValue(userRecord);
      authRepositoryMock.findInstitutionById.mockResolvedValue(null);
      prismaMock.institutionUser.findFirst.mockResolvedValue(null);
      redisMock.pipeline.mockReturnValue({
        set: jest.fn(),
        del: jest.fn(),
        sadd: jest.fn(),
        expire: jest.fn(),
        exec: jest.fn().mockResolvedValue([]),
      });

      const response = await request(app.getHttpServer())
        .post(loginUrl)
        .send({ email: 'admin@escala.app', password: VALID_PASSWORD })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user).toBeDefined();
      expect(response.body.user.id).toBe('super-admin-id');
      expect(response.body.user.isSuperAdmin).toBe(true);
      expect(response.body.institution).toBeNull();
    });

    it('returns 200 with JWT for valid institution user', async () => {
      const userRecord = {
        id: 'inst-user-id',
        email: 'user@institution.edu',
        passwordHash: `${VALID_SALT}:${VALID_HASH}`,
        firstName: 'Inst',
        lastName: 'User',
        ci: '11111111',
        phone: null,
        isSuperAdmin: false,
        institutionId: 'inst-1',
      };
      const institutionMembership = {
        id: 'inst-1',
        institutionId: 'inst-1',
        institutionName: 'Test University',
        institutionType: 'UNIVERSITY',
        institutionUserId: 'iu-1',
      };
      authRepositoryMock.findByEmail.mockResolvedValue(userRecord);
      authRepositoryMock.findInstitutionById.mockResolvedValue(
        institutionMembership,
      );
      prismaMock.institutionUser.findFirst.mockResolvedValue({
        id: 'iu-1',
        userId: 'inst-user-id',
        institutionId: 'inst-1',
        isActive: true,
        roles: [],
      });
      redisMock.pipeline.mockReturnValue({
        set: jest.fn(),
        del: jest.fn(),
        sadd: jest.fn(),
        expire: jest.fn(),
        exec: jest.fn().mockResolvedValue([]),
      });

      const response = await request(app.getHttpServer())
        .post(loginUrl)
        .send({
          email: 'user@institution.edu',
          password: VALID_PASSWORD,
          institutionId: 'inst-1',
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user.isSuperAdmin).toBe(false);
      expect(response.body.institution).not.toBeNull();
      expect(response.body.institution.institutionId).toBe('inst-1');
    });

    it('returns 401 when email does not exist', async () => {
      authRepositoryMock.findByEmail.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .post(loginUrl)
        .send({ email: 'nonexistent@test.com', password: VALID_PASSWORD })
        .expect(401);

      expect(response.body.message).toContain('Invalid email or password');
    });

    it('returns 401 when password is incorrect', async () => {
      // return a valid user but send wrong password
      const userRecord = {
        id: 'user-id',
        email: 'user@test.com',
        passwordHash: `${VALID_SALT}:${VALID_HASH}`,
        firstName: 'Test',
        lastName: 'User',
        ci: '12345678',
        phone: null,
        isSuperAdmin: false,
        institutionId: 'inst-1',
      };
      authRepositoryMock.findByEmail.mockResolvedValue(userRecord);

      const response = await request(app.getHttpServer())
        .post(loginUrl)
        .send({
          email: 'user@test.com',
          password: 'wrong-password',
          institutionId: 'inst-1',
        })
        .expect(401);

      expect(response.body.message).toContain('Invalid email or password');
    });

    it('returns 401 when institution user does not provide institutionId', async () => {
      const userRecord = {
        id: 'user-id',
        email: 'user@inst.edu',
        passwordHash: `${VALID_SALT}:${VALID_HASH}`,
        firstName: 'Inst',
        lastName: 'User',
        ci: '22222222',
        phone: null,
        isSuperAdmin: false,
        institutionId: 'inst-1',
      };
      authRepositoryMock.findByEmail.mockResolvedValue(userRecord);

      // No institutionId in request, but user is not super admin
      await request(app.getHttpServer())
        .post(loginUrl)
        .send({ email: 'user@inst.edu', password: VALID_PASSWORD })
        .expect(401);
    });
  });
});
