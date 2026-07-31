import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'The new password of the user.',
    example: 'Escala2026.!',
    minLength: 8,
    maxLength: 32,
    type: String,
  })
  @IsNotEmpty({ message: 'The password is required.' })
  @IsString({ message: 'The password must be a string.' })
  @MinLength(8, { message: 'The password must be at least 8 characters long.' })
  @MaxLength(32, {
    message: 'The password must be at most 32 characters long.',
  })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.])[A-Za-z\d@$!%*?&.]{8,}$/,
    {
      message:
        'The password must contain at least one lowercase letter, one uppercase letter, one digit, and one special character.',
    },
  )
  newPassword: string;
}
