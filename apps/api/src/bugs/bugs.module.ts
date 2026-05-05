import { Module, forwardRef } from '@nestjs/common';
import { BugsController } from './bugs.controller';
import { BugsService } from './bugs.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WatchersModule } from '../watchers/watchers.module';
import { TasksModule } from '../tasks/tasks.module';
import { AiBugFixModule } from '../ai-bug-fix/ai-bug-fix.module';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    WatchersModule,
    forwardRef(() => TasksModule),
    AiBugFixModule,
  ],
  controllers: [BugsController],
  providers: [BugsService],
  exports: [BugsService],
})
export class BugsModule {}
