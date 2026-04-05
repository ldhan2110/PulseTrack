import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async upsertFromJwt(jwtUser: { sub: string; email: string; username: string; roles: string[] }) {
    const role = this.mapPrimaryRole(jwtUser.roles);
    return this.prisma.user.upsert({
      where: { keycloakId: jwtUser.sub },
      update: { email: jwtUser.email, username: jwtUser.username, role },
      create: {
        keycloakId: jwtUser.sub,
        email: jwtUser.email,
        username: jwtUser.username,
        role,
      },
    });
  }

  async findByKeycloakId(keycloakId: string) {
    return this.prisma.user.findUnique({ where: { keycloakId } });
  }

  async findAll() {
    return this.prisma.user.findMany();
  }

  private mapPrimaryRole(roles: string[]): UserRole {
    // Priority: pm > ba > developer > leadership
    if (roles.includes('pm')) return UserRole.pm;
    if (roles.includes('ba')) return UserRole.ba;
    if (roles.includes('developer')) return UserRole.developer;
    if (roles.includes('leadership')) return UserRole.leadership;
    return UserRole.developer; // default fallback
  }
}
