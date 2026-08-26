import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  list(projectId: string) {
    return this.prisma.skill.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(projectId: string, dto: CreateSkillDto) {
    try {
      return await this.prisma.skill.create({
        data: {
          projectId,
          key: dto.key,
          name: dto.name,
          description: dto.description ?? null,
          content: dto.content,
          enabled: dto.enabled ?? true,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Skill key "${dto.key}" already exists in this project.`);
      }
      throw e;
    }
  }

  async update(projectId: string, skillId: string, dto: UpdateSkillDto) {
    const result = await this.prisma.skill.updateMany({
      where: { id: skillId, projectId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.enabled !== undefined && { enabled: dto.enabled }),
      },
    });
    if (result.count === 0) throw new NotFoundException('Skill not found.');
    return this.prisma.skill.findUnique({ where: { id: skillId } });
  }

  async remove(projectId: string, skillId: string) {
    const result = await this.prisma.skill.deleteMany({
      where: { id: skillId, projectId },
    });
    if (result.count === 0) throw new NotFoundException('Skill not found.');
    return { success: true };
  }
}
