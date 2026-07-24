import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  Min,
  IsUUID,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCourseDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  public readonly programId: string;

  @ApiProperty({ example: 'CS101' })
  @IsString()
  @IsNotEmpty()
  public readonly code: string;

  @ApiProperty({ example: 'Data Structures' })
  @IsString()
  @IsNotEmpty()
  public readonly name: string;

  @ApiProperty({ example: 4 })
  @IsInt()
  @Min(1)
  public readonly credits: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  public readonly termLevel: number;
}

export class UpdateCourseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  public readonly code?: string;

  @ApiPropertyOptional({ example: 'Advanced Data Structures' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  public readonly name?: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  public readonly credits?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  public readonly termLevel?: number;
}

export class PrerequisiteEntryDto {
  @ApiPropertyOptional({
    description: 'ID of the course required as prerequisite',
  })
  @IsOptional()
  @IsUUID()
  public readonly requiredCourseId?: string;

  @ApiPropertyOptional({ description: 'Minimum credits required' })
  @IsOptional()
  @IsInt()
  @Min(1)
  public readonly requiredCredits?: number;
}

export class SetPrerequisitesDto {
  @ApiProperty({ type: [PrerequisiteEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrerequisiteEntryDto)
  public readonly prerequisites: PrerequisiteEntryDto[];
}

export class PrerequisiteResponseDto {
  @ApiProperty()
  public courseId: string;

  @ApiProperty({ nullable: true })
  public requiredCourseId: string | null;

  @ApiProperty({ nullable: true })
  public requiredCredits: number | null;
}

export class CourseResponseDto {
  @ApiProperty()
  public id: string;

  @ApiProperty()
  public programId: string;

  @ApiProperty()
  public code: string;

  @ApiProperty()
  public name: string;

  @ApiProperty()
  public credits: number;

  @ApiProperty()
  public termLevel: number;

  @ApiProperty()
  public createdAt: string;

  @ApiProperty({ type: [PrerequisiteResponseDto] })
  public prerequisites: PrerequisiteResponseDto[];
}
