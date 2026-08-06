import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { RedisService } from '@core/infrastructure/cache/redis.service';
import { Prisma } from '@prisma/client';
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
    programExists: jest.Mock;
    update: jest.Mock;
    softDelete: jest.Mock;
    getPrerequisites: jest.Mock;
    getPrerequisitesForCourses: jest.Mock;
    setPrerequisites: jest.Mock;
    findDependentCourses: jest.Mock;
    purgePrerequisites: jest.Mock;
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
      programExists: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      getPrerequisites: jest.fn(),
      getPrerequisitesForCourses: jest.fn(),
      setPrerequisites: jest.fn(),
      findDependentCourses: jest.fn(),
      purgePrerequisites: jest.fn(),
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
      courseRepoMock.programExists.mockResolvedValue(true);
      courseRepoMock.findAllByProgram.mockResolvedValue([]);
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

    it('returns 404 when the program does not exist', async () => {
      courseRepoMock.programExists.mockResolvedValue(false);

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
        .expect(404);

      expect(response.body.errorCode).toBe('ERR_PROGRAM_NOT_FOUND');
      expect(courseRepoMock.create).not.toHaveBeenCalled();
    });

    it('returns 422 when the code already exists in the program', async () => {
      courseRepoMock.programExists.mockResolvedValue(true);
      courseRepoMock.findAllByProgram.mockResolvedValue([
        buildCourse({ code: 'CS101', termLevel: 1 }, COURSE_UUID),
      ]);

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
        .expect(422);

      expect(response.body.errorCode).toBe('ERR_COURSE_CREATION_FAILED');
      expect(courseRepoMock.create).not.toHaveBeenCalled();
    });

    it('returns 422 instead of 500 when the FK constraint fails', async () => {
      courseRepoMock.programExists.mockResolvedValue(true);
      courseRepoMock.findAllByProgram.mockResolvedValue([]);
      courseRepoMock.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('FK violation', {
          code: 'P2003',
          clientVersion: 'test',
          meta: { field_name: 'courses_program_id_fkey' },
        }),
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
        .expect(422);

      expect(response.body.errorCode).toBe('ERR_RESOURCE_NOT_FOUND');
      expect(response.body.message).toBe('Referenced resource does not exist');
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

    it('returns 404 when not found', async () => {
      courseRepoMock.findById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .patch(`/courses/${COURSE_UUID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated' })
        .expect(404);
    });

    it('returns 200 when moving a course with no dependencies', async () => {
      courseRepoMock.findById.mockResolvedValue(
        buildCourse({ termLevel: 1 }, COURSE_UUID),
      );
      courseRepoMock.findAllByProgram.mockResolvedValue([
        buildCourse({ termLevel: 1 }, COURSE_UUID),
      ]);
      courseRepoMock.getPrerequisites.mockResolvedValue([]);
      courseRepoMock.findDependentCourses.mockResolvedValue([]);
      courseRepoMock.update.mockResolvedValue(
        buildCourse({ termLevel: 3 }, COURSE_UUID),
      );

      const response = await request(app.getHttpServer())
        .patch(`/courses/${COURSE_UUID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ termLevel: 3 })
        .expect(200);

      expect(response.body.data.termLevel).toBe(3);
    });

    it('returns 422 when moving a course before its own prerequisite', async () => {
      courseRepoMock.findById.mockResolvedValue(
        buildCourse({ termLevel: 2 }, COURSE_UUID),
      );
      courseRepoMock.findAllByProgram.mockResolvedValue([
        buildCourse({ termLevel: 1 }, COURSE2_UUID),
        buildCourse({ termLevel: 2 }, COURSE_UUID),
      ]);
      courseRepoMock.getPrerequisites.mockResolvedValue([
        {
          courseId: COURSE_UUID,
          requiredCourseId: COURSE2_UUID,
          requiredCredits: null,
        },
      ]);

      await request(app.getHttpServer())
        .patch(`/courses/${COURSE_UUID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ termLevel: 1 })
        .expect(422);

      expect(courseRepoMock.update).not.toHaveBeenCalled();
    });

    it('returns 422 when moving a course to a level equal to a dependent course', async () => {
      courseRepoMock.findById.mockResolvedValue(
        buildCourse({ termLevel: 1 }, COURSE_UUID),
      );
      courseRepoMock.findAllByProgram.mockResolvedValue([
        buildCourse({ termLevel: 1 }, COURSE_UUID),
        buildCourse({ termLevel: 2 }, COURSE2_UUID),
      ]);
      courseRepoMock.getPrerequisites.mockResolvedValue([]);
      courseRepoMock.findDependentCourses.mockResolvedValue([
        buildCourse({ termLevel: 2 }, COURSE2_UUID),
      ]);

      await request(app.getHttpServer())
        .patch(`/courses/${COURSE_UUID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ termLevel: 2 })
        .expect(422);

      expect(courseRepoMock.update).not.toHaveBeenCalled();
    });

    it('returns 200 when moving a prerequisite while dependents remain later', async () => {
      courseRepoMock.findById.mockResolvedValue(
        buildCourse({ termLevel: 1 }, COURSE_UUID),
      );
      courseRepoMock.findAllByProgram.mockResolvedValue([
        buildCourse({ termLevel: 1 }, COURSE_UUID),
        buildCourse({ termLevel: 3 }, COURSE2_UUID),
      ]);
      courseRepoMock.getPrerequisites.mockResolvedValue([]);
      courseRepoMock.findDependentCourses.mockResolvedValue([
        buildCourse({ termLevel: 3 }, COURSE2_UUID),
      ]);
      courseRepoMock.update.mockResolvedValue(
        buildCourse({ termLevel: 2 }, COURSE_UUID),
      );

      const response = await request(app.getHttpServer())
        .patch(`/courses/${COURSE_UUID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ termLevel: 2 })
        .expect(200);

      expect(response.body.data.termLevel).toBe(2);
    });

    it('returns 422 when renaming to a code already used in the program', async () => {
      courseRepoMock.findById.mockResolvedValue(
        buildCourse({ code: 'CS101', termLevel: 1 }, COURSE_UUID),
      );
      courseRepoMock.findAllByProgram.mockResolvedValue([
        buildCourse({ code: 'CS101', termLevel: 1 }, COURSE_UUID),
        buildCourse({ code: 'CS201', termLevel: 2 }, COURSE2_UUID),
      ]);

      await request(app.getHttpServer())
        .patch(`/courses/${COURSE_UUID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: 'CS201' })
        .expect(422);

      expect(courseRepoMock.update).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /courses/:courseId', () => {
    it('returns 200 when deleting', async () => {
      courseRepoMock.findById.mockResolvedValue(buildCourse({}, COURSE_UUID));

      await request(app.getHttpServer())
        .delete(`/courses/${COURSE_UUID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect(
          (res: {
            body: { data?: { deletedId?: string; message?: string } };
          }) => {
            expect(res.body.data).toMatchObject({
              deletedId: COURSE_UUID,
              message: 'Course deleted successfully',
            });
          },
        );

      expect(courseRepoMock.softDelete).toHaveBeenCalledWith(COURSE_UUID);
      expect(courseRepoMock.purgePrerequisites).toHaveBeenCalledWith(
        COURSE_UUID,
      );
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
      courseRepoMock.findById.mockResolvedValue(
        buildCourse({ termLevel: 2 }, COURSE_UUID),
      );
      courseRepoMock.findAllByProgram.mockResolvedValue([
        buildCourse({ termLevel: 1 }, COURSE2_UUID),
        buildCourse({ termLevel: 2 }, COURSE_UUID),
      ]);
      courseRepoMock.getPrerequisitesForCourses.mockResolvedValue([]);

      await request(app.getHttpServer())
        .put(url)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ prerequisites: [{ requiredCourseId: COURSE2_UUID }] })
        .expect(200)
        .expect(
          (res: {
            body: {
              data?: { courseId?: string; prerequisiteCount?: number };
            };
          }) => {
            expect(res.body.data).toEqual({
              courseId: COURSE_UUID,
              prerequisiteCount: 1,
            });
          },
        );
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

    it('clears all prerequisites with an empty array', async () => {
      courseRepoMock.findById.mockResolvedValue(
        buildCourse({ termLevel: 2 }, COURSE_UUID),
      );
      courseRepoMock.findAllByProgram.mockResolvedValue([
        buildCourse({ termLevel: 2 }, COURSE_UUID),
      ]);
      courseRepoMock.getPrerequisitesForCourses.mockResolvedValue([]);

      await request(app.getHttpServer())
        .put(url)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ prerequisites: [] })
        .expect(200);

      expect(courseRepoMock.setPrerequisites).toHaveBeenCalledWith(
        COURSE_UUID,
        [],
      );
    });

    it('accepts a mixed entry with course and credits together', async () => {
      courseRepoMock.findById.mockResolvedValue(
        buildCourse({ termLevel: 2 }, COURSE_UUID),
      );
      courseRepoMock.findAllByProgram.mockResolvedValue([
        buildCourse({ termLevel: 1 }, COURSE2_UUID),
        buildCourse({ termLevel: 2 }, COURSE_UUID),
      ]);
      courseRepoMock.getPrerequisitesForCourses.mockResolvedValue([]);

      await request(app.getHttpServer())
        .put(url)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          prerequisites: [
            { requiredCourseId: COURSE2_UUID, requiredCredits: 20 },
          ],
        })
        .expect(200);

      expect(courseRepoMock.setPrerequisites).toHaveBeenCalledWith(
        COURSE_UUID,
        [
          {
            requiredCourseId: COURSE2_UUID,
            requiredCredits: 20,
          },
        ],
      );
    });

    it('returns 422 when a prerequisite is in the same or later level', async () => {
      courseRepoMock.findById.mockResolvedValue(
        buildCourse({ termLevel: 1 }, COURSE_UUID),
      );
      courseRepoMock.findAllByProgram.mockResolvedValue([
        buildCourse({ termLevel: 1 }, COURSE_UUID),
        buildCourse({ termLevel: 1 }, COURSE2_UUID),
      ]);

      await request(app.getHttpServer())
        .put(url)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ prerequisites: [{ requiredCourseId: COURSE2_UUID }] })
        .expect(422)
        .expect((res: { body: { errorCode?: string } }) => {
          expect(res.body.errorCode).toBe('ERR_COURSE_PREREQ_INVALID');
        });
    });

    it('returns 422 when a prerequisite does not exist in the program', async () => {
      courseRepoMock.findById.mockResolvedValue(
        buildCourse({ termLevel: 2 }, COURSE_UUID),
      );
      courseRepoMock.findAllByProgram.mockResolvedValue([
        buildCourse({ termLevel: 2 }, COURSE_UUID),
      ]);

      await request(app.getHttpServer())
        .put(url)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          prerequisites: [
            { requiredCourseId: '550e8400-e29b-41d4-a716-44665544ffff' },
          ],
        })
        .expect(422);
    });

    it('returns 422 when the course requires itself', async () => {
      courseRepoMock.findById.mockResolvedValue(
        buildCourse({ termLevel: 2 }, COURSE_UUID),
      );
      courseRepoMock.findAllByProgram.mockResolvedValue([
        buildCourse({ termLevel: 2 }, COURSE_UUID),
      ]);

      await request(app.getHttpServer())
        .put(url)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ prerequisites: [{ requiredCourseId: COURSE_UUID }] })
        .expect(422);
    });

    it('returns 422 when an entry has neither course nor credits', async () => {
      courseRepoMock.findById.mockResolvedValue(
        buildCourse({ termLevel: 2 }, COURSE_UUID),
      );

      await request(app.getHttpServer())
        .put(url)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ prerequisites: [{}] })
        .expect(422);
    });

    it('deduplicates repeated prerequisite entries', async () => {
      courseRepoMock.findById.mockResolvedValue(
        buildCourse({ termLevel: 2 }, COURSE_UUID),
      );
      courseRepoMock.findAllByProgram.mockResolvedValue([
        buildCourse({ termLevel: 1 }, COURSE2_UUID),
        buildCourse({ termLevel: 2 }, COURSE_UUID),
      ]);
      courseRepoMock.getPrerequisitesForCourses.mockResolvedValue([]);

      await request(app.getHttpServer())
        .put(url)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          prerequisites: [
            { requiredCourseId: COURSE2_UUID },
            { requiredCourseId: COURSE2_UUID },
          ],
        })
        .expect(200)
        .expect(
          (res: {
            body: {
              data?: { courseId?: string; prerequisiteCount?: number };
            };
          }) => {
            expect(res.body.data).toEqual({
              courseId: COURSE_UUID,
              prerequisiteCount: 1,
            });
          },
        );

      expect(courseRepoMock.setPrerequisites).toHaveBeenCalledWith(
        COURSE_UUID,
        [{ requiredCourseId: COURSE2_UUID, requiredCredits: null }],
      );
    });

    it('returns 422 when prerequisites would create a cycle', async () => {
      courseRepoMock.findById.mockResolvedValue(
        buildCourse({ termLevel: 3 }, COURSE_UUID),
      );
      courseRepoMock.findAllByProgram.mockResolvedValue([
        buildCourse({ termLevel: 1 }, COURSE2_UUID),
        buildCourse({ termLevel: 3 }, COURSE_UUID),
      ]);
      courseRepoMock.getPrerequisitesForCourses.mockResolvedValue([
        {
          courseId: COURSE2_UUID,
          requiredCourseId: COURSE_UUID,
          requiredCredits: null,
        },
      ]);

      await request(app.getHttpServer())
        .put(url)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ prerequisites: [{ requiredCourseId: COURSE2_UUID }] })
        .expect(422);
    });
  });
});
