import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatGateway } from './chat.gateway';

function makeSocket(id = 's1') {
  return {
    id,
    handshake: { auth: { token: 'x' } },
    data: {} as Record<string, unknown>,
    disconnect: vi.fn(),
    to: vi.fn(),
    join: vi.fn(),
  } as any;
}

function makeGateway() {
  const auth = { extractUserFromHandshake: vi.fn() };
  const chatService = {
    assertMember: vi.fn(),
    sendMessage: vi.fn(),
    setServer: vi.fn(),
  };
  const gateway = new ChatGateway(auth as any, chatService as any);
  gateway.server = { emit: vi.fn() } as any;
  return { gateway, auth, chatService };
}

describe('ChatGateway.handleConnection', () => {
  it('keeps a valid connection and stashes userId on socket.data', async () => {
    const { gateway, auth } = makeGateway();
    auth.extractUserFromHandshake.mockResolvedValue('u1');
    const socket = makeSocket();

    await gateway.handleConnection(socket);

    expect(socket.disconnect).not.toHaveBeenCalled();
    expect(socket.data.userId).toBe('u1');
    expect(socket.join).toHaveBeenCalledWith('user:u1');
  });

  it('disconnects when the token is missing or invalid', async () => {
    const { gateway, auth } = makeGateway();
    auth.extractUserFromHandshake.mockResolvedValue(null);
    const socket = makeSocket();

    await gateway.handleConnection(socket);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(socket.data.userId).toBeUndefined();
  });
});

describe('ChatGateway typing', () => {
  it('relays chat:typing to other members with no service/DB call', () => {
    const { gateway, chatService } = makeGateway();
    const emit = vi.fn();
    const socket = makeSocket();
    socket.data.userId = 'u1';
    socket.to.mockReturnValue({ emit });

    gateway.handleTyping(socket, 'c1');

    expect(socket.to).toHaveBeenCalledWith('convo:c1');
    expect(emit).toHaveBeenCalledWith('chat:typing', {
      conversationId: 'c1',
      userId: 'u1',
    });
    expect(chatService.assertMember).not.toHaveBeenCalled();
    expect(chatService.sendMessage).not.toHaveBeenCalled();
  });
});

describe('ChatGateway presence', () => {
  let gateway: ChatGateway;
  let auth: { extractUserFromHandshake: ReturnType<typeof vi.fn> };
  let server: { emit: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    const g = makeGateway();
    gateway = g.gateway;
    auth = g.auth;
    server = gateway.server as any;
    auth.extractUserFromHandshake.mockResolvedValue('u1');
  });

  it('stays online across two sockets, goes offline only after the last closes', async () => {
    const s1 = makeSocket('s1');
    const s2 = makeSocket('s2');

    await gateway.handleConnection(s1);
    await gateway.handleConnection(s2);
    expect(gateway.isOnline('u1')).toBe(true);

    gateway.handleDisconnect(s1);
    expect(gateway.isOnline('u1')).toBe(true);

    gateway.handleDisconnect(s2);
    expect(gateway.isOnline('u1')).toBe(false);

    // exactly one online transition and one offline transition
    expect(server.emit).toHaveBeenCalledTimes(2);
    expect(server.emit).toHaveBeenNthCalledWith(1, 'chat:presence', {
      userId: 'u1',
      online: true,
    });
    expect(server.emit).toHaveBeenNthCalledWith(2, 'chat:presence', {
      userId: 'u1',
      online: false,
    });
  });
});
