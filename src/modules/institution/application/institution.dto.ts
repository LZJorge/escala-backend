import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { InstitutionType } from '@prisma/client';

class MasterAdminDto {
  @ApiProperty({ example: 'admin@institucion.edu' })
  public readonly email: string;

  @ApiProperty({ example: 'securePass123' })
  public readonly password: string;

  @ApiProperty({ example: 'Carlos' })
  public readonly firstName: string;

  @ApiProperty({ example: 'Mendoza' })
  public readonly lastName: string;

  @ApiProperty({ example: '87654321' })
  public readonly ci: string;
}

export class CreateInstitutionDto {
  @ApiProperty({ example: 'Universidad Central de Venezuela' })
  public readonly name: string;

  @ApiProperty({
    enum: ['UNIVERSITY', 'HIGH_SCHOOL', 'INSTITUTE'],
    example: 'UNIVERSITY',
  })
  public readonly institutionType: InstitutionType;

  @ApiProperty({ example: 'contact@ucv.ve' })
  public readonly contactEmail: string;

  @ApiPropertyOptional({ example: 'https://www.ucv.ve' })
  public readonly websiteUrl?: string;

  @ApiPropertyOptional({ example: 'https://logo.ucv.ve/logo.png' })
  public readonly logoUrl?: string;

  @ApiProperty({ description: 'Master admin credentials for this institution' })
  public readonly masterAdmin: MasterAdminDto;
}

export class UpdateInstitutionDto {
  @ApiPropertyOptional()
  public readonly name?: string;

  @ApiPropertyOptional({ enum: ['UNIVERSITY', 'HIGH_SCHOOL', 'INSTITUTE'] })
  public readonly institutionType?: InstitutionType;

  @ApiPropertyOptional()
  public readonly contactEmail?: string;

  @ApiPropertyOptional()
  public readonly websiteUrl?: string;

  @ApiPropertyOptional()
  public readonly logoUrl?: string;
}
