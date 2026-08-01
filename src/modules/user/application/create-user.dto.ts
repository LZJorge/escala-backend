import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsIn,
} from 'class-validator';

export class CreateUserDto {
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

  @ApiPropertyOptional({
    example: ['ADMIN'],
    description: 'Profiles to create: ADMIN (staff/teacher), STUDENT',
  })
  @IsOptional()
  @IsArray()
  @IsIn(['ADMIN', 'STUDENT'], { each: true })
  public readonly profiles?: Array<'ADMIN' | 'STUDENT'>;

  @ApiPropertyOptional({
    example: ['role-uuid-1'],
    description:
      'Role IDs to assign on creation (applied to the ADMIN profile)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  public readonly roleIds?: string[];
}
