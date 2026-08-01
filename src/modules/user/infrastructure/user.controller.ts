import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
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
import { UserListItem } from '../domain/user.repository';
import { ApiErrors } from '@core/infrastructure/http/api-error-response.decorator';
import { PaginationDto } from '@core/infrastructure/http/pagination.dto';
import { Page } from '@core/domain/page';
import { DomainException } from '@core/domain/domain.exception';
import { ErrorCodes } from '@core/domain/error-codes';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly roleService: RoleService,
  ) {}

  @Get()
  @RequirePermission('user.read')
  @ApiOperation({
    summary: 'List institution users with their roles (paginated)',
  })
  @ApiOkResponse({ description: 'Paginated users with their roles' })
  @ApiErrors(401, 403)
  public async findAll(
    @Query() query: PaginationDto,
  ): Promise<Page<UserListItem>> {
    const result = await this.userService.findAllUsers(query);
    return result.value;
  }

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
      throw new DomainException(
        ErrorCodes.ERR_USER_NOT_FOUND,
        result.error as string,
      );
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
      throw new DomainException(
        ErrorCodes.ERR_USER_UPDATE_FAILED,
        result.error as string,
      );
    }
    return result.value;
  }

  @Patch(':userId')
  @RequirePermission('user.update')
  @ApiOperation({ summary: 'Update a user profile (admin)' })
  @ApiOkResponse({ type: UserProfileDto })
  @ApiErrors(401, 403, 404, 422)
  public async updateUser(
    @Param('userId') userId: string,
    @Body() body: UpdateProfileDto,
  ): Promise<UserProfileDto> {
    const result = await this.userService.updateProfile(userId, body);
    if (result.isFailure) {
      const errorMessage = result.error as string;
      if (errorMessage.includes('not found')) {
        throw new DomainException(ErrorCodes.ERR_USER_NOT_FOUND, errorMessage);
      }
      throw new DomainException(
        ErrorCodes.ERR_USER_UPDATE_FAILED,
        errorMessage,
      );
    }
    return result.value;
  }

  @Post()
  @RequirePermission('user.create')
  @ApiOperation({ summary: 'Create a new user (optionally with roles)' })
  @ApiErrors(401, 403, 422)
  public async create(@Body() body: CreateUserDto): Promise<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: string[];
  }> {
    const result = await this.userService.createUser(body);
    if (result.isFailure) {
      const errorMessage = result.error as string;
      if (errorMessage.includes('Email')) {
        throw new DomainException(
          ErrorCodes.ERR_USER_EMAIL_EXISTS,
          errorMessage,
        );
      }
      if (errorMessage.includes('CI')) {
        throw new DomainException(ErrorCodes.ERR_USER_CI_EXISTS, errorMessage);
      }
      if (errorMessage.includes('role IDs')) {
        throw new DomainException(
          ErrorCodes.ERR_ROLE_ASSIGNMENT_FAILED,
          errorMessage,
        );
      }
      throw new DomainException(
        ErrorCodes.ERR_USER_CREATION_FAILED,
        errorMessage,
      );
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
      throw new DomainException(
        ErrorCodes.ERR_USER_NOT_FOUND,
        result.error as string,
      );
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
      throw new DomainException(
        ErrorCodes.ERR_ROLE_ASSIGNMENT_FAILED,
        result.error as string,
      );
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
      throw new DomainException(
        ErrorCodes.ERR_ROLE_ASSIGNMENT_FAILED,
        result.error as string,
      );
    }
  }
}
