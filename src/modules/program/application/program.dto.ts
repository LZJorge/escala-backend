import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  Min,
} from 'class-validator';
import { TermType } from '@prisma/client';

export class CreateProgramDto {
  @ApiProperty({ example: 'Computer Science' })
  @IsString()
  @IsNotEmpty()
  public readonly name: string;

  @ApiProperty({ enum: ['SEMESTER', 'QUARTER', 'YEAR'], example: 'SEMESTER' })
  @IsEnum(TermType)
  public readonly termType: TermType;

  @ApiProperty({ example: 120 })
  @IsInt()
  @Min(1)
  public readonly totalCredits: number;
}

export class UpdateProgramDto {
  @ApiPropertyOptional({ example: 'Computer Engineering' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  public readonly name?: string;

  @ApiPropertyOptional({ enum: ['SEMESTER', 'QUARTER', 'YEAR'] })
  @IsOptional()
  @IsEnum(TermType)
  public readonly termType?: TermType;

  @ApiPropertyOptional({ example: 130 })
  @IsOptional()
  @IsInt()
  @Min(1)
  public readonly totalCredits?: number;
}

export class ProgramResponseDto {
  @ApiProperty()
  public id: string;

  @ApiProperty()
  public name: string;

  @ApiProperty({ enum: ['SEMESTER', 'QUARTER', 'YEAR'] })
  public termType: string;

  @ApiProperty()
  public totalCredits: number;

  @ApiProperty()
  public createdAt: string;
}

export class ProgramSummaryResponseDto {
  @ApiProperty()
  public programId: string;

  @ApiProperty()
  public name: string;

  @ApiProperty({ enum: ['SEMESTER', 'QUARTER', 'YEAR'] })
  public termType: string;

  @ApiProperty({ description: 'Total credits required to graduate' })
  public totalCredits: number;

  @ApiProperty({
    description:
      'Sum of credits of active pensum courses (compare against totalCredits)',
  })
  public allocatedCredits: number;

  @ApiProperty({ description: 'Active courses in the pensum' })
  public courseCount: number;

  @ApiProperty({ description: 'Highest term level in the pensum (duration)' })
  public totalTermLevels: number;

  @ApiProperty({
    description: 'Active courses that have at least one prerequisite',
  })
  public prerequisiteChainsCount: number;

  @ApiProperty({ description: 'Active sections offered for this program' })
  public sectionCount: number;

  @ApiProperty({
    description: 'Distinct students currently enrolled in this program',
  })
  public studentCount: number;

  @ApiProperty({
    description:
      'Distinct students with a DROPPED or WITHDRAWN enrollment in this program',
  })
  public dropoutCount: number;

  @ApiProperty({
    description: 'Distinct teachers assigned to active sections of the program',
  })
  public activeTeachersCount: number;

  @ApiProperty({
    description: 'Sum of capacity across active sections of the program',
  })
  public totalCapacity: number;

  @ApiProperty({
    description: 'totalCapacity minus studentCount (occupancy headroom)',
  })
  public availableSpots: number;

  @ApiProperty({
    description: 'Total transcript records linked to this program courses',
  })
  public historicalTranscriptsCount: number;

  @ApiProperty()
  public createdAt: string;

  @ApiProperty()
  public updatedAt: string;
}

export class PensumPrerequisiteDto {
  @ApiProperty({ nullable: true })
  public requiredCourseId: string | null;

  @ApiProperty({ nullable: true })
  public requiredCredits: number | null;
}

export class PensumCourseDto {
  @ApiProperty()
  public id: string;

  @ApiProperty()
  public code: string;

  @ApiProperty()
  public name: string;

  @ApiProperty()
  public credits: number;

  @ApiProperty()
  public termLevel: number;

  @ApiProperty({ type: [PensumPrerequisiteDto] })
  public prerequisites: PensumPrerequisiteDto[];
}

export class PensumResponseDto {
  @ApiProperty()
  public id: string;

  @ApiProperty()
  public name: string;

  @ApiProperty({ enum: ['SEMESTER', 'QUARTER', 'YEAR'] })
  public termType: string;

  @ApiProperty()
  public totalCredits: number;

  @ApiProperty()
  public updatedAt: string;

  @ApiProperty({ type: [PensumCourseDto] })
  public courses: PensumCourseDto[];
}
