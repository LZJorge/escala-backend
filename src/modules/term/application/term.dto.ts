import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsISO8601,
  IsUUID,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { TermStatus } from '@prisma/client';

export class CreateTermDto {
  @ApiProperty({
    description: 'Program the term belongs to',
    example: '3f2c1b4a-0000-4000-8000-000000000000',
  })
  @IsUUID()
  public readonly programId: string;

  @ApiProperty({ example: 'Semester 2026-I' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  public readonly name: string;

  @ApiProperty({ example: '2026-02-01' })
  @IsISO8601()
  public readonly startDate: string;

  @ApiProperty({ example: '2026-06-30' })
  @IsISO8601()
  public readonly endDate: string;
}

export class UpdateTermDto {
  @ApiPropertyOptional({ example: 'Semester 2026-I' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  public readonly name?: string;

  @ApiPropertyOptional({ example: '2026-02-01' })
  @IsOptional()
  @IsISO8601()
  public readonly startDate?: string;

  @ApiPropertyOptional({ example: '2026-06-30' })
  @IsOptional()
  @IsISO8601()
  public readonly endDate?: string;
}

export class ChangeTermStatusDto {
  @ApiProperty({ enum: TermStatus, example: TermStatus.ACTIVE })
  @IsEnum(TermStatus)
  public readonly status: TermStatus;
}

export class TermResponseDto {
  @ApiProperty()
  public id: string;

  @ApiProperty()
  public programId: string;

  @ApiProperty()
  public name: string;

  @ApiProperty()
  public startDate: string;

  @ApiProperty()
  public endDate: string;

  @ApiProperty({ enum: TermStatus })
  public status: string;

  @ApiProperty()
  public createdAt: string;

  @ApiProperty()
  public updatedAt: string;
}
