import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTestModuleDto } from './dto/create-test-module.dto';
import { UpdateTestModuleDto } from './dto/update-test-module.dto';

@Injectable()
export class TestModulesService {
  constructor(private prisma: PrismaService) {}

  async findAll(projectId: string) {
    return this.prisma.testModule.findMany({
      where: { projectId },
      include: { _count: { select: { testCases: true } } },
      orderBy: { position: 'asc' },
    });
  }

  async create(projectId: string, dto: CreateTestModuleDto) {
    let position = dto.position;
    if (position === undefined) {
      const last = await this.prisma.testModule.findFirst({
        where: { projectId, parentId: dto.parentId ?? null },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      position = (last?.position ?? -1) + 1;
    }

    return this.prisma.testModule.create({
      data: {
        projectId,
        name: dto.name,
        position,
        parentId: dto.parentId,
      },
      include: { _count: { select: { testCases: true } } },
    });
  }

  async update(moduleId: string, dto: UpdateTestModuleDto) {
    return this.prisma.testModule.update({
      where: { id: moduleId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.position !== undefined && { position: dto.position }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
      },
      include: { _count: { select: { testCases: true } } },
    });
  }

  async delete(moduleId: string) {
    return this.prisma.testModule.delete({ where: { id: moduleId } });
  }
}
