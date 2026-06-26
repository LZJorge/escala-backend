import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  public readonly email: string;

  @ApiProperty({ example: 'securePass123' })
  public readonly password: string;
}
