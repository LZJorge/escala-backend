import {
  Controller,
  Get,
  Post,
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
import { SuperAdmin } from '@modules/auth/infrastructure/decorators/super-admin.decorator';
import { MasterAdmin } from '@modules/auth/infrastructure/decorators/master-admin.decorator';
import { InstitutionService } from '../application/institution.service';
import {
  CreateInstitutionDto,
  CreateInstitutionUserDto,
} from '../application/institution.dto';

@ApiTags('Institutions')
@Controller('institutions')
export class InstitutionController {
  constructor(private readonly institutionService: InstitutionService) {}

  @Post()
  @SuperAdmin()
  @ApiOperation({ summary: 'Create a new institution (super admin only)' })
  @ApiCreatedResponse({ description: 'Institution created' })
  public async create(@Body() body: CreateInstitutionDto): Promise<{
    id: string;
    name: string;
    slug: string;
    institutionType: string;
    contactEmail: string;
  }> {
    const result = await this.institutionService.create(body);
    if (result.isFailure) {
      throw new UnprocessableEntityException(result.error);
    }
    return result.value;
  }

  @Get()
  @ApiOperation({ summary: 'List all institutions' })
  @ApiOkResponse({ description: 'Array of institutions' })
  public async findAll(): Promise<
    Array<{ id: string; name: string; slug: string; institutionType: string }>
  > {
    const result = await this.institutionService.findAll();
    return result.value;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get institution by ID' })
  @ApiOkResponse({ description: 'Institution details' })
  public async findById(@Param('id') id: string): Promise<{
    id: string;
    name: string;
    slug: string;
    institutionType: string;
    contactEmail: string;
    websiteUrl: string | null;
    logoUrl: string | null;
    isVerified: boolean;
  }> {
    const result = await this.institutionService.findById(id);
    if (result.isFailure) {
      throw new NotFoundException(result.error);
    }
    return result.value;
  }

  @Post(':institutionId/users')
  @MasterAdmin()
  @ApiOperation({
    summary: 'Create a user within the institution (admin only)',
  })
  public async createUser(
    @Param('institutionId') institutionId: string,
    @Body() body: CreateInstitutionUserDto,
  ): Promise<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    institutionUserId: string;
  }> {
    const result = await this.institutionService.createUser(
      institutionId,
      body,
    );
    if (result.isFailure) {
      throw new UnprocessableEntityException(result.error);
    }
    return result.value;
  }
}
