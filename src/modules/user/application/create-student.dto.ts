import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateStudentDto {
  @ApiProperty({ example: 'Maria' })
  @IsString()
  @IsNotEmpty()
  public readonly firstName: string;

  @ApiProperty({ example: 'Gonzalez' })
  @IsString()
  @IsNotEmpty()
  public readonly lastName: string;

  @ApiProperty({ example: 'maria.gonzalez@instituto.edu' })
  @IsEmail()
  public readonly email: string;

  @ApiProperty({ example: '12345678' })
  @IsString()
  @IsNotEmpty()
  public readonly ci: string;

  @ApiProperty({ example: '3f2c1b4a-0000-4000-8000-000000000000' })
  @IsUUID()
  public readonly programId: string;
}
