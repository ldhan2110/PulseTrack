import { Module } from '@nestjs/common';
import { BugsController } from './bugs.controller';
import { BugsService } from './bugs.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WatchersModule } from '../watchers/watchers.module';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    WatchersModule,
  ],
  controllers: [BugsController],
  providers: [BugsService],
  exports: [BugsService],
})
export class BugsModule {}
