import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { RedisService } from '@core/infrastructure/cache/redis.service';
import { PROGRAM_REPOSITORY } from '@modules/program/domain/program.repository';
import { PrismaServiceMock } from '../utils/mocks/prisma.mock';
import { RedisServiceMock } from '../utils/mocks/redis.mock';
import { buildProgram } from '../utils/factories/program.factory';
import { ErrorCodes } from '@core/domain/error-codes';

describe('Program (e2e)', () => {
  let app: INestApplication;
  let prismaMock: PrismaServiceMock;
  let redisMock: RedisServiceMock;
  let programRepoMock: {
    create: jest.Mock;
    findAll: jest.Mock;
    findById: jest.Mock;
    update: jest.Mock;
    softDelete: jest.Mock;
    getPensum: jest.Mock;
  };
  let jwtService: JwtService;
  let adminToken: string;
  beforeAll(async () => {
    prismaMock = new PrismaServiceMock();
    redisMock = new RedisServiceMock();
    programRepoMock = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      getPensum: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(RedisService)
      .useValue(redisMock)
      .overrideProvider(PROGRAM_REPOSITORY)
      .useValue(programRepoMock)
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
    adminToken = jwtService.sign({
      sub: 'admin-id',
      email: 'admin@escala.app',
      roleType: 'SUPER_ADMIN',
    });
    void jwtService.sign({
      sub: 'user-id',
      email: 'user@test.com',
      roleType: 'USER',
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();

    prismaMock.adminRole.findMany.mockResolvedValue([
      {
        role: {
          permissions: [
            { permission: { code: 'program.create' } },
            { permission: { code: 'program.read' } },
            { permission: { code: 'program.update' } },
            { permission: { code: 'program.delete' } },
          ],
        },
      },
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /programs', () => {
    const url = '/programs';

    it('returns 201 when creating a program', async () => {
      programRepoMock.create.mockResolvedValue(
        buildProgram(
          { name: 'Engineering', termType: 'SEMESTER', totalCredits: 160 },
          'prog-1',
        ),
      );

      const response = await request(app.getHttpServer())
        .post(url)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Engineering', termType: 'SEMESTER', totalCredits: 160 })
        .expect(201);

      expect(response.body.data.id).toBe('prog-1');
      expect(response.body.data.name).toBe('Engineering');
    });

    it('returns 401 without token', async () => {
      const response = await request(app.getHttpServer())
        .post(url)
        .send({ name: 'Engineering', termType: 'SEMESTER', totalCredits: 160 })
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        errorCode: ErrorCodes.SEC_AUTH_TOKEN_MISSING,
        path: url,
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /programs', () => {
    it('returns 200 with program list', async () => {
      programRepoMock.findAll.mockResolvedValue([
        buildProgram({ name: 'Engineering' }, 'prog-1'),
      ]);

      const response = await request(app.getHttpServer())
        .get('/programs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Engineering');
    });
  });

  describe('GET /programs/:programId', () => {
    it('returns 200 with program details', async () => {
      programRepoMock.findById.mockResolvedValue(
        buildProgram({ name: 'Engineering' }, 'prog-1'),
      );

      const response = await request(app.getHttpServer())
        .get('/programs/prog-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.name).toBe('Engineering');
    });

    it('returns 404 when not found', async () => {
      programRepoMock.findById.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get('/programs/nope')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        errorCode: ErrorCodes.ERR_PROGRAM_NOT_FOUND,
        path: '/programs/nope',
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('PATCH /programs/:programId', () => {
    it('returns 200 when updating', async () => {
      const existing = buildProgram({ name: 'Old' }, 'prog-1');
      programRepoMock.findById.mockResolvedValue(existing);
      programRepoMock.update.mockResolvedValue(
        buildProgram({ name: 'Updated' }, 'prog-1'),
      );

      const response = await request(app.getHttpServer())
        .patch('/programs/prog-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated' })
        .expect(200);

      expect(response.body.data.name).toBe('Updated');
    });

    it('returns 422 when not found', async () => {
      programRepoMock.findById.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .patch('/programs/nope')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated' })
        .expect(422);

      expect(response.body).toMatchObject({
        statusCode: 422,
        errorCode: ErrorCodes.ERR_PROGRAM_UPDATE_FAILED,
        path: '/programs/nope',
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('DELETE /programs/:programId', () => {
    it('returns 200 when deleting', async () => {
      programRepoMock.findById.mockResolvedValue(buildProgram({}, 'prog-1'));

      await request(app.getHttpServer())
        .delete('/programs/prog-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect(
          (res: {
            body: { data?: { deletedId?: string; message?: string } };
          }) => {
            expect(res.body.data).toMatchObject({
              deletedId: 'prog-1',
              message: 'Program deleted successfully',
            });
          },
        );
    });

    it('returns 404 when not found', async () => {
      programRepoMock.findById.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .delete('/programs/nope')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        errorCode: ErrorCodes.ERR_PROGRAM_NOT_FOUND,
        path: '/programs/nope',
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /programs/:programId/pensum', () => {
    it('returns 200 with pensum data', async () => {
      programRepoMock.getPensum.mockResolvedValue({
        id: 'prog-1',
        name: 'Engineering',
        termType: 'SEMESTER',
        totalCredits: 160,
        updatedAt: new Date('2026-07-24T12:00:00Z'),
        courses: [
          {
            id: 'c1',
            code: 'CS101',
            name: 'Intro',
            credits: 4,
            termLevel: 1,
            prerequisites: [],
          },
          {
            id: 'c2',
            code: 'CS201',
            name: 'Advanced',
            credits: 5,
            termLevel: 2,
            prerequisites: [{ requiredCourseId: 'c1', requiredCredits: null }],
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .get('/programs/prog-1/pensum')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.id).toBe('prog-1');
      expect(response.body.data.courses).toHaveLength(2);
      expect(response.body.data.updatedAt).toBe('2026-07-24T12:00:00.000Z');
    });

    it('returns 404 when program not found', async () => {
      programRepoMock.getPensum.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get('/programs/nope/pensum')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        errorCode: ErrorCodes.ERR_PROGRAM_NOT_FOUND,
        path: '/programs/nope/pensum',
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    it('returns 401 without token', async () => {
      const response = await request(app.getHttpServer())
        .get('/programs/prog-1/pensum')
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        errorCode: ErrorCodes.SEC_AUTH_TOKEN_MISSING,
        path: '/programs/prog-1/pensum',
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});
