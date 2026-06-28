import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UnprocessableEntityException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { MasterAdmin } from '@modules/auth/infrastructure/decorators/master-admin.decorator';
import { RoleService } from '../application/role.service';
import {
  CreateRoleDto,
  UpdateRoleDto,
  RoleResponseDto,
  AssignRoleDto,
  UnassignRoleDto,
} from '../application/role.dto';
import { ApiErrors } from '@core/infrastructure/http/api-error-response.decorator';

@ApiTags('Roles')
@Controller('institutions/:institutionId/roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  @MasterAdmin()
  @ApiOperation({ summary: 'Create a custom role with permissions' })
  @ApiCreatedResponse({ description: 'Role created' })
  @ApiErrors(401, 403, 422)
  public async create(
    @Param('institutionId') institutionId: string,
    @Body() body: CreateRoleDto,
  ): Promise<{ id: string; name: string; permissionCodes: string[] }> {
    const result = await this.roleService.create(institutionId, body);
    if (result.isFailure) {
      throw new UnprocessableEntityException(result.error);
    }
    return result.value;
  }

  @Get()
  @ApiOperation({ summary: 'List all roles for an institution' })
  @ApiOkResponse({ type: [RoleResponseDto] })
  public async findAll(
    @Param('institutionId') institutionId: string,
  ): Promise<RoleResponseDto[]> {
    const result = await this.roleService.findAll(institutionId);
    return result.value;
  }

  @Get(':roleId')
  @ApiOperation({ summary: 'Get role details with permissions' })
  @ApiOkResponse({ type: RoleResponseDto })
  @ApiErrors(404)
  public async findById(
    @Param('roleId') roleId: string,
  ): Promise<RoleResponseDto> {
    const result = await this.roleService.findById(roleId);
    if (result.isFailure) {
      throw new NotFoundException(result.error);
    }
    return result.value;
  }

  @Patch(':roleId')
  @MasterAdmin()
  @ApiOperation({ summary: 'Update role name or permissions' })
  @ApiOkResponse({ description: 'Role updated' })
  @ApiErrors(401, 403, 422)
  public async update(
    @Param('roleId') roleId: string,
    @Body() body: UpdateRoleDto,
  ): Promise<{ id: string; name: string; permissionCodes: string[] }> {
    const result = await this.roleService.update(roleId, body);
    if (result.isFailure) {
      throw new UnprocessableEntityException(result.error);
    }
    return result.value;
  }

  @Delete(':roleId')
  @MasterAdmin()
  @ApiOperation({ summary: 'Delete a custom role' })
  @ApiOkResponse({ description: 'Role deleted' })
  @ApiErrors(401, 403, 422)
  public async delete(@Param('roleId') roleId: string): Promise<void> {
    const result = await this.roleService.delete(roleId);
    if (result.isFailure) {
      throw new UnprocessableEntityException(result.error);
    }
  }
}

@ApiTags('Roles')
@Controller('institutions/:institutionId/role-assignments')
export class RoleAssignmentController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  @MasterAdmin()
  @ApiOperation({ summary: 'Assign a role to an institution user' })
  @ApiCreatedResponse({ description: 'Role assigned' })
  @ApiErrors(401, 403, 422)
  public async assign(@Body() body: AssignRoleDto): Promise<void> {
    const result = await this.roleService.assignRole(
      body.institutionUserId,
      body.roleId,
    );
    if (result.isFailure) {
      throw new UnprocessableEntityException(result.error);
    }
  }

  @Delete()
  @MasterAdmin()
  @ApiOperation({ summary: 'Remove a role from an institution user' })
  @ApiOkResponse({ description: 'Role unassigned' })
  @ApiErrors(401, 403, 422)
  public async unassign(@Body() body: UnassignRoleDto): Promise<void> {
    const result = await this.roleService.unassignRole(
      body.institutionUserId,
      body.roleId,
    );
    if (result.isFailure) {
      throw new UnprocessableEntityException(result.error);
    }
  }
}
