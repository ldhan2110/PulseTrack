import { Module } from '@nestjs/common';
import { BugAttachmentsController } from './bug-attachments.controller';
import { BugAttachmentsService } from './bug-attachments.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BugAttachmentsController],
  providers: [BugAttachmentsService],
})
export class BugAttachmentsModule {}
