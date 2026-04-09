import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'requiredPermission';

export interface RequiredPermission {
  area: string;
  action: string;
}

export const RequirePermission = (area: string, action: string) =>
  SetMetadata(PERMISSION_KEY, { area, action } as RequiredPermission);
