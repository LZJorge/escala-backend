import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '@core/infrastructure/http/pagination.dto';

export class TeacherQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description:
      'Free text search over email, first name, last name or CI (case-insensitive)',
  })
  @IsOptional()
  @IsString()
  public readonly q?: string;

  @ApiPropertyOptional({
    enum: ['true', 'false'],
    description: 'Filter by active status (soft-deleted users are inactive)',
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  public readonly isActive?: 'true' | 'false';

  @ApiPropertyOptional({
    description: 'Filter by an assigned role id (e.g. "Profesor")',
  })
  @IsOptional()
  @IsString()
  public readonly roleId?: string;
}
