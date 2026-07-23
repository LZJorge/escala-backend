import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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
import { RequirePermission } from '@modules/auth/infrastructure/decorators/require-permission.decorator';
import type { AuthenticatedRequest } from '@modules/auth/infrastructure/authenticated-request';
import { UserService } from '../application/user.service';
import { RoleService } from '@modules/role/application/role.service';
import { UpdateProfileDto } from '../application/update-profile.dto';
import { UserProfileDto } from '../application/user-profile.dto';
import { CreateUserDto } from '../application/create-user.dto';
import { AssignRoleDto } from '../application/assign-role.dto';
import { ApiErrors } from '@core/infrastructure/http/api-error-response.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly roleService: RoleService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user profile (polymorphic)' })
  @ApiOkResponse({ description: 'Profile + roles + permissions' })
  @ApiErrors(401, 404)
  public async getMe(@Req() request: AuthenticatedRequest): Promise<{
    id: string;
    email: string;
    type: 'SUPER_ADMIN' | 'USER';
    firstName?: string;
    lastName?: string;
    roles?: string[];
    permissions: string[];
  }> {
    const result = await this.userService.getMe(request.user);
    if (result.isFailure) {
      throw new NotFoundException(result.error);
    }
    return result.value;
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiOkResponse({ type: UserProfileDto })
  @ApiErrors(401, 404, 422)
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

  @Post()
  @RequirePermission('user.create')
  @ApiOperation({ summary: 'Create a new user' })
  @ApiErrors(401, 403, 422)
  public async create(@Body() body: CreateUserDto): Promise<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  }> {
    const result = await this.userService.createUser(body);
    if (result.isFailure) {
      throw new UnprocessableEntityException(result.error);
    }
    return result.value;
  }

  @Delete(':userId')
  @RequirePermission('user.delete')
  @ApiOperation({ summary: 'Soft delete a user (preserves academic history)' })
  @ApiErrors(401, 403, 404)
  public async delete(@Param('userId') userId: string): Promise<void> {
    const result = await this.userService.softDelete(userId);
    if (result.isFailure) {
      throw new NotFoundException(result.error);
    }
  }

  @Post(':userId/roles')
  @RequirePermission('role.assign')
  @ApiOperation({ summary: 'Assign a role to a user' })
  @ApiErrors(401, 403, 422)
  public async assignRole(
    @Param('userId') userId: string,
    @Body() body: AssignRoleDto,
  ): Promise<void> {
    const result = await this.roleService.assignRole(userId, body.roleId);
    if (result.isFailure) {
      throw new UnprocessableEntityException(result.error);
    }
  }

  @Delete(':userId/roles/:roleId')
  @RequirePermission('role.assign')
  @ApiOperation({ summary: 'Remove a role from a user' })
  @ApiErrors(401, 403, 422)
  public async unassignRole(
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
  ): Promise<void> {
    const result = await this.roleService.unassignRole(userId, roleId);
    if (result.isFailure) {
      throw new UnprocessableEntityException(result.error);
    }
  }
}
