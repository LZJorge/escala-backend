import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from '../application/auth.service';
import { LoginDto } from '../application/login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authenticate user and return JWT with institutions',
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description: 'Token + user profile + institution memberships',
  })
  public async login(@Body() body: LoginDto): Promise<{
    accessToken: string;
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      isSuperAdmin: boolean;
    };
    institutions: Array<{
      id: string;
      institutionId: string;
      institutionName: string;
      institutionType: string;
    }>;
  }> {
    const result = await this.authService.login(body);
    if (result.isFailure) {
      throw new UnauthorizedException(result.error);
    }
    return result.value;
  }
}
