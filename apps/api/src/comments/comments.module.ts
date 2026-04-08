import { Module } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { BugCommentsController } from './bug-comments.controller';
import { CommentsService } from './comments.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CommentsController, BugCommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
