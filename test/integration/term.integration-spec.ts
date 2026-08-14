import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { RedisService } from '@core/infrastructure/cache/redis.service';
import { TERM_REPOSITORY } from '@modules/term/domain/term.repository';
import { Term } from '@modules/term/domain/term.entity';
import { TermStatus } from '@prisma/client';
import { PrismaServiceMock } from '../utils/mocks/prisma.mock';
import { RedisServiceMock } from '../utils/mocks/redis.mock';

function buildTerm(
  overrides: Partial<{
    programId: string;
    name: string;
    startDate: Date;
    endDate: Date;
    status: TermStatus;
  }> = {},
  id?: string,
): Term {
  return new Term(
    {
      programId: 'prog-1',
      name: 'Semester 2026-I',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-07-31'),
      status: TermStatus.UPCOMING,
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

    redisMock.get.mockResolvedValue(null);

    prismaMock.adminRole.findMany.mockResolvedValue([
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
        buildTerm(
          {
            name: 'Semester 2026-I',
            programId: '3f2c1b4a-0000-4000-8000-000000000000',
          },
          'term-1',
        ),
      );

      const response = await request(app.getHttpServer())
        .post(url)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          programId: '3f2c1b4a-0000-4000-8000-000000000000',
          name: 'Semester 2026-I',
          startDate: '2026-03-01',
          endDate: '2026-07-31',
        })
        .expect(201);

      expect(response.body.data.id).toBe('term-1');
      expect(response.body.data.status).toBe('UPCOMING');
      expect(response.body.data.programId).toBe(
        '3f2c1b4a-0000-4000-8000-000000000000',
      );
      expect(redisMock.delete).toHaveBeenCalledWith('escala:term:term-1');
      expect(redisMock.delete).toHaveBeenCalledWith(
        'escala:terms:list:UPCOMING:3f2c1b4a-0000-4000-8000-000000000000',
      );
      expect(redisMock.delete).toHaveBeenCalledWith('escala:terms:list:*:*');
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
        buildTerm({ name: 'Spring', status: TermStatus.ACTIVE }, 'term-1'),
      ]);

      const response = await request(app.getHttpServer())
        .get('/terms?status=ACTIVE')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Spring');
      expect(redisMock.set).toHaveBeenCalledWith(
        'escala:terms:list:ACTIVE:*',
        expect.any(Array),
        1800,
      );
    });

    it('returns the cached list without hitting the repository', async () => {
      redisMock.get.mockResolvedValue([
        {
          id: 'term-1',
          programId: 'prog-1',
          name: 'Spring',
          startDate: '2026-03-01T00:00:00.000Z',
          endDate: '2026-07-31T00:00:00.000Z',
          status: 'ACTIVE',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/terms')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(termRepoMock.findAll).not.toHaveBeenCalled();
      expect(redisMock.set).not.toHaveBeenCalled();
    });
  });

  describe('GET /terms/active', () => {
    it('returns 200 with the active term', async () => {
      termRepoMock.findActive.mockResolvedValue(
        buildTerm({ name: 'Current', status: TermStatus.ACTIVE }, 'term-1'),
      );

      const response = await request(app.getHttpServer())
        .get('/terms/active')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.name).toBe('Current');
      expect(response.body.data.status).toBe('ACTIVE');
      expect(redisMock.set).toHaveBeenCalledWith(
        'escala:terms:active:*',
        expect.objectContaining({ name: 'Current' }),
        1800,
      );
    });

    it('returns the cached active term without hitting the repository', async () => {
      redisMock.get.mockResolvedValue({
        id: 'term-1',
        programId: 'prog-1',
        name: 'Current',
        startDate: '2026-03-01T00:00:00.000Z',
        endDate: '2026-07-31T00:00:00.000Z',
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });

      const response = await request(app.getHttpServer())
        .get('/terms/active')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.name).toBe('Current');
      expect(termRepoMock.findActive).not.toHaveBeenCalled();
    });

    it('caches the active term per programId', async () => {
      termRepoMock.findActive.mockResolvedValue(
        buildTerm({ name: 'Current', status: TermStatus.ACTIVE }, 'term-1'),
      );

      await request(app.getHttpServer())
        .get('/terms/active?programId=prog-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(redisMock.set).toHaveBeenCalledWith(
        'escala:terms:active:prog-1',
        expect.any(Object),
        1800,
      );
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
      expect(redisMock.set).toHaveBeenCalledWith(
        'escala:term:term-1',
        expect.objectContaining({ name: 'Spring' }),
        1800,
      );
    });

    it('returns the cached term without hitting the repository', async () => {
      redisMock.get.mockResolvedValue({
        id: 'term-1',
        programId: 'prog-1',
        name: 'Spring',
        startDate: '2026-03-01T00:00:00.000Z',
        endDate: '2026-07-31T00:00:00.000Z',
        status: 'UPCOMING',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });

      const response = await request(app.getHttpServer())
        .get('/terms/term-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.name).toBe('Spring');
      expect(termRepoMock.findById).not.toHaveBeenCalled();
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
      expect(redisMock.delete).toHaveBeenCalledWith('escala:term:term-1');
      expect(redisMock.delete).toHaveBeenCalledWith(
        'escala:terms:list:UPCOMING:prog-1',
      );
      expect(redisMock.delete).toHaveBeenCalledWith(
        'escala:terms:list:*:prog-1',
      );
      expect(redisMock.delete).toHaveBeenCalledWith('escala:terms:active:*');
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
        buildTerm({ name: 'Old', status: TermStatus.CLOSED }, 'term-1'),
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
      const existing = buildTerm({ status: TermStatus.UPCOMING }, 'term-1');
      termRepoMock.findById.mockResolvedValue(existing);
      termRepoMock.findActive.mockResolvedValue(null);
      termRepoMock.update.mockResolvedValue(
        buildTerm({ status: TermStatus.ACTIVE }, 'term-1'),
      );

      const response = await request(app.getHttpServer())
        .patch('/terms/term-1/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: TermStatus.ACTIVE })
        .expect(200);

      expect(response.body.data.status).toBe('ACTIVE');
      expect(redisMock.delete).toHaveBeenCalledWith('escala:term:term-1');
      expect(redisMock.delete).toHaveBeenCalledWith(
        'escala:terms:active:prog-1',
      );
      expect(redisMock.delete).toHaveBeenCalledWith(
        'escala:terms:list:UPCOMING:prog-1',
      );
      expect(redisMock.delete).toHaveBeenCalledWith(
        'escala:terms:list:ACTIVE:prog-1',
      );
      expect(redisMock.delete).toHaveBeenCalledWith('escala:terms:list:*:*');
    });

    it('returns 422 when skipping from UPCOMING to CLOSED', async () => {
      termRepoMock.findById.mockResolvedValue(
        buildTerm({ status: TermStatus.UPCOMING }, 'term-1'),
      );

      await request(app.getHttpServer())
        .patch('/terms/term-1/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: TermStatus.CLOSED })
        .expect(422);
    });

    it('returns 409 when another term is already ACTIVE', async () => {
      termRepoMock.findById.mockResolvedValue(
        buildTerm({ status: TermStatus.UPCOMING }, 'term-2'),
      );
      termRepoMock.findActive.mockResolvedValue(
        buildTerm(
          { name: 'Active Spring', status: TermStatus.ACTIVE },
          'term-1',
        ),
      );

      await request(app.getHttpServer())
        .patch('/terms/term-2/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: TermStatus.ACTIVE })
        .expect(409);
    });
  });

  describe('DELETE /terms/:id', () => {
    it('returns 200 when deleting an UPCOMING term', async () => {
      termRepoMock.findById.mockResolvedValue(
        buildTerm({ status: TermStatus.UPCOMING }, 'term-1'),
      );
      termRepoMock.countSections.mockResolvedValue(0);

      await request(app.getHttpServer())
        .delete('/terms/term-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect(
          (res: {
            body: { data?: { deletedId?: string; message?: string } };
          }) => {
            expect(res.body.data).toMatchObject({
              deletedId: 'term-1',
              message: 'Term deleted successfully',
            });
          },
        );

      expect(redisMock.delete).toHaveBeenCalledWith('escala:term:term-1');
      expect(redisMock.delete).toHaveBeenCalledWith(
        'escala:terms:list:UPCOMING:prog-1',
      );
      expect(redisMock.delete).toHaveBeenCalledWith('escala:terms:active:*');
    });

    it('returns 422 when term has sections', async () => {
      termRepoMock.findById.mockResolvedValue(
        buildTerm({ status: TermStatus.UPCOMING }, 'term-1'),
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
