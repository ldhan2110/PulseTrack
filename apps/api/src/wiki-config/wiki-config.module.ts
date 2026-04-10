import { Module, forwardRef } from '@nestjs/common';
import { WikiConfigController } from './wiki-config.controller';
import { WikiConfigService } from './wiki-config.service';
import { WikiGenerationModule } from '../wiki-generation/wiki-generation.module';

@Module({
  imports: [forwardRef(() => WikiGenerationModule)],
  controllers: [WikiConfigController],
  providers: [WikiConfigService],
  exports: [WikiConfigService],
})
export class WikiConfigModule {}
