import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public readonly firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public readonly lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public readonly phone?: string;
}
