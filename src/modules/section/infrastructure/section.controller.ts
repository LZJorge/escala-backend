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
  ApiQuery,
} from '@nestjs/swagger';
import { RequirePermission } from '@modules/auth/infrastructure/decorators/require-permission.decorator';
import { SectionService } from '../application/section.service';
import {
  CreateSectionDto,
  UpdateSectionDto,
  CreateScheduleDto,
  SectionResponseDto,
  ScheduleResponseDto,
} from '../application/section.dto';
import { ApiErrors } from '@core/infrastructure/http/api-error-response.decorator';
import { DomainException } from '@core/domain/domain.exception';
import { ErrorCodes } from '@core/domain/error-codes';

@ApiTags('Sections')
@Controller('sections')
export class SectionController {
  constructor(private readonly service: SectionService) {}

  @Post()
  @RequirePermission('section.create')
  @ApiOperation({ summary: 'Create a section with optional schedules' })
  @ApiCreatedResponse({ type: SectionResponseDto })
  @ApiErrors(401, 403, 422)
  public async create(
    @Body() body: CreateSectionDto,
  ): Promise<SectionResponseDto> {
    const result = await this.service.create(body);

    if (result.isFailure) {
      if (result.error && result.error.includes('closed term')) {
        throw new DomainException(
          ErrorCodes.ERR_SECTION_CLOSED_TERM,
          result.error,
        );
      }

      throw new DomainException(
        ErrorCodes.ERR_SECTION_CREATION_FAILED,
        result.error as string,
      );
    }

    return result.value;
  }

  @Get()
  @RequirePermission('section.read')
  @ApiOperation({
    summary: 'List sections filtered by term, course, or teacher',
  })
  @ApiOkResponse({ type: [SectionResponseDto] })
  @ApiQuery({ name: 'termId', required: false })
  @ApiQuery({ name: 'courseId', required: false })
  @ApiQuery({ name: 'teacherId', required: false })
  public async findAll(
    @Query('termId') termId?: string,
    @Query('courseId') courseId?: string,
    @Query('teacherId') teacherId?: string,
  ): Promise<SectionResponseDto[]> {
    const result = await this.service.findAll({ termId, courseId, teacherId });

    return result.value;
  }

  @Get(':id')
  @RequirePermission('section.read')
  @ApiOperation({ summary: 'Get section by ID with schedules' })
  @ApiOkResponse({ type: SectionResponseDto })
  @ApiErrors(404)
  public async findById(@Param('id') id: string): Promise<SectionResponseDto> {
    const result = await this.service.findById(id);

    if (result.isFailure) {
      throw new DomainException(
        ErrorCodes.ERR_SECTION_NOT_FOUND,
        result.error as string,
      );
    }

    return result.value;
  }

  @Patch(':id')
  @RequirePermission('section.update')
  @ApiOperation({ summary: 'Update section name, capacity, or teacher' })
  @ApiOkResponse({ type: SectionResponseDto })
  @ApiErrors(401, 403, 404, 422)
  public async update(
    @Param('id') id: string,
    @Body() body: UpdateSectionDto,
  ): Promise<SectionResponseDto> {
    const result = await this.service.update(id, body);

    if (result.isFailure) {
      if (result.error === 'Section not found') {
        throw new DomainException(
          ErrorCodes.ERR_SECTION_NOT_FOUND,
          result.error,
        );
      }

      throw new DomainException(
        ErrorCodes.ERR_SECTION_UPDATE_FAILED,
        result.error as string,
      );
    }

    return result.value;
  }

  @Delete(':id')
  @RequirePermission('section.delete')
  @ApiOperation({
    summary:
      'Soft delete a section (blocked if enrollments or assessments exist)',
  })
  @ApiOkResponse({ description: 'Section deleted' })
  @ApiErrors(401, 403, 404, 409, 422)
  public async delete(
    @Param('id') id: string,
  ): Promise<{ deletedId: string; message: string }> {
    const result = await this.service.delete(id);

    if (result.isFailure) {
      if (result.error === 'Section not found') {
        throw new DomainException(
          ErrorCodes.ERR_SECTION_NOT_FOUND,
          result.error,
        );
      }

      if (result.error && result.error.includes('closed term')) {
        throw new DomainException(
          ErrorCodes.ERR_SECTION_CLOSED_TERM,
          result.error,
        );
      }

      throw new DomainException(
        ErrorCodes.ERR_SECTION_DELETE_FAILED,
        result.error as string,
      );
    }
    return { deletedId: id, message: 'Section deleted successfully' };
  }

  @Post(':id/schedules')
  @RequirePermission('section.schedule')
  @ApiOperation({ summary: 'Add a schedule block to a section' })
  @ApiCreatedResponse({ type: ScheduleResponseDto })
  @ApiErrors(401, 403, 404, 422)
  public async addSchedule(
    @Param('id') id: string,
    @Body() body: CreateScheduleDto,
  ): Promise<ScheduleResponseDto> {
    const result = await this.service.addSchedule(id, body);

    if (result.isFailure) {
      if (result.error === 'Section not found') {
        throw new DomainException(
          ErrorCodes.ERR_SECTION_NOT_FOUND,
          result.error,
        );
      }

      throw new DomainException(
        ErrorCodes.ERR_SECTION_SCHEDULE_CONFLICT,
        result.error as string,
      );
    }

    return result.value;
  }

  @Delete(':id/schedules/:scheduleId')
  @RequirePermission('section.schedule')
  @ApiOperation({ summary: 'Remove a schedule block' })
  @ApiOkResponse({ description: 'Schedule deleted' })
  @ApiErrors(401, 403, 404)
  public async deleteSchedule(
    @Param('id') id: string,
    @Param('scheduleId') scheduleId: string,
  ): Promise<{ sectionId: string; deletedId: string; message: string }> {
    const result = await this.service.deleteSchedule(id, scheduleId);

    if (result.isFailure) {
      throw new DomainException(
        ErrorCodes.ERR_SCHEDULE_NOT_FOUND,
        result.error as string,
      );
    }
    return {
      sectionId: id,
      deletedId: scheduleId,
      message: 'Schedule deleted successfully',
    };
  }
}
