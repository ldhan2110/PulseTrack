import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByKeycloakId(keycloakId: string) {
    return this.prisma.user.findUnique({ where: { keycloakId } });
  }

  async findAll(callerId: string) {
    // Directory scoping: only users sharing a project or conversation with the
    // caller — never the whole user table (external→internal enumeration).
    return this.prisma.user.findMany({
      where: {
        id: { not: callerId },
        OR: [
          {
            projectMembers: { some: { project: { members: { some: { userId: callerId } } } } },
          },
          {
            conversationMemberships: {
              some: { conversation: { members: { some: { userId: callerId } } } },
            },
          },
        ],
      },
    });
  }
}
