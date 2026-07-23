import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class AssignRoleDto {
  @ApiProperty({ example: 'uuid-of-role' })
  @IsString()
  @IsNotEmpty()
  public readonly roleId: string;
}
