-- AlterTable
ALTER TABLE "course_prerequisites" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "courses" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "programs" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "super_admins" ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT true;
