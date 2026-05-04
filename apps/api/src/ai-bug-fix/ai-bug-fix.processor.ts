import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { spawn, ChildProcess } from 'child_process';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AiBugFixService } from './ai-bug-fix.service';
import { GitProviderFactory } from '../branches/providers/git-provider.factory';
import type { AiFixJobData } from './dto/ai-fix-job.dto';

const execFileAsync = promisify(execFile);

@Processor('ai-bug-fix', { concurrency: 4 })
export class AiBugFixProcessor extends WorkerHost {
  private readonly logger = new Logger(AiBugFixProcessor.name);
  /** Track running CLI processes by fixId so we can kill on cancel. */
  private readonly runningProcesses = new Map<string, ChildProcess>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly aiService: AiBugFixService,
    private readonly providerFactory: GitProviderFactory,
  ) {
    super();
  }

  private emitProgress(userId: string, fixId: string, step: string): void {
    this.notifications.notifyUser(userId, 'ai-bug-fix:progress', { fixId, step });
  }

  private emitStream(userId: string, fixId: string, logBuffer: string): void {
    this.notifications.notifyUser(userId, 'ai-bug-fix:stream', { fixId, text: logBuffer });
  }

  private runCli(
    command: string,
    args: string[],
    opts: { cwd: string; env?: Record<string, string | undefined> },
    fixId: string,
    userId: string,
    logBuffer: { text: string },
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: opts.cwd,
        env: opts.env as NodeJS.ProcessEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.runningProcesses.set(fixId, child);
      const stdoutChunks: string[] = [];

      child.stdout.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stdoutChunks.push(text);
        logBuffer.text += text;
        this.emitStream(userId, fixId, logBuffer.text);
        for (const line of text.split('\n').filter(Boolean)) {
          this.logger.log(`[Fix ${fixId}] ${line}`);
        }
      });

      child.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        logBuffer.text += text;
        this.emitStream(userId, fixId, logBuffer.text);
        for (const line of text.split('\n').filter(Boolean)) {
          this.logger.warn(`[Fix ${fixId}] ${line}`);
        }
      });

      child.on('error', (err) => {
        this.runningProcesses.delete(fixId);
        reject(err);
      });

      child.on('close', (code) => {
        this.runningProcesses.delete(fixId);
        if (code === 0 || code === null) {
          resolve(stdoutChunks.join(''));
        } else {
          reject(new Error(`CLI exited with code ${code}`));
        }
      });
    });
  }

  killProcess(fixId: string): boolean {
    const child = this.runningProcesses.get(fixId);
    if (child) {
      child.kill('SIGTERM');
      this.runningProcesses.delete(fixId);
      return true;
    }
    return false;
  }

  async process(job: Job<AiFixJobData>): Promise<void> {
    const { fixId, bugId, projectId, userId, targetBranch, guidance, includeTests } = job.data;
    const logBuffer = { text: '' };
    let worktreePath: string | null = null;
    let branchName: string | null = null;

    try {
      // --- PREPARE ---
      await this.updateStatus(fixId, 'preparing');
      this.emitProgress(userId, fixId, 'preparing');
      logBuffer.text += '$ Preparing worktree...\n';
      this.emitStream(userId, fixId, logBuffer.text);

      const config = await this.aiService.getProjectAiConfig(projectId);
      const bug = await this.aiService.fetchBugWithRelations(bugId);
      const attempt = (await this.prisma.aiBugFix.findUniqueOrThrow({ where: { id: fixId } })).attempt;

      branchName = this.aiService.generateBranchName(bug.bugKey, bug.title, attempt);
      worktreePath = `/tmp/ai-fix-${fixId}`;

      // git pull in main worktree
      logBuffer.text += '$ git pull\n';
      this.emitStream(userId, fixId, logBuffer.text);
      await execFileAsync('git', ['pull'], { cwd: config.workspacePath, timeout: 60_000 });

      // Create worktree
      logBuffer.text += `$ git worktree add ${worktreePath} -b ${branchName} origin/${targetBranch}\n`;
      this.emitStream(userId, fixId, logBuffer.text);
      await execFileAsync('git', [
        'worktree', 'add', worktreePath, '-b', branchName, `origin/${targetBranch}`,
      ], { cwd: config.workspacePath, timeout: 30_000 });

      await this.prisma.aiBugFix.update({
        where: { id: fixId },
        data: { branchName, worktreePath },
      });

      // --- BUILD PROMPT ---
      const testCases = includeTests ? await this.aiService.fetchLinkedTestCases(bugId) : null;
      const previousAttempts = await this.aiService.fetchPreviousAttempts(bugId);

      const prompt = this.aiService.buildPrompt({
        bug,
        testCases,
        previousAttempts,
        guidance,
        projectContext: config.projectContext,
      });

      // --- SPAWN CLI ---
      await this.updateStatus(fixId, 'fixing');
      this.emitProgress(userId, fixId, 'fixing');
      logBuffer.text += `\n$ ${config.cli} (fixing bug with code-graph)\n`;
      this.emitStream(userId, fixId, logBuffer.text);

      const cliArgs = this.aiService.buildCliArgs(config.provider, config.model, prompt);
      const cliEnv = this.aiService.buildCliEnv(config.provider, config.apiKey);

      const rawOutput = await this.runCli(config.cli, cliArgs, {
        cwd: worktreePath,
        env: { ...process.env, ...cliEnv },
      }, fixId, userId, logBuffer);

      // --- PARSE OUTPUT ---
      const analysis = this.aiService.parseAnalysis(rawOutput);
      await this.prisma.aiBugFix.update({
        where: { id: fixId },
        data: {
          rootCause: analysis.rootCause,
          solution: analysis.solution,
          filesChanged: analysis.filesChanged,
        },
      });

      // --- PUSH + CREATE MR ---
      await this.updateStatus(fixId, 'pushing');
      this.emitProgress(userId, fixId, 'pushing');
      logBuffer.text += `\n$ git push origin ${branchName}\n`;
      this.emitStream(userId, fixId, logBuffer.text);

      await execFileAsync('git', ['push', 'origin', branchName], {
        cwd: worktreePath,
        timeout: 120_000,
      });

      await this.updateStatus(fixId, 'creating-mr');
      this.emitProgress(userId, fixId, 'creating-mr');
      logBuffer.text += '$ Creating merge request...\n';
      this.emitStream(userId, fixId, logBuffer.text);

      const provider = this.providerFactory.create(config.repoProvider);
      const mrDescription = this.aiService.buildMrDescription(bug, analysis);
      const mrTitle = `fix(${bug.bugKey ?? 'bug'}): ${bug.title}`.slice(0, 200);

      const result = await provider.createPr({
        repoUrl: config.repoUrl,
        token: config.repoToken,
        title: mrTitle,
        description: mrDescription,
        sourceBranch: branchName,
        targetBranch,
      });

      await this.prisma.aiBugFix.update({
        where: { id: fixId },
        data: {
          prUrl: result.prUrl,
          prNumber: result.prNumber,
          status: 'completed',
          completedAt: new Date(),
        },
      });

      logBuffer.text += `\nDone — MR created: ${result.prUrl}\n`;
      this.emitStream(userId, fixId, logBuffer.text);

      this.notifications.notifyUser(userId, 'ai-bug-fix:completed', {
        fixId,
        prUrl: result.prUrl,
        prNumber: result.prNumber,
        rootCause: analysis.rootCause,
        solution: analysis.solution,
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[Fix ${fixId}] Failed: ${message}`, error instanceof Error ? error.stack : undefined);

      logBuffer.text += `\nError: ${message}\n`;
      this.emitStream(userId, fixId, logBuffer.text);

      // Check if cancelled
      const record = await this.prisma.aiBugFix.findUnique({ where: { id: fixId } });
      if (record?.status !== 'cancelled') {
        await this.prisma.aiBugFix.update({
          where: { id: fixId },
          data: { status: 'failed', errorMessage: message, completedAt: new Date() },
        });

        this.notifications.notifyUser(userId, 'ai-bug-fix:failed', { fixId, error: message });
      }
    } finally {
      // Cleanup worktree
      if (worktreePath) {
        try {
          await execFileAsync('git', ['worktree', 'remove', worktreePath, '--force'], {
            cwd: (await this.aiService.getProjectAiConfig(projectId).catch(() => null))?.workspacePath ?? process.cwd(),
            timeout: 30_000,
          });
        } catch (e) {
          this.logger.warn(`[Fix ${fixId}] Worktree cleanup failed: ${(e as Error).message}`);
        }
      }
      // Delete local branch (remote stays for MR)
      if (branchName) {
        try {
          const config = await this.aiService.getProjectAiConfig(projectId).catch(() => null);
          if (config) {
            await execFileAsync('git', ['branch', '-D', branchName], {
              cwd: config.workspacePath,
              timeout: 10_000,
            });
          }
        } catch {
          // Branch may not exist locally if worktree creation failed
        }
      }
    }
  }

  private async updateStatus(fixId: string, status: string): Promise<void> {
    await this.prisma.aiBugFix.update({ where: { id: fixId }, data: { status } });
  }
}
