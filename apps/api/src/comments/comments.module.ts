import { Module } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { BugCommentsController } from './bug-comments.controller';
import { CommentsService } from './comments.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WatchersModule } from '../watchers/watchers.module';

@Module({
  imports: [PrismaModule, NotificationsModule, WatchersModule],
  controllers: [CommentsController, BugCommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
