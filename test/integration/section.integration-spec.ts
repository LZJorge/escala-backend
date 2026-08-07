import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { RedisService } from '@core/infrastructure/cache/redis.service';
import { SECTION_REPOSITORY } from '@modules/section/domain/section.repository';
import { CourseSection } from '@modules/section/domain/course-section.entity';
import { SectionSchedule } from '@modules/section/domain/section-schedule.entity';
import { PrismaServiceMock } from '../utils/mocks/prisma.mock';
import { RedisServiceMock } from '../utils/mocks/redis.mock';
import { DayOfWeek } from '@prisma/client';
import { ErrorCodes } from '@core/domain/error-codes';

function buildSection(
  overrides: Partial<{
    courseId: string;
    termId: string;
    teacherId: string;
    name: string;
    capacity: number;
  }> = {},
  id?: string,
): CourseSection {
  return new CourseSection(
    {
      courseId: '550e8400-e29b-41d4-a716-446655440000',
      termId: '550e8400-e29b-41d4-a716-446655440001',
      teacherId: '550e8400-e29b-41d4-a716-446655440002',
      name: 'Section A',
      capacity: 30,
      ...overrides,
    },
    id,
  );
}

function buildSchedule(
  overrides: Partial<{
    sectionId: string;
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
    roomIdentifier: string | null;
  }> = {},
  id?: string,
): SectionSchedule {
  return new SectionSchedule(
    {
      sectionId: '550e8400-e29b-41d4-a716-446655440010',
      dayOfWeek: DayOfWeek.MONDAY,
      startTime: '08:00',
      endTime: '10:00',
      roomIdentifier: null,
      ...overrides,
    },
    id,
  );
}

