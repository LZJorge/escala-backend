import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { RedisService } from '@core/infrastructure/cache/redis.service';
import { PrismaServiceMock } from '../utils/mocks/prisma.mock';
import { RedisServiceMock } from '../utils/mocks/redis.mock';

describe('Role (e2e)', () => {
  let app: INestApplication;
  let prismaMock: PrismaServiceMock;
  let redisMock: RedisServiceMock;
  let jwtService: JwtService;
  let masterToken: string;

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
    masterToken = jwtService.sign({
      sub: 'master-admin-id',
      email: 'master@inst.edu',
      isSuperAdmin: false,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // MasterAdminGuard will check this; default: pass
    prismaMock.institutionUser.findFirst.mockResolvedValue({
      id: 'iu-master',
      userId: 'master-admin-id',
      institutionId: 'inst-1',
      isActive: true,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ──────────────────────────────────────────────
  // Roles CRUD
  // ──────────────────────────────────────────────
  describe('POST /institutions/:institutionId/roles', () => {
    const url = '/institutions/inst-1/roles';

    it('returns 201 when master admin creates a role', async () => {
      prismaMock.institution.findUnique.mockResolvedValue({
        id: 'inst-1',
        name: 'Test Inst',
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
          code: 'course.view',
          module: 'course',
          description: null,
        },
      ]);
      redisMock.del.mockResolvedValue(1);
      redisMock.sadd.mockResolvedValue(2);
      redisMock.expire.mockResolvedValue(1);

      const response = await request(app.getHttpServer())
        .post(url)
        .set('Authorization', `Bearer ${masterToken}`)
        .send({
          name: 'Coordinator',
          permissionCodes: ['course.create', 'course.view'],
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Coordinator');
      expect(response.body.permissionCodes).toEqual([
        'course.create',
        'course.view',
      ]);
    });

    it('returns 422 when permission codes are invalid', async () => {
      prismaMock.institution.findUnique.mockResolvedValue({
        id: 'inst-1',
        name: 'Test Inst',
      });
      prismaMock.permission.findMany.mockResolvedValue([
        {
          id: 'perm-1',
          code: 'course.create',
          module: 'course',
          description: null,
        },
      ]);

      await request(app.getHttpServer())
        .post(url)
        .set('Authorization', `Bearer ${masterToken}`)
        .send({
          name: 'Bad Role',
          permissionCodes: ['course.create', 'nonexistent.code'],
        })
        .expect(422);
    });
  });

  describe('GET /institutions/:institutionId/roles', () => {
    it('returns 200 with role list (public)', async () => {
      prismaMock.role.findMany.mockResolvedValue([
        {
          id: 'role-1',
          name: 'Master',
          isStudent: false,
          isMaster: true,
          isEditable: false,
          institutionId: 'inst-1',
          createdAt: new Date(),
          permissions: [{ permission: { code: 'system.admin' } }],
        },
        {
          id: 'role-2',
          name: 'Student',
          isStudent: true,
          isMaster: false,
          isEditable: false,
          institutionId: 'inst-1',
          createdAt: new Date(),
          permissions: [],
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/institutions/inst-1/roles')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toBe('Master');
    });
  });

  describe('GET /institutions/:institutionId/roles/:roleId', () => {
    it('returns 200 with role details', async () => {
      prismaMock.role.findUnique.mockResolvedValue({
        id: 'role-1',
        name: 'Coordinator',
        isStudent: false,
        isMaster: false,
        isEditable: true,
        institutionId: 'inst-1',
        createdAt: new Date(),
        permissions: [{ permission: { code: 'course.create' } }],
      });

      const response = await request(app.getHttpServer())
        .get('/institutions/inst-1/roles/role-1')
        .expect(200);

      expect(response.body.name).toBe('Coordinator');
      expect(response.body.permissionCodes).toEqual(['course.create']);
    });

    it('returns 404 when role not found', async () => {
      prismaMock.role.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/institutions/inst-1/roles/non-existent')
        .expect(404);
    });
  });

  describe('PATCH /institutions/:institutionId/roles/:roleId', () => {
    const url = '/institutions/inst-1/roles/role-1';

    it('returns 200 when master admin updates a role', async () => {
      prismaMock.role.findUnique.mockResolvedValueOnce({
        id: 'role-1',
        name: 'Old Name',
        isStudent: false,
        isMaster: false,
        isEditable: true,
        institutionId: 'inst-1',
      });
      prismaMock.permission.findMany.mockResolvedValue([
        {
          id: 'perm-1',
          code: 'course.create',
          module: 'course',
          description: null,
        },
      ]);
      prismaMock.rolePermission.findMany.mockResolvedValue([
        { permission: { code: 'course.create' } },
      ]);
      redisMock.del.mockResolvedValue(1);

      const response = await request(app.getHttpServer())
        .patch(url)
        .set('Authorization', `Bearer ${masterToken}`)
        .send({ name: 'New Name', permissionCodes: ['course.create'] })
        .expect(200);

      expect(response.body.name).toBe('New Name');
    });

    it('returns 422 when trying to modify a non-editable role', async () => {
      prismaMock.role.findUnique.mockResolvedValue({
        id: 'built-in-role',
        name: 'Master',
        isStudent: false,
        isMaster: true,
        isEditable: false,
        institutionId: 'inst-1',
      });

      await request(app.getHttpServer())
        .patch('/institutions/inst-1/roles/built-in-role')
        .set('Authorization', `Bearer ${masterToken}`)
        .send({ name: 'Hacked' })
        .expect(422);
    });
  });

  describe('DELETE /institutions/:institutionId/roles/:roleId', () => {
    it('returns 200 when master admin deletes a custom role', async () => {
      prismaMock.role.findUnique.mockResolvedValue({
        id: 'custom-role',
        name: 'Temporary',
        isStudent: false,
        isMaster: false,
        isEditable: true,
        institutionId: 'inst-1',
      });
      redisMock.del.mockResolvedValue(1);

      await request(app.getHttpServer())
        .delete('/institutions/inst-1/roles/custom-role')
        .set('Authorization', `Bearer ${masterToken}`)
        .expect(200);
    });

    it('returns 422 when trying to delete a non-editable role', async () => {
      prismaMock.role.findUnique.mockResolvedValue({
        id: 'built-in-role',
        name: 'Master',
        isStudent: false,
        isMaster: true,
        isEditable: false,
        institutionId: 'inst-1',
      });

      await request(app.getHttpServer())
        .delete('/institutions/inst-1/roles/built-in-role')
        .set('Authorization', `Bearer ${masterToken}`)
        .expect(422);
    });
  });

  // ──────────────────────────────────────────────
  // Role Assignments
  // ──────────────────────────────────────────────
  describe('POST /institutions/:institutionId/role-assignments', () => {
    const url = '/institutions/inst-1/role-assignments';

    it('returns 201 when master admin assigns a role', async () => {
      prismaMock.institutionUser.findUnique.mockResolvedValue({
        id: 'iu-target',
        userId: 'target-user',
        institutionId: 'inst-1',
        isActive: true,
      });
      prismaMock.role.findUnique.mockResolvedValue({
        id: 'role-to-assign',
        name: 'Editor',
        isStudent: false,
        isMaster: false,
        isEditable: true,
        institutionId: 'inst-1',
      });
      prismaMock.institutionUserRole.findUnique.mockResolvedValue(null);
      redisMock.pipeline.mockReturnValue({
        del: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });

      await request(app.getHttpServer())
        .post(url)
        .set('Authorization', `Bearer ${masterToken}`)
        .send({ institutionUserId: 'iu-target', roleId: 'role-to-assign' })
        .expect(201);
    });

    it('returns 422 when assigning a role from a different institution', async () => {
      prismaMock.institutionUser.findUnique.mockResolvedValue({
        id: 'iu-target',
        userId: 'target-user',
        institutionId: 'inst-1',
        isActive: true,
      });
      prismaMock.role.findUnique.mockResolvedValue({
        id: 'role-wrong-inst',
        name: 'Other Role',
        isStudent: false,
        isMaster: false,
        isEditable: true,
        institutionId: 'inst-2',
      });

      await request(app.getHttpServer())
        .post(url)
        .set('Authorization', `Bearer ${masterToken}`)
        .send({ institutionUserId: 'iu-target', roleId: 'role-wrong-inst' })
        .expect(422);
    });
  });

  describe('DELETE /institutions/:institutionId/role-assignments', () => {
    const url = '/institutions/inst-1/role-assignments';

    it('returns 200 when master admin unassigns a role', async () => {
      prismaMock.institutionUser.findUnique.mockResolvedValue({
        id: 'iu-target',
        userId: 'target-user',
        institutionId: 'inst-1',
        isActive: true,
      });
      prismaMock.role.findUnique.mockResolvedValue({
        id: 'role-to-remove',
        name: 'Editor',
        isStudent: false,
        isMaster: false,
        isEditable: true,
        institutionId: 'inst-1',
      });
      redisMock.pipeline.mockReturnValue({
        del: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });

      await request(app.getHttpServer())
        .delete(url)
        .set('Authorization', `Bearer ${masterToken}`)
        .send({ institutionUserId: 'iu-target', roleId: 'role-to-remove' })
        .expect(200);
    });

    it('returns 422 when trying to remove the last master role', async () => {
      prismaMock.institutionUser.findUnique.mockResolvedValue({
        id: 'iu-last-master',
        userId: 'last-master',
        institutionId: 'inst-1',
        isActive: true,
      });
      prismaMock.role.findUnique.mockResolvedValue({
        id: 'master-role',
        name: 'Master',
        isStudent: false,
        isMaster: true,
        isEditable: false,
        institutionId: 'inst-1',
      });
      prismaMock.institutionUserRole.count.mockResolvedValue(0);

      await request(app.getHttpServer())
        .delete(url)
        .set('Authorization', `Bearer ${masterToken}`)
        .send({ institutionUserId: 'iu-last-master', roleId: 'master-role' })
        .expect(422);
    });
  });
});
