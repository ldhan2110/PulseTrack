import { Module } from '@nestjs/common';
import { AgentRunner } from './agent-runner.service';
import { AiConfigLoader } from './ai-config-loader.service';
import { SkillRegistry } from './skill-registry.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [AgentRunner, AiConfigLoader, SkillRegistry],
  exports: [AgentRunner, AiConfigLoader, SkillRegistry],
})
export class AiModule {}
