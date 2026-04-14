import { Module } from '@nestjs/common';
import { WbsController } from './wbs.controller';
import { WbsDependencyController } from './wbs-dependency.controller';
import { WbsBacklogController } from './wbs-backlog.controller';
import { WbsService } from './wbs.service';
import { WbsDependencyService } from './wbs-dependency.service';
import { WbsBacklogService } from './wbs-backlog.service';

@Module({
  controllers: [WbsController, WbsDependencyController, WbsBacklogController],
  providers: [WbsService, WbsDependencyService, WbsBacklogService],
  exports: [WbsService],
})
export class WbsModule {}
