import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from '../application/auth.service';
import { LoginDto } from '../application/login.dto';
import { ChangePasswordDto } from '../application/change-password.dto';
import { SuperAdmin } from './decorators/super-admin.decorator';
import { IgnorePasswordBlock } from './decorators/ignore-password-block.decorator';
import { ApiErrors } from '@core/infrastructure/http/api-error-response.decorator';
import { DomainException } from '@core/domain/domain.exception';
import { ErrorCodes } from '@core/domain/error-codes';
import { type AuthenticatedRequest } from './authenticated-request';

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
      mustChangePassword: boolean;
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

  @Post('change-superadmin-password')
  @SuperAdmin()
  @IgnorePasswordBlock()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change password for super admin and rotate JWT',
  })
  @ApiBody({ type: ChangePasswordDto })
  @ApiOkResponse({
    description: 'Password changed successfully',
    schema: {
      type: 'object',
      properties: {
        accessToken: {
          type: 'string',
          description: 'Updated JWT',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM...',
        },
        user: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'admin@escala.edu.ve',
            },
            mustChangePassword: {
              type: 'boolean',
              example: false,
            },
            roleType: {
              type: 'string',
              example: 'SUPER_ADMIN',
            },
          },
        },
      },
    },
  })
  @ApiErrors(401, 403, 404)
  public async changeSuperAdminPassword(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ): Promise<{
    accessToken: string;
    user: {
      id: string;
      email: string;
      mustChangePassword: boolean;
      roleType: 'SUPER_ADMIN';
    };
  }> {
    const superAdminId = req.user.sub;

    const result = await this.authService.changeSuperAdminPassword(
      superAdminId,
      dto.newPassword,
    );

    if (result.isFailure) {
      throw new DomainException(
        ErrorCodes.ERR_USER_NOT_FOUND,
        result.error as string,
      );
    }

    return result.value;
  }
}
