import { ApiProperty } from '@nestjs/swagger';

export class PermissionDto {
  @ApiProperty()
  public readonly id: string;

  @ApiProperty()
  public readonly code: string;

  @ApiProperty()
  public readonly module: string;

  @ApiProperty({ nullable: true })
  public readonly description: string | null;
}
