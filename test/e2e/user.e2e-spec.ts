import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { clearDatabase } from '../utils/prisma.test-utils';
import { randomBytes, scryptSync } from 'node:crypto';
import { ErrorCodes } from '@core/domain/error-codes';

async function loginWithPermissions(
  app: INestApplication,
  prisma: PrismaService,
  permissionCodes: string[],
  suffix: string,
): Promise<string> {
  const permissions = await Promise.all(
    permissionCodes.map((code: string) =>
      prisma.permission.create({
        data: { code, module: code.split('.')[0], description: code },
      }),
    ),
  );

  const role = await prisma.role.create({
    data: { name: `Test Role ${suffix}`, isEditable: true },
  });

  await prisma.rolePermission.createMany({
    data: permissions.map((p: { id: string }) => ({
      roleId: role.id,
      permissionId: p.id,
    })),
  });

  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync('operator_password', salt, 64).toString('hex');

  const user = await prisma.user.create({
    data: {
      email: `operator-${suffix}@test.edu`,
      password: `${salt}:${hash}`,
      firstName: 'Operator',
      lastName: suffix,
      ci: `operator-ci-${suffix}`,
    },
  });

  const adminProfile = await prisma.adminProfile.create({
    data: { userId: user.id },
  });

  await prisma.adminRole.create({
    data: { adminProfileId: adminProfile.id, roleId: role.id },
  });

  const loginResponse = await request(app.getHttpServer())
    .post('/auth/login')
    .send({
      email: `operator-${suffix}@test.edu`,
      password: 'operator_password',
    })
    .expect(200);

  return loginResponse.body.data.accessToken as string;
}

