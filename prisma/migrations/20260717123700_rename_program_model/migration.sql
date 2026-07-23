-- Rename model from AcademicProgram to Program
ALTER TABLE "academic_programs" RENAME TO "programs";
ALTER INDEX "academic_programs_pkey" RENAME TO "programs_pkey";

-- Update foreign key constraint in courses table
ALTER TABLE "courses" RENAME CONSTRAINT "courses_program_id_fkey" TO "courses_program_id_fkey";
