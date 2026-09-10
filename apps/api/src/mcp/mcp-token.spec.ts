import { createHash } from 'crypto';
import { ForbiddenException } from '@nestjs/common';
import { McpTokenService, hashToken } from './mcp-token.service';
import { ProjectRolesGuard } from '../auth/project-roles.guard';

// Minimal in-memory Prisma double — only the mcpToken methods the service touches.
function makePrisma() {
  const rows: any[] = [];
  return {
    rows,
    mcpToken: {
      create: async ({ data }: any) => {
        const row = { id: 'id' + rows.length, lastUsedAt: null, revokedAt: null, expiresAt: null, createdAt: new Date(), ...data };
        rows.push(row);
        return row;
      },
      findMany: async ({ where }: any) => rows.filter((r) => r.projectId === where.projectId),
      findFirst: async ({ where }: any) => rows.find((r) => r.id === where.id && r.projectId === where.projectId) ?? null,
      update: async ({ where, data }: any) => {
        const row = rows.find((r) => r.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
  };
}

describe('McpTokenService', () => {
  it('createToken returns a pt_mcp_ raw token and stores only its sha256 hash', async () => {
    const prisma = makePrisma();
    const svc = new McpTokenService(prisma as any);

    const result = await svc.createToken('p1', 'u1', { label: 'Cursor', scopes: ['tasks:read'] });

    expect(result.token).toMatch(/^pt_mcp_[0-9a-f]{32}$/);
    const stored = prisma.rows[0];
    // raw token is never what's stored
    expect(stored.tokenHash).not.toBe(result.token);
    // stored value is exactly sha256(raw) hex
    expect(stored.tokenHash).toBe(createHash('sha256').update(result.token).digest('hex'));
    expect(stored.tokenHash).toBe(hashToken(result.token));
  });

  it('list never exposes the tokenHash', async () => {
    const prisma = makePrisma();
    const svc = new McpTokenService(prisma as any);
    await svc.createToken('p1', 'u1', { label: 'a', scopes: ['bugs:read'] });

    const list = await svc.list('p1');
    expect(list).toHaveLength(1);
    expect(list[0]).not.toHaveProperty('tokenHash');
    expect(list[0]).not.toHaveProperty('token');
  });

  it('revoke sets revokedAt (soft delete)', async () => {
    const prisma = makePrisma();
    const svc = new McpTokenService(prisma as any);
    const created = await svc.createToken('p1', 'u1', { label: 'a', scopes: ['tasks:read'] });

    const revoked = await svc.revoke('p1', created.id);
    expect(revoked.revokedAt).toBeInstanceOf(Date);
  });
});

describe('ProjectRolesGuard — manage gate on token routes', () => {
  function ctx(handlerPerm: any) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: 'u1' }, params: { projectId: 'p1' } }),
      }),
      getHandler: () => 'h',
      getClass: () => 'c',
    } as any;
  }

  it('non-manager (member without projectSettings:update) is blocked with 403', async () => {
    const prisma = {
      projectMember: {
        findUnique: async () => ({
          customRole: { isSystem: false, permissions: { projectSettings: {} } },
        }),
      },
    };
    const reflector = {
      getAllAndOverride: () => ({ area: 'projectSettings', action: 'update' }),
    };
    const guard = new ProjectRolesGuard(reflector as any, prisma as any);

    await expect(guard.canActivate(ctx(null))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('manager (permission present) passes', async () => {
    const prisma = {
      projectMember: {
        findUnique: async () => ({
          customRole: { isSystem: false, permissions: { projectSettings: { update: true } } },
        }),
      },
    };
    const reflector = {
      getAllAndOverride: () => ({ area: 'projectSettings', action: 'update' }),
    };
    const guard = new ProjectRolesGuard(reflector as any, prisma as any);

    await expect(guard.canActivate(ctx(null))).resolves.toBe(true);
  });
});
