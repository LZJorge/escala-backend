import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { RedisService } from '@core/infrastructure/cache/redis.service';
import { INSTITUTION_REPOSITORY } from '@modules/institution/domain/institution.repository';
import { PrismaServiceMock } from '../utils/mocks/prisma.mock';
import { RedisServiceMock } from '../utils/mocks/redis.mock';
import { buildInstitution } from '../utils/factories/institution.factory';

describe('Institution (e2e)', () => {
  let app: INestApplication;
  let prismaMock: PrismaServiceMock;
  let redisMock: RedisServiceMock;
  let institutionRepositoryMock: {
    find: jest.Mock;
    update: jest.Mock;
  };
  let jwtService: JwtService;
  let superAdminToken: string;
  let regularUserToken: string;

  beforeAll(async () => {
    prismaMock = new PrismaServiceMock();
    redisMock = new RedisServiceMock();
    institutionRepositoryMock = {
      find: jest.fn(),
      update: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(RedisService)
      .useValue(redisMock)
      .overrideProvider(INSTITUTION_REPOSITORY)
      .useValue(institutionRepositoryMock)
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
    superAdminToken = jwtService.sign({
      sub: 'super-admin-id',
      email: 'admin@escala.app',
      roleType: 'SUPER_ADMIN',
    });
    regularUserToken = jwtService.sign({
      sub: 'regular-user',
      email: 'user@test.com',
      roleType: 'USER',
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /institution', () => {
    it('returns 200 with institution details (public)', async () => {
      const inst = buildInstitution({ name: 'Test University' }, 'inst-1');
      institutionRepositoryMock.find.mockResolvedValue(inst);

      const response = await request(app.getHttpServer())
        .get('/institution')
        .expect(200);

      expect(response.body.data.id).toBe('inst-1');
      expect(response.body.data.name).toBe('Test University');
    });

    it('returns 404 when institution not found', async () => {
      institutionRepositoryMock.find.mockResolvedValue(null);

      await request(app.getHttpServer()).get('/institution').expect(404);
    });
  });

  describe('PATCH /institution', () => {
    it('returns 200 when super admin updates institution', async () => {
      const inst = buildInstitution({ name: 'Old Name' }, 'inst-1');
      institutionRepositoryMock.find.mockResolvedValue(inst);
      institutionRepositoryMock.update.mockResolvedValue(undefined);

      const response = await request(app.getHttpServer())
        .patch('/institution')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ name: 'New Name' })
        .expect(200);

      expect(response.body.data.name).toBe('New Name');
    });

    it('returns 403 when a regular user tries to update', async () => {
      await request(app.getHttpServer())
        .patch('/institution')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ name: 'Hacked Name' })
        .expect(403);
    });

    it('returns 401 when no token is provided', async () => {
      await request(app.getHttpServer())
        .patch('/institution')
        .send({ name: 'Hacked Name' })
        .expect(401);
    });
  });
});
