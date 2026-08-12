import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { Job } from 'bullmq';
import { chromium, type Browser, type Page } from 'playwright';
import { expect } from 'playwright/test';
import { NotificationsService } from '../notifications/notifications.service';
import { AutomationRunService, type AutomationJobData } from './automation-run.service';
import { ProjectVariablesService } from './project-variables.service';
import { executeSandboxedScript, type SandboxContext } from './script-sandbox';

export abstract class AutomationRunProcessor extends WorkerHost {
  private readonly logger = new Logger(AutomationRunProcessor.name);
  private readonly activeBrowsers = new Map<string, Browser>();

  constructor(
    @Inject(forwardRef(() => AutomationRunService))
    private readonly runService: AutomationRunService,
    private readonly variablesService: ProjectVariablesService,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<AutomationJobData>): Promise<void> {
    const { runId, script, baseUrl, timeoutMs, projectId, runnerId, mode, executionCaseId } = job.data;
    const live = mode === 'live';
    let browser: Browser | undefined;
    let page: Page | undefined;

    this.logger.log(`[process] START runId=${runId} runnerId=${runnerId} baseUrl=${baseUrl} timeoutMs=${timeoutMs}`);

    try {
      this.emit(runnerId, 'automation:status', { runId, status: 'RUNNING' });

      // Use headed chromium (not headless shell) for CDP screencast support
      this.logger.log(`[process] Launching chromium...`);
      browser = await chromium.launch({
        headless: true,
        args: [
          '--headless=new',
          '--disable-web-security',
          '--disable-features=BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults',
          '--disable-extensions',
          '--allow-running-insecure-content',
        ],
      });
      this.activeBrowsers.set(runId, browser);
      this.logger.log(`[process] Chromium launched OK`);

      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
      });

