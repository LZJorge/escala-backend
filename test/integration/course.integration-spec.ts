import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { RedisService } from '@core/infrastructure/cache/redis.service';
import { COURSE_REPOSITORY } from '@modules/course/domain/course.repository';
import { PrismaServiceMock } from '../utils/mocks/prisma.mock';
import { RedisServiceMock } from '../utils/mocks/redis.mock';
import { buildCourse } from '../utils/factories/course.factory';

const PROG_UUID = '550e8400-e29b-41d4-a716-446655440000';
const COURSE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const COURSE2_UUID = '550e8400-e29b-41d4-a716-446655440002';

describe('Course (e2e)', () => {
  let app: INestApplication;
  let prismaMock: PrismaServiceMock;
  let redisMock: RedisServiceMock;
  let courseRepoMock: {
    create: jest.Mock;
    findAllByProgram: jest.Mock;
    findById: jest.Mock;
    update: jest.Mock;
    softDelete: jest.Mock;
    getPrerequisites: jest.Mock;
    getPrerequisitesForCourses: jest.Mock;
    setPrerequisites: jest.Mock;
  };
  let jwtService: JwtService;
  let adminToken: string;

  beforeAll(async () => {
    prismaMock = new PrismaServiceMock();
    redisMock = new RedisServiceMock();
    courseRepoMock = {
      create: jest.fn(),
      findAllByProgram: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      getPrerequisites: jest.fn(),
      getPrerequisitesForCourses: jest.fn(),
      setPrerequisites: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(RedisService)
      .useValue(redisMock)
      .overrideProvider(COURSE_REPOSITORY)
      .useValue(courseRepoMock)
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

    prismaMock.adminRole.findMany.mockResolvedValue([
      {
        role: {
          permissions: [
            { permission: { code: 'course.create' } },
            { permission: { code: 'course.read' } },
            { permission: { code: 'course.update' } },
            { permission: { code: 'course.delete' } },
          ],
        },
      },
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /courses', () => {
    const url = '/courses';

    it('returns 201 when creating a course', async () => {
      courseRepoMock.create.mockResolvedValue(
        buildCourse(
          {
            programId: PROG_UUID,
            code: 'CS101',
            name: 'Intro',
            credits: 4,
            termLevel: 1,
          },
          COURSE_UUID,
        ),
      );

      const response = await request(app.getHttpServer())
        .post(url)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          programId: PROG_UUID,
          code: 'CS101',
          name: 'Intro',
          credits: 4,
          termLevel: 1,
        })
        .expect(201);
      expect(response.body.data.id).toBe(COURSE_UUID);
      expect(response.body.data.code).toBe('CS101');
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer())
        .post(url)
        .send({
          programId: PROG_UUID,
          code: 'CS101',
          name: 'Intro',
          credits: 4,
          termLevel: 1,
        })
        .expect(401);
    });
  });

  describe('GET /courses/by-program/:programId', () => {
    it('returns 200 with course list', async () => {
      courseRepoMock.findAllByProgram.mockResolvedValue([
        buildCourse(
          { code: 'CS101', name: 'Intro', termLevel: 1 },
          COURSE_UUID,
        ),
        buildCourse(
          { code: 'CS201', name: 'Advanced', termLevel: 2 },
          COURSE2_UUID,
        ),
      ]);
      courseRepoMock.getPrerequisitesForCourses.mockResolvedValue([
        {
          courseId: COURSE2_UUID,
          requiredCourseId: COURSE_UUID,
          requiredCredits: null,
        },
      ]);

      const response = await request(app.getHttpServer())
        .get(`/courses/by-program/${PROG_UUID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].prerequisites).toEqual([]);
      expect(response.body.data[1].prerequisites).toEqual([
        {
          courseId: COURSE2_UUID,
          requiredCourseId: COURSE_UUID,
          requiredCredits: null,
        },
      ]);
    });
  });

  describe('GET /courses/:courseId', () => {
    it('returns 200 with course details', async () => {
      courseRepoMock.findById.mockResolvedValue(
        buildCourse({ code: 'CS101' }, COURSE_UUID),
      );
      courseRepoMock.getPrerequisites.mockResolvedValue([]);

      const response = await request(app.getHttpServer())
        .get(`/courses/${COURSE_UUID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.code).toBe('CS101');
    });

    it('returns 404 when not found', async () => {
      courseRepoMock.findById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/courses/550e8400-e29b-41d4-a716-44665544ffff')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('PATCH /courses/:courseId', () => {
    it('returns 200 when updating', async () => {
      const existing = buildCourse({ name: 'Old' }, COURSE_UUID);
      courseRepoMock.findById.mockResolvedValue(existing);
      courseRepoMock.update.mockResolvedValue(
        buildCourse({ name: 'Updated' }, COURSE_UUID),
      );
      courseRepoMock.getPrerequisites.mockResolvedValue([]);

      const response = await request(app.getHttpServer())
        .patch(`/courses/${COURSE_UUID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated' })
        .expect(200);

      expect(response.body.data.name).toBe('Updated');
    });

    it('returns 422 when not found', async () => {
      courseRepoMock.findById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .patch(`/courses/${COURSE_UUID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated' })
        .expect(422);
    });
  });

  describe('DELETE /courses/:courseId', () => {
    it('returns 200 when deleting', async () => {
      courseRepoMock.findById.mockResolvedValue(buildCourse({}, COURSE_UUID));

      await request(app.getHttpServer())
        .delete(`/courses/${COURSE_UUID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('returns 404 when not found', async () => {
      courseRepoMock.findById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .delete(`/courses/${COURSE_UUID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('PUT /courses/:courseId/prerequisites', () => {
    const url = `/courses/${COURSE_UUID}/prerequisites`;

    it('returns 200 when setting prerequisites', async () => {
      courseRepoMock.findById.mockResolvedValue(buildCourse({}, COURSE_UUID));

      await request(app.getHttpServer())
        .put(url)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ prerequisites: [{ requiredCourseId: COURSE_UUID }] })
        .expect(200);
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer())
        .put(url)
        .send({ prerequisites: [] })
        .expect(401);
    });

    it('returns 404 when course not found', async () => {
      courseRepoMock.findById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .put(`/courses/${COURSE_UUID}/prerequisites`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ prerequisites: [] })
        .expect(404);
    });
  });
});
