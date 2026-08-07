const PREFIX = 'escala';

export const CacheKeys = {
  PROGRAM_SUMMARY: (programId: string) =>
    `${PREFIX}:program:${programId}:summary` as const,
} as const;

export type ValidCacheKey = ReturnType<
  (typeof CacheKeys)[keyof typeof CacheKeys]
>;
