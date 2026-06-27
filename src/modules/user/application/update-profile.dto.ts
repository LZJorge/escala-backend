import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional()
  public readonly firstName?: string;

  @ApiPropertyOptional()
  public readonly lastName?: string;

  @ApiPropertyOptional()
  public readonly phone?: string;
}
