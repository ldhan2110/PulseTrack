import { Module } from '@nestjs/common';
import { TestExecutionsController } from './test-executions.controller';
import { TestExecutionsService } from './test-executions.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TestAutomationModule } from '../test-automation/test-automation.module';

@Module({
  imports: [PrismaModule, TestAutomationModule],
  controllers: [TestExecutionsController],
  providers: [TestExecutionsService],
  exports: [TestExecutionsService],
})
export class TestExecutionsModule {}
