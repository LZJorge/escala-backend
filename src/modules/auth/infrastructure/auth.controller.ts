import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from '../application/auth.service';
import { LoginDto } from '../application/login.dto';
import { ApiErrors } from '@core/infrastructure/http/api-error-response.decorator';
import { DomainException } from '@core/domain/domain.exception';
import { ErrorCodes } from '@core/domain/error-codes';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authenticate user and return JWT',
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description: 'Token + user profile',
  })
  @ApiErrors(401)
  public async login(@Body() body: LoginDto): Promise<{
    accessToken: string;
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      roleType: 'SUPER_ADMIN' | 'USER';
    };
  }> {
    const result = await this.authService.login(body);
    if (result.isFailure) {
      throw new DomainException(
        ErrorCodes.SEC_AUTH_INVALID_CREDENTIALS,
        result.error as string,
      );
    }
    return result.value;
  }
}
