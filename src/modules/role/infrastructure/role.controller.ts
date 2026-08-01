import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { RequirePermission } from '@modules/auth/infrastructure/decorators/require-permission.decorator';
import { RoleService } from '../application/role.service';
import {
  CreateRoleDto,
  UpdateRoleDto,
  RoleResponseDto,
} from '../application/role.dto';
import { ApiErrors } from '@core/infrastructure/http/api-error-response.decorator';
import { PaginationDto } from '@core/infrastructure/http/pagination.dto';
import { Page } from '@core/domain/page';
import { DomainException } from '@core/domain/domain.exception';
import { ErrorCodes } from '@core/domain/error-codes';

@ApiTags('Roles')
@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  @RequirePermission('role.create')
  @ApiOperation({ summary: 'Create a custom role with permissions' })
  @ApiCreatedResponse({ description: 'Role created' })
  @ApiErrors(401, 403, 422)
  public async create(
    @Body() body: CreateRoleDto,
  ): Promise<{ id: string; name: string; permissionCodes: string[] }> {
    const result = await this.roleService.create(body);
    if (result.isFailure) {
      const errorMessage = result.error as string;
      if (errorMessage.includes('name already in use')) {
        throw new DomainException(
          ErrorCodes.ERR_ROLE_NAME_EXISTS,
          errorMessage,
        );
      }
      throw new DomainException(
        ErrorCodes.ERR_ROLE_CREATION_FAILED,
        errorMessage,
      );
    }
    return result.value;
  }

  @Get()
  @RequirePermission('role.read')
  @ApiOperation({ summary: 'List roles (paginated)' })
  @ApiOkResponse({ type: [RoleResponseDto] })
  public async findAll(
    @Query() query: PaginationDto,
  ): Promise<Page<RoleResponseDto>> {
    const result = await this.roleService.findAll(query);
    return result.value;
  }

  @Get(':roleId')
  @RequirePermission('role.read')
  @ApiOperation({ summary: 'Get role details with permissions' })
  @ApiOkResponse({ type: RoleResponseDto })
  @ApiErrors(404)
  public async findById(
    @Param('roleId') roleId: string,
  ): Promise<RoleResponseDto> {
    const result = await this.roleService.findById(roleId);
    if (result.isFailure) {
      throw new DomainException(
        ErrorCodes.ERR_ROLE_NOT_FOUND,
        result.error as string,
      );
    }
    return result.value;
  }

  @Patch(':roleId')
  @RequirePermission('role.update')
  @ApiOperation({ summary: 'Update role name or permissions' })
  @ApiOkResponse({ description: 'Role updated' })
  @ApiErrors(401, 403, 422)
  public async update(
    @Param('roleId') roleId: string,
    @Body() body: UpdateRoleDto,
  ): Promise<{ id: string; name: string; permissionCodes: string[] }> {
    const result = await this.roleService.update(roleId, body);
    if (result.isFailure) {
      const errorMessage = result.error as string;
      if (errorMessage.includes('name already in use')) {
        throw new DomainException(
          ErrorCodes.ERR_ROLE_NAME_EXISTS,
          errorMessage,
        );
      }
      throw new DomainException(
        ErrorCodes.ERR_ROLE_UPDATE_FAILED,
        errorMessage,
      );
    }
    return result.value;
  }

  @Delete(':roleId')
  @RequirePermission('role.delete')
  @ApiOperation({ summary: 'Delete a custom role' })
  @ApiOkResponse({ description: 'Role deleted' })
  @ApiErrors(401, 403, 404, 422)
  public async delete(@Param('roleId') roleId: string): Promise<void> {
    const result = await this.roleService.delete(roleId);
    if (result.isFailure) {
      if (
        typeof result.error === 'string' &&
        result.error.includes('Built-in')
      ) {
        throw new DomainException(ErrorCodes.ERR_ROLE_BUILT_IN, result.error);
      }
      throw new DomainException(
        ErrorCodes.ERR_ROLE_NOT_FOUND,
        result.error as string,
      );
    }
  }
}
