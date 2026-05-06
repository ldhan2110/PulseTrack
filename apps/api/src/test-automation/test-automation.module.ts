import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsModule } from '../notifications/notifications.module';
import { TestAutomationService } from './test-automation.service';
import { AutomationRunService } from './automation-run.service';
import { AutomationRunProcessor } from './automation-run.processor';
import { ProjectVariablesService } from './project-variables.service';
import { TestAutomationController } from './test-automation.controller';
import { ProjectVariablesController } from './project-variables.controller';

@Module({
  imports: [
    NotificationsModule,
    BullModule.registerQueue({ name: 'test-automation' }),
  ],
  controllers: [TestAutomationController, ProjectVariablesController],
  providers: [
    TestAutomationService,
    AutomationRunService,
    AutomationRunProcessor,
    ProjectVariablesService,
  ],
  exports: [TestAutomationService],
})
export class TestAutomationModule {}
