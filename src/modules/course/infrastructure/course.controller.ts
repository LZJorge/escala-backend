import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
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
import { CourseService } from '../application/course.service';
import {
  CreateCourseDto,
  UpdateCourseDto,
  SetPrerequisitesDto,
  CourseResponseDto,
} from '../application/course.dto';
import { ApiErrors } from '@core/infrastructure/http/api-error-response.decorator';
import { DomainException } from '@core/domain/domain.exception';
import { ErrorCodes } from '@core/domain/error-codes';

@ApiTags('Courses')
@Controller('courses')
export class CourseController {
  constructor(private readonly service: CourseService) {}

  @Post()
  @RequirePermission('course.create')
  @ApiOperation({ summary: 'Create a course' })
  @ApiCreatedResponse({ type: CourseResponseDto })
  @ApiErrors(401, 403, 422)
  public async create(
    @Body() body: CreateCourseDto,
  ): Promise<CourseResponseDto> {
    const result = await this.service.create(body);

    if (result.isFailure) {
      if (result.error === 'Program not found') {
        throw new DomainException(
          ErrorCodes.ERR_PROGRAM_NOT_FOUND,
          result.error,
        );
      }
      throw new DomainException(
        ErrorCodes.ERR_COURSE_CREATION_FAILED,
        result.error as string,
      );
    }

    return result.value;
  }

  @Get('by-program/:programId')
  @RequirePermission('course.read')
  @ApiOperation({ summary: 'List courses by program' })
  @ApiOkResponse({ type: [CourseResponseDto] })
  public async findByProgram(
    @Param('programId') programId: string,
  ): Promise<CourseResponseDto[]> {
    const result = await this.service.findByProgram(programId);

    return result.value;
  }

  @Get(':courseId')
  @RequirePermission('course.read')
  @ApiOperation({ summary: 'Get course by ID' })
  @ApiOkResponse({ type: CourseResponseDto })
  @ApiErrors(404)
  public async findById(
    @Param('courseId') courseId: string,
  ): Promise<CourseResponseDto> {
    const result = await this.service.findById(courseId);

    if (result.isFailure) {
      throw new DomainException(
        ErrorCodes.ERR_COURSE_NOT_FOUND,
        result.error as string,
      );
    }

    return result.value;
  }

  @Patch(':courseId')
  @RequirePermission('course.update')
  @ApiOperation({ summary: 'Update a course' })
  @ApiOkResponse({ type: CourseResponseDto })
  @ApiErrors(401, 403, 404, 422)
  public async update(
    @Param('courseId') courseId: string,
    @Body() body: UpdateCourseDto,
  ): Promise<CourseResponseDto> {
    const result = await this.service.update(courseId, body);

    if (result.isFailure) {
      if (result.error === 'Course not found') {
        throw new DomainException(
          ErrorCodes.ERR_COURSE_NOT_FOUND,
          result.error,
        );
      }
      throw new DomainException(
        ErrorCodes.ERR_COURSE_UPDATE_FAILED,
        result.error as string,
      );
    }

    return result.value;
  }

  @Delete(':courseId')
  @RequirePermission('course.delete')
  @ApiOperation({ summary: 'Soft delete a course' })
  @ApiOkResponse({ description: 'Course deleted' })
  @ApiErrors(401, 403, 404, 422)
  public async delete(
    @Param('courseId') courseId: string,
  ): Promise<{ deletedId: string; message: string }> {
    const result = await this.service.delete(courseId);

    if (result.isFailure) {
      if (result.error === 'Course not found') {
        throw new DomainException(
          ErrorCodes.ERR_COURSE_NOT_FOUND,
          result.error,
        );
      }
      throw new DomainException(
        ErrorCodes.ERR_COURSE_DELETE_FAILED,
        result.error as string,
      );
    }
    return { deletedId: courseId, message: 'Course deleted successfully' };
  }

  @Put(':courseId/prerequisites')
  @RequirePermission('course.update')
  @ApiOperation({ summary: 'Set prerequisites for a course (replaces all)' })
  @ApiOkResponse({ description: 'Prerequisites updated' })
  @ApiErrors(401, 403, 404, 422)
  public async setPrerequisites(
    @Param('courseId') courseId: string,
    @Body() body: SetPrerequisitesDto,
  ): Promise<{ courseId: string; prerequisiteCount: number }> {
    const seen = new Set<string | number>();
    const mapped: Array<{
      requiredCourseId: string | null;
      requiredCredits: number | null;
    }> = [];
    for (const p of body.prerequisites) {
      const key = p.requiredCourseId ?? p.requiredCredits;

      if (key !== undefined && seen.has(key)) {
        continue;
      }

      if (key !== undefined) {
        seen.add(key);
      }

      mapped.push({
        requiredCourseId: p.requiredCourseId ?? null,
        requiredCredits: p.requiredCredits ?? null,
      });
    }
    const result = await this.service.setPrerequisites(courseId, mapped);

    if (result.isFailure) {
      if (result.error === 'Course not found') {
        throw new DomainException(
          ErrorCodes.ERR_COURSE_NOT_FOUND,
          result.error,
        );
      }
      throw new DomainException(
        ErrorCodes.ERR_COURSE_PREREQ_INVALID,
        result.error as string,
      );
    }
    return { courseId, prerequisiteCount: mapped.length };
  }
}
