import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  Min,
  Max,
  IsArray,
  ValidateNested,
  IsEnum,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DayOfWeek } from '@prisma/client';

export class CreateScheduleDto {
  @ApiProperty({ enum: DayOfWeek, example: DayOfWeek.MONDAY })
  @IsEnum(DayOfWeek)
  public readonly dayOfWeek: DayOfWeek;

  @ApiProperty({ example: '08:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'startTime must be in HH:mm format',
  })
  public readonly startTime: string;

  @ApiProperty({ example: '10:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'endTime must be in HH:mm format',
  })
  public readonly endTime: string;

  @ApiPropertyOptional({ example: 'Lab 101' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  public readonly roomIdentifier?: string;
}

export class CreateSectionDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  public readonly courseId: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  public readonly termId: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  public readonly teacherId: string;

  @ApiProperty({ example: 'Section A' })
  @IsString()
  @IsNotEmpty()
  public readonly name: string;

  @ApiProperty({ example: 30 })
  @IsInt()
  @Min(1)
  @Max(150)
  public readonly capacity: number;

  @ApiPropertyOptional({ type: [CreateScheduleDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateScheduleDto)
  public readonly schedules?: CreateScheduleDto[];
}

export class UpdateSectionDto {
  @ApiPropertyOptional({ example: 'Section B' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  public readonly name?: string;

  @ApiPropertyOptional({ example: 40 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(150)
  public readonly capacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  public readonly teacherId?: string;
}

export class UpdateCapacityDto {
  @ApiProperty({ example: 25 })
  @IsInt()
  @Min(1)
  @Max(150)
  public readonly capacity: number;
}

export class ScheduleResponseDto {
  @ApiProperty()
  public id: string;

  @ApiProperty({ enum: DayOfWeek })
  public dayOfWeek: string;

  @ApiProperty()
  public startTime: string;

  @ApiProperty()
  public endTime: string;

  @ApiProperty({ nullable: true })
  public roomIdentifier: string | null;
}

export class SectionResponseDto {
  @ApiProperty()
  public id: string;

  @ApiProperty()
  public courseId: string;

  @ApiProperty()
  public termId: string;

  @ApiProperty()
  public teacherId: string;

  @ApiProperty()
  public name: string;

  @ApiProperty()
  public capacity: number;

  @ApiProperty()
  public createdAt: string;

  @ApiProperty({ type: [ScheduleResponseDto] })
  public schedules: ScheduleResponseDto[];
}
