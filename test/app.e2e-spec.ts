import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { RedisService } from '@core/infrastructure/cache/redis.service';
import { PrismaServiceMock } from './utils/mocks/prisma.mock';
import { RedisServiceMock } from './utils/mocks/redis.mock';

describe('App (smoke)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(new PrismaServiceMock())
      .overrideProvider(RedisService)
      .useValue(new RedisServiceMock())
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('boots without error', () => {
    expect(app).toBeDefined();
  });

  it('responds with envelope error on unknown route', async () => {
    const response = await request(app.getHttpServer())
      .get('/unknown-route')
      .expect(404);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toHaveProperty('code', 'NOT_FOUND');
  });
});
