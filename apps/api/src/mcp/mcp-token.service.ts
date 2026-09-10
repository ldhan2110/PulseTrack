import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMcpTokenDto } from './dto/create-mcp-token.dto';

const TOKEN_PREFIX = 'pt_mcp_';

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

@Injectable()
export class McpTokenService {
  constructor(private prisma: PrismaService) {}

  // Mints a PAT bound to (user, project, scopes). Returns the raw token ONCE —
  // only its sha256 hash is persisted (a PAT is verified, not replayed).
  async createToken(projectId: string, userId: string, dto: CreateMcpTokenDto) {
    const raw = TOKEN_PREFIX + randomBytes(16).toString('hex');
    const token = await this.prisma.mcpToken.create({
      data: {
        projectId,
        userId,
        label: dto.label,
        scopes: dto.scopes,
        tokenHash: hashToken(raw),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
    return { ...this.toDto(token), token: raw };
  }

  // Lists a project's tokens. Never exposes tokenHash.
  async list(projectId: string) {
    const tokens = await this.prisma.mcpToken.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    return tokens.map((t) => this.toDto(t));
  }

  // Soft revoke — stamps revokedAt, keeps the audit row.
  async revoke(projectId: string, id: string) {
    const existing = await this.prisma.mcpToken.findFirst({ where: { id, projectId } });
    if (!existing) throw new NotFoundException('Token not found');
    const token = await this.prisma.mcpToken.update({
      where: { id },
      data: { revokedAt: existing.revokedAt ?? new Date() },
    });
    return this.toDto(token);
  }

  private toDto(t: {
    id: string;
    label: string;
    scopes: string[];
    lastUsedAt: Date | null;
    expiresAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: t.id,
      label: t.label,
      scopes: t.scopes,
      lastUsedAt: t.lastUsedAt,
      expiresAt: t.expiresAt,
      revokedAt: t.revokedAt,
      createdAt: t.createdAt,
    };
  }
}
