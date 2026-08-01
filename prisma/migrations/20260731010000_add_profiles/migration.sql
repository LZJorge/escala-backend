-- CreateTable
CREATE TABLE "student_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "enrollment_year" INTEGER,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "department" TEXT,

    CONSTRAINT "admin_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_roles" (
    "id" UUID NOT NULL,
    "admin_profile_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,

    CONSTRAINT "admin_roles_pkey" PRIMARY KEY ("id")
);

-- Backfill profiles from legacy user_roles
INSERT INTO "admin_profiles" ("id", "user_id")
SELECT gen_random_uuid(), "user_id"
FROM (SELECT DISTINCT "user_id" FROM "user_roles") u;

INSERT INTO "admin_roles" ("id", "admin_profile_id", "role_id")
SELECT gen_random_uuid(), ap."id", ur."role_id"
FROM "user_roles" ur
JOIN "admin_profiles" ap ON ap."user_id" = ur."user_id";

INSERT INTO "student_profiles" ("id", "user_id")
SELECT gen_random_uuid(), ur."user_id"
FROM "user_roles" ur
JOIN "roles" r ON r."id" = ur."role_id"
WHERE r."is_student" = true
GROUP BY ur."user_id";

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_user_id_key" ON "student_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_profiles_user_id_key" ON "admin_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_roles_admin_profile_id_role_id_key" ON "admin_roles"("admin_profile_id", "role_id");

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_profiles" ADD CONSTRAINT "admin_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_roles" ADD CONSTRAINT "admin_roles_admin_profile_id_fkey" FOREIGN KEY ("admin_profile_id") REFERENCES "admin_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_roles" ADD CONSTRAINT "admin_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Re-point academic relations from users to profiles
ALTER TABLE "course_sections" DROP CONSTRAINT "course_sections_teacher_id_fkey";
ALTER TABLE "course_sections" ADD CONSTRAINT "course_sections_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "admin_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "enrollments" DROP CONSTRAINT "enrollments_student_id_fkey";
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assessment_submissions" DROP CONSTRAINT "assessment_submissions_student_id_fkey";
ALTER TABLE "assessment_submissions" ADD CONSTRAINT "assessment_submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transcripts" DROP CONSTRAINT "transcripts_student_id_fkey";
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropTable
DROP TABLE "user_roles";

-- AlterTable
ALTER TABLE "roles" DROP COLUMN "is_student";
