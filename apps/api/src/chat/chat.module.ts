import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ConversationMemberGuard } from './conversation-member.guard';

@Module({
  imports: [ConfigModule, PrismaModule, NotificationsModule],
  controllers: [ChatController],
  providers: [ChatGateway, ChatService, ConversationMemberGuard],
})
export class ChatModule {}
