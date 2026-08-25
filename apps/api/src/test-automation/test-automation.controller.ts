import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TestAutomationService } from './test-automation.service';
import { AutomationRunService } from './automation-run.service';
import { AgentsService } from '../agents/agents.service';
import { UpsertAutomationDto } from './dto/upsert-automation.dto';

@Controller('test-automation')
@UseGuards(JwtAuthGuard)
export class TestAutomationController {
  constructor(
    private readonly automationService: TestAutomationService,
    private readonly runService: AutomationRunService,
    private readonly agents: AgentsService,
  ) {}

  @Post(':testCaseId/generate-script')
  async generateScript(@Param('testCaseId') testCaseId: string) {
    const script = await this.agents.run('testcase-script', { testCaseId });
    return { script };
  }

  @Post(':testCaseId')
  upsert(
    @Param('testCaseId') testCaseId: string,
    @Body() dto: UpsertAutomationDto,
  ) {
    return this.automationService.upsert(testCaseId, dto);
  }

  @Get(':testCaseId')
  findByTestCase(@Param('testCaseId') testCaseId: string) {
    return this.automationService.findByTestCaseId(testCaseId);
  }

  @Delete(':testCaseId')
  deleteAutomation(@Param('testCaseId') testCaseId: string) {
    return this.automationService.delete(testCaseId);
  }

  @Post(':testCaseId/run')
  triggerRun(
    @Param('testCaseId') testCaseId: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.runService.triggerRun(testCaseId, req.user.id, 'live');
  }

  @Post(':testCaseId/execute')
  triggerExecution(
    @Param('testCaseId') testCaseId: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.runService.triggerRun(testCaseId, req.user.id, 'execution');
  }

  @Delete('runs/:runId/cancel')
  cancelRun(@Param('runId') runId: string) {
    return this.runService.cancelRun(runId);
  }

  @Get(':testCaseId/runs')
  async getRunHistory(@Param('testCaseId') testCaseId: string) {
    const automation = await this.automationService.findByTestCaseId(testCaseId);
    if (!automation) return [];
    return this.runService.getRunHistory(automation.id);
  }
}
