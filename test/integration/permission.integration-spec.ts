import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { RedisService } from '@core/infrastructure/cache/redis.service';
import { PERMISSION_REPOSITORY } from '@modules/permission/domain/permission.repository';
import { PrismaServiceMock } from '../utils/mocks/prisma.mock';
import { RedisServiceMock } from '../utils/mocks/redis.mock';

describe('Permission (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const permissionMock = {
      findAll: jest.fn().mockResolvedValue([
        {
          id: 'p1',
          code: 'system.admin',
          module: 'system',
          description: 'System admin',
        },
        {
          id: 'p2',
          code: 'course.create',
          module: 'course',
          description: 'Create courses',
        },
      ]),
      findByCodes: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(new PrismaServiceMock())
      .overrideProvider(RedisService)
      .useValue(new RedisServiceMock())
      .overrideProvider(PERMISSION_REPOSITORY)
      .useValue(permissionMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /permissions', () => {
    it('returns 200 with permission catalog (public)', async () => {
      const response = await request(app.getHttpServer())
        .get('/permissions')
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].code).toBe('system.admin');
      expect(response.body.data[1].code).toBe('course.create');
    });
  });
});
