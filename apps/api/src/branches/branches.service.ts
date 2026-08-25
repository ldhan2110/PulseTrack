import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { GitProviderFactory } from './providers/git-provider.factory';
import { decrypt } from '../common/encryption.util';
import { CreateBranchDto } from './dto/create-branch.dto';
import { CreatePrDto } from './dto/create-pr.dto';

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providerFactory: GitProviderFactory,
    private readonly config: ConfigService,
  ) {}

  private get encryptionKey(): string {
    return this.config.getOrThrow<string>('ENCRYPTION_KEY');
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
  }

  private async getRepository(projectId: string, repositoryId: string) {
    const repo = await this.prisma.repository.findUnique({ where: { id: repositoryId } });
    if (!repo || repo.projectId !== projectId) {
      throw new NotFoundException('Repository not found for this project');
    }
    return repo;
  }

  async listRemoteBranches(projectId: string, repositoryId: string): Promise<string[]> {
    const repo = await this.getRepository(projectId, repositoryId);

    const token = decrypt(repo.accessToken, this.encryptionKey);
    const provider = this.providerFactory.create(repo.provider);

    return provider.listBranches({ repoUrl: repo.repoUrl, token });
  }

  async listByTask(projectId: string, taskId: string) {
    return this.prisma.taskBranch.findMany({
      where: { projectId, taskId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createBranch(projectId: string, taskId: string, dto: CreateBranchDto) {
    const repo = await this.getRepository(projectId, dto.repositoryId);

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });
    if (!task || task.projectId !== projectId) throw new NotFoundException('Task not found');

    if (!task.taskKey) throw new BadRequestException('Task has no key — set a project prefix first');

    const slug = this.slugify(task.title);
    const existingCount = await this.prisma.taskBranch.count({
      where: { taskId },
    });

    const sequence = existingCount + 1;
    const suffix = sequence > 1 ? `-${sequence}` : '';
    const branchName = `${dto.branchType}/${task.taskKey}-${slug}${suffix}`;

    const token = decrypt(repo.accessToken, this.encryptionKey);
    const provider = this.providerFactory.create(repo.provider);

    await provider.createBranch({
      repoUrl: repo.repoUrl,
      token,
      branchName,
      sourceBranch: dto.sourceBranch,
    });

    return this.prisma.taskBranch.create({
      data: {
        taskId,
        projectId,
        repositoryId: repo.id,
        branchName,
        branchType: dto.branchType,
        sequence,
      },
    });
  }

  async createPr(projectId: string, dto: CreatePrDto) {
    const branch = await this.prisma.taskBranch.findUnique({
      where: { id: dto.branchId },
      include: { task: true },
    });
    if (!branch || branch.projectId !== projectId) throw new NotFoundException('Branch not found');
    if (branch.prUrl) throw new BadRequestException('PR/MR already exists for this branch');

    const repo = await this.getRepository(projectId, branch.repositoryId);

    const token = decrypt(repo.accessToken, this.encryptionKey);
    const provider = this.providerFactory.create(repo.provider);

    const prTitle = `${branch.branchType}(${branch.task.taskKey}): ${branch.task.title}`;
    const prDescription = this.buildPrDescription(branch.task);

    const result = await provider.createPr({
      repoUrl: repo.repoUrl,
      token,
      title: prTitle,
      description: prDescription,
      sourceBranch: branch.branchName,
      targetBranch: dto.targetBranch,
    });

    return this.prisma.taskBranch.update({
      where: { id: branch.id },
      data: {
        prUrl: result.prUrl,
        prNumber: result.prNumber,
        prTitle,
        prStatus: 'open',
      },
    });
  }

  async deleteTaskBranch(projectId: string, taskId: string, branchId: string) {
    const branch = await this.prisma.taskBranch.findUnique({
      where: { id: branchId },
    });
    if (!branch || branch.projectId !== projectId || branch.taskId !== taskId) {
      throw new NotFoundException('Branch not found');
    }

    await this.prisma.taskBranch.delete({ where: { id: branchId } });

    return { deleted: true };
  }

  private buildPrDescription(task: { taskKey: string | null; title: string; description: string | null; acceptanceCriteria: string | null }): string {
    const lines: string[] = [];
    lines.push(`## ${task.taskKey}: ${task.title}`);
    if (task.description) {
      lines.push('', '### Description', task.description);
    }
    if (task.acceptanceCriteria) {
      lines.push('', '### Acceptance Criteria', task.acceptanceCriteria);
    }
    return lines.join('\n');
  }
}
