import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuthService } from '../application/auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  public async register(
    @Body()
    body: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      ci: string;
      phone?: string;
    },
  ): Promise<{
    accessToken: string;
    user: { id: string; email: string; firstName: string; lastName: string };
  }> {
    const result = await this.authService.register(body);
    if (result.isFailure) {
      throw new UnprocessableEntityException(result.error);
    }
    return result.value;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  public async login(
    @Body() body: { email: string; password: string },
  ): Promise<{
    accessToken: string;
    user: { id: string; email: string; firstName: string; lastName: string };
  }> {
    const result = await this.authService.login(body);
    if (result.isFailure) {
      throw new UnauthorizedException(result.error);
    }
    return result.value;
  }
}
