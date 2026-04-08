import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WatchersController } from './watchers.controller';
import { WatchersService } from './watchers.service';

@Module({
  imports: [PrismaModule],
  controllers: [WatchersController],
  providers: [WatchersService],
  exports: [WatchersService],
})
export class WatchersModule {}
