import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  public readonly email: string;

  @ApiProperty({ example: 'securePass123', minLength: 8 })
  public readonly password: string;

  @ApiProperty({ example: 'John' })
  public readonly firstName: string;

  @ApiProperty({ example: 'Doe' })
  public readonly lastName: string;

  @ApiProperty({ example: '12345678' })
  public readonly ci: string;

  @ApiPropertyOptional({ example: '+584141234567' })
  public readonly phone?: string;
}