describe('Users', () => {
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

  describe('GET /users/me', () => {
    it('returns limited data for super admin', async () => {
      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync('test_password', salt, 64).toString('hex');

      await prisma.superAdmin.create({
        data: {
          email: 'admin@test.edu',
          password: `${salt}:${hash}`,
          mustChangePassword: false,
        },
      });

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@test.edu', password: 'test_password' })
        .expect(200);

      const token: string = loginResponse.body.data.accessToken;

      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        email: 'admin@test.edu',
        type: 'SUPER_ADMIN',
      });
      expect(response.body.data.permissions).toEqual(['*']);
      expect(response.body.data.firstName).toBeUndefined();
    });

    it('returns full profile for a regular user', async () => {
      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync('user_password', salt, 64).toString('hex');

      await prisma.user.create({
        data: {
          email: 'user@test.edu',
          password: `${salt}:${hash}`,
          firstName: 'Regular',
          lastName: 'User',
          ci: 'user-ci',
        },
      });

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'user@test.edu', password: 'user_password' })
        .expect(200);

      const token: string = loginResponse.body.data.accessToken;

      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        email: 'user@test.edu',
        firstName: 'Regular',
        lastName: 'User',
        type: 'USER',
      });
      expect(response.body.data.roles).toEqual([]);
      expect(response.body.data.permissions).toEqual([]);
    });
  });

  describe('GET /users', () => {
    it('returns all users with their roles for user.read permission', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['user.read'],
        'reader',
      );

      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync('target_password', salt, 64).toString('hex');

      const role = await prisma.role.create({
        data: { name: 'Editor', isEditable: true },
      });

      const targetUser = await prisma.user.create({
        data: {
          email: 'listed@test.edu',
          password: `${salt}:${hash}`,
          firstName: 'Listed',
          lastName: 'User',
          ci: 'listed-ci',
        },
      });

      const listedProfile = await prisma.adminProfile.create({
        data: { userId: targetUser.id },
      });

      await prisma.adminRole.create({
        data: { adminProfileId: listedProfile.id, roleId: role.id },
      });

      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            email: 'listed@test.edu',
            firstName: 'Listed',
            lastName: 'User',
            ci: 'listed-ci',
            isActive: true,
            roles: ['Editor'],
          }),
        ]),
      );
    });

    it('filters users by profile', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['user.read', 'student.read'],
        'filterer',
      );

      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync('filter_password', salt, 64).toString('hex');
      const password = `${salt}:${hash}`;

      const adminUser = await prisma.user.create({
        data: {
          email: 'admin-filter@test.edu',
          password,
          firstName: 'Admin',
          lastName: 'Filter',
          ci: 'admin-filter-ci',
        },
      });
      await prisma.adminProfile.create({ data: { userId: adminUser.id } });

      const studentUser = await prisma.user.create({
        data: {
          email: 'student-filter@test.edu',
          password,
          firstName: 'Student',
          lastName: 'Filter',
          ci: 'student-filter-ci',
        },
      });
      const filterProgram = await prisma.program.create({
        data: { name: 'Filter Prog', termType: 'SEMESTER' },
      });
      await prisma.studentProfile.create({
        data: {
          userId: studentUser.id,
          programId: filterProgram.id,
          enrollmentYear: 2026,
        },
      });

      await prisma.user.create({
        data: {
          email: 'none-filter@test.edu',
          password,
          firstName: 'None',
          lastName: 'Filter',
          ci: 'none-filter-ci',
        },
      });

      const students = await request(app.getHttpServer())
        .get('/users?profile=STUDENT')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const studentEmails = students.body.data.map(
        (u: { email: string }) => u.email,
      );
      expect(studentEmails).toContain('student-filter@test.edu');
      expect(studentEmails).not.toContain('admin-filter@test.edu');
      expect(studentEmails).not.toContain('none-filter@test.edu');

      const admins = await request(app.getHttpServer())
        .get('/users?profile=ADMIN')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const adminEmails = admins.body.data.map(
        (u: { email: string }) => u.email,
      );
      expect(adminEmails).toContain('admin-filter@test.edu');
      expect(adminEmails).not.toContain('student-filter@test.edu');

      const none = await request(app.getHttpServer())
        .get('/users?profile=NONE')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const noneEmails = none.body.data.map((u: { email: string }) => u.email);
      expect(noneEmails).toContain('none-filter@test.edu');
      expect(noneEmails).not.toContain('admin-filter@test.edu');
    });

    it('filters by text, active status, role and enrollment year', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['user.read', 'student.read'],
        'filterer2',
      );

      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync('filter_password', salt, 64).toString('hex');
      const password = `${salt}:${hash}`;

      const searchUser = await prisma.user.create({
        data: {
          email: 'juan@test.edu',
          password,
          firstName: 'Juan',
          lastName: 'Perez',
          ci: '12345678',
        },
      });
      const searchProgram = await prisma.program.create({
        data: { name: 'Search Prog', termType: 'SEMESTER' },
      });
      await prisma.studentProfile.create({
        data: {
          userId: searchUser.id,
          programId: searchProgram.id,
          enrollmentYear: 2025,
        },
      });

      const role = await prisma.role.create({
        data: { name: 'Filter Role', isEditable: true },
      });
      const roleUser = await prisma.user.create({
        data: {
          email: 'roler@test.edu',
          password,
          firstName: 'Roler',
          lastName: 'User',
          ci: 'roler-ci',
        },
      });
      const roleAdminProfile = await prisma.adminProfile.create({
        data: { userId: roleUser.id },
      });
      await prisma.adminRole.create({
        data: { adminProfileId: roleAdminProfile.id, roleId: role.id },
      });

      await prisma.user.create({
        data: {
          email: 'inactive@test.edu',
          password,
          firstName: 'Inactive',
          lastName: 'User',
          ci: 'inactive-ci',
          isActive: false,
        },
      });

      const qResponse = await request(app.getHttpServer())
        .get('/users?q=juan')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const qEmails = qResponse.body.data.map(
        (u: { email: string }) => u.email,
      );
      expect(qEmails).toContain('juan@test.edu');
      expect(qEmails).not.toContain('roler@test.edu');

      const roleResponse = await request(app.getHttpServer())
        .get(`/users?roleId=${role.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const roleEmails = roleResponse.body.data.map(
        (u: { email: string }) => u.email,
      );
      expect(roleEmails).toContain('roler@test.edu');
      expect(roleEmails).not.toContain('juan@test.edu');
      expect(roleResponse.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            email: 'roler@test.edu',
            profiles: ['ADMIN'],
          }),
        ]),
      );

      const activeResponse = await request(app.getHttpServer())
        .get('/users?isActive=true')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const activeEmails = activeResponse.body.data.map(
        (u: { email: string }) => u.email,
      );
      expect(activeEmails).toContain('juan@test.edu');
      expect(activeEmails).not.toContain('inactive@test.edu');

      const yearResponse = await request(app.getHttpServer())
        .get('/users?profile=STUDENT&enrollmentYear=2025')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const yearEmails = yearResponse.body.data.map(
        (u: { email: string }) => u.email,
      );
      expect(yearEmails).toContain('juan@test.edu');
      expect(yearEmails).not.toContain('roler@test.edu');
      expect(yearResponse.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            email: 'juan@test.edu',
            profiles: ['STUDENT'],
          }),
        ]),
      );
    });

    it('returns 403 without user.read permission', async () => {
      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync('user_password', salt, 64).toString('hex');

      await prisma.user.create({
        data: {
          email: 'noperm@test.edu',
          password: `${salt}:${hash}`,
          firstName: 'No',
          lastName: 'Perm',
          ci: 'noperm-ci',
        },
      });

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'noperm@test.edu', password: 'user_password' })
        .expect(200);

      const token: string = loginResponse.body.data.accessToken;

      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(response.body).toMatchObject({
        statusCode: 403,
        errorCode: ErrorCodes.SEC_AUTH_INSUFFICIENT_PERMISSIONS,
        path: '/users',
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    it('allows super admin to list users', async () => {
      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync('test_password', salt, 64).toString('hex');

      await prisma.superAdmin.create({
        data: {
          email: 'admin@test.edu',
          password: `${salt}:${hash}`,
          mustChangePassword: false,
        },
      });

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@test.edu', password: 'test_password' })
        .expect(200);

      const token: string = loginResponse.body.data.accessToken;

      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data).toEqual([]);
    });
  });

  describe('POST /users', () => {
    it('creates a user when authenticated with user.create permission', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['user.create', 'user.read'],
        'creator',
      );

      const createProgram = await prisma.program.create({
        data: { name: 'Create Prog', termType: 'SEMESTER' },
      });

      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'newuser@test.edu',
          password: 'new_password',
          firstName: 'New',
          lastName: 'User',
          ci: 'new-ci',
          profiles: ['STUDENT'],
          programId: createProgram.id,
        })
        .expect(201);

      expect(response.body.data).toMatchObject({
        email: 'newuser@test.edu',
        firstName: 'New',
        lastName: 'User',
        profiles: ['STUDENT'],
      });
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.studentProfileId).toBeDefined();
      expect(response.body.data.adminProfileId).toBeNull();

      const saved = await prisma.user.findUnique({
        where: { email: 'newuser@test.edu' },
      });
      expect(saved).not.toBeNull();
      expect(saved!.password).toContain(':');
      expect(saved!.firstName).toBe('New');
    });

    it('returns 403 without user.create permission', async () => {
      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync('user_password', salt, 64).toString('hex');

      await prisma.user.create({
        data: {
          email: 'noperm@test.edu',
          password: `${salt}:${hash}`,
          firstName: 'No',
          lastName: 'Perm',
          ci: 'noperm-ci',
        },
      });

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'noperm@test.edu', password: 'user_password' })
        .expect(200);

      const token: string = loginResponse.body.data.accessToken;

      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'shouldfail@test.edu',
          password: 'test',
          firstName: 'Should',
          lastName: 'Fail',
          ci: 'fail-ci',
          profiles: ['STUDENT'],
        })
        .expect(403);

      expect(response.body).toMatchObject({
        statusCode: 403,
        errorCode: ErrorCodes.SEC_AUTH_INSUFFICIENT_PERMISSIONS,
        path: '/users',
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    it('creates a user with an ADMIN profile without roles', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['user.create', 'user.read'],
        'admin-creator',
      );

      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'newadmin@test.edu',
          password: 'new_password',
          firstName: 'New',
          lastName: 'Admin',
          ci: 'new-admin-ci',
          profiles: ['ADMIN'],
        })
        .expect(201);

      expect(response.body.data).toMatchObject({
        email: 'newadmin@test.edu',
        profiles: ['ADMIN'],
        roles: [],
      });
      expect(response.body.data.adminProfileId).toBeDefined();

      const savedAdminProfile = await prisma.adminProfile.findUnique({
        where: { userId: response.body.data.id },
        include: { roles: true },
      });
      expect(savedAdminProfile).not.toBeNull();
      expect(savedAdminProfile!.roles).toEqual([]);
    });

    it('rejects a user without any profile with 400', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['user.create', 'user.read'],
        'no-profile-creator',
      );

      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'noprofile@test.edu',
          password: 'new_password',
          firstName: 'No',
          lastName: 'Profile',
          ci: 'no-profile-ci',
        })
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        errorCode: ErrorCodes.ERR_VALIDATION_FAILED,
      });
    });
  });

  describe('POST /users/:userId/roles', () => {
    it('assigns a role to a user', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['role.assign', 'role.read'],
        'assigner',
      );

      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync('target_password', salt, 64).toString('hex');

      const targetUser = await prisma.user.create({
        data: {
          email: 'target@test.edu',
          password: `${salt}:${hash}`,
          firstName: 'Target',
          lastName: 'User',
          ci: 'target-ci',
        },
      });

      const targetRole = await prisma.role.create({
        data: { name: 'Target Role', isEditable: true },
      });

      await request(app.getHttpServer())
        .post(`/users/${targetUser.id}/roles`)
        .set('Authorization', `Bearer ${token}`)
        .send({ roleId: targetRole.id })
        .expect(201);

      const assignedProfile = await prisma.adminProfile.findUniqueOrThrow({
        where: { userId: targetUser.id },
      });
      const userRole = await prisma.adminRole.findUnique({
        where: {
          adminProfileId_roleId: {
            adminProfileId: assignedProfile.id,
            roleId: targetRole.id,
          },
        },
      });
      expect(userRole).not.toBeNull();
    });
  });

  describe('Duplicate prevention', () => {
    it('returns 422 when creating a user with an existing email', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['user.create', 'user.read'],
        'dup-email-operator',
      );

      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync('existing_password', salt, 64).toString('hex');

      await prisma.user.create({
        data: {
          email: 'existing@test.edu',
          password: `${salt}:${hash}`,
          firstName: 'Existing',
          lastName: 'User',
          ci: 'existing-ci',
        },
      });

      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'existing@test.edu',
          password: 'new_password',
          firstName: 'Duplicate',
          lastName: 'Email',
          ci: 'different-ci',
          profiles: ['STUDENT'],
        })
        .expect(409);

      expect(response.body).toMatchObject({
        errorCode: ErrorCodes.ERR_USER_EMAIL_EXISTS,
        statusCode: 409,
      });
      expect(response.body.message).toContain('Email already in use');
    });

    it('returns 422 when creating a user with an existing CI', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['user.create', 'user.read'],
        'dup-ci-operator',
      );

      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync('existing_password', salt, 64).toString('hex');

      await prisma.user.create({
        data: {
          email: 'existing@test.edu',
          password: `${salt}:${hash}`,
          firstName: 'Existing',
          lastName: 'User',
          ci: 'dup-ci',
        },
      });

      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'different@test.edu',
          password: 'new_password',
          firstName: 'Duplicate',
          lastName: 'CI',
          ci: 'dup-ci',
          profiles: ['STUDENT'],
        })
        .expect(409);

      expect(response.body).toMatchObject({
        errorCode: ErrorCodes.ERR_USER_CI_EXISTS,
        statusCode: 409,
      });
      expect(response.body.message).toContain('CI already in use');
    });
  });

  describe('GET /users academic filters and enrichment', () => {
    it('returns enrollmentYear and programId on list items', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['user.read', 'student.read'],
        'enrich',
      );

      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync('enrich_password', salt, 64).toString('hex');

      const program = await prisma.program.create({
        data: { name: 'Ingenieria en Sistemas', termType: 'SEMESTER' },
      });
      const course = await prisma.course.create({
        data: {
          programId: program.id,
          code: 'SIS-101',
          name: 'Intro a Sistemas',
          credits: 5,
          termLevel: 1,
        },
      });
      const term = await prisma.term.create({
        data: {
          programId: program.id,
          name: 'Spring 2026',
          startDate: new Date('2026-03-01'),
          endDate: new Date('2026-07-31'),
          status: 'ACTIVE',
        },
      });
      const teacher = await prisma.user.create({
        data: {
          email: 'teacher-enrich@test.edu',
          password: `${salt}:${hash}`,
          firstName: 'Prof',
          lastName: 'Enrich',
          ci: 'teacher-enrich-ci',
        },
      });
      const teacherProfile = await prisma.adminProfile.create({
        data: { userId: teacher.id },
      });
      const section = await prisma.courseSection.create({
        data: {
          courseId: course.id,
          termId: term.id,
          teacherId: teacherProfile.id,
          name: 'SIS-101-M1',
          capacity: 30,
        },
      });
      const student = await prisma.user.create({
        data: {
          email: 'student-enrich@test.edu',
          password: `${salt}:${hash}`,
          firstName: 'Student',
          lastName: 'Enrich',
          ci: 'student-enrich-ci',
        },
      });
      const studentProfile = await prisma.studentProfile.create({
        data: {
          userId: student.id,
          programId: program.id,
          enrollmentYear: 2026,
        },
      });
      await prisma.enrollment.create({
        data: {
          sectionId: section.id,
          studentId: studentProfile.id,
          status: 'ENROLLED',
        },
      });

      const freshStudent = await prisma.user.create({
        data: {
          email: 'fresh-enrich@test.edu',
          password: `${salt}:${hash}`,
          firstName: 'Fresh',
          lastName: 'Enrich',
          ci: 'fresh-enrich-ci',
        },
      });
      await prisma.studentProfile.create({
        data: { userId: freshStudent.id, programId: program.id },
      });

      const response = await request(app.getHttpServer())
        .get(`/users?q=enrich`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            email: 'student-enrich@test.edu',
            enrollmentYear: 2026,
            programId: program.id,
          }),
          expect.objectContaining({
            email: 'fresh-enrich@test.edu',
            programId: program.id,
          }),
        ]),
      );
      const nonStudent = response.body.data.find(
        (u: { email: string }) => u.email === 'teacher-enrich@test.edu',
      );
      expect(nonStudent).toMatchObject({ programId: null });
    });

    it('filters by programId and academicStatus', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['user.read', 'student.read'],
        'acad-filter',
      );

      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync('acad_password', salt, 64).toString('hex');

      const informatica = await prisma.program.create({
        data: { name: 'Informatica', termType: 'SEMESTER' },
      });
      const medicina = await prisma.program.create({
        data: { name: 'Medicina', termType: 'SEMESTER' },
      });
      const courseA = await prisma.course.create({
        data: {
          programId: informatica.id,
          code: 'INF-101',
          name: 'Programacion',
          credits: 4,
          termLevel: 1,
        },
      });
      const courseB = await prisma.course.create({
        data: {
          programId: medicina.id,
          code: 'MED-101',
          name: 'Anatomia',
          credits: 4,
          termLevel: 1,
        },
      });
      const term = await prisma.term.create({
        data: {
          programId: medicina.id,
          name: 'Spring 2026',
          startDate: new Date('2026-03-01'),
          endDate: new Date('2026-07-31'),
          status: 'ACTIVE',
        },
      });
      const teacher = await prisma.user.create({
        data: {
          email: 'teacher-acad@test.edu',
          password: `${salt}:${hash}`,
          firstName: 'Prof',
          lastName: 'Acad',
          ci: 'teacher-acad-ci',
        },
      });
      const teacherProfile = await prisma.adminProfile.create({
        data: { userId: teacher.id },
      });
      const sectionA = await prisma.courseSection.create({
        data: {
          courseId: courseA.id,
          termId: term.id,
          teacherId: teacherProfile.id,
          name: 'INF-M1',
          capacity: 30,
        },
      });
      const sectionB = await prisma.courseSection.create({
        data: {
          courseId: courseB.id,
          termId: term.id,
          teacherId: teacherProfile.id,
          name: 'MED-M1',
          capacity: 30,
        },
      });

      const enrolled = await prisma.user.create({
        data: {
          email: 'enrolled-acad@test.edu',
          password: `${salt}:${hash}`,
          firstName: 'Enrolled',
          lastName: 'Acad',
          ci: 'enrolled-acad-ci',
        },
      });
      const enrolledProfile = await prisma.studentProfile.create({
        data: { userId: enrolled.id, programId: informatica.id },
      });
      await prisma.enrollment.create({
        data: {
          sectionId: sectionA.id,
          studentId: enrolledProfile.id,
          status: 'ENROLLED',
        },
      });

      const withdrawn = await prisma.user.create({
        data: {
          email: 'withdrawn-acad@test.edu',
          password: `${salt}:${hash}`,
          firstName: 'Withdrawn',
          lastName: 'Acad',
          ci: 'withdrawn-acad-ci',
        },
      });
      const withdrawnProfile = await prisma.studentProfile.create({
        data: { userId: withdrawn.id, programId: medicina.id },
      });
      await prisma.enrollment.create({
        data: {
          sectionId: sectionB.id,
          studentId: withdrawnProfile.id,
          status: 'WITHDRAWN',
        },
      });

      const direct = await prisma.user.create({
        data: {
          email: 'direct-acad@test.edu',
          password: `${salt}:${hash}`,
          firstName: 'Direct',
          lastName: 'Acad',
          ci: 'direct-acad-ci',
        },
      });
      await prisma.studentProfile.create({
        data: { userId: direct.id, programId: informatica.id },
      });

      const byProgram = await request(app.getHttpServer())
        .get(`/users?programId=${informatica.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const byProgramEmails = byProgram.body.data.map(
        (u: { email: string }) => u.email,
      );
      expect(byProgramEmails).toContain('enrolled-acad@test.edu');
      expect(byProgramEmails).toContain('direct-acad@test.edu');
      expect(byProgramEmails).not.toContain('withdrawn-acad@test.edu');

      const byStatus = await request(app.getHttpServer())
        .get(`/users?academicStatus=WITHDRAWN`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const byStatusEmails = byStatus.body.data.map(
        (u: { email: string }) => u.email,
      );
      expect(byStatusEmails).toContain('withdrawn-acad@test.edu');
      expect(byStatusEmails).not.toContain('enrolled-acad@test.edu');

      const combined = await request(app.getHttpServer())
        .get(`/users?programId=${medicina.id}&academicStatus=WITHDRAWN`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const combinedEmails = combined.body.data.map(
        (u: { email: string }) => u.email,
      );
      expect(combinedEmails).toContain('withdrawn-acad@test.edu');
    });
  });

  describe('GET /users/:userId/academic-snapshot', () => {
    it('returns active-term sections and passed credits', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['student.read'],
        'snapshot-reader',
      );

      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync('snap_password', salt, 64).toString('hex');

      const program = await prisma.program.create({
        data: { name: 'Snapshot Prog', termType: 'SEMESTER' },
      });
      const course = await prisma.course.create({
        data: {
          programId: program.id,
          code: 'SNAP-101',
          name: 'Calculo I',
          credits: 4,
          termLevel: 1,
        },
      });
      const activeTerm = await prisma.term.create({
        data: {
          programId: program.id,
          name: 'Active 2026',
          startDate: new Date('2026-03-01'),
          endDate: new Date('2026-07-31'),
          status: 'ACTIVE',
        },
      });
      const closedTerm = await prisma.term.create({
        data: {
          programId: program.id,
          name: 'Closed 2025',
          startDate: new Date('2025-03-01'),
          endDate: new Date('2025-07-31'),
          status: 'CLOSED',
        },
      });
      const teacher = await prisma.user.create({
        data: {
          email: 'teacher-snap@test.edu',
          password: `${salt}:${hash}`,
          firstName: 'Prof',
          lastName: 'Snap',
          ci: 'teacher-snap-ci',
        },
      });
      const teacherProfile = await prisma.adminProfile.create({
        data: { userId: teacher.id },
      });
      const activeSection = await prisma.courseSection.create({
        data: {
          courseId: course.id,
          termId: activeTerm.id,
          teacherId: teacherProfile.id,
          name: 'CAL-M1',
          capacity: 30,
        },
      });
      const closedSection = await prisma.courseSection.create({
        data: {
          courseId: course.id,
          termId: closedTerm.id,
          teacherId: teacherProfile.id,
          name: 'CAL-M0',
          capacity: 30,
        },
      });
      const student = await prisma.user.create({
        data: {
          email: 'student-snap@test.edu',
          password: `${salt}:${hash}`,
          firstName: 'Student',
          lastName: 'Snap',
          ci: 'student-snap-ci',
        },
      });
      const studentProfile = await prisma.studentProfile.create({
        data: { userId: student.id, programId: program.id },
      });
      await prisma.enrollment.create({
        data: {
          sectionId: activeSection.id,
          studentId: studentProfile.id,
          status: 'ENROLLED',
        },
      });
      await prisma.enrollment.create({
        data: {
          sectionId: closedSection.id,
          studentId: studentProfile.id,
          status: 'ENROLLED',
        },
      });
      await prisma.transcript.create({
        data: {
          studentId: studentProfile.id,
          courseId: course.id,
          termId: closedTerm.id,
          finalGrade: 90,
          status: 'PASSED',
        },
      });
      const failedCourse = await prisma.course.create({
        data: {
          programId: program.id,
          code: 'SNAP-102',
          name: 'Fisica',
          credits: 3,
          termLevel: 2,
        },
      });
      await prisma.transcript.create({
        data: {
          studentId: studentProfile.id,
          courseId: failedCourse.id,
          termId: closedTerm.id,
          finalGrade: 40,
          status: 'FAILED',
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/users/${student.id}/academic-snapshot`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        sections: [
          {
            sectionName: 'CAL-M1',
            courseName: 'Calculo I',
            teacherName: 'Prof Snap',
          },
        ],
        passedCredits: 4,
      });
    });

    it('returns 403 without student.read permission', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['user.read'],
        'snapshot-denied',
      );

      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync('snap_password', salt, 64).toString('hex');

      const user = await prisma.user.create({
        data: {
          email: 'victim@test.edu',
          password: `${salt}:${hash}`,
          firstName: 'Victim',
          lastName: 'User',
          ci: 'victim-ci',
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/users/${user.id}/academic-snapshot`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(response.body).toMatchObject({
        statusCode: 403,
        errorCode: ErrorCodes.SEC_AUTH_INSUFFICIENT_PERMISSIONS,
      });
    });
  });

  describe('POST /users/students', () => {
    it('registers a student atomically with CI as default password', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['student.create', 'student.read', 'user.read'],
        'student-registrar',
      );

      const program = await prisma.program.create({
        data: { name: 'Ingenieria Civil', termType: 'SEMESTER' },
      });

      const response = await request(app.getHttpServer())
        .post('/users/students')
        .set('Authorization', `Bearer ${token}`)
        .send({
          firstName: 'Carlos',
          lastName: 'Rojas',
          email: 'carlos.rojas@test.edu',
          ci: '87654321',
          programId: program.id,
        })
        .expect(201);

      expect(response.body.data).toMatchObject({
        email: 'carlos.rojas@test.edu',
        program: 'Ingenieria Civil',
        message: 'Student registered successfully',
      });

      const created = await prisma.user.findUnique({
        where: { email: 'carlos.rojas@test.edu' },
        include: { studentProfile: true },
      });
      expect(created).not.toBeNull();
      expect(created?.studentProfile).not.toBeNull();
      expect(created?.studentProfile?.programId).toBe(program.id);
      const now = new Date();
      expect(created?.studentProfile?.enrollmentYear).toBe(now.getFullYear());
      expect(created?.studentProfile?.enrollmentMonth).toBe(now.getMonth() + 1);

      const salt = (created?.password ?? '').split(':')[0];
      const hash = (created?.password ?? '').split(':')[1];
      const expectedHash = scryptSync('87654321', salt, 64).toString('hex');
      expect(hash).toBe(expectedHash);

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'carlos.rojas@test.edu', password: '87654321' })
        .expect(200);
      expect(loginResponse.body.data.accessToken).toBeDefined();
    });

    it('returns 409 when the email is already in use', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['student.create', 'student.read', 'user.read'],
        'student-registrar-409a',
      );

      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync('dup_password', salt, 64).toString('hex');

      await prisma.user.create({
        data: {
          email: 'dup@test.edu',
          password: `${salt}:${hash}`,
          firstName: 'Dup',
          lastName: 'User',
          ci: 'dup-ci',
        },
      });

      const program = await prisma.program.create({
        data: { name: 'Dup Prog', termType: 'SEMESTER' },
      });

      const response = await request(app.getHttpServer())
        .post('/users/students')
        .set('Authorization', `Bearer ${token}`)
        .send({
          firstName: 'Dup',
          lastName: 'User',
          email: 'dup@test.edu',
          ci: 'other-ci',
          programId: program.id,
        })
        .expect(409);

      expect(response.body).toMatchObject({
        statusCode: 409,
        errorCode: ErrorCodes.ERR_USER_EMAIL_EXISTS,
      });
    });

    it('returns 409 when the CI is already registered', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['student.create', 'student.read', 'user.read'],
        'student-registrar-409b',
      );

      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync('dup_password', salt, 64).toString('hex');

      await prisma.user.create({
        data: {
          email: 'taken@test.edu',
          password: `${salt}:${hash}`,
          firstName: 'Taken',
          lastName: 'User',
          ci: '11111111',
        },
      });

      const program = await prisma.program.create({
        data: { name: 'Taken Prog', termType: 'SEMESTER' },
      });

      const response = await request(app.getHttpServer())
        .post('/users/students')
        .set('Authorization', `Bearer ${token}`)
        .send({
          firstName: 'New',
          lastName: 'Student',
          email: 'new@test.edu',
          ci: '11111111',
          programId: program.id,
        })
        .expect(409);

      expect(response.body).toMatchObject({
        statusCode: 409,
        errorCode: ErrorCodes.ERR_USER_CI_EXISTS,
      });
    });

    it('returns 404 when the program does not exist', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['student.create', 'student.read', 'user.read'],
        'student-registrar-404',
      );

      const response = await request(app.getHttpServer())
        .post('/users/students')
        .set('Authorization', `Bearer ${token}`)
        .send({
          firstName: 'Ghost',
          lastName: 'Student',
          email: 'ghost@test.edu',
          ci: '99999999',
          programId: '3f2c1b4a-0000-4000-8000-000000000000',
        })
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        errorCode: ErrorCodes.ERR_PROGRAM_NOT_FOUND,
      });
    });

    it('returns 403 without student.create permission', async () => {
      const token = await loginWithPermissions(
        app,
        prisma,
        ['user.read'],
        'student-denied',
      );

      const response = await request(app.getHttpServer())
        .post('/users/students')
        .set('Authorization', `Bearer ${token}`)
        .send({
          firstName: 'No',
          lastName: 'Permission',
          email: 'noperm-student@test.edu',
          ci: '12340001',
          programId: '3f2c1b4a-0000-4000-8000-000000000000',
        })
        .expect(403);

      expect(response.body).toMatchObject({
        statusCode: 403,
        errorCode: ErrorCodes.SEC_AUTH_INSUFFICIENT_PERMISSIONS,
      });
    });
  });
});
