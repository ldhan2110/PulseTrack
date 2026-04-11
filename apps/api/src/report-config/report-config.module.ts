import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReportConfigController } from './report-config.controller';
import { ReportConfigService } from './report-config.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'report-generation' })],
  controllers: [ReportConfigController],
  providers: [ReportConfigService],
  exports: [ReportConfigService],
})
export class ReportConfigModule {}
