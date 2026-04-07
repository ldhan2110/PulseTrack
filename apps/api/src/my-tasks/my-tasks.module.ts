import { Module } from '@nestjs/common';
import { MyTasksController } from './my-tasks.controller';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [TasksModule],
  controllers: [MyTasksController],
})
export class MyTasksModule {}
