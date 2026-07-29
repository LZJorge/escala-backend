import { Controller, Get, Patch, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { SuperAdmin } from '@modules/auth/infrastructure/decorators/super-admin.decorator';
import { InstitutionService } from '../application/institution.service';
import { UpdateInstitutionDto } from '../application/institution.dto';
import { ApiErrors } from '@core/infrastructure/http/api-error-response.decorator';
import { DomainException } from '@core/domain/domain.exception';
import { ErrorCodes } from '@core/domain/error-codes';

@ApiTags('Institution')
@Controller()
export class InstitutionController {
  constructor(private readonly institutionService: InstitutionService) {}

  @Get('institution')
  @ApiOperation({ summary: 'Get the single institution record' })
  @ApiOkResponse({ description: 'Institution details' })
  @ApiErrors(404)
  public async findOne(): Promise<{
    id: string;
    name: string;
    contactEmail: string | null;
    websiteUrl: string | null;
    logoUrl: string | null;
  }> {
    const result = await this.institutionService.get();
    if (result.isFailure) {
      throw new DomainException(
        ErrorCodes.ERR_INSTITUTION_NOT_FOUND,
        result.error as string,
      );
    }
    return result.value;
  }

  @Patch('institution')
  @SuperAdmin()
  @ApiOperation({ summary: 'Update institution config (super admin only)' })
  @ApiOkResponse({ description: 'Institution updated' })
  @ApiErrors(401, 403, 404)
  public async update(@Body() body: UpdateInstitutionDto): Promise<{
    id: string;
    name: string;
    contactEmail: string | null;
    websiteUrl: string | null;
    logoUrl: string | null;
  }> {
    const result = await this.institutionService.update(body);
    if (result.isFailure) {
      throw new DomainException(
        ErrorCodes.ERR_INSTITUTION_UPDATE_FAILED,
        result.error as string,
      );
    }
    return result.value;
  }
}
