import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  UnprocessableEntityException,
  NotFoundException,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/jwt-auth.guard';
import type { AuthenticatedRequest } from '@modules/auth/infrastructure/authenticated-request';
import { UserService } from '../application/user.service';
import { UpdateProfileDto } from '../application/update-profile.dto';
import { UserProfileDto } from '../application/user-profile.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiOkResponse({ type: UserProfileDto })
  public async getProfile(
    @Req() request: AuthenticatedRequest,
  ): Promise<UserProfileDto> {
    const result = await this.userService.getProfile(request.user.sub);
    if (result.isFailure) {
      throw new NotFoundException(result.error);
    }
    return result.value;
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiOkResponse({ type: UserProfileDto })
  public async updateProfile(
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdateProfileDto,
  ): Promise<UserProfileDto> {
    const result = await this.userService.updateProfile(request.user.sub, body);
    if (result.isFailure) {
      throw new UnprocessableEntityException(result.error);
    }
    return result.value;
  }
}
