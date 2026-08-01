import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { RedisService } from '@core/infrastructure/cache/redis.service';
import { USER_REPOSITORY } from '@modules/user/domain/user.repository';
import { PrismaServiceMock } from '../utils/mocks/prisma.mock';
import { RedisServiceMock } from '../utils/mocks/redis.mock';
import { buildUser } from '../utils/factories/user.factory';
import { ErrorCodes } from '@core/domain/error-codes';

describe('User (e2e)', () => {
  let app: INestApplication;
  let prismaMock: PrismaServiceMock;
  let redisMock: RedisServiceMock;
  let userRepositoryMock: {
    findAll: jest.Mock;
    count: jest.Mock;
    findById: jest.Mock;
    findByEmail: jest.Mock;
    findByCi: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    softDelete: jest.Mock;
  };
  let jwtService: JwtService;
  let regularToken: string;
  let superAdminToken: string;

  beforeAll(async () => {
    prismaMock = new PrismaServiceMock();
    redisMock = new RedisServiceMock();
    userRepositoryMock = {
      findAll: jest.fn(),
      count: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByCi: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(RedisService)
      .useValue(redisMock)
      .overrideProvider(USER_REPOSITORY)
      .useValue(userRepositoryMock)
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
    superAdminToken = jwtService.sign({
      sub: 'super-admin-id',
      email: 'admin@escala.app',
      roleType: 'SUPER_ADMIN',
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /users/me (regular user)', () => {
    it('returns 200 with user profile, roles and permissions', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'test-user-id',
        email: 'user@example.com',
        firstName: 'Test',
        lastName: 'User',
        roles: [
          {
            role: {
              name: 'Editor',
              permissions: [
                { permission: { code: 'course.create' } },
                { permission: { code: 'course.read' } },
              ],
            },
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        id: 'test-user-id',
        email: 'user@example.com',
        type: 'USER',
      });
      expect(response.body.data.roles).toEqual(['Editor']);
      expect(response.body.data.permissions).toEqual(
        expect.arrayContaining(['course.create', 'course.read']),
      );
    });

    it('returns 404 when user is not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        errorCode: ErrorCodes.ERR_USER_NOT_FOUND,
        path: '/users/me',
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    it('returns 401 when no token is provided', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/me')
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        errorCode: ErrorCodes.SEC_AUTH_TOKEN_MISSING,
        path: '/users/me',
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /users/me (super admin)', () => {
    it('returns 200 with super admin profile', async () => {
      prismaMock.superAdmin.findUnique.mockResolvedValue({
        id: 'super-admin-id',
        email: 'admin@escala.app',
      });

      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        id: 'super-admin-id',
        email: 'admin@escala.app',
        type: 'SUPER_ADMIN',
        permissions: ['*'],
      });
    });

    it('returns 404 when super admin is not found', async () => {
      prismaMock.superAdmin.findUnique.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        errorCode: ErrorCodes.ERR_USER_NOT_FOUND,
        path: '/users/me',
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /users', () => {
    it('returns 200 with users and their roles for user.read permission', async () => {
      prismaMock.userRole.findMany.mockResolvedValue([
        {
          role: {
            permissions: [{ permission: { code: 'user.read' } }],
          },
        },
      ]);
      userRepositoryMock.findAll.mockResolvedValue([
        {
          id: 'user-1',
          email: 'one@test.edu',
          firstName: 'One',
          lastName: 'User',
          ci: '1',
          phone: null,
          isActive: true,
          roles: ['Editor'],
        },
        {
          id: 'user-2',
          email: 'two@test.edu',
          firstName: 'Two',
          lastName: 'User',
          ci: '2',
          phone: '+584141234567',
          isActive: false,
          roles: [],
        },
      ]);
      userRepositoryMock.count.mockResolvedValue(2);

      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      expect(response.body.meta).toMatchObject({
        page: 1,
        pageSize: 20,
        total: 2,
      });
      expect(response.body.data).toEqual([
        expect.objectContaining({ email: 'one@test.edu', roles: ['Editor'] }),
        expect.objectContaining({ email: 'two@test.edu', isActive: false }),
      ]);
    });

    it('returns 403 without user.read permission', async () => {
      prismaMock.userRole.findMany.mockResolvedValue([]);

      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        statusCode: 403,
        errorCode: ErrorCodes.SEC_AUTH_INSUFFICIENT_PERMISSIONS,
        path: '/users',
      });
    });
  });

  describe('PATCH /users/me', () => {
    it('returns 200 with the updated profile', async () => {
      const user = buildUser({ phone: null });
      userRepositoryMock.findById.mockResolvedValue(user);
      userRepositoryMock.update.mockResolvedValue(undefined);

      const response = await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ phone: '+584141234567' })
        .expect(200);

      expect(response.body.data.phone).toBe('+584141234567');
    });

    it('returns 422 when user is not found for update', async () => {
      userRepositoryMock.findById.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ firstName: 'New' })
        .expect(422);

      expect(response.body).toMatchObject({
        statusCode: 422,
        errorCode: ErrorCodes.ERR_USER_UPDATE_FAILED,
        path: '/users/me',
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('POST /users', () => {
    const createUrl = '/users';
    const validPayload = {
      email: 'newuser@example.com',
      password: 'securePass123',
      firstName: 'New',
      lastName: 'User',
      ci: '87654321',
    };

    it('returns 201 when user is created', async () => {
      prismaMock.userRole.findMany.mockResolvedValue([
        {
          role: {
            permissions: [
              { permission: { code: 'user.create' } },
              { permission: { code: 'user.read' } },
            ],
          },
        },
      ]);

      userRepositoryMock.findByEmail.mockResolvedValue(null);
      userRepositoryMock.findByCi.mockResolvedValue(null);
      userRepositoryMock.save.mockResolvedValue(undefined);

      const response = await request(app.getHttpServer())
        .post(createUrl)
        .set('Authorization', `Bearer ${regularToken}`)
        .send(validPayload)
        .expect(201);

      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.email).toBe('newuser@example.com');
    });

    it('returns 422 when email already exists', async () => {
      prismaMock.userRole.findMany.mockResolvedValue([
        {
          role: {
            permissions: [
              { permission: { code: 'user.create' } },
              { permission: { code: 'user.read' } },
            ],
          },
        },
      ]);

      userRepositoryMock.findByEmail.mockResolvedValue(
        buildUser({ email: 'existing@example.com' }),
      );
      userRepositoryMock.findByCi.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .post(createUrl)
        .set('Authorization', `Bearer ${regularToken}`)
        .send(validPayload)
        .expect(422);

      expect(response.body).toMatchObject({
        statusCode: 422,
        errorCode: ErrorCodes.ERR_USER_EMAIL_EXISTS,
        path: createUrl,
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    it('returns 403 without user.create permission', async () => {
      prismaMock.userRole.findMany.mockResolvedValue([
        {
          role: {
            permissions: [{ permission: { code: 'role.read' } }],
          },
        },
      ]);

      const response = await request(app.getHttpServer())
        .post(createUrl)
        .set('Authorization', `Bearer ${regularToken}`)
        .send(validPayload)
        .expect(403);

      expect(response.body).toMatchObject({
        statusCode: 403,
        errorCode: ErrorCodes.SEC_AUTH_INSUFFICIENT_PERMISSIONS,
        path: createUrl,
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    it('returns 403 with user.create but no user.read', async () => {
      prismaMock.userRole.findMany.mockResolvedValue([
        {
          role: {
            permissions: [{ permission: { code: 'user.create' } }],
          },
        },
      ]);

      const response = await request(app.getHttpServer())
        .post(createUrl)
        .set('Authorization', `Bearer ${regularToken}`)
        .send(validPayload)
        .expect(403);

      expect(response.body).toMatchObject({
        statusCode: 403,
        errorCode: ErrorCodes.SEC_AUTH_INSUFFICIENT_PERMISSIONS,
        path: createUrl,
      });
    });

    it('returns 401 without token', async () => {
      const response = await request(app.getHttpServer())
        .post(createUrl)
        .send(validPayload)
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        errorCode: ErrorCodes.SEC_AUTH_TOKEN_MISSING,
        path: createUrl,
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    it('creates user with roles and returns them', async () => {
      prismaMock.userRole.findMany.mockResolvedValue([
        {
          role: {
            permissions: [
              { permission: { code: 'user.create' } },
              { permission: { code: 'user.read' } },
            ],
          },
        },
      ]);

      userRepositoryMock.findByEmail.mockResolvedValue(null);
      userRepositoryMock.findByCi.mockResolvedValue(null);
      userRepositoryMock.save.mockResolvedValue(undefined);
      prismaMock.role.findMany.mockResolvedValue([
        { id: 'role-1', name: 'Editor' },
      ]);
      prismaMock.userRole.createMany.mockResolvedValue({ count: 1 });

      const response = await request(app.getHttpServer())
        .post(createUrl)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ ...validPayload, roleIds: ['role-1'] })
        .expect(201);

      expect(response.body.data.roles).toEqual(['Editor']);
      expect(prismaMock.userRole.createMany).toHaveBeenCalledWith({
        data: [{ userId: expect.any(String), roleId: 'role-1' }],
      });
    });

    it('returns 422 when a role ID is invalid', async () => {
      prismaMock.userRole.findMany.mockResolvedValue([
        {
          role: {
            permissions: [
              { permission: { code: 'user.create' } },
              { permission: { code: 'user.read' } },
            ],
          },
        },
      ]);

      userRepositoryMock.findByEmail.mockResolvedValue(null);
      userRepositoryMock.findByCi.mockResolvedValue(null);
      prismaMock.role.findMany.mockResolvedValue([
        { id: 'role-1', name: 'Editor' },
      ]);

      const response = await request(app.getHttpServer())
        .post(createUrl)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ ...validPayload, roleIds: ['role-1', 'nonexistent'] })
        .expect(422);

      expect(response.body).toMatchObject({
        statusCode: 422,
        errorCode: ErrorCodes.ERR_ROLE_ASSIGNMENT_FAILED,
        path: createUrl,
      });
    });
  });

  describe('PATCH /users/:userId', () => {
    it('returns 200 when admin updates a user', async () => {
      prismaMock.userRole.findMany.mockResolvedValue([
        {
          role: {
            permissions: [
              { permission: { code: 'user.update' } },
              { permission: { code: 'user.read' } },
            ],
          },
        },
      ]);

      userRepositoryMock.findById.mockResolvedValue(buildUser({ phone: null }));
      userRepositoryMock.update.mockResolvedValue(undefined);

      const response = await request(app.getHttpServer())
        .patch('/users/target-user-id')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ firstName: 'Updated' })
        .expect(200);

      expect(response.body.data.firstName).toBe('Updated');
    });

    it('returns 404 when user not found', async () => {
      prismaMock.userRole.findMany.mockResolvedValue([
        {
          role: {
            permissions: [
              { permission: { code: 'user.update' } },
              { permission: { code: 'user.read' } },
            ],
          },
        },
      ]);

      userRepositoryMock.findById.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .patch('/users/non-existent')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ firstName: 'Updated' })
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        errorCode: ErrorCodes.ERR_USER_NOT_FOUND,
        path: '/users/non-existent',
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    it('returns 403 without user.update permission', async () => {
      prismaMock.userRole.findMany.mockResolvedValue([]);

      const response = await request(app.getHttpServer())
        .patch('/users/target-user-id')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ firstName: 'Updated' })
        .expect(403);

      expect(response.body).toMatchObject({
        statusCode: 403,
        errorCode: ErrorCodes.SEC_AUTH_INSUFFICIENT_PERMISSIONS,
        path: '/users/target-user-id',
      });
    });
  });

  describe('DELETE /users/:userId', () => {
    it('returns 200 when user is soft deleted', async () => {
      prismaMock.userRole.findMany.mockResolvedValue([
        {
          role: {
            permissions: [
              { permission: { code: 'user.delete' } },
              { permission: { code: 'user.read' } },
            ],
          },
        },
      ]);

      userRepositoryMock.findById.mockResolvedValue(buildUser());
      userRepositoryMock.softDelete.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete('/users/test-user-id')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);
    });

    it('returns 404 when user not found', async () => {
      prismaMock.userRole.findMany.mockResolvedValue([
        {
          role: {
            permissions: [
              { permission: { code: 'user.delete' } },
              { permission: { code: 'user.read' } },
            ],
          },
        },
      ]);

      userRepositoryMock.findById.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .delete('/users/non-existent')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        errorCode: ErrorCodes.ERR_USER_NOT_FOUND,
        path: '/users/non-existent',
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('POST /users/:userId/roles', () => {
    it('returns 201 when role is assigned', async () => {
      prismaMock.userRole.findMany.mockResolvedValue([
        {
          role: {
            permissions: [
              { permission: { code: 'role.assign' } },
              { permission: { code: 'role.read' } },
            ],
          },
        },
      ]);

      prismaMock.role.findUnique.mockResolvedValue({
        id: 'role-id',
        name: 'Editor',
        isStudent: false,
        isEditable: true,
      });
      prismaMock.userRole.findUnique.mockResolvedValue(null);
      prismaMock.userRole.create.mockResolvedValue({ id: 'ur-id' });

      await request(app.getHttpServer())
        .post('/users/user-id/roles')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ roleId: 'role-id' })
        .expect(201);
    });

    it('returns 422 when role not found', async () => {
      prismaMock.userRole.findMany.mockResolvedValue([
        {
          role: {
            permissions: [
              { permission: { code: 'role.assign' } },
              { permission: { code: 'role.read' } },
            ],
          },
        },
      ]);

      prismaMock.role.findUnique.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .post('/users/user-id/roles')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ roleId: 'nonexistent' })
        .expect(422);

      expect(response.body).toMatchObject({
        statusCode: 422,
        errorCode: ErrorCodes.ERR_ROLE_ASSIGNMENT_FAILED,
        path: '/users/user-id/roles',
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('DELETE /users/:userId/roles/:roleId', () => {
    it('returns 200 when role is unassigned', async () => {
      prismaMock.userRole.findMany.mockResolvedValue([
        {
          role: {
            permissions: [
              { permission: { code: 'role.assign' } },
              { permission: { code: 'role.read' } },
            ],
          },
        },
      ]);

      prismaMock.role.findUnique.mockResolvedValue({
        id: 'role-id',
        name: 'Editor',
        isStudent: false,
        isEditable: true,
      });
      prismaMock.userRole.delete.mockResolvedValue({ id: 'ur-id' });

      await request(app.getHttpServer())
        .delete('/users/user-id/roles/role-id')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);
    });

    it('returns 422 when role not found', async () => {
      prismaMock.userRole.findMany.mockResolvedValue([
        {
          role: {
            permissions: [
              { permission: { code: 'role.assign' } },
              { permission: { code: 'role.read' } },
            ],
          },
        },
      ]);

      prismaMock.role.findUnique.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .delete('/users/user-id/roles/nonexistent')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ roleId: 'nonexistent' })
        .expect(422);

      expect(response.body).toMatchObject({
        statusCode: 422,
        errorCode: ErrorCodes.ERR_ROLE_ASSIGNMENT_FAILED,
        path: '/users/user-id/roles/nonexistent',
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});
