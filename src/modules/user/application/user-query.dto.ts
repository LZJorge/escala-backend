import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { EnrollmentStatus } from '@prisma/client';
import { PaginationDto } from '@core/infrastructure/http/pagination.dto';

export class UserQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description:
      'Free text search over email, first name, last name or CI (case-insensitive)',
  })
  @IsOptional()
  @IsString()
  public readonly q?: string;

  @ApiPropertyOptional({
    enum: ['ADMIN', 'STUDENT', 'NONE'],
    description:
      'Filter by profile: ADMIN (has an admin profile), STUDENT (has a student profile), NONE (no profile at all)',
  })
  @IsOptional()
  @IsIn(['ADMIN', 'STUDENT', 'NONE'])
  public readonly profile?: 'ADMIN' | 'STUDENT' | 'NONE';

  @ApiPropertyOptional({
    enum: ['true', 'false'],
    description: 'Filter by active status (soft-deleted users are inactive)',
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  public readonly isActive?: 'true' | 'false';

  @ApiPropertyOptional({
    description: 'Filter by an assigned role id (implies ADMIN profile)',
  })
  @IsOptional()
  @IsString()
  public readonly roleId?: string;

  @ApiPropertyOptional({
    description: 'Filter students by enrollment year (student profile)',
    example: 2026,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  public readonly enrollmentYear?: number;

  @ApiPropertyOptional({
    description:
      'Filter students enrolled in courses of a given program id (implies student profile)',
  })
  @IsOptional()
  @IsString()
  public readonly programId?: string;

  @ApiPropertyOptional({
    enum: EnrollmentStatus,
    description:
      'Filter students by enrollment status (ENROLLED, DROPPED or WITHDRAWN)',
  })
  @IsOptional()
  @IsEnum(EnrollmentStatus)
  public readonly academicStatus?: EnrollmentStatus;

  @ApiPropertyOptional({
    description: 'Created at or after (ISO 8601)',
    example: '2026-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  public readonly createdFrom?: string;

  @ApiPropertyOptional({
    description: 'Created at or before (ISO 8601)',
    example: '2026-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  public readonly createdTo?: string;
}
