export const PERMISSION_REPOSITORY = Symbol('PERMISSION_REPOSITORY');

export interface PermissionRecord {
  id: string;
  code: string;
  module: string;
  description: string | null;
}

export interface PermissionRepository {
  findAll(): Promise<PermissionRecord[]>;
  findByCodes(codes: string[]): Promise<PermissionRecord[]>;
}
