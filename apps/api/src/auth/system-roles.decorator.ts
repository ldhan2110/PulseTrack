import { SetMetadata } from '@nestjs/common';

export const SYSTEM_ROLES_KEY = 'systemRoles';
export const SystemRoles = (...roles: string[]) => SetMetadata(SYSTEM_ROLES_KEY, roles);
