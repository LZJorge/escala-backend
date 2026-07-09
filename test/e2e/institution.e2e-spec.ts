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
    findById: jest.Mock;
    findMany: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let jwtService: JwtService;
  let superAdminToken: string;
  let regularUserToken: string;

  beforeAll(async () => {
    prismaMock = new PrismaServiceMock();
    redisMock = new RedisServiceMock();
    institutionRepositoryMock = {
      findById: jest.fn(),
      findMany: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
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
      isSuperAdmin: true,
    });
    regularUserToken = jwtService.sign({
      sub: 'regular-user',
      email: 'user@test.com',
      isSuperAdmin: false,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /institutions', () => {
    const createUrl = '/institutions';
    const validPayload = {
      name: 'New University',
      institutionType: 'UNIVERSITY',
      contactEmail: 'contact@new.edu',
      masterAdmin: {
        email: 'admin@new.edu',
        password: 'securePass123',
        firstName: 'Master',
        lastName: 'Admin',
        ci: '87654321',
      },
    };

    it('returns 201 when super admin creates an institution', async () => {
      prismaMock.institution.findUnique.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .post(createUrl)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(validPayload)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('New University');
    });

    it('returns 403 when a regular user tries to create', async () => {
      await request(app.getHttpServer())
        .post(createUrl)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send(validPayload)
        .expect(403);
    });

    it('returns 400 when payload is invalid', async () => {
      await request(app.getHttpServer())
        .post(createUrl)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ name: '' })
        .expect(400);
    });
  });

  describe('GET /institutions', () => {
    it('returns 200 with institution list (public)', async () => {
      const inst1 = buildInstitution(
        { name: 'Uni A', slug: 'uni-a' },
        'inst-a',
      );
      const inst2 = buildInstitution(
        { name: 'Uni B', slug: 'uni-b' },
        'inst-b',
      );
      institutionRepositoryMock.findMany.mockResolvedValue([inst1, inst2]);

      const response = await request(app.getHttpServer())
        .get('/institutions')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toBe('Uni A');
      expect(response.body[1].name).toBe('Uni B');
    });
  });

  describe('GET /institutions/:id', () => {
    it('returns 200 with institution details', async () => {
      const inst = buildInstitution(
        { name: 'Detail Uni', slug: 'detail-uni' },
        'inst-detail',
      );
      institutionRepositoryMock.findById.mockResolvedValue(inst);

      const response = await request(app.getHttpServer())
        .get('/institutions/inst-detail')
        .expect(200);

      expect(response.body.id).toBe('inst-detail');
      expect(response.body.name).toBe('Detail Uni');
    });

    it('returns 404 when institution not found', async () => {
      institutionRepositoryMock.findById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/institutions/non-existent')
        .expect(404);
    });
  });

  describe('POST /institutions/:institutionId/users', () => {
    const validUser = {
      email: 'newuser@inst.edu',
      password: 'securePass123',
      firstName: 'New',
      lastName: 'User',
      ci: '99999999',
    };

    it('returns 201 when master admin creates a user', async () => {
      const masterToken = jwtService.sign({
        sub: 'master-admin-id',
        email: 'master@inst.edu',
        isSuperAdmin: false,
      });

      // MasterAdminGuard: must find a master membership
      prismaMock.institutionUser.findFirst.mockResolvedValue({
        id: 'iu-master',
        userId: 'master-admin-id',
        institutionId: 'inst-id',
        isActive: true,
      });

      // Email uniqueness check passes
      prismaMock.user.findFirst.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/institutions/inst-id/users')
        .set('Authorization', `Bearer ${masterToken}`)
        .send(validUser)
        .expect(201);
    });

    it('returns 403 when a user from another institution tries to create', async () => {
      const otherToken = jwtService.sign({
        sub: 'other-admin',
        email: 'other@inst.edu',
        isSuperAdmin: false,
      });

      // MasterAdminGuard: no membership → ForbiddenException
      prismaMock.institutionUser.findFirst.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/institutions/other-inst/users')
        .set('Authorization', `Bearer ${otherToken}`)
        .send(validUser)
        .expect(403);
    });
  });
});
