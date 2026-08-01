import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsIn,
  ArrayMinSize,
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

  @ApiProperty({
    description:
      'Profiles to create. At least one is required: ADMIN (staff/teacher), STUDENT. Roles are assigned later via POST /users/:userId/roles.',
    example: ['STUDENT'],
    enum: ['ADMIN', 'STUDENT'],
    isArray: true,
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(['ADMIN', 'STUDENT'], { each: true })
  public readonly profiles: Array<'ADMIN' | 'STUDENT'>;
}
