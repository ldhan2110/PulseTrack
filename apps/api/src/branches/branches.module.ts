import { Module } from '@nestjs/common';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { GitProviderFactory } from './providers/git-provider.factory';

@Module({
  controllers: [BranchesController],
  providers: [BranchesService, GitProviderFactory],
  exports: [BranchesService],
})
export class BranchesModule {}
