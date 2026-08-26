import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { GeneratedTask } from '../agents/specialist/ba-user-story.agent';

export interface GenerateTasksInput {
  prompt: string;
  breakIntoSubTasks: boolean;
}

type Status = 'waiting' | 'active' | 'completed' | 'failed';

export interface AiGenerationJobResult {
  status: Status;
  step?: string;
  tasks?: GeneratedTask[];
  error?: string;
  displayLines?: string[];
}

/** Extract plain text from uploaded documents. txt/md only; binary formats skipped. */
function extractDocuments(files: Express.Multer.File[]): string[] {
  return files
    .filter((f) => /\.(txt|md)$/i.test(f.originalname))
    .map((f) => f.buffer.toString('utf8'));
}

@Injectable()
export class AiTaskGenerationService {
  constructor(
    @InjectQueue('ai-task-generation') private readonly queue: Queue,
  ) {}

  async enqueue(
    projectId: string,
    input: GenerateTasksInput,
    files: Express.Multer.File[],
  ): Promise<{ jobId: string }> {
    if (!input.prompt?.trim()) throw new BadRequestException('Prompt is required.');
    const documents = extractDocuments(files ?? []);
    const job = await this.queue.add('generate', {
      projectId,
      prompt: input.prompt.trim(),
      breakIntoSubTasks: input.breakIntoSubTasks,
      documents,
    });
    return { jobId: String(job.id) };
  }

  async getResult(jobId: string): Promise<AiGenerationJobResult> {
    const job = await this.queue.getJob(jobId);
    if (!job) return { status: 'failed', error: 'Job not found' };

    const state = await job.getState();
    if (state === 'completed') {
      return { status: 'completed', tasks: (job.returnvalue as GeneratedTask[]) ?? [] };
    }
    if (state === 'failed') {
      return { status: 'failed', error: job.failedReason ?? 'Generation failed' };
    }
    if (state === 'active') {
      const progress = job.progress as { step?: string; displayLines?: string[] };
      return { status: 'active', step: progress?.step, displayLines: progress?.displayLines };
    }
    return { status: 'waiting' };
  }
}
