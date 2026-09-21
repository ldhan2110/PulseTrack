import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { ConversationMemberGuard } from './conversation-member.guard';
import { ChatService } from './chat.service';

function ctx(conversationId: string | undefined, userId: string | undefined) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ params: { id: conversationId }, user: { id: userId } }),
    }),
  } as any;
}

describe('ConversationMemberGuard', () => {
  let prisma: any;
  let guard: ConversationMemberGuard;

  beforeEach(() => {
    prisma = { conversationMember: { findUnique: vi.fn() } };
    guard = new ConversationMemberGuard(new ChatService(prisma));
  });

  it('allows a member', async () => {
    prisma.conversationMember.findUnique.mockResolvedValue({ id: 'm1' });
    await expect(guard.canActivate(ctx('c1', 'u1'))).resolves.toBe(true);
  });

  it('denies a non-member with 403', async () => {
    prisma.conversationMember.findUnique.mockResolvedValue(null);
    await expect(guard.canActivate(ctx('c1', 'u2'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
