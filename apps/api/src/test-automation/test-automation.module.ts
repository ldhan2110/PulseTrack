import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsModule } from '../notifications/notifications.module';
import { AgentsModule } from '../agents/agents.module';
import { TestAutomationService } from './test-automation.service';
import { AutomationRunService } from './automation-run.service';
import {
  LiveAutomationProcessor,
  ExecutionAutomationProcessor,
} from './automation-run.processor';
import { TestcaseScriptProcessor } from './testcase-script.processor';
import { TestcaseScriptService } from './testcase-script.service';
import { ProjectVariablesService } from './project-variables.service';
import { TestAutomationController } from './test-automation.controller';
import { ProjectVariablesController } from './project-variables.controller';

@Module({
  imports: [
    NotificationsModule,
    AgentsModule,
    BullModule.registerQueue(
      { name: 'test-automation-live' },
      { name: 'test-automation-execution' },
      { name: 'ai-testcase-script' },
    ),
  ],
  controllers: [TestAutomationController, ProjectVariablesController],
  providers: [
    TestAutomationService,
    AutomationRunService,
    LiveAutomationProcessor,
    ExecutionAutomationProcessor,
    TestcaseScriptProcessor,
    TestcaseScriptService,
    ProjectVariablesService,
  ],
  exports: [TestAutomationService, AutomationRunService],
})
export class TestAutomationModule {}
