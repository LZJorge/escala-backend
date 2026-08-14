const PREFIX = 'escala';

export const CacheKeys = {
  PROGRAM_ALL: () => `${PREFIX}:program:all` as const,
  PROGRAM_BY_ID: (programId: string) =>
    `${PREFIX}:program:${programId}` as const,
  PROGRAM_SUMMARY: (programId: string) =>
    `${PREFIX}:program:${programId}:summary` as const,
  PROGRAM_PENSUM: (programId: string) =>
    `${PREFIX}:program:${programId}:pensum` as const,
  COURSE_BY_PROGRAM: (programId: string) =>
    `${PREFIX}:program:${programId}:courses` as const,
  COURSE_BY_ID: (courseId: string) => `${PREFIX}:course:${courseId}` as const,
  TERM_LIST: (status?: string, programId?: string) =>
    `${PREFIX}:terms:list:${status ?? '*'}:${programId ?? '*'}` as const,
  TERM_ACTIVE: (programId?: string) =>
    `${PREFIX}:terms:active:${programId ?? '*'}` as const,
  TERM_BY_ID: (termId: string) => `${PREFIX}:term:${termId}` as const,
} as const;
export type ValidCacheKey = ReturnType<
  (typeof CacheKeys)[keyof typeof CacheKeys]
>;
