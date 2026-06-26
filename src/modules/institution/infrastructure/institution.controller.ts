import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  UnprocessableEntityException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '@modules/auth/infrastructure/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: { sub: string; email: string };
}
import { InstitutionService } from '../application/institution.service';
import { CreateInstitutionDto } from '../application/institution.dto';

@ApiTags('Institutions')
@Controller('institutions')
export class InstitutionController {
  constructor(private readonly institutionService: InstitutionService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new institution (super admin only)' })
  @ApiCreatedResponse({ description: 'Institution created' })
  public async create(@Body() body: CreateInstitutionDto): Promise<{
    id: string;
    name: string;
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
    Array<{ id: string; name: string; institutionType: string }>
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a user within the institution (admin only)',
  })
  public async createUser(
    @Req() request: AuthenticatedRequest,
    @Param('institutionId') institutionId: string,
    @Body()
    body: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      ci: string;
      phone?: string;
    },
  ): Promise<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    institutionUserId: string;
  }> {
    const result = await this.institutionService.createUser(
      request.user.sub,
      institutionId,
      body,
    );
    if (result.isFailure) {
      throw new UnprocessableEntityException(result.error);
    }
    return result.value;
  }
}
