import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { clearDatabase } from '../utils/prisma.test-utils';

describe('Permissions', () => {
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

  describe('GET /permissions', () => {
    it('returns all permissions in an envelope', async () => {
      await prisma.permission.createMany({
        data: [
          {
            code: 'course.read',
            module: 'course',
            description: 'View courses',
          },
          {
            code: 'course.create',
            module: 'course',
            description: 'Create courses',
          },
          { code: 'user.read', module: 'user', description: 'View users' },
        ],
      });

      const response = await request(app.getHttpServer())
        .get('/permissions')
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'course.read', module: 'course' }),
          expect.objectContaining({ code: 'course.create', module: 'course' }),
          expect.objectContaining({ code: 'user.read', module: 'user' }),
        ]),
      );
    });

    it('returns an empty array when no permissions exist', async () => {
      const response = await request(app.getHttpServer())
        .get('/permissions')
        .expect(200);

      expect(response.body.data).toEqual([]);
    });

    it('does not require authentication', async () => {
      const response = await request(app.getHttpServer())
        .get('/permissions')
        .expect(200);

      expect(response.body.data).toBeDefined();
    });
  });
});
