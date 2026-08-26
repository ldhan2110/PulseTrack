import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RepositoryConfigController } from './repository-config.controller';
import { RepositoryConfigService } from './repository-config.service';
import { RepositoryCloneProcessor } from './repository-clone.processor';
import { RepositoryIndexProcessor } from './repository-index.processor';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    NotificationsModule,
    BullModule.registerQueue({ name: 'repository-clone' }, { name: 'repository-index' }),
  ],
  controllers: [RepositoryConfigController],
  providers: [RepositoryConfigService, RepositoryCloneProcessor, RepositoryIndexProcessor],
  exports: [RepositoryConfigService],
})
export class RepositoryConfigModule {}