      // SSRF protection: block private IPs (allow baseUrl host)
      const allowedHost = baseUrl ? new URL(baseUrl).hostname : null;
      await context.route('**/*', (route) => {
        const url = new URL(route.request().url());
        const hostname = url.hostname;
        // Allow the configured baseUrl host
        if (allowedHost && hostname === allowedHost) {
          return route.continue();
        }
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
      const { page: wrappedPage, getSteps } = this.wrapPageForCapture(page, runId, runnerId, live);

      // Start CDP screencast (live mode only)
      const cdp = live ? await context.newCDPSession(page) : null;
      if (cdp) {
        await cdp.send('Page.startScreencast', {
          format: 'jpeg',
          quality: 60,
          maxWidth: 1280,
          maxHeight: 720,
          everyNthFrame: 1,
        });

        let frameCount = 0;
        cdp.on('Page.screencastFrame', (params) => {
          frameCount++;
          if (frameCount <= 3 || frameCount % 10 === 0) {
            this.logger.log(`[process] CDP frame #${frameCount} received (${params.data?.length ?? 0} bytes) → emitting to runnerId=${runnerId}`);
          }
          this.emit(runnerId, 'automation:frame', {
            runId,
            data: params.data,
            timestamp: Date.now(),
          });
          void cdp.send('Page.screencastFrameAck', {
            sessionId: params.sessionId,
          });
        });

        // Force initial frame by navigating to about:blank explicitly
        await page.goto('about:blank');
        // Send a manual screenshot as first frame to unblock UI
        const initialFrame = await page.screenshot({ type: 'jpeg', quality: 60 });
        this.logger.log(`[process] Initial screenshot captured (${initialFrame.length} bytes) → emitting to runnerId=${runnerId}`);
        this.emit(runnerId, 'automation:frame', {
          runId,
          data: initialFrame.toString('base64'),
          timestamp: Date.now(),
        });
      }

      // Build env vars
      const variables = await this.variablesService.getDecryptedVariables(projectId);
      const env: Record<string, string> = {};
      for (const v of variables) {
        env[v.key] = v.value;
      }

      // Build step function for semantic grouping
      const stepFn = async (name: string, fn: () => Promise<void>) => {
        const start = Date.now();
        try {
          await fn();
          let screenshot = '';
          if (live) {
            try {
              const buf = await page!.screenshot({ type: 'jpeg', quality: 60 });
              screenshot = buf.toString('base64');
            } catch {
              // page may be closed
            }
          }
          const stepData = {
            name,
            type: 'custom' as const,
            status: 'passed' as const,
            duration: Date.now() - start,
            screenshot,
          };
          this.emit(runnerId, 'automation:step', { runId, ...stepData });
        } catch (err) {
          let screenshot = '';
          try {
            const buf = await page!.screenshot({ type: 'jpeg', quality: 60 });
            screenshot = buf.toString('base64');
          } catch {
            // page may be closed
          }
          const stepData = {
            name,
            type: 'custom' as const,
            status: 'failed' as const,
            duration: Date.now() - start,
            screenshot,
            error: err instanceof Error ? err.message : String(err),
          };
          this.emit(runnerId, 'automation:step', { runId, ...stepData });
          throw err;
        }
      };

      // Build sandbox context
      const sandboxContext: SandboxContext = {
        page: wrappedPage,
        expect,
        baseUrl: baseUrl || '',
        env,
        step: stepFn,
      };

      // Execute script
      this.logger.log(`[process] Executing script (${script.length} chars)...`);
      const logs: Array<{ level: string; message: string; timestamp: number }> = [];

      const result = await executeSandboxedScript(script, sandboxContext, {
        timeoutMs,
        onLog: (message) => {
          const entry = { level: 'log', message, timestamp: Date.now() };
          logs.push(entry);
          this.emit(runnerId, 'automation:log', { runId, ...entry });
        },
      });

      this.logger.log(`[process] Script done: success=${result.success} duration=${result.duration}ms error=${result.error ?? 'none'}`);

      // Stop screencast
      await cdp?.send('Page.stopScreencast').catch(() => {});

      // Save result
      const status = result.success
        ? 'PASSED'
        : result.error?.includes('timed out')
          ? 'TIMEOUT'
          : 'FAILED';

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const steps = getSteps().map(({ screenshot, ...s }) => s);

      await this.runService.updateRunResult(runId, {
        status,
        duration: result.duration,
        logs: { messages: logs, steps },
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

      if (executionCaseId) {
        const shot = await page?.screenshot({ type: 'jpeg', quality: 60 })
          .then((b) => b.toString('base64'))
          .catch(() => undefined);
        await this.runService.completeExecutionCaseRun(executionCaseId, runnerId, status, shot);
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

      if (executionCaseId) {
        const shot = await page?.screenshot({ type: 'jpeg', quality: 60 })
          .then((b) => b.toString('base64'))
          .catch(() => undefined);
        await this.runService.completeExecutionCaseRun(executionCaseId, runnerId, 'FAILED', shot);
      }
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
    this.logger.debug(`[emit] event=${event} → user:${userId}`);
    this.notifications.notifyUser(userId, event, data);
  }

  private wrapPageForCapture(
    page: Page,
    runId: string,
    runnerId: string,
    live: boolean,
  ): { page: Page; getSteps: () => Array<{ name: string; type: string; status: string; duration: number; screenshot: string }> } {
    const steps: Array<{ name: string; type: string; status: string; duration: number; screenshot: string }> = [];
    const self = this;

    const captureStep = async (name: string, type: string, startTime: number, error?: string) => {
      let screenshot = '';
      // execution mode: screenshot on failure only
      if (live || error) {
        try {
          const buf = await page.screenshot({ type: 'jpeg', quality: 60 });
          screenshot = buf.toString('base64');
        } catch {
          // page may be closed
        }
      }
      const step = {
        name,
        type,
        status: error ? 'failed' : 'passed',
        duration: Date.now() - startTime,
        screenshot,
        ...(error ? { error } : {}),
      };
      steps.push(step);
      self.emit(runnerId, 'automation:step', { runId, ...step });
    };

    const methodsToWrap = ['goto', 'click', 'fill', 'check', 'uncheck', 'selectOption', 'press', 'type'] as const;

    for (const method of methodsToWrap) {
      const original = (page as any)[method].bind(page);
      (page as any)[method] = async (...args: any[]) => {
        const start = Date.now();
        const label = method === 'goto'
          ? `goto ${args[0]}`
          : `${method} ${typeof args[0] === 'string' ? args[0] : ''}`;
        try {
          const result = await original(...args);
          await captureStep(label, method === 'goto' ? 'navigation' : 'action', start);
          return result;
        } catch (err) {
          await captureStep(label, method === 'goto' ? 'navigation' : 'action', start, err instanceof Error ? err.message : String(err));
          throw err;
        }
      };
    }

    return { page, getSteps: () => steps };
  }
}

@Injectable()
@Processor('test-automation-live', {
  concurrency: Number(process.env.AUTOMATION_LIVE_CONCURRENCY) || 5,
})
export class LiveAutomationProcessor extends AutomationRunProcessor {}

@Injectable()
@Processor('test-automation-execution', {
  concurrency: Number(process.env.AUTOMATION_EXECUTION_CONCURRENCY) || 40,
})
export class ExecutionAutomationProcessor extends AutomationRunProcessor {}
