import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { hashToken } from './mcp-token.service';

export interface McpSession {
  userId: string;
  projectId: string;
  scopes: string[];
  tokenId: string;
}

// Trust boundary for /mcp. External agents have no Keycloak JWT, so this guard —
// not JwtAuthGuard — authenticates the request via the PAT. Resolves the token,
// its user, and the project membership once, and attaches an McpSession to the
// request for the transport/tool layer. projectId always comes from the token,
// never a request/tool argument.
@Injectable()
export class McpPatGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const raw = this.extractBearer(req.headers?.authorization);
    if (!raw) throw new UnauthorizedException('Missing MCP token');

    const token = await this.prisma.mcpToken.findUnique({
      where: { tokenHash: hashToken(raw) },
    });
    if (!token) throw new UnauthorizedException('Invalid MCP token');
    if (token.revokedAt) throw new UnauthorizedException('MCP token revoked');
    if (token.expiresAt && token.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('MCP token expired');
    }

    // The token's user must still be a member of the bound project.
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: token.projectId, userId: token.userId } },
    });
    if (!member) throw new UnauthorizedException('Token user is not a project member');

    await this.prisma.mcpToken.update({
      where: { id: token.id },
      data: { lastUsedAt: new Date() },
    });

    const session: McpSession = {
      userId: token.userId,
      projectId: token.projectId,
      scopes: token.scopes,
      tokenId: token.id,
    };
    req.mcpSession = session;
    return true;
  }

  private extractBearer(header?: string): string | null {
    if (!header) return null;
    const [scheme, value] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !value) return null;
    return value.trim();
  }
}
