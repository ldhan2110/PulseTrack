import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SocketAuthService } from '../notifications/socket-auth.service';
import { ChatService } from './chat.service';

@WebSocketGateway({ namespace: '/chat', cors: { origin: '*' } })
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  // In-memory presence: userId → set of live socket ids. Single-node (see design open-q).
  private readonly presence = new Map<string, Set<string>>();

  // Presence transitions are batched: a login storm (500 users) would otherwise
  // fire 500 global broadcasts. Instead we collect the latest state per user and
  // flush one `chat:presence:batch` per window. ponytail: fixed 1s window, tune
  // if presence feels laggy.
  private static readonly PRESENCE_FLUSH_MS = 1000;
  private readonly pendingPresence = new Map<string, boolean>();
  private flushTimer?: ReturnType<typeof setTimeout>;

  private queuePresence(userId: string, online: boolean): void {
    this.pendingPresence.set(userId, online);
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(
        () => this.flushPresence(),
        ChatGateway.PRESENCE_FLUSH_MS,
      );
    }
  }

  private flushPresence(): void {
    this.flushTimer = undefined;
    if (this.pendingPresence.size === 0) return;
    const batch = [...this.pendingPresence].map(([userId, online]) => ({
      userId,
      online,
    }));
    this.pendingPresence.clear();
    this.server?.emit('chat:presence:batch', batch);
  }

  constructor(
    private readonly socketAuthService: SocketAuthService,
    private readonly chatService: ChatService,
  ) {}

  afterInit(server: Server): void {
    this.chatService.setServer(server);
  }

  isOnline(userId: string): boolean {
    return (this.presence.get(userId)?.size ?? 0) > 0;
  }

  async handleConnection(socket: Socket): Promise<void> {
    const userId = await this.socketAuthService.extractUserFromHandshake(
      socket.handshake,
    );

    if (!userId) {
      socket.disconnect(true);
      return;
    }

    socket.data.userId = userId;
    // Personal room for events targeted at the user even without a convo open
    // (added-to-channel, @mention). See ChatService.emitToUser.
    await socket.join(`user:${userId}`);

    const sockets = this.presence.get(userId) ?? new Set<string>();
    const wasOffline = sockets.size === 0;
    sockets.add(socket.id);
    this.presence.set(userId, sockets);
    if (wasOffline) {
      this.queuePresence(userId, true);
    }
    // Snapshot of everyone currently online — so a fresh/refreshed client shows
    // correct status instead of waiting for live deltas that never come.
    socket.emit('chat:presence:snapshot', [...this.presence.keys()]);
  }

  handleDisconnect(socket: Socket): void {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const sockets = this.presence.get(userId);
    if (!sockets) return;
    sockets.delete(socket.id);
    if (sockets.size === 0) {
      this.presence.delete(userId);
      this.queuePresence(userId, false);
    }
  }

  @SubscribeMessage('chat:typing')
  handleTyping(
    @ConnectedSocket() socket: Socket,
    @MessageBody() conversationId: string,
  ): void {
    // Ephemeral — relay to the other members only, no persistence.
    socket
      .to(`convo:${conversationId}`)
      .emit('chat:typing', { conversationId, userId: socket.data.userId });
  }

  // Enter a conversation room (member-gated) so the socket receives its live events.
  @SubscribeMessage('chat:join')
  async handleJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() conversationId: string,
  ): Promise<void> {
    // chat:join can arrive before the async handleConnection sets userId — ignore until authed.
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    await this.chatService.assertMember(conversationId, userId);
    await socket.join(`convo:${conversationId}`);
  }

  @SubscribeMessage('chat:send')
  async handleSend(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { conversationId: string; body?: string; replyToId?: string },
  ): Promise<void> {
    await this.chatService.assertMember(
      payload.conversationId,
      socket.data.userId,
    );
    await socket.join(`convo:${payload.conversationId}`);
    await this.chatService.sendMessage(
      payload.conversationId,
      socket.data.userId,
      payload.body,
      payload.replyToId,
    );
  }
}
