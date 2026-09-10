import { Module } from '@nestjs/common';
import { McpTokenController } from './mcp-token.controller';
import { McpTokenService } from './mcp-token.service';

@Module({
  controllers: [McpTokenController],
  providers: [McpTokenService],
  exports: [McpTokenService],
})
export class McpModule {}
