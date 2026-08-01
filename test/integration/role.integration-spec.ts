import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { RedisService } from '@core/infrastructure/cache/redis.service';
import { PrismaServiceMock } from '../utils/mocks/prisma.mock';
import { RedisServiceMock } from '../utils/mocks/redis.mock';
import { ErrorCodes } from '@core/domain/error-codes';

describe('Role (e2e)', () => {
  let app: INestApplication;
  let prismaMock: PrismaServiceMock;
  let redisMock: RedisServiceMock;
  let jwtService: JwtService;
  let regularToken: string;

  beforeAll(async () => {
    prismaMock = new PrismaServiceMock();
    redisMock = new RedisServiceMock();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(RedisService)
      .useValue(redisMock)
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
    regularToken = jwtService.sign({
      sub: 'test-user-id',
      email: 'user@example.com',
      roleType: 'USER',
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();

    prismaMock.userRole.findMany.mockResolvedValue([
      {
        role: {
          permissions: [
            { permission: { code: 'role.create' } },
            { permission: { code: 'role.read' } },
            { permission: { code: 'role.update' } },
            { permission: { code: 'role.delete' } },
          ],
        },
      },
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /roles', () => {
    const url = '/roles';

    it('returns 201 when user creates a role', async () => {
      prismaMock.permission.findMany.mockResolvedValue([
        {
          id: 'perm-1',
          code: 'course.create',
          module: 'course',
          description: null,
        },
        {
          id: 'perm-2',
          code: 'course.read',
          module: 'course',
          description: null,
        },
      ]);

      const response = await request(app.getHttpServer())
        .post(url)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          name: 'Coordinator',
          permissionCodes: ['course.create', 'course.read'],
        })
        .expect(201);

      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe('Coordinator');
      expect(response.body.data.permissionCodes).toEqual([
        'course.create',
        'course.read',
      ]);
    });

    it('returns 422 when a permission lacks its .read dependency', async () => {
      prismaMock.permission.findMany.mockResolvedValue([
        {
          id: 'perm-1',
          code: 'course.create',
          module: 'course',
          description: null,
        },
      ]);

      const response = await request(app.getHttpServer())
        .post(url)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          name: 'Broken Role',
          permissionCodes: ['course.create'],
        })
        .expect(422);

      expect(response.body).toMatchObject({
        statusCode: 422,
        errorCode: ErrorCodes.ERR_ROLE_CREATION_FAILED,
        path: url,
      });
      expect(response.body.message).toContain('requires "course.read"');
    });

    it('returns 422 when permission codes are invalid', async () => {
      prismaMock.permission.findMany.mockResolvedValue([
        {
          id: 'perm-1',
          code: 'course.create',
          module: 'course',
          description: null,
        },
      ]);

      const response = await request(app.getHttpServer())
        .post(url)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          name: 'Bad Role',
          permissionCodes: ['course.create', 'nonexistent.code'],
        })
        .expect(422);

      expect(response.body).toMatchObject({
        statusCode: 422,
        errorCode: ErrorCodes.ERR_ROLE_CREATION_FAILED,
        path: url,
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    it('returns 401 without token', async () => {
      const response = await request(app.getHttpServer())
        .post(url)
        .send({ name: 'Role', permissionCodes: ['course.create'] })
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        errorCode: ErrorCodes.SEC_AUTH_TOKEN_MISSING,
        path: url,
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /roles', () => {
    it('returns 200 with role list', async () => {
      prismaMock.role.findMany.mockResolvedValue([
        {
          id: 'role-1',
          name: 'Admin',
          isStudent: false,
          isEditable: false,
          createdAt: new Date(),
          permissions: [{ permission: { code: 'system.admin' } }],
        },
        {
          id: 'role-2',
          name: 'Student',
          isStudent: true,
          isEditable: false,
          createdAt: new Date(),
          permissions: [],
        },
      ]);
      prismaMock.role.count.mockResolvedValue(2);

      const response = await request(app.getHttpServer())
        .get('/roles')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      expect(response.body.meta).toMatchObject({
        page: 1,
        pageSize: 20,
        total: 2,
      });
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].name).toBe('Admin');
    });
  });

  describe('GET /roles/:roleId', () => {
    it('returns 200 with role details', async () => {
      prismaMock.role.findUnique.mockResolvedValue({
        id: 'role-1',
        name: 'Coordinator',
        isStudent: false,
        isEditable: true,
        createdAt: new Date(),
        permissions: [{ permission: { code: 'course.create' } }],
      });

      const response = await request(app.getHttpServer())
        .get('/roles/role-1')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      expect(response.body.data.name).toBe('Coordinator');
      expect(response.body.data.permissionCodes).toEqual(['course.create']);
    });

    it('returns 404 when role not found', async () => {
      prismaMock.role.findUnique.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get('/roles/non-existent')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        errorCode: ErrorCodes.ERR_ROLE_NOT_FOUND,
        path: '/roles/non-existent',
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('PATCH /roles/:roleId', () => {
    const url = '/roles/role-1';

    it('returns 200 when user updates a role', async () => {
      prismaMock.role.findUnique.mockResolvedValueOnce({
        id: 'role-1',
        name: 'Old Name',
        isStudent: false,
        isEditable: true,
      });
      prismaMock.permission.findMany.mockResolvedValue([
        {
          id: 'perm-1',
          code: 'course.create',
          module: 'course',
          description: null,
        },
        {
          id: 'perm-2',
          code: 'course.read',
          module: 'course',
          description: null,
        },
      ]);
      prismaMock.rolePermission.findMany.mockResolvedValue([
        { permission: { code: 'course.create' } },
      ]);

      const response = await request(app.getHttpServer())
        .patch(url)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          name: 'New Name',
          permissionCodes: ['course.create', 'course.read'],
        })
        .expect(200);

      expect(response.body.data.name).toBe('New Name');
    });

    it('returns 422 when permissionCodes lack their .read dependency', async () => {
      prismaMock.role.findUnique.mockResolvedValue({
        id: 'role-1',
        name: 'Old Name',
        isStudent: false,
        isEditable: true,
      });
      prismaMock.permission.findMany.mockResolvedValue([
        {
          id: 'perm-1',
          code: 'course.create',
          module: 'course',
          description: null,
        },
      ]);

      const response = await request(app.getHttpServer())
        .patch(url)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ permissionCodes: ['course.create'] })
        .expect(422);

      expect(response.body).toMatchObject({
        statusCode: 422,
        errorCode: ErrorCodes.ERR_ROLE_UPDATE_FAILED,
        path: url,
      });
      expect(response.body.message).toContain('requires "course.read"');
    });

    it('returns 422 when trying to modify a non-editable role', async () => {
      prismaMock.role.findUnique.mockResolvedValue({
        id: 'built-in-role',
        name: 'Admin',
        isStudent: false,
        isEditable: false,
      });

      const response = await request(app.getHttpServer())
        .patch('/roles/built-in-role')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ name: 'Hacked' })
        .expect(422);

      expect(response.body).toMatchObject({
        statusCode: 422,
        errorCode: ErrorCodes.ERR_ROLE_UPDATE_FAILED,
        path: '/roles/built-in-role',
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('DELETE /roles/:roleId', () => {
    it('returns 200 when user deletes a custom role', async () => {
      prismaMock.role.findUnique.mockResolvedValue({
        id: 'custom-role',
        name: 'Temporary',
        isStudent: false,
        isEditable: true,
      });

      await request(app.getHttpServer())
        .delete('/roles/custom-role')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);
    });

    it('returns 404 when role not found', async () => {
      prismaMock.role.findUnique.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .delete('/roles/non-existent')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        errorCode: ErrorCodes.ERR_ROLE_NOT_FOUND,
        path: '/roles/non-existent',
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    it('returns 403 when trying to delete a non-editable role', async () => {
      prismaMock.role.findUnique.mockResolvedValue({
        id: 'built-in-role',
        name: 'Admin',
        isStudent: false,
        isEditable: false,
      });

      const response = await request(app.getHttpServer())
        .delete('/roles/built-in-role')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        statusCode: 403,
        errorCode: ErrorCodes.ERR_ROLE_BUILT_IN,
        path: '/roles/built-in-role',
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});
