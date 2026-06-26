import { ApiProperty } from '@nestjs/swagger';

class UserInfo {
  @ApiProperty()
  public readonly id: string;

  @ApiProperty()
  public readonly email: string;

  @ApiProperty()
  public readonly firstName: string;

  @ApiProperty()
  public readonly lastName: string;
}

export class AuthResponseDto {
  @ApiProperty()
  public readonly accessToken: string;

  @ApiProperty({ type: UserInfo })
  public readonly user: UserInfo;
}