describe('Section (e2e)', () => {
  let app: INestApplication;
  let prismaMock: PrismaServiceMock;
  let redisMock: RedisServiceMock;
  let sectionRepoMock: {
    getTermStatus: jest.Mock;
    isTeacher: jest.Mock;
    isCourseAvailable: jest.Mock;
    getCourseProgramId: jest.Mock;
    create: jest.Mock;
    createSchedules: jest.Mock;
    findAll: jest.Mock;
    findById: jest.Mock;
    update: jest.Mock;
    softDelete: jest.Mock;
    addSchedule: jest.Mock;
    deleteSchedule: jest.Mock;
    countEnrollments: jest.Mock;
    countAssessments: jest.Mock;
    findTeacherConflicts: jest.Mock;
    findRoomConflicts: jest.Mock;
  };
  let jwtService: JwtService;
  let adminToken: string;

  beforeAll(async () => {
    prismaMock = new PrismaServiceMock();
    redisMock = new RedisServiceMock();
    sectionRepoMock = {
      getTermStatus: jest.fn(),
      isTeacher: jest.fn(),
      isCourseAvailable: jest.fn(),
      getCourseProgramId: jest.fn(),
      create: jest.fn(),
      createSchedules: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      addSchedule: jest.fn(),
      deleteSchedule: jest.fn(),
      countEnrollments: jest.fn(),
      countAssessments: jest.fn(),
      findTeacherConflicts: jest.fn(),
      findRoomConflicts: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(RedisService)
      .useValue(redisMock)
      .overrideProvider(SECTION_REPOSITORY)
      .useValue(sectionRepoMock)
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

    sectionRepoMock.getTermStatus.mockResolvedValue('ACTIVE');
    sectionRepoMock.isTeacher.mockResolvedValue(true);
    sectionRepoMock.isCourseAvailable.mockResolvedValue(true);

    prismaMock.adminRole.findMany.mockResolvedValue([
      {
        role: {
          permissions: [
            { permission: { code: 'section.create' } },
            { permission: { code: 'section.read' } },
            { permission: { code: 'section.update' } },
            { permission: { code: 'section.delete' } },
            { permission: { code: 'section.schedule' } },
          ],
        },
      },
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /sections', () => {
    const url = '/sections';

    it('returns 201 when creating a section', async () => {
      sectionRepoMock.create.mockResolvedValue(
        buildSection({ name: 'Section A' }, 'sec-1'),
      );
      sectionRepoMock.createSchedules.mockResolvedValue([]);
      sectionRepoMock.getCourseProgramId.mockResolvedValue('prog-1');

      const response = await request(app.getHttpServer())
        .post(url)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          courseId: '550e8400-e29b-41d4-a716-446655440000',
          termId: '550e8400-e29b-41d4-a716-446655440001',
          teacherId: '550e8400-e29b-41d4-a716-446655440002',
          name: 'Section A',
          capacity: 30,
        })
        .expect(201);

      expect(response.body.data.id).toBe('sec-1');
      expect(response.body.data.name).toBe('Section A');
      expect(response.body.data.capacity).toBe(30);
      expect(redisMock.delete).toHaveBeenCalledWith(
        'escala:program:prog-1:summary',
      );
    });

    it('returns 201 when creating a section with schedules', async () => {
      sectionRepoMock.create.mockResolvedValue(
        buildSection({ name: 'With Schedule' }, 'sec-2'),
      );
      sectionRepoMock.createSchedules.mockResolvedValue([
        buildSchedule(
          {
            sectionId: 'sec-2',
            dayOfWeek: 'MONDAY',
            startTime: '08:00',
            endTime: '10:00',
          },
          'sch-1',
        ),
      ]);

      const response = await request(app.getHttpServer())
        .post(url)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          courseId: '550e8400-e29b-41d4-a716-446655440000',
          termId: '550e8400-e29b-41d4-a716-446655440001',
          teacherId: '550e8400-e29b-41d4-a716-446655440002',
          name: 'With Schedule',
          capacity: 25,
          schedules: [
            {
              dayOfWeek: 'MONDAY',
              startTime: '08:00',
              endTime: '10:00',
            },
          ],
        })
        .expect(201);

      expect(response.body.data.schedules).toHaveLength(1);
      expect(response.body.data.schedules[0].dayOfWeek).toBe('MONDAY');
    });

    it('returns 401 without token', async () => {
      const response = await request(app.getHttpServer())
        .post(url)
        .send({
          courseId: '550e8400-e29b-41d4-a716-446655440000',
          termId: '550e8400-e29b-41d4-a716-446655440001',
          teacherId: '550e8400-e29b-41d4-a716-446655440002',
          name: 'Section A',
          capacity: 30,
        })
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        errorCode: ErrorCodes.SEC_AUTH_TOKEN_MISSING,
        path: url,
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    it('returns 422 when teacherId belongs to a student', async () => {
      sectionRepoMock.isTeacher.mockResolvedValueOnce(false);

      const response = await request(app.getHttpServer())
        .post(url)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          courseId: '550e8400-e29b-41d4-a716-446655440000',
          termId: '550e8400-e29b-41d4-a716-446655440001',
          teacherId: '550e8400-e29b-41d4-a716-446655440099',
          name: 'Hacked Section',
          capacity: 30,
        })
        .expect(422);

      expect(response.body).toMatchObject({
        statusCode: 422,
        errorCode: ErrorCodes.ERR_SECTION_CREATION_FAILED,
        path: url,
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    it('returns 422 when the course is soft-deleted or unavailable', async () => {
      sectionRepoMock.isCourseAvailable.mockResolvedValueOnce(false);

      const response = await request(app.getHttpServer())
        .post(url)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          courseId: '550e8400-e29b-41d4-a716-446655440000',
          termId: '550e8400-e29b-41d4-a716-446655440001',
          teacherId: '550e8400-e29b-41d4-a716-446655440002',
          name: 'Dead Course Section',
          capacity: 30,
        })
        .expect(422);

      expect(response.body).toMatchObject({
        statusCode: 422,
        errorCode: ErrorCodes.ERR_SECTION_CREATION_FAILED,
        path: url,
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /sections', () => {
    it('returns 200 with section list filtered by termId', async () => {
      sectionRepoMock.findAll.mockResolvedValue([
        {
          section: buildSection({ name: 'Math 101-A' }, 'sec-1'),
          schedules: [buildSchedule({ sectionId: 'sec-1' }, 'sch-1')],
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/sections?termId=550e8400-e29b-41d4-a716-446655440001')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Math 101-A');
    });
  });

  describe('GET /sections/:id', () => {
    it('returns 200 with section details and schedules', async () => {
      sectionRepoMock.findById.mockResolvedValue({
        section: buildSection({ name: 'Physics Lab' }, 'sec-1'),
        schedules: [
          buildSchedule(
            {
              sectionId: 'sec-1',
              dayOfWeek: 'WEDNESDAY',
              startTime: '14:00',
              endTime: '16:00',
            },
            'sch-1',
          ),
        ],
      });

      const response = await request(app.getHttpServer())
        .get('/sections/sec-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.name).toBe('Physics Lab');
      expect(response.body.data.schedules).toHaveLength(1);
      expect(response.body.data.schedules[0].dayOfWeek).toBe('WEDNESDAY');
    });

    it('returns 404 when not found', async () => {
      sectionRepoMock.findById.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get('/sections/nope')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        errorCode: ErrorCodes.ERR_SECTION_NOT_FOUND,
        path: '/sections/nope',
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('PATCH /sections/:id', () => {
    it('returns 200 when updating name and capacity', async () => {
      sectionRepoMock.findById.mockResolvedValue({
        section: buildSection({ name: 'Old Name', capacity: 20 }, 'sec-1'),
        schedules: [],
      });
      sectionRepoMock.update.mockResolvedValue(
        buildSection({ name: 'New Name', capacity: 30 }, 'sec-1'),
      );

      const response = await request(app.getHttpServer())
        .patch('/sections/sec-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'New Name', capacity: 30 })
        .expect(200);

      expect(response.body.data.name).toBe('New Name');
      expect(response.body.data.capacity).toBe(30);
    });

    it('returns 422 when reducing capacity below enrollment count', async () => {
      sectionRepoMock.findById.mockResolvedValue({
        section: buildSection({ capacity: 30 }, 'sec-1'),
        schedules: [],
      });
      sectionRepoMock.countEnrollments.mockResolvedValue(20);

      const response = await request(app.getHttpServer())
        .patch('/sections/sec-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ capacity: 15 })
        .expect(422);

      expect(response.body).toMatchObject({
        statusCode: 422,
        errorCode: ErrorCodes.ERR_SECTION_UPDATE_FAILED,
        path: '/sections/sec-1',
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    it('returns 404 when not found', async () => {
      sectionRepoMock.findById.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .patch('/sections/nope')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated' })
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        errorCode: ErrorCodes.ERR_SECTION_NOT_FOUND,
        path: '/sections/nope',
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('DELETE /sections/:id', () => {
    it('returns 200 when deleting a section with no enrollments', async () => {
      sectionRepoMock.findById.mockResolvedValue({
        section: buildSection({}, 'sec-1'),
        schedules: [],
      });
      sectionRepoMock.countEnrollments.mockResolvedValue(0);
      sectionRepoMock.countAssessments.mockResolvedValue(0);

      await request(app.getHttpServer())
        .delete('/sections/sec-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect(
          (res: {
            body: { data?: { deletedId?: string; message?: string } };
          }) => {
            expect(res.body.data).toMatchObject({
              deletedId: 'sec-1',
              message: 'Section deleted successfully',
            });
          },
        );
    });

    it('returns 409 when section has enrollments', async () => {
      sectionRepoMock.findById.mockResolvedValue({
        section: buildSection({}, 'sec-1'),
        schedules: [],
      });
      sectionRepoMock.countEnrollments.mockResolvedValue(5);

      const response = await request(app.getHttpServer())
        .delete('/sections/sec-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409);

      expect(response.body).toMatchObject({
        statusCode: 409,
        errorCode: ErrorCodes.ERR_SECTION_DELETE_FAILED,
        path: '/sections/sec-1',
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    it('returns 404 when not found', async () => {
      sectionRepoMock.findById.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .delete('/sections/nope')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        errorCode: ErrorCodes.ERR_SECTION_NOT_FOUND,
        path: '/sections/nope',
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('POST /sections/:id/schedules', () => {
    it('returns 201 when adding a schedule to a section', async () => {
      sectionRepoMock.findById.mockResolvedValue({
        section: buildSection({}, 'sec-1'),
        schedules: [],
      });
      sectionRepoMock.findTeacherConflicts.mockResolvedValue([]);
      sectionRepoMock.addSchedule.mockResolvedValue(
        buildSchedule(
          {
            sectionId: 'sec-1',
            dayOfWeek: 'MONDAY',
            startTime: '08:00',
            endTime: '10:00',
          },
          'sch-1',
        ),
      );

      const response = await request(app.getHttpServer())
        .post('/sections/sec-1/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ dayOfWeek: 'MONDAY', startTime: '08:00', endTime: '10:00' })
        .expect(201);

      expect(response.body.data.dayOfWeek).toBe('MONDAY');
    });

    it('returns 409 when teacher has a conflicting schedule', async () => {
      sectionRepoMock.findById.mockResolvedValue({
        section: buildSection({}, 'sec-1'),
        schedules: [],
      });
      sectionRepoMock.findTeacherConflicts.mockResolvedValue([
        {
          sectionId: 'sec-2',
          sectionName: 'Conflict Section',
          dayOfWeek: 'MONDAY',
          startTime: '09:00',
          endTime: '11:00',
          roomIdentifier: null,
          conflictingTeacherId: 'teacher-id',
        },
      ]);

      const response = await request(app.getHttpServer())
        .post('/sections/sec-1/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ dayOfWeek: 'MONDAY', startTime: '08:00', endTime: '10:00' })
        .expect(409);

      expect(response.body).toMatchObject({
        statusCode: 409,
        errorCode: ErrorCodes.ERR_SECTION_SCHEDULE_CONFLICT,
        path: '/sections/sec-1/schedules',
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    it('returns 409 when room is occupied', async () => {
      sectionRepoMock.findById.mockResolvedValue({
        section: buildSection({}, 'sec-1'),
        schedules: [],
      });
      sectionRepoMock.findTeacherConflicts.mockResolvedValue([]);
      sectionRepoMock.findRoomConflicts.mockResolvedValue([
        {
          sectionId: 'sec-2',
          sectionName: 'Other Section',
          dayOfWeek: 'MONDAY',
          startTime: '09:00',
          endTime: '11:00',
          roomIdentifier: 'Lab 101',
        },
      ]);

      const response = await request(app.getHttpServer())
        .post('/sections/sec-1/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          dayOfWeek: 'MONDAY',
          startTime: '08:00',
          endTime: '10:00',
          roomIdentifier: 'Lab 101',
        })
        .expect(409);

      expect(response.body).toMatchObject({
        statusCode: 409,
        errorCode: ErrorCodes.ERR_SECTION_SCHEDULE_CONFLICT,
        path: '/sections/sec-1/schedules',
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('DELETE /sections/:id/schedules/:scheduleId', () => {
    it('returns 200 when deleting a schedule', async () => {
      sectionRepoMock.findById.mockResolvedValue({
        section: buildSection({}, 'sec-1'),
        schedules: [buildSchedule({ sectionId: 'sec-1' }, 'sch-1')],
      });

      await request(app.getHttpServer())
        .delete('/sections/sec-1/schedules/sch-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect(
          (res: {
            body: {
              data?: {
                sectionId?: string;
                deletedId?: string;
                message?: string;
              };
            };
          }) => {
            expect(res.body.data).toMatchObject({
              sectionId: 'sec-1',
              deletedId: 'sch-1',
              message: 'Schedule deleted successfully',
            });
          },
        );
    });

    it('returns 404 when section not found', async () => {
      sectionRepoMock.findById.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .delete('/sections/nope/schedules/sch-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        errorCode: ErrorCodes.ERR_SCHEDULE_NOT_FOUND,
        path: '/sections/nope/schedules/sch-1',
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});
