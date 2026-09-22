import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ChatService } from './chat.service';

/**
 * Chat is cross-project, so ProjectRolesGuard (needs :projectId) does not apply.
 * This guard authorizes by conversation membership instead.
 */
@Injectable()
export class ConversationMemberGuard implements CanActivate {
  constructor(private readonly chatService: ChatService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const conversationId = req.params?.conversationId ?? req.params?.id;
    const userId = req.user?.id;
    if (!conversationId || !userId) {
      throw new ForbiddenException('Not a member of this conversation');
    }
    await this.chatService.assertMember(conversationId, userId);
    return true;
  }
}
