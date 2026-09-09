import { Module } from '@nestjs/common';
import { TimeLogsController } from './time-logs.controller';
import { ReportsController } from './reports.controller';
import { TimeLogsService } from './time-logs.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [TimeLogsController, ReportsController],
  providers: [TimeLogsService],
})
export class TimeLogsModule {}
