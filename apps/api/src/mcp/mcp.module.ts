import { Module } from '@nestjs/common';
import { McpTokenController } from './mcp-token.controller';
import { McpTokenService } from './mcp-token.service';
import { McpController } from './mcp.controller';
import { McpPatGuard } from './mcp-pat.guard';
import { McpServerService } from './mcp-server.service';
import { TasksModule } from '../tasks/tasks.module';
import { BugsModule } from '../bugs/bugs.module';

@Module({
  imports: [TasksModule, BugsModule],
  controllers: [McpTokenController, McpController],
  providers: [McpTokenService, McpPatGuard, McpServerService],
  exports: [McpTokenService],
})
export class McpModule {}
