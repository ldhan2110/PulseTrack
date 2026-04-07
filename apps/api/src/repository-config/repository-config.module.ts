import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RepositoryConfigController } from './repository-config.controller';
import { RepositoryConfigService } from './repository-config.service';
import { RepositoryCloneProcessor } from './repository-clone.processor';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule, BullModule.registerQueue({ name: 'repository-clone' })],
  controllers: [RepositoryConfigController],
  providers: [RepositoryConfigService, RepositoryCloneProcessor],
  exports: [RepositoryConfigService],
})
export class RepositoryConfigModule {}
