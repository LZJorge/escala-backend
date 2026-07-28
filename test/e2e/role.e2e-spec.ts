import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { clearDatabase } from '../utils/prisma.test-utils';
import { randomBytes, scryptSync } from 'node:crypto';

async function loginWithPermissions(
  app: INestApplication,
  prisma: PrismaService,
  permissionCodes: string[],
  suffix: string,
): Promise<string> {
  const permissions = await Promise.all(
    permissionCodes.map((code) =>
      prisma.permission.create({
        data: { code, module: code.split('.')[0], description: code },
      }),
    ),
  );

  const role = await prisma.role.create({
    data: { name: `Operator Role ${suffix}`, isEditable: true },
  });

  await prisma.rolePermission.createMany({
    data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
  });

  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync('operator_password', salt, 64).toString('hex');

  const user = await prisma.user.create({
    data: {
      email: `role-op-${suffix}@test.edu`,
      password: `${salt}:${hash}`,
      firstName: 'Operator',
      lastName: suffix,
      ci: `role-op-ci-${suffix}`,
    },
  });

  await prisma.userRole.create({
    data: { userId: user.id, roleId: role.id },
  });

  const loginResponse = await request(app.getHttpServer())
    .post('/auth/login')
    .send({
      email: `role-op-${suffix}@test.edu`,
      password: 'operator_password',
    })
    .expect(200);

  return loginResponse.body.data.accessToken as string;
}

describe('Roles', () => {
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

  describe('POST /roles', () => {
    it('creates a role with permissions transactionally', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['role.create'],
        'creator',
      );

      await prisma.permission.createMany({
        data: [
          {
            code: 'course.read',
            module: 'course',
            description: 'View courses',
          },
          {
            code: 'section.read',
            module: 'section',
            description: 'View sections',
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .post('/roles')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Academic Viewer',
          permissionCodes: ['course.read', 'section.read'],
        })
        .expect(201);

      expect(response.body.data).toMatchObject({
        name: 'Academic Viewer',
        permissionCodes: ['course.read', 'section.read'],
      });

      const roleId: string = response.body.data.id;

      const linkCount = await prisma.rolePermission.count({
        where: { roleId },
      });
      expect(linkCount).toBe(2);

      const role = await prisma.role.findUnique({ where: { id: roleId } });
      expect(role).not.toBeNull();
      expect(role!.name).toBe('Academic Viewer');
    });
  });

  describe('PATCH /roles/:roleId', () => {
    it('replaces old permissions with new ones', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['role.update'],
        'updater',
      );

      const permA = await prisma.permission.create({
        data: { code: 'course.read', module: 'course', description: 'a' },
      });
      const permB = await prisma.permission.create({
        data: { code: 'course.update', module: 'course', description: 'b' },
      });
      const permC = await prisma.permission.create({
        data: { code: 'course.delete', module: 'course', description: 'c' },
      });

      const role = await prisma.role.create({
        data: { name: 'Old Role', isEditable: true },
      });

      await prisma.rolePermission.createMany({
        data: [
          { roleId: role.id, permissionId: permA.id },
          { roleId: role.id, permissionId: permB.id },
        ],
      });

      await request(app.getHttpServer())
        .patch(`/roles/${role.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ permissionCodes: ['course.delete'] })
        .expect(200);

      const remaining = await prisma.rolePermission.findMany({
        where: { roleId: role.id },
        include: { permission: true },
      });
      const codes = remaining.map((rp) => rp.permission.code);
      expect(codes).toEqual(['course.delete']);
    });

    it('returns 422 when patching an immutable role', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['role.update'],
        'immutable-updater',
      );

      const role = await prisma.role.create({
        data: { name: 'System Role', isEditable: false },
      });

      await request(app.getHttpServer())
        .patch(`/roles/${role.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Hacked' })
        .expect(422);
    });
  });

  describe('DELETE /roles/:roleId', () => {
    it('returns 403 when deleting an immutable role', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['role.delete'],
        'immutable-deleter',
      );

      const role = await prisma.role.create({
        data: { name: 'System Default', isEditable: false },
      });

      await request(app.getHttpServer())
        .delete(`/roles/${role.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });
});
