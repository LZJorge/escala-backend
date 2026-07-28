import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { RedisService } from '@core/infrastructure/cache/redis.service';
import { TERM_REPOSITORY } from '@modules/term/domain/term.repository';
import { Term } from '@modules/term/domain/term.entity';
import { PrismaServiceMock } from '../utils/mocks/prisma.mock';
import { RedisServiceMock } from '../utils/mocks/redis.mock';

function buildTerm(
  overrides: Partial<{
    name: string;
    startDate: Date;
    endDate: Date;
    status: string;
  }> = {},
  id?: string,
): Term {
  return new Term(
    {
      name: 'Semester 2026-I',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-07-31'),
      status: 'UPCOMING',
      ...overrides,
    },
    id,
  );
}

describe('Term (e2e)', () => {
  let app: INestApplication;
  let prismaMock: PrismaServiceMock;
  let redisMock: RedisServiceMock;
  let termRepoMock: {
    create: jest.Mock;
    findAll: jest.Mock;
    findById: jest.Mock;
    findActive: jest.Mock;
    update: jest.Mock;
    softDelete: jest.Mock;
    countSections: jest.Mock;
  };
  let jwtService: JwtService;
  let adminToken: string;

  beforeAll(async () => {
    prismaMock = new PrismaServiceMock();
    redisMock = new RedisServiceMock();
    termRepoMock = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findActive: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      countSections: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(RedisService)
      .useValue(redisMock)
      .overrideProvider(TERM_REPOSITORY)
      .useValue(termRepoMock)
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
  });

  beforeEach(() => {
    jest.clearAllMocks();

    prismaMock.userRole.findMany.mockResolvedValue([
      {
        role: {
          permissions: [
            { permission: { code: 'term.create' } },
            { permission: { code: 'term.read' } },
            { permission: { code: 'term.update' } },
            { permission: { code: 'term.close' } },
            { permission: { code: 'term.delete' } },
          ],
        },
      },
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /terms', () => {
    const url = '/terms';

    it('returns 201 when creating a term', async () => {
      termRepoMock.create.mockResolvedValue(
        buildTerm({ name: 'Semester 2026-I' }, 'term-1'),
      );

      const response = await request(app.getHttpServer())
        .post(url)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Semester 2026-I',
          startDate: '2026-03-01',
          endDate: '2026-07-31',
        })
        .expect(201);

      expect(response.body.data.id).toBe('term-1');
      expect(response.body.data.status).toBe('UPCOMING');
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer())
        .post(url)
        .send({
          name: 'Semester 2026-I',
          startDate: '2026-03-01',
          endDate: '2026-07-31',
        })
        .expect(401);
    });
  });

  describe('GET /terms', () => {
    it('returns 200 with term list', async () => {
      termRepoMock.findAll.mockResolvedValue([
        buildTerm({ name: 'Spring', status: 'ACTIVE' }, 'term-1'),
      ]);

      const response = await request(app.getHttpServer())
        .get('/terms?status=ACTIVE')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Spring');
    });
  });

  describe('GET /terms/active', () => {
    it('returns 200 with the active term', async () => {
      termRepoMock.findActive.mockResolvedValue(
        buildTerm({ name: 'Current', status: 'ACTIVE' }, 'term-1'),
      );

      const response = await request(app.getHttpServer())
        .get('/terms/active')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.name).toBe('Current');
      expect(response.body.data.status).toBe('ACTIVE');
    });

    it('returns 200 with null when no term is active', async () => {
      termRepoMock.findActive.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get('/terms/active')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toBeNull();
    });
  });

  describe('GET /terms/:id', () => {
    it('returns 200 with term details', async () => {
      termRepoMock.findById.mockResolvedValue(
        buildTerm({ name: 'Spring' }, 'term-1'),
      );

      const response = await request(app.getHttpServer())
        .get('/terms/term-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.name).toBe('Spring');
    });

    it('returns 404 when not found', async () => {
      termRepoMock.findById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/terms/nope')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('PATCH /terms/:id', () => {
    it('returns 200 when updating', async () => {
      const existing = buildTerm({ name: 'Old' }, 'term-1');
      termRepoMock.findById.mockResolvedValue(existing);
      termRepoMock.update.mockResolvedValue(
        buildTerm({ name: 'Updated' }, 'term-1'),
      );

      const response = await request(app.getHttpServer())
        .patch('/terms/term-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated' })
        .expect(200);

      expect(response.body.data.name).toBe('Updated');
    });

    it('returns 404 when not found', async () => {
      termRepoMock.findById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .patch('/terms/nope')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated' })
        .expect(404);
    });

    it('returns 422 when term is CLOSED', async () => {
      termRepoMock.findById.mockResolvedValue(
        buildTerm({ name: 'Old', status: 'CLOSED' }, 'term-1'),
      );

      await request(app.getHttpServer())
        .patch('/terms/term-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Should Fail' })
        .expect(422);
    });
  });

  describe('PATCH /terms/:id/status', () => {
    it('returns 200 transitioning from UPCOMING to ACTIVE', async () => {
      const existing = buildTerm({ status: 'UPCOMING' }, 'term-1');
      termRepoMock.findById.mockResolvedValue(existing);
      termRepoMock.findActive.mockResolvedValue(null);
      termRepoMock.update.mockResolvedValue(
        buildTerm({ status: 'ACTIVE' }, 'term-1'),
      );

      const response = await request(app.getHttpServer())
        .patch('/terms/term-1/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ACTIVE' })
        .expect(200);

      expect(response.body.data.status).toBe('ACTIVE');
    });

    it('returns 422 when skipping from UPCOMING to CLOSED', async () => {
      termRepoMock.findById.mockResolvedValue(
        buildTerm({ status: 'UPCOMING' }, 'term-1'),
      );

      await request(app.getHttpServer())
        .patch('/terms/term-1/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CLOSED' })
        .expect(422);
    });

    it('returns 409 when another term is already ACTIVE', async () => {
      termRepoMock.findById.mockResolvedValue(
        buildTerm({ status: 'UPCOMING' }, 'term-2'),
      );
      termRepoMock.findActive.mockResolvedValue(
        buildTerm({ name: 'Active Spring', status: 'ACTIVE' }, 'term-1'),
      );

      await request(app.getHttpServer())
        .patch('/terms/term-2/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ACTIVE' })
        .expect(409);
    });
  });

  describe('DELETE /terms/:id', () => {
    it('returns 200 when deleting an UPCOMING term', async () => {
      termRepoMock.findById.mockResolvedValue(
        buildTerm({ status: 'UPCOMING' }, 'term-1'),
      );
      termRepoMock.countSections.mockResolvedValue(0);

      await request(app.getHttpServer())
        .delete('/terms/term-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('returns 422 when term has sections', async () => {
      termRepoMock.findById.mockResolvedValue(
        buildTerm({ status: 'UPCOMING' }, 'term-1'),
      );
      termRepoMock.countSections.mockResolvedValue(3);

      await request(app.getHttpServer())
        .delete('/terms/term-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(422);
    });

    it('returns 404 when not found', async () => {
      termRepoMock.findById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .delete('/terms/nope')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });
});
