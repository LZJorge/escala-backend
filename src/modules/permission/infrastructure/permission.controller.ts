import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { PermissionService } from '../application/permission.service';
import { PermissionDto } from '../application/permission.dto';

@ApiTags('Permissions')
@Controller('permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get()
  @ApiOperation({ summary: 'List all available permissions' })
  @ApiOkResponse({ type: [PermissionDto] })
  public async findAll(): Promise<PermissionDto[]> {
    return this.permissionService.findAll();
  }
}
