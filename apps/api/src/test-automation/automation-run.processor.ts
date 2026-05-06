import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { chromium, type Browser, type Page } from 'playwright';
import { expect } from 'playwright/test';
import { NotificationsService } from '../notifications/notifications.service';
import { AutomationRunService, type AutomationJobData } from './automation-run.service';
import { ProjectVariablesService } from './project-variables.service';
import { executeSandboxedScript, type SandboxContext } from './script-sandbox';

@Processor('test-automation', { concurrency: 3 })
export class AutomationRunProcessor extends WorkerHost {
  private readonly logger = new Logger(AutomationRunProcessor.name);
  private readonly activeBrowsers = new Map<string, Browser>();

  constructor(
    private readonly runService: AutomationRunService,
    private readonly variablesService: ProjectVariablesService,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<AutomationJobData>): Promise<void> {
    const { runId, script, baseUrl, timeoutMs, projectId, runnerId } = job.data;
    let browser: Browser | undefined;
    let page: Page | undefined;

    try {
      this.emit(runnerId, 'automation:status', { runId, status: 'RUNNING' });

      browser = await chromium.launch({ headless: true });
      this.activeBrowsers.set(runId, browser);

      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
      });

      // SSRF protection: block private IPs
      await context.route('**/*', (route) => {
        const url = new URL(route.request().url());
        const hostname = url.hostname;
        const blocked =
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname.startsWith('10.') ||
          hostname.startsWith('172.16.') ||
          hostname.startsWith('192.168.') ||
          hostname === '169.254.169.254' ||
          hostname === '0.0.0.0';
        if (blocked) {
          return route.abort('blockedbyclient');
        }
        return route.continue();
      });
      page = await context.newPage();

      // Start CDP screencast
      const cdp = await context.newCDPSession(page);
      await cdp.send('Page.startScreencast', {
        format: 'jpeg',
        quality: 60,
        maxWidth: 1280,
        maxHeight: 720,
        everyNthFrame: 1,
      });

      cdp.on('Page.screencastFrame', (params) => {
        this.emit(runnerId, 'automation:frame', {
          runId,
          data: params.data,
          timestamp: Date.now(),
        });
        void cdp.send('Page.screencastFrameAck', {
          sessionId: params.sessionId,
        });
      });

      // Build env vars
      const variables = await this.variablesService.getDecryptedVariables(projectId);
      const env: Record<string, string> = {};
      for (const v of variables) {
        env[v.key] = v.value;
      }

      // Build sandbox context
      const sandboxContext: SandboxContext = {
        page,
        expect,
        baseUrl: baseUrl || '',
        env,
      };

      // Execute script
      const logs: Array<{ level: string; message: string; timestamp: number }> = [];

      const result = await executeSandboxedScript(script, sandboxContext, {
        timeoutMs,
        onLog: (message) => {
          const entry = { level: 'log', message, timestamp: Date.now() };
          logs.push(entry);
          this.emit(runnerId, 'automation:log', { runId, ...entry });
        },
      });

      // Stop screencast
      await cdp.send('Page.stopScreencast').catch(() => {});

      // Save result
      const status = result.success
        ? 'PASSED'
        : result.error?.includes('timed out')
          ? 'TIMEOUT'
          : 'FAILED';

      await this.runService.updateRunResult(runId, {
        status,
        duration: result.duration,
        logs: logs.length > 0 ? logs : undefined,
        error: result.error,
      });

      this.emit(runnerId, 'automation:status', {
        runId,
        status,
        duration: result.duration,
      });

      if (!result.success) {
        this.emit(runnerId, 'automation:error', {
          runId,
          message: result.error ?? 'Unknown error',
        });
      }
    } catch (err) {
      this.logger.error(`Automation run ${runId} crashed: ${err}`);

      await this.runService.updateRunResult(runId, {
        status: 'FAILED',
        duration: 0,
        error: err instanceof Error ? err.message : String(err),
      });

      this.emit(runnerId, 'automation:status', { runId, status: 'FAILED' });
      this.emit(runnerId, 'automation:error', {
        runId,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.activeBrowsers.delete(runId);
      if (browser) await browser.close().catch(() => {});
    }
  }

  async cancelRun(runId: string): Promise<void> {
    const browser = this.activeBrowsers.get(runId);
    if (browser) {
      await browser.close().catch(() => {});
      this.activeBrowsers.delete(runId);
    }
  }

  private emit(userId: string, event: string, data: unknown): void {
    this.notifications.notifyUser(userId, event, data);
  }
}
