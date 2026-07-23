import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsNotEmpty } from 'class-validator';

export class UpdateInstitutionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  public readonly name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  public readonly contactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public readonly websiteUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public readonly logoUrl?: string;
}
