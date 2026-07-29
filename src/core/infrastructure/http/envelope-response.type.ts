export interface PaginatedMeta {
  total: number;
  page: number;
  lastPage: number;
  hasNextPage: boolean;
}

export interface EnvelopeResponse<T> {
  data: T;
  meta?: PaginatedMeta;
}

export interface ErrorResponse {
  statusCode: number;
  errorCode: string;
  message: string;
  details?: Record<string, unknown> | string[];
  timestamp: string;
  path: string;
}
