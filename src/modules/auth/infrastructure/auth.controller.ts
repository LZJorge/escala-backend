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
    summary: 'Authenticate user and return JWT with institution',
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description: 'Token + user profile + institution (null for super admin)',
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
    institution: {
      id: string;
      institutionId: string;
      institutionName: string;
      institutionType: string;
    } | null;
  }> {
    const result = await this.authService.login(body);
    if (result.isFailure) {
      throw new UnauthorizedException(result.error);
    }
    return result.value;
  }
}
