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

  async listRemoteBranches(projectId: string): Promise<string[]> {
    const repoConfig = await this.prisma.repositoryConfig.findUnique({
      where: { projectId },
    });
    if (!repoConfig) throw new NotFoundException('Repository not configured for this project');

    const token = decrypt(repoConfig.accessToken, this.encryptionKey);
    const provider = this.providerFactory.create(repoConfig.provider);

    return provider.listBranches({ repoUrl: repoConfig.repoUrl, token });
  }

  async listByTask(projectId: string, taskId: string) {
    return this.prisma.taskBranch.findMany({
      where: { projectId, taskId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createBranch(projectId: string, taskId: string, dto: CreateBranchDto) {
    const repoConfig = await this.prisma.repositoryConfig.findUnique({
      where: { projectId },
    });
    if (!repoConfig) throw new NotFoundException('Repository not configured for this project');

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

    const token = decrypt(repoConfig.accessToken, this.encryptionKey);
    const provider = this.providerFactory.create(repoConfig.provider);

    await provider.createBranch({
      repoUrl: repoConfig.repoUrl,
      token,
      branchName,
      sourceBranch: dto.sourceBranch,
    });

    return this.prisma.taskBranch.create({
      data: {
        taskId,
        projectId,
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

    const repoConfig = await this.prisma.repositoryConfig.findUnique({
      where: { projectId },
    });
    if (!repoConfig) throw new NotFoundException('Repository not configured');

    const token = decrypt(repoConfig.accessToken, this.encryptionKey);
    const provider = this.providerFactory.create(repoConfig.provider);

    const prTitle = `${branch.branchType}(${branch.task.taskKey}): ${branch.task.title}`;
    const prDescription = this.buildPrDescription(branch.task);

    const result = await provider.createPr({
      repoUrl: repoConfig.repoUrl,
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
