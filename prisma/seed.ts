import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const PERMISSIONS: Array<{ code: string; module: string; description: string }> = [
  { code: 'institution.read', module: 'institution', description: 'View institution details' },
  { code: 'institution.update', module: 'institution', description: 'Update institution settings' },
  { code: 'user.create', module: 'user', description: 'Create users in the institution' },
  { code: 'user.read', module: 'user', description: 'View users in the institution' },
  { code: 'user.update', module: 'user', description: 'Update user profiles in the institution' },
  { code: 'user.delete', module: 'user', description: 'Remove users from the institution' },
  { code: 'student.read', module: 'student', description: 'View students' },
  { code: 'role.create', module: 'role', description: 'Create custom roles' },
  { code: 'role.read', module: 'role', description: 'View roles and their permissions' },
  { code: 'role.update', module: 'role', description: 'Modify role permissions' },
  { code: 'role.delete', module: 'role', description: 'Delete custom roles' },
  { code: 'role.assign', module: 'role', description: 'Assign roles to institution users' },
  { code: 'program.create', module: 'program', description: 'Create academic programs' },
  { code: 'program.read', module: 'program', description: 'View academic programs' },
  { code: 'program.update', module: 'program', description: 'Update program structure' },
  { code: 'program.delete', module: 'program', description: 'Delete academic programs' },
  { code: 'course.create', module: 'course', description: 'Create courses within a program' },
  { code: 'course.read', module: 'course', description: 'View course catalog' },
  { code: 'course.update', module: 'course', description: 'Update course details and credits' },
  { code: 'course.delete', module: 'course', description: 'Delete courses' },
  { code: 'section.create', module: 'section', description: 'Create course sections per term' },
  { code: 'section.read', module: 'section', description: 'View course sections' },
  { code: 'section.update', module: 'section', description: 'Modify section capacity or teacher' },
  { code: 'section.delete', module: 'section', description: 'Delete course sections' },
  { code: 'section.schedule', module: 'section', description: 'Manage section schedules' },
  { code: 'term.create', module: 'term', description: 'Create academic terms' },
  { code: 'term.read', module: 'term', description: 'View academic terms' },
  { code: 'term.update', module: 'term', description: 'Modify term dates' },
  { code: 'term.close', module: 'term', description: 'Close a term (immutable snapshot)' },
  { code: 'term.delete', module: 'term', description: 'Delete upcoming terms' },
  { code: 'enrollment.create', module: 'enrollment', description: 'Enroll students in sections' },
  { code: 'enrollment.read', module: 'enrollment', description: 'View enrollment records' },
  { code: 'enrollment.drop', module: 'enrollment', description: 'Drop student enrollments' },
  { code: 'assessment.create', module: 'assessment', description: 'Create assessment plans' },
  { code: 'assessment.read', module: 'assessment', description: 'View assessments' },
  { code: 'assessment.update', module: 'assessment', description: 'Modify assessment weight or due date' },
  { code: 'assessment.grade', module: 'assessment', description: 'Grade student submissions' },
  { code: 'transcript.read', module: 'transcript', description: 'View student transcripts' },
  { code: 'transcript.export', module: 'transcript', description: 'Export transcript records' },
];

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hashed = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hashed}`;
}

async function createDemoUsers(prisma: PrismaClient): Promise<void> {
  const DEMO_PASSWORD = 'Demo1234.';

  const roleDefinitions: Array<{ name: string; permissions: string[] }> = [
    {
      name: 'Coordinador Académico',
      permissions: [
        'user.create',
        'user.read',
        'user.update',
        'user.delete',
        'role.assign',
        'role.read',
        'student.read',
      ],
    },
    {
      name: 'Profesor',
      permissions: ['program.read', 'course.read', 'section.read', 'term.read'],
    },
  ];

  const roles: Array<{ id: string; name: string }> = [];
  for (const def of roleDefinitions) {
    const role = await prisma.role.upsert({
      where: { name: def.name },
      update: {},
      create: { name: def.name, isEditable: true },
    });

    const permissionIds: string[] = [];
    for (const code of def.permissions) {
      const permission = await prisma.permission.findUnique({ where: { code } });
      if (!permission) {
        console.warn(`Permission ${code} not found. Skipping for role ${def.name}.`);
        continue;
      }
      permissionIds.push(permission.id);
    }

    await prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId: string) => ({
        roleId: role.id,
        permissionId,
      })),
      skipDuplicates: true,
    });

    roles.push({ id: role.id, name: role.name });
    console.log(`Role ready: ${role.name}`);
  }

  const demoUsers: Array<{
    email: string;
    firstName: string;
    lastName: string;
    ci: string;
    adminProfile: { department: string } | null;
    roleNames: string[];
    studentProfile: { enrollmentYear: number } | null;
  }> = [
    {
      email: 'coordinador@escala.edu.ve',
      firstName: 'Laura',
      lastName: 'Rodriguez',
      ci: '10000001',
      adminProfile: { department: 'Coordinación' },
      roleNames: ['Coordinador Académico'],
      studentProfile: null,
    },
    {
      email: 'profesor@escala.edu.ve',
      firstName: 'Carlos',
      lastName: 'Mendez',
      ci: '10000002',
      adminProfile: { department: 'Ciencias' },
      roleNames: ['Profesor'],
      studentProfile: null,
    },
    {
      email: 'admin-sin-rol@escala.edu.ve',
      firstName: 'Rosa',
      lastName: 'Blanco',
      ci: '10000003',
      adminProfile: { department: 'Administración' },
      roleNames: [],
      studentProfile: null,
    },
    {
      email: 'estudiante@escala.edu.ve',
      firstName: 'Ana',
      lastName: 'Lopez',
      ci: '10000004',
      adminProfile: null,
      roleNames: [],
      studentProfile: { enrollmentYear: 2025 },
    },
    {
      email: 'estudiante2@escala.edu.ve',
      firstName: 'Pedro',
      lastName: 'Garcia',
      ci: '10000005',
      adminProfile: null,
      roleNames: [],
      studentProfile: { enrollmentYear: 2026 },
    },
    {
      email: 'hibrido@escala.edu.ve',
      firstName: 'Marta',
      lastName: 'Diaz',
      ci: '10000006',
      adminProfile: { department: 'Tutorías' },
      roleNames: ['Profesor'],
      studentProfile: { enrollmentYear: 2026 },
    },
    {
      email: 'sin-perfil@escala.edu.ve',
      firstName: 'Luis',
      lastName: 'Torres',
      ci: '10000007',
      adminProfile: null,
      roleNames: [],
      studentProfile: null,
    },
  ];

  for (const demo of demoUsers) {
    const existing = await prisma.user.findUnique({
      where: { email: demo.email },
    });
    if (existing) {
      console.log(`Demo user ${demo.email} already exists. Skipping.`);
      continue;
    }

    const user = await prisma.user.create({
      data: {
        email: demo.email,
        password: hashPassword(DEMO_PASSWORD),
        firstName: demo.firstName,
        lastName: demo.lastName,
        ci: demo.ci,
      },
    });

    if (demo.adminProfile) {
      const profile = await prisma.adminProfile.create({
        data: { userId: user.id, department: demo.adminProfile.department },
      });
      const roleIds = demo.roleNames
        .map((name: string) => roles.find((r) => r.name === name)?.id)
        .filter((id): id is string => id !== undefined);
      await prisma.adminRole.createMany({
        data: roleIds.map((roleId: string) => ({
          adminProfileId: profile.id,
          roleId,
        })),
        skipDuplicates: true,
      });
    }

    if (demo.studentProfile) {
      await prisma.studentProfile.create({
        data: {
          userId: user.id,
          enrollmentYear: demo.studentProfile.enrollmentYear,
        },
      });
    }

    console.log(`Demo user created: ${demo.email} (password: ${DEMO_PASSWORD})`);
  }
}

interface SeedCourse {
  code: string;
  name: string;
  credits: number;
  termLevel: number;
  prereqCodes: string[];
}

const DEMO_PROGRAM_NAME = 'Ingeniería en Informática';

const DEMO_COURSES: SeedCourse[] = [
  { code: 'INF101', name: 'Introducción a la Programación', credits: 4, termLevel: 1, prereqCodes: [] },
  { code: 'MAT101', name: 'Cálculo I', credits: 4, termLevel: 1, prereqCodes: [] },
  { code: 'FIS101', name: 'Física I', credits: 4, termLevel: 1, prereqCodes: [] },
  { code: 'COM101', name: 'Lenguaje y Comunicación', credits: 3, termLevel: 1, prereqCodes: [] },
  { code: 'INF102', name: 'Fundamentos de Computación', credits: 3, termLevel: 1, prereqCodes: [] },
  { code: 'INF201', name: 'Programación Estructurada', credits: 4, termLevel: 2, prereqCodes: ['INF101'] },
  { code: 'MAT201', name: 'Cálculo II', credits: 4, termLevel: 2, prereqCodes: ['MAT101'] },
  { code: 'FIS201', name: 'Física II', credits: 4, termLevel: 2, prereqCodes: ['FIS101'] },
  { code: 'MAT202', name: 'Matemática Discreta', credits: 3, termLevel: 2, prereqCodes: ['INF101'] },
  { code: 'INF202', name: 'Algoritmos y Estructuras de Datos I', credits: 4, termLevel: 2, prereqCodes: ['INF201'] },
  { code: 'INF301', name: 'Programación Orientada a Objetos', credits: 4, termLevel: 3, prereqCodes: ['INF201'] },
  { code: 'MAT301', name: 'Álgebra Lineal', credits: 4, termLevel: 3, prereqCodes: ['MAT201'] },
  { code: 'INF302', name: 'Estructuras de Datos II', credits: 4, termLevel: 3, prereqCodes: ['INF202'] },
  { code: 'MAT302', name: 'Probabilidad y Estadística', credits: 3, termLevel: 3, prereqCodes: ['MAT201'] },
  { code: 'INF303', name: 'Arquitectura de Computadores', credits: 3, termLevel: 3, prereqCodes: ['FIS201', 'INF102'] },
  { code: 'INF401', name: 'Bases de Datos I', credits: 4, termLevel: 4, prereqCodes: ['INF301'] },
  { code: 'MAT401', name: 'Ecuaciones Diferenciales', credits: 3, termLevel: 4, prereqCodes: ['MAT201'] },
  { code: 'INF402', name: 'Ingeniería de Software I', credits: 4, termLevel: 4, prereqCodes: ['INF301'] },
  { code: 'INF403', name: 'Sistemas Operativos', credits: 4, termLevel: 4, prereqCodes: ['INF303', 'INF302'] },
  { code: 'COM401', name: 'Inglés Técnico I', credits: 2, termLevel: 4, prereqCodes: [] },
  { code: 'INF501', name: 'Bases de Datos II', credits: 4, termLevel: 5, prereqCodes: ['INF401'] },
  { code: 'INF502', name: 'Redes de Computadoras I', credits: 4, termLevel: 5, prereqCodes: ['INF403', 'INF303'] },
  { code: 'INF503', name: 'Ingeniería de Software II', credits: 4, termLevel: 5, prereqCodes: ['INF402'] },
  { code: 'MAT501', name: 'Investigación de Operaciones', credits: 3, termLevel: 5, prereqCodes: ['MAT301', 'MAT302'] },
  { code: 'INF504', name: 'Compiladores e Intérpretes', credits: 4, termLevel: 5, prereqCodes: ['INF403', 'INF302'] },
  { code: 'INF601', name: 'Redes de Computadoras II', credits: 4, termLevel: 6, prereqCodes: ['INF502'] },
  { code: 'INF602', name: 'Inteligencia Artificial', credits: 4, termLevel: 6, prereqCodes: ['MAT302', 'INF302'] },
  { code: 'INF603', name: 'Desarrollo Web', credits: 4, termLevel: 6, prereqCodes: ['INF503', 'INF401'] },
  { code: 'INF604', name: 'Sistemas Distribuidos', credits: 4, termLevel: 6, prereqCodes: ['INF502', 'INF403'] },
  { code: 'COM601', name: 'Inglés Técnico II', credits: 2, termLevel: 6, prereqCodes: ['COM401'] },
  { code: 'INF701', name: 'Auditoría y Seguridad Informática', credits: 3, termLevel: 7, prereqCodes: ['INF604'] },
  { code: 'INF702', name: 'Desarrollo Móvil', credits: 4, termLevel: 7, prereqCodes: ['INF603'] },
  { code: 'INF703', name: 'Interacción Humano-Computador', credits: 3, termLevel: 7, prereqCodes: ['INF503'] },
  { code: 'INF704', name: 'Computación Gráfica', credits: 4, termLevel: 7, prereqCodes: ['INF302', 'MAT301'] },
  { code: 'ADM701', name: 'Gerencia de Proyectos', credits: 3, termLevel: 7, prereqCodes: ['INF503'] },
  { code: 'INF801', name: 'Big Data y Analítica', credits: 4, termLevel: 8, prereqCodes: ['INF602', 'INF501'] },
  { code: 'INF802', name: 'Cloud Computing', credits: 3, termLevel: 8, prereqCodes: ['INF604'] },
  { code: 'INF803', name: 'Arquitectura de Software', credits: 4, termLevel: 8, prereqCodes: ['INF604', 'INF503'] },
  { code: 'INF804', name: 'Aseguramiento de la Calidad y Pruebas', credits: 3, termLevel: 8, prereqCodes: ['INF503'] },
  { code: 'INF805', name: 'Ética y Legislación Informática', credits: 2, termLevel: 8, prereqCodes: ['ADM701'] },
  { code: 'INF901', name: 'Proyecto de Grado I', credits: 4, termLevel: 9, prereqCodes: ['INF803', 'INF702'] },
  { code: 'INF902', name: 'DevOps e Integración Continua', credits: 3, termLevel: 9, prereqCodes: ['INF802', 'INF801'] },
  { code: 'INF903', name: 'Criptografía', credits: 3, termLevel: 9, prereqCodes: ['INF701', 'MAT301'] },
  { code: 'INF904', name: 'Machine Learning', credits: 4, termLevel: 9, prereqCodes: ['INF801'] },
  { code: 'INF905', name: 'Seminario de Investigación', credits: 2, termLevel: 9, prereqCodes: ['INF805'] },
  { code: 'INF1001', name: 'Trabajo Especial de Grado', credits: 8, termLevel: 10, prereqCodes: ['INF901'] },
  { code: 'INF1002', name: 'Pasantías Profesionales', credits: 6, termLevel: 10, prereqCodes: ['INF903', 'INF902'] },
  { code: 'INF1003', name: 'Seminario de Emprendimiento', credits: 2, termLevel: 10, prereqCodes: ['INF905'] },
  { code: 'INF1004', name: 'Evaluación de Proyectos Tecnológicos', credits: 3, termLevel: 10, prereqCodes: ['ADM701'] },
];

async function createDemoProgram(prisma: PrismaClient): Promise<void> {
  const existing = await prisma.program.findFirst({
    where: { name: DEMO_PROGRAM_NAME, deletedAt: null },
  });
  if (existing) {
    console.log(`Demo program ${DEMO_PROGRAM_NAME} already exists. Skipping.`);
    return;
  }

  const totalCredits = DEMO_COURSES.reduce(
    (sum: number, c: SeedCourse) => sum + c.credits,
    0,
  );

  const program = await prisma.program.create({
    data: {
      name: DEMO_PROGRAM_NAME,
      termType: 'SEMESTER',
      totalCredits,
    },
  });
  console.log(`Program created: ${program.name} (${totalCredits} credits)`);

  const idByCode = new Map<string, string>();
  for (const c of DEMO_COURSES) {
    const course = await prisma.course.create({
      data: {
        programId: program.id,
        code: c.code,
        name: c.name,
        credits: c.credits,
        termLevel: c.termLevel,
      },
    });
    idByCode.set(c.code, course.id);
    console.log(`Course created: ${c.code} ${c.name} (level ${c.termLevel})`);
  }

  const prereqRows: Array<{ courseId: string; requiredCourseId: string }> = [];
  for (const c of DEMO_COURSES) {
    const courseId = idByCode.get(c.code);
    for (const prereqCode of c.prereqCodes) {
      const requiredCourseId = idByCode.get(prereqCode);
      if (!courseId || !requiredCourseId) {
        console.warn(`Skipping prereq ${prereqCode} -> ${c.code}: course not found.`);
        continue;
      }
      prereqRows.push({ courseId, requiredCourseId });
    }
  }

  await prisma.coursePrerequisite.createMany({
    data: prereqRows,
    skipDuplicates: true,
  });
  console.log(`Seeded ${prereqRows.length} prerequisites.`);
}

async function seed(): Promise<void> {
  console.log('Seeding permissions...');

  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: {},
      create: perm,
    });
  }

  console.log(`Seeded ${PERMISSIONS.length} permissions.`);

  const superAdminEmail = process.env.SUPERADMIN_EMAIL;
  const superAdminPassword = process.env.SUPERADMIN_PASSWORD;

  if (!superAdminEmail || !superAdminPassword) {
    console.warn('Missing SUPERADMIN_EMAIL or SUPERADMIN_PASSWORD in environment. Skipping super admin creation.');
  } else {
    const existing = await prisma.superAdmin.findFirst();;

    if (!existing) {
      await prisma.superAdmin.create({
        data: {
          email: superAdminEmail,
          password: hashPassword(superAdminPassword),
          mustChangePassword: true,
        },
      });
      console.log(`Super admin created`);
    } else {
      console.log('Super admin already exists. Skipping.');
    }
  }

  const institutionCount = await prisma.institution.count();
  if (institutionCount === 0) {
    await prisma.institution.create({
      data: {
        name: 'Default Institution',
        contactEmail: 'admin@institution.edu',
      },
    });
    console.log('Default institution created.');
  } else {
    console.log('Institution already exists. Skipping.');
  }

  await createDemoUsers(prisma);

  await createDemoProgram(prisma);

  await prisma.$disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});