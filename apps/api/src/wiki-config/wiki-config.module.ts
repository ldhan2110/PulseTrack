import { Module } from '@nestjs/common';
import { WikiConfigController } from './wiki-config.controller';
import { WikiConfigService } from './wiki-config.service';

@Module({
  controllers: [WikiConfigController],
  providers: [WikiConfigService],
  exports: [WikiConfigService],
})
export class WikiConfigModule {}
