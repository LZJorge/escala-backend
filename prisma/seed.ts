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

async function seed(): Promise<void> {
  console.log('Seeding permissions…');

  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: {},
      create: perm,
    });
  }

  console.log(`✅ ${PERMISSIONS.length} permissions seeded.`);

  const superAdminEmail = 'admin@escala.app';
  const existing = await prisma.user.findUnique({ where: { email: superAdminEmail } });

  if (!existing) {
    const salt = randomBytes(16).toString('hex');
    const hashed = scryptSync('admin123', salt, 64).toString('hex');

    await prisma.user.create({
      data: {
        email: superAdminEmail,
        passwordHash: `${salt}:${hashed}`,
        firstName: 'Super',
        lastName: 'Admin',
        ci: '00000000',
        isSuperAdmin: true,
      },
    });
    console.log('✅ Super admin user created (admin@escala.app / admin123).');
  } else {
    console.log('⏭️  Super admin already exists — skipped.');
  }

  await prisma.$disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
