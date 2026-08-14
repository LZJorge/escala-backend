-- Backfill: assign existing orphan student profiles to the oldest active program.
-- ponytail: single default program for legacy rows; re-assign manually if wrong.
UPDATE "student_profiles"
SET "program_id" = (
  SELECT "id" FROM "programs" WHERE "deleted_at" IS NULL ORDER BY "created_at" ASC LIMIT 1
)
WHERE "program_id" IS NULL;

-- DropForeignKey
ALTER TABLE "student_profiles" DROP CONSTRAINT "student_profiles_program_id_fkey";

-- AlterTable
ALTER TABLE "student_profiles" ALTER COLUMN "program_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
