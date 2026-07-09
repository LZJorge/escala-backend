import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { RedisService } from '@core/infrastructure/cache/redis.service';
import { USER_REPOSITORY } from '@modules/user/domain/user.repository';
import { PrismaServiceMock } from '../utils/mocks/prisma.mock';
import { RedisServiceMock } from '../utils/mocks/redis.mock';
import { buildUser } from '../utils/factories/user.factory';

describe('User (e2e)', () => {
  let app: INestApplication;
  let prismaMock: PrismaServiceMock;
  let redisMock: RedisServiceMock;
  let userRepositoryMock: { findById: jest.Mock; update: jest.Mock };
  let jwtService: JwtService;
  let validToken: string;

  beforeAll(async () => {
    prismaMock = new PrismaServiceMock();
    redisMock = new RedisServiceMock();
    userRepositoryMock = {
      findById: jest.fn(),
      update: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(RedisService)
      .useValue(redisMock)
      .overrideProvider(USER_REPOSITORY)
      .useValue(userRepositoryMock)
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

    jwtService = app.get(JwtService);
    validToken = jwtService.sign({
      sub: 'test-user-id',
      email: 'user@example.com',
      isSuperAdmin: false,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /users/me', () => {
    it('returns 200 with the user profile', async () => {
      const user = buildUser({ email: 'user@example.com' });
      userRepositoryMock.findById.mockResolvedValue(user);

      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'test-user-id',
        email: 'user@example.com',
        firstName: 'Test',
        lastName: 'User',
        ci: '12345678',
      });
    });

    it('returns 404 when user is not found', async () => {
      userRepositoryMock.findById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);
    });

    it('returns 401 when no token is provided', async () => {
      await request(app.getHttpServer()).get('/users/me').expect(401);
    });

    it('returns 401 when token is expired', async () => {
      const expiredToken = jwtService.sign(
        { sub: 'user', email: 'user@test.com', isSuperAdmin: false },
        { expiresIn: '0s' },
      );

      await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });

  describe('PATCH /users/me', () => {
    it('returns 200 with the updated profile', async () => {
      const user = buildUser({ phone: null });
      userRepositoryMock.findById.mockResolvedValue(user);
      userRepositoryMock.update.mockResolvedValue(undefined);

      const response = await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ phone: '+584141234567' })
        .expect(200);

      expect(response.body.phone).toBe('+584141234567');
    });

    it('returns 422 when user is not found for update', async () => {
      userRepositoryMock.findById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ firstName: 'New' })
        .expect(422);
    });
  });
});
