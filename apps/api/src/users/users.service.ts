import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auth: AuthService,
  ) {}

  // Strip secret fields from any user before it leaves the API.
  sanitizeUser(user: User) {
    const { passwordHash, pwResetTokenHash, pwResetTokenExp, ...safe } = user;
    void passwordHash;
    void pwResetTokenHash;
    void pwResetTokenExp;
    return safe;
  }

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

  private async requireExternal(userId: string): Promise<User> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.userType !== 'EXTERNAL') {
      throw new ForbiddenException('Profile is managed by your identity provider');
    }
    return user;
  }

  async updateOwnProfile(userId: string, dto: UpdateProfileDto) {
    await this.requireExternal(userId);
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Name cannot be empty');
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { name },
    });
    return this.sanitizeUser(updated);
  }

  async updateOwnAvatar(userId: string, avatarUrl: string) {
    await this.requireExternal(userId);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { imageUrl: avatarUrl },
    });
    return this.sanitizeUser(updated);
  }

  async changeOwnPassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.requireExternal(userId);
    const ok =
      !!user.passwordHash &&
      (await this.auth.verifyPassword(user.passwordHash, dto.currentPassword));
    if (!ok) throw new UnauthorizedException('Current password is incorrect');
    const passwordHash = await this.auth.hashPassword(dto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    return { success: true };
  }
}
