import { Module, forwardRef } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { WatchersModule } from '../watchers/watchers.module';
import { BugsModule } from '../bugs/bugs.module';

@Module({
  imports: [
    NotificationsModule,
    WorkflowModule,
    WatchersModule,
    forwardRef(() => BugsModule),
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
