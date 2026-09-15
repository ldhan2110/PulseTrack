import { Module } from '@nestjs/common';
import { McpTokenController } from './mcp-token.controller';
import { McpTokenService } from './mcp-token.service';
import { McpController } from './mcp.controller';
import { McpPatGuard } from './mcp-pat.guard';
import { McpServerService } from './mcp-server.service';
import { TasksModule } from '../tasks/tasks.module';
import { BugsModule } from '../bugs/bugs.module';
import { TestCasesModule } from '../test-cases/test-cases.module';
import { TimeLogsModule } from '../time-logs/time-logs.module';
import { TestModulesModule } from '../test-modules/test-modules.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [TasksModule, BugsModule, TestCasesModule, TimeLogsModule, TestModulesModule, ProjectsModule],
  controllers: [McpTokenController, McpController],
  providers: [McpTokenService, McpPatGuard, McpServerService],
  exports: [McpTokenService],
})
export class McpModule {}
