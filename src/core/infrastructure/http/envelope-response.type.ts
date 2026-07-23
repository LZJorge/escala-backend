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

export interface EnvelopeError {
  code: string;
  message: string;
  details?: string[];
}

export interface EnvelopeErrorResponse {
  error: EnvelopeError;
}
