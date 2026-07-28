import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UnprocessableEntityException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { RequirePermission } from '@modules/auth/infrastructure/decorators/require-permission.decorator';
import { TermService } from '../application/term.service';
import {
  CreateTermDto,
  UpdateTermDto,
  ChangeTermStatusDto,
  TermResponseDto,
} from '../application/term.dto';
import { ApiErrors } from '@core/infrastructure/http/api-error-response.decorator';

@ApiTags('Terms')
@Controller('terms')
export class TermController {
  constructor(private readonly service: TermService) {}

  @Post()
  @RequirePermission('term.create')
  @ApiOperation({ summary: 'Create an academic term' })
  @ApiCreatedResponse({ type: TermResponseDto })
  @ApiErrors(401, 403, 422)
  public async create(@Body() body: CreateTermDto): Promise<TermResponseDto> {
    const result = await this.service.create(body);

    if (result.isFailure) {
      throw new UnprocessableEntityException(result.error);
    }

    return result.value;
  }

  @Get()
  @RequirePermission('term.read')
  @ApiOperation({ summary: 'List all terms' })
  @ApiOkResponse({ type: [TermResponseDto] })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['UPCOMING', 'ACTIVE', 'CLOSED'],
  })
  public async findAll(
    @Query('status') status?: string,
  ): Promise<TermResponseDto[]> {
    const result = await this.service.findAll(status);

    return result.value;
  }

  @Get('active')
  @RequirePermission('term.read')
  @ApiOperation({ summary: 'Get the currently active term' })
  @ApiOkResponse({ type: TermResponseDto })
  public async findActive(): Promise<TermResponseDto | null> {
    const result = await this.service.findActive();

    return result.value;
  }

  @Get(':id')
  @RequirePermission('term.read')
  @ApiOperation({ summary: 'Get term by ID' })
  @ApiOkResponse({ type: TermResponseDto })
  @ApiErrors(404)
  public async findById(@Param('id') id: string): Promise<TermResponseDto> {
    const result = await this.service.findById(id);

    if (result.isFailure) {
      throw new NotFoundException(result.error);
    }

    return result.value;
  }

  @Patch(':id')
  @RequirePermission('term.update')
  @ApiOperation({
    summary: 'Update term details (name, dates) — only if not CLOSED',
  })
  @ApiOkResponse({ type: TermResponseDto })
  @ApiErrors(401, 403, 404, 422)
  public async update(
    @Param('id') id: string,
    @Body() body: UpdateTermDto,
  ): Promise<TermResponseDto> {
    const result = await this.service.update(id, body);

    if (result.isFailure) {
      if (result.error === 'Term not found') {
        throw new NotFoundException(result.error);
      }

      throw new UnprocessableEntityException(result.error);
    }

    return result.value;
  }

  @Patch(':id/status')
  @RequirePermission('term.close')
  @ApiOperation({ summary: 'Change term status (UPCOMING → ACTIVE → CLOSED)' })
  @ApiOkResponse({ type: TermResponseDto })
  @ApiErrors(401, 403, 404, 409, 422)
  public async changeStatus(
    @Param('id') id: string,
    @Body() body: ChangeTermStatusDto,
  ): Promise<TermResponseDto> {
    const result = await this.service.changeStatus(id, body.status);

    if (result.isFailure) {
      if (result.error === 'Term not found') {
        throw new NotFoundException(result.error);
      }

      if (result.error === 'Another term is already active') {
        throw new ConflictException(result.error);
      }

      // ponytail: invalid transitions become 422
      throw new UnprocessableEntityException(result.error);
    }

    return result.value;
  }

  @Delete(':id')
  @RequirePermission('term.delete')
  @ApiOperation({ summary: 'Soft delete an upcoming term' })
  @ApiOkResponse({ description: 'Term deleted' })
  @ApiErrors(401, 403, 404, 422)
  public async delete(@Param('id') id: string): Promise<void> {
    const result = await this.service.delete(id);

    if (result.isFailure) {
      if (result.error === 'Term not found') {
        throw new NotFoundException(result.error);
      }

      throw new UnprocessableEntityException(result.error);
    }
  }
}
