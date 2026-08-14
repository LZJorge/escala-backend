-- AlterTable
ALTER TABLE "terms" ADD COLUMN     "program_id" UUID;

-- ponytail: backfill existing terms to the first non-deleted program, terms need one program
UPDATE "terms" SET "program_id" = (SELECT "id" FROM "programs" WHERE "deleted_at" IS NULL ORDER BY "created_at" ASC LIMIT 1) WHERE "program_id" IS NULL;

ALTER TABLE "terms" ALTER COLUMN "program_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "terms" ADD CONSTRAINT "terms_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
