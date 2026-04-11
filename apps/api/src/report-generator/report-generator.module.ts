import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReportGeneratorService } from './report-generator.service';
import { ReportGeneratorProcessor } from './report-generator.processor';
import { GoogleChatService } from './google-chat.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'report-generation' })],
  providers: [ReportGeneratorService, ReportGeneratorProcessor, GoogleChatService],
  exports: [ReportGeneratorService],
})
export class ReportGeneratorModule {}
