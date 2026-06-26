import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  ValidateNested,
  IsNotEmpty,
  IsDefined,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InstitutionType } from '@prisma/client';

class MasterAdminDto {
  @ApiProperty({ example: 'admin@institucion.edu' })
  @IsEmail()
  public readonly email: string;

  @ApiProperty({ example: 'securePass123' })
  @IsString()
  @IsNotEmpty()
  public readonly password: string;

  @ApiProperty({ example: 'Carlos' })
  @IsString()
  @IsNotEmpty()
  public readonly firstName: string;

  @ApiProperty({ example: 'Mendoza' })
  @IsString()
  @IsNotEmpty()
  public readonly lastName: string;

  @ApiProperty({ example: '87654321' })
  @IsString()
  @IsNotEmpty()
  public readonly ci: string;
}

export class CreateInstitutionDto {
  @ApiProperty({ example: 'Universidad Central de Venezuela' })
  @IsString()
  @IsNotEmpty()
  public readonly name: string;

  @ApiProperty({
    enum: ['UNIVERSITY', 'HIGH_SCHOOL', 'INSTITUTE'],
    example: 'UNIVERSITY',
  })
  @IsEnum(InstitutionType)
  public readonly institutionType: InstitutionType;

  @ApiProperty({ example: 'contact@ucv.ve' })
  @IsEmail()
  public readonly contactEmail: string;

  @ApiPropertyOptional({ example: 'https://www.ucv.ve' })
  @IsOptional()
  @IsString()
  public readonly websiteUrl?: string;

  @ApiPropertyOptional({ example: 'https://logo.ucv.ve/logo.png' })
  @IsOptional()
  @IsString()
  public readonly logoUrl?: string;

  @ApiProperty({ description: 'Master admin credentials for this institution' })
  @ValidateNested()
  @Type(() => MasterAdminDto)
  @IsDefined()
  public readonly masterAdmin: MasterAdminDto;
}

export class CreateInstitutionUserDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  public readonly email: string;

  @ApiProperty({ example: 'securePass123' })
  @IsString()
  @IsNotEmpty()
  public readonly password: string;

  @ApiProperty({ example: 'Juan' })
  @IsString()
  @IsNotEmpty()
  public readonly firstName: string;

  @ApiProperty({ example: 'Perez' })
  @IsString()
  @IsNotEmpty()
  public readonly lastName: string;

  @ApiProperty({ example: '12345678' })
  @IsString()
  @IsNotEmpty()
  public readonly ci: string;

  @ApiPropertyOptional({ example: '+584141234567' })
  @IsOptional()
  @IsString()
  public readonly phone?: string;
}

export class UpdateInstitutionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  public readonly name?: string;

  @ApiPropertyOptional({ enum: ['UNIVERSITY', 'HIGH_SCHOOL', 'INSTITUTE'] })
  @IsOptional()
  @IsEnum(InstitutionType)
  public readonly institutionType?: InstitutionType;

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
