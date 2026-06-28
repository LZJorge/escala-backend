import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsArray, IsOptional } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'Coordinador Académico' })
  @IsString()
  @IsNotEmpty()
  public readonly name: string;

  @ApiProperty({ example: ['course.create', 'course.view', 'section.view'] })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  public readonly permissionCodes: string[];
}

export class UpdateRoleDto {
  @ApiPropertyOptional({ example: 'Coordinador Académico' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  public readonly name?: string;

  @ApiPropertyOptional({ example: ['course.create', 'course.view'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  public readonly permissionCodes?: string[];
}

export class RoleResponseDto {
  @ApiProperty()
  public readonly id: string;

  @ApiProperty()
  public readonly name: string;

  @ApiProperty()
  public readonly isStudent: boolean;

  @ApiProperty()
  public readonly isMaster: boolean;

  @ApiProperty()
  public readonly isEditable: boolean;

  @ApiProperty({ type: [String] })
  public readonly permissionCodes: string[];
}

export class AssignRoleDto {
  @ApiProperty({ description: 'InstitutionUser ID' })
  @IsString()
  @IsNotEmpty()
  public readonly institutionUserId: string;

  @ApiProperty({ description: 'Role ID' })
  @IsString()
  @IsNotEmpty()
  public readonly roleId: string;
}

export class UnassignRoleDto {
  @ApiProperty({ description: 'InstitutionUser ID' })
  @IsString()
  @IsNotEmpty()
  public readonly institutionUserId: string;

  @ApiProperty({ description: 'Role ID' })
  @IsString()
  @IsNotEmpty()
  public readonly roleId: string;
}
