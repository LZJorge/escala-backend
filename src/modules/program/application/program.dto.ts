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
