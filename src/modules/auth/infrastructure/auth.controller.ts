import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBody,
} from '@nestjs/swagger';
import { AuthService } from '../application/auth.service';
import { RegisterDto } from '../application/register.dto';
import { LoginDto } from '../application/login.dto';
import { AuthResponseDto } from '../application/auth-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponse({ type: AuthResponseDto })
  public async register(@Body() body: RegisterDto): Promise<AuthResponseDto> {
    const result = await this.authService.register(body);
    if (result.isFailure) {
      throw new UnprocessableEntityException(result.error);
    }
    return result.value;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user and return JWT' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: AuthResponseDto })
  public async login(@Body() body: LoginDto): Promise<AuthResponseDto> {
    const result = await this.authService.login(body);
    if (result.isFailure) {
      throw new UnauthorizedException(result.error);
    }
    return result.value;
  }
}
