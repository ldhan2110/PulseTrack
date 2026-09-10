import { UnauthorizedException } from '@nestjs/common';
import { McpPatGuard } from './mcp-pat.guard';
import { hashToken } from './mcp-token.service';

const RAW = 'pt_mcp_0123456789abcdef0123456789abcdef';

function ctx(authorization?: string) {
  const req: any = { headers: { authorization } };
  return {
    _req: req,
    switchToHttp: () => ({ getRequest: () => req }),
  } as any;
}

// Prisma double: one token + membership toggles, records update() calls.
function makePrisma(opts: {
  token: any | null;
  member?: any | null;
}) {
  const updates: any[] = [];
  return {
    updates,
    mcpToken: {
      findUnique: async ({ where }: any) =>
        opts.token && where.tokenHash === opts.token.tokenHash ? opts.token : null,
      update: async (args: any) => {
        updates.push(args);
        return { ...opts.token, ...args.data };
      },
    },
    projectMember: {
      findUnique: async () => (opts.member === undefined ? { id: 'm1' } : opts.member),
    },
  };
}

function activeToken(overrides: any = {}) {
  return {
    id: 't1',
    userId: 'u1',
    projectId: 'p1',
    scopes: ['tasks:read'],
    tokenHash: hashToken(RAW),
    revokedAt: null,
    expiresAt: null,
    ...overrides,
  };
}

describe('McpPatGuard', () => {
  it('missing bearer → 401', async () => {
    const guard = new McpPatGuard(makePrisma({ token: activeToken() }) as any);
    await expect(guard.canActivate(ctx(undefined))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('unknown token (no hash match) → 401', async () => {
    const guard = new McpPatGuard(makePrisma({ token: null }) as any);
    await expect(guard.canActivate(ctx(`Bearer ${RAW}`))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('revoked token → 401', async () => {
    const guard = new McpPatGuard(makePrisma({ token: activeToken({ revokedAt: new Date() }) }) as any);
    await expect(guard.canActivate(ctx(`Bearer ${RAW}`))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('expired token → 401', async () => {
    const past = new Date(Date.now() - 1000);
    const guard = new McpPatGuard(makePrisma({ token: activeToken({ expiresAt: past }) }) as any);
    await expect(guard.canActivate(ctx(`Bearer ${RAW}`))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('non-member token → 401', async () => {
    const guard = new McpPatGuard(makePrisma({ token: activeToken(), member: null }) as any);
    await expect(guard.canActivate(ctx(`Bearer ${RAW}`))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('valid token → passes, stamps lastUsedAt, attaches session', async () => {
    const prisma = makePrisma({ token: activeToken() });
    const guard = new McpPatGuard(prisma as any);
    const c = ctx(`Bearer ${RAW}`);

    await expect(guard.canActivate(c)).resolves.toBe(true);

    // lastUsedAt stamped via update
    expect(prisma.updates).toHaveLength(1);
    expect(prisma.updates[0].data.lastUsedAt).toBeInstanceOf(Date);
    // session attached, projectId comes from the token
    expect(c._req.mcpSession).toEqual({
      userId: 'u1',
      projectId: 'p1',
      scopes: ['tasks:read'],
      tokenId: 't1',
    });
  });
});
