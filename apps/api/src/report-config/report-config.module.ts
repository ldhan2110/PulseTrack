import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReportConfigController } from './report-config.controller';
import { ReportConfigService } from './report-config.service';
import { ReportGeneratorModule } from '../report-generator/report-generator.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'report-generation' }),
    ReportGeneratorModule,
  ],
  controllers: [ReportConfigController],
  providers: [ReportConfigService],
  exports: [ReportConfigService],
})
export class ReportConfigModule {}
