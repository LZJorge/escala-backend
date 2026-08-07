import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { RequirePermission } from '@modules/auth/infrastructure/decorators/require-permission.decorator';
import { ProgramService } from '../application/program.service';
import {
  CreateProgramDto,
  UpdateProgramDto,
  ProgramResponseDto,
  PensumResponseDto,
  ProgramSummaryResponseDto,
} from '../application/program.dto';
import { ApiErrors } from '@core/infrastructure/http/api-error-response.decorator';
import { DomainException } from '@core/domain/domain.exception';
import { ErrorCodes } from '@core/domain/error-codes';

@ApiTags('Programs')
@Controller('programs')
export class ProgramController {
  constructor(private readonly service: ProgramService) {}

  @Post()
  @RequirePermission('program.create')
  @ApiOperation({ summary: 'Create a program' })
  @ApiCreatedResponse({ type: ProgramResponseDto })
  @ApiErrors(401, 403, 422)
  public async create(
    @Body() body: CreateProgramDto,
  ): Promise<ProgramResponseDto> {
    const result = await this.service.create(body);

    if (result.isFailure) {
      throw new DomainException(
        ErrorCodes.ERR_PROGRAM_CREATION_FAILED,
        result.error as string,
      );
    }

    return result.value;
  }

  @Get()
  @RequirePermission('program.read')
  @ApiOperation({ summary: 'List all programs' })
  @ApiOkResponse({ type: [ProgramResponseDto] })
  public async findAll(): Promise<ProgramResponseDto[]> {
    const result = await this.service.findAll();

    return result.value;
  }

  @Get(':programId')
  @RequirePermission('program.read')
  @ApiOperation({ summary: 'Get program by ID' })
  @ApiOkResponse({ type: ProgramResponseDto })
  @ApiErrors(404)
  public async findById(
    @Param('programId') programId: string,
  ): Promise<ProgramResponseDto> {
    const result = await this.service.findById(programId);

    if (result.isFailure) {
      throw new DomainException(
        ErrorCodes.ERR_PROGRAM_NOT_FOUND,
        result.error as string,
      );
    }

    return result.value;
  }

  @Patch(':programId')
  @RequirePermission('program.update')
  @ApiOperation({ summary: 'Update a program' })
  @ApiOkResponse({ type: ProgramResponseDto })
  @ApiErrors(401, 403, 404, 422)
  public async update(
    @Param('programId') programId: string,
    @Body() body: UpdateProgramDto,
  ): Promise<ProgramResponseDto> {
    const result = await this.service.update(programId, body);

    if (result.isFailure) {
      throw new DomainException(
        ErrorCodes.ERR_PROGRAM_UPDATE_FAILED,
        result.error as string,
      );
    }

    return result.value;
  }

  @Get(':programId/summary')
  @RequirePermission('program.read')
  @ApiOperation({
    summary:
      'Get program summary with pensum and enrollment metadata for dashboards',
  })
  @ApiOkResponse({ type: ProgramSummaryResponseDto })
  @ApiErrors(404)
  public async getSummary(
    @Param('programId') programId: string,
  ): Promise<ProgramSummaryResponseDto> {
    const result = await this.service.getSummary(programId);

    if (result.isFailure) {
      throw new DomainException(
        ErrorCodes.ERR_PROGRAM_NOT_FOUND,
        result.error as string,
      );
    }

    return result.value;
  }

  @Get(':programId/pensum')
  @RequirePermission('program.read')
  @ApiOperation({
    summary: 'Get program pensum with all courses and prerequisites',
  })
  @ApiOkResponse({ type: PensumResponseDto })
  @ApiErrors(404)
  public async getPensum(
    @Param('programId') programId: string,
  ): Promise<PensumResponseDto> {
    const result = await this.service.getPensum(programId);

    if (result.isFailure) {
      throw new DomainException(
        ErrorCodes.ERR_PROGRAM_NOT_FOUND,
        result.error as string,
      );
    }

    return result.value;
  }

  @Delete(':programId')
  @RequirePermission('program.delete')
  @ApiOperation({ summary: 'Soft delete a program' })
  @ApiOkResponse({ description: 'Program deleted' })
  @ApiErrors(401, 403, 404, 422)
  public async delete(
    @Param('programId') programId: string,
  ): Promise<{ deletedId: string; message: string }> {
    const result = await this.service.delete(programId);

    if (result.isFailure) {
      if (result.error === 'Program not found') {
        throw new DomainException(
          ErrorCodes.ERR_PROGRAM_NOT_FOUND,
          result.error,
        );
      }
      throw new DomainException(
        ErrorCodes.ERR_PROGRAM_DELETE_FAILED,
        result.error as string,
      );
    }
    return { deletedId: programId, message: 'Program deleted successfully' };
  }
}
