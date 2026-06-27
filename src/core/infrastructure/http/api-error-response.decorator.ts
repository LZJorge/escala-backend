import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

const ERROR_LABELS: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
};

export function ApiErrors(
  ...statuses: number[]
): MethodDecorator & PropertyDecorator {
  return applyDecorators(
    ...statuses.map((status: number) =>
      ApiResponse({
        status,
        description: ERROR_LABELS[status] ?? 'Error',
        schema: {
          type: 'object',
          properties: {
            statusCode: { type: 'number', example: status },
            message: { type: 'string', example: ERROR_LABELS[status] },
            error: {
              type: 'string',
              example: ERROR_LABELS[status] ?? 'Error',
            },
            timestamp: {
              type: 'string',
              example: new Date().toISOString(),
            },
            path: { type: 'string', example: '/api/endpoint' },
          },
        },
      }),
    ),
  );
}
