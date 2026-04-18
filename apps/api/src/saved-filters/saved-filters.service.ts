import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSavedFilterDto } from './dto/create-saved-filter.dto';
import { UpdateSavedFilterDto } from './dto/update-saved-filter.dto';

@Injectable()
export class SavedFiltersService {
  constructor(private prisma: PrismaService) {}

  async findAll(projectId: string, userId: string, entityType?: string) {
    return this.prisma.savedFilter.findMany({
      where: {
        projectId,
        userId,
        ...(entityType ? { entityType } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(projectId: string, userId: string, dto: CreateSavedFilterDto) {
    if (dto.isDefault) {
      await this.prisma.savedFilter.updateMany({
        where: { userId, projectId, entityType: dto.entityType, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.savedFilter.create({
      data: {
        projectId,
        userId,
        name: dto.name,
        entityType: dto.entityType,
        filters: dto.filters as Prisma.InputJsonValue,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateSavedFilterDto) {
    const existing = await this.prisma.savedFilter.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Saved filter not found');
    }

    if (dto.isDefault === true) {
      await this.prisma.savedFilter.updateMany({
        where: { userId, projectId: existing.projectId, entityType: existing.entityType, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.savedFilter.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.filters !== undefined ? { filters: dto.filters as Prisma.InputJsonValue } : {}),
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
      },
    });
  }

  async remove(id: string, userId: string) {
    const existing = await this.prisma.savedFilter.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Saved filter not found');
    }

    return this.prisma.savedFilter.delete({ where: { id } });
  }
}
