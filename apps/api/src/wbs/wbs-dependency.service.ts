import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDependencyDto } from './dto/create-dependency.dto';

@Injectable()
export class WbsDependencyService {
  constructor(private readonly prisma: PrismaService) {}

  async listDependencies(projectId: string) {
    return this.prisma.wbsDependency.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createDependency(projectId: string, dto: CreateDependencyDto) {
    // Validate source exists
    await this.validateNodeExists(dto.sourceId, dto.sourceType);
    // Validate target exists
    await this.validateNodeExists(dto.targetId, dto.targetType);
    // Prevent duplicate
    const existing = await this.prisma.wbsDependency.findFirst({
      where: {
        projectId,
        sourceId: dto.sourceId,
        sourceType: dto.sourceType,
        targetId: dto.targetId,
        targetType: dto.targetType,
      },
    });
    if (existing) throw new BadRequestException('Dependency already exists');
    // Prevent self-dependency
    if (dto.sourceId === dto.targetId && dto.sourceType === dto.targetType) {
      throw new BadRequestException('Cannot create dependency on itself');
    }

    return this.prisma.wbsDependency.create({
      data: {
        projectId,
        sourceId: dto.sourceId,
        sourceType: dto.sourceType,
        targetId: dto.targetId,
        targetType: dto.targetType,
      },
    });
  }

  async deleteDependency(depId: string) {
    const dep = await this.prisma.wbsDependency.findUnique({ where: { id: depId } });
    if (!dep) throw new NotFoundException('Dependency not found');
    return this.prisma.wbsDependency.delete({ where: { id: depId } });
  }

  private async validateNodeExists(nodeId: string, nodeType: string) {
    if (nodeType === 'TASK') {
      const task = await this.prisma.wbsTask.findUnique({ where: { id: nodeId } });
      if (!task) throw new NotFoundException(`WBS task ${nodeId} not found`);
    } else {
      const subtask = await this.prisma.wbsSubtask.findUnique({ where: { id: nodeId } });
      if (!subtask) throw new NotFoundException(`WBS subtask ${nodeId} not found`);
    }
  }
}
