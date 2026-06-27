import { ApiProperty } from '@nestjs/swagger';

export class UserProfileDto {
  @ApiProperty()
  public readonly id: string;

  @ApiProperty()
  public readonly email: string;

  @ApiProperty()
  public readonly firstName: string;

  @ApiProperty()
  public readonly lastName: string;

  @ApiProperty()
  public readonly ci: string;

  @ApiProperty({ nullable: true })
  public readonly phone: string | null;
}
