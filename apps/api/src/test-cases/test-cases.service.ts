import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTestCaseDto } from './dto/create-test-case.dto';
import { UpdateTestCaseDto } from './dto/update-test-case.dto';
import { BulkImportTestCasesDto } from './dto/bulk-import-test-cases.dto';
import type { EntityType } from '@prisma/client';

const USER_SELECT = { id: true, username: true, email: true, name: true, imageUrl: true };

const TEST_CASE_INCLUDE = {
  steps: { orderBy: { position: 'asc' as const } },
  links: true,
  module: { select: { id: true, name: true } },
  creator: { select: USER_SELECT },
};

@Injectable()
export class TestCasesService {
  constructor(private prisma: PrismaService) {}

  async findAll(projectId: string, filters?: {
    moduleId?: string;
    suiteId?: string;
    status?: string;
    priority?: string;
    tags?: string;
    search?: string;
  }) {
    const where: any = { projectId };
    if (filters?.moduleId) {
      const ids = filters.moduleId.split(',').filter(Boolean);
      where.moduleId = ids.length === 1 ? ids[0] : { in: ids };
    }
    if (filters?.status) {
      const vals = filters.status.split(',').filter(Boolean);
      where.status = vals.length === 1 ? vals[0] : { in: vals };
    }
    if (filters?.priority) {
      const vals = filters.priority.split(',').filter(Boolean);
      where.priority = vals.length === 1 ? vals[0] : { in: vals };
    }
    if (filters?.tags) where.tags = { hasSome: filters.tags.split(',') };
    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { testCaseKey: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters?.suiteId) {
      where.suiteMemberships = { some: { suiteId: filters.suiteId } };
    }

    return this.prisma.testCase.findMany({
      where,
      include: TEST_CASE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(testCaseId: string) {
    return this.prisma.testCase.findUnique({
      where: { id: testCaseId },
      include: TEST_CASE_INCLUDE,
    });
  }

  async findByKey(testCaseKey: string) {
    return this.prisma.testCase.findFirst({
      where: { testCaseKey },
      include: TEST_CASE_INCLUDE,
    });
  }

  async create(projectId: string, creatorId: string, dto: CreateTestCaseDto) {
    return this.prisma.$transaction(async (tx) => {
      // Atomically increment testCaseSeq to generate testCaseKey
      const project = await tx.project.update({
        where: { id: projectId },
        data: { testCaseSeq: { increment: 1 } },
        select: { prefix: true, testCaseSeq: true },
      });
      const testCaseKey = project.prefix
        ? `${project.prefix}-TC-${project.testCaseSeq}`
        : null;

      const testCase = await tx.testCase.create({
        data: {
          projectId,
          creatorId,
          testCaseKey,
          title: dto.title,
          preconditions: dto.preconditions,
          expectedResult: dto.expectedResult,
          priority: dto.priority,
          tags: dto.tags ?? [],
          estimatedMinutes: dto.estimatedMinutes,
          moduleId: dto.moduleId,
        },
      });

      if (dto.steps?.length) {
        await tx.testCaseStep.createMany({
          data: dto.steps.map((s) => ({
            testCaseId: testCase.id,
            position: s.position,
            action: s.action,
            expectedResult: s.expectedResult,
          })),
        });
      }

      if (dto.links?.length) {
        await tx.testCaseLink.createMany({
          data: dto.links.map((l) => ({
            testCaseId: testCase.id,
            entityType: l.entityType as EntityType,
            entityId: l.entityId,
          })),
        });
      }

      return tx.testCase.findUniqueOrThrow({
        where: { id: testCase.id },
        include: TEST_CASE_INCLUDE,
      });
    });
  }

  async update(testCaseId: string, dto: UpdateTestCaseDto) {
    return this.prisma.$transaction(async (tx) => {
      const data: Record<string, unknown> = {};
      if (dto.title !== undefined) data.title = dto.title;
      if (dto.preconditions !== undefined) data.preconditions = dto.preconditions;
      if (dto.expectedResult !== undefined) data.expectedResult = dto.expectedResult;
      if (dto.priority !== undefined) data.priority = dto.priority;
      if (dto.status !== undefined) data.status = dto.status;
      if (dto.tags !== undefined) data.tags = dto.tags;
      if (dto.estimatedMinutes !== undefined) data.estimatedMinutes = dto.estimatedMinutes;
      if (dto.moduleId !== undefined) data.moduleId = dto.moduleId;

      await tx.testCase.update({ where: { id: testCaseId }, data });

      if (dto.steps !== undefined) {
        await tx.testCaseStep.deleteMany({ where: { testCaseId } });
        if (dto.steps.length > 0) {
          await tx.testCaseStep.createMany({
            data: dto.steps.map((s) => ({
              testCaseId,
              position: s.position,
              action: s.action,
              expectedResult: s.expectedResult,
            })),
          });
        }
      }

      if (dto.links !== undefined) {
        await tx.testCaseLink.deleteMany({ where: { testCaseId } });
        if (dto.links.length > 0) {
          await tx.testCaseLink.createMany({
            data: dto.links.map((l) => ({
              testCaseId,
              entityType: l.entityType as EntityType,
              entityId: l.entityId,
            })),
          });
        }
      }

      return tx.testCase.findUniqueOrThrow({
        where: { id: testCaseId },
        include: TEST_CASE_INCLUDE,
      });
    });
  }

  async delete(testCaseId: string) {
    return this.prisma.testCase.delete({ where: { id: testCaseId } });
  }

  async bulkAddToSuite(suiteId: string, testCaseIds: string[]) {
    // Get existing members to skip duplicates
    const existing = await this.prisma.testSuiteMember.findMany({
      where: { suiteId, testCaseId: { in: testCaseIds } },
      select: { testCaseId: true },
    });
    const existingIds = new Set(existing.map((m) => m.testCaseId));
    const newIds = testCaseIds.filter((id) => !existingIds.has(id));

    if (newIds.length === 0) return { added: 0 };

    // Get max position
    const last = await this.prisma.testSuiteMember.findFirst({
      where: { suiteId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    let nextPos = (last?.position ?? -1) + 1;

    await this.prisma.testSuiteMember.createMany({
      data: newIds.map((testCaseId) => ({
        suiteId,
        testCaseId,
        position: nextPos++,
      })),
    });

    return { added: newIds.length };
  }

  async bulkImport(projectId: string, creatorId: string, dto: BulkImportTestCasesDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Collect unique module names
      const moduleNames = [...new Set(
        dto.items.map((item) => item.moduleName?.trim()).filter(Boolean) as string[],
      )];

      // 2. Resolve existing modules
      const existingModules = moduleNames.length > 0
        ? await tx.testModule.findMany({
            where: { projectId, name: { in: moduleNames, mode: 'insensitive' } },
            select: { id: true, name: true },
          })
        : [];

      const moduleMap = new Map<string, string>();
      for (const m of existingModules) {
        moduleMap.set(m.name.toLowerCase(), m.id);
      }

      // 3. Auto-create missing modules
      const modulesCreated: string[] = [];
      for (const name of moduleNames) {
        if (!moduleMap.has(name.toLowerCase())) {
          const created = await tx.testModule.create({
            data: { projectId, name, position: 0 },
          });
          moduleMap.set(name.toLowerCase(), created.id);
          modulesCreated.push(name);
        }
      }

      // 3b. Ensure a default module for items without moduleName
      const defaultModuleName = 'General';
      if (!moduleMap.has(defaultModuleName.toLowerCase())) {
        const existing = await tx.testModule.findFirst({
          where: { projectId, name: { equals: defaultModuleName, mode: 'insensitive' } },
          select: { id: true },
        });
        if (existing) {
          moduleMap.set(defaultModuleName.toLowerCase(), existing.id);
        } else {
          const created = await tx.testModule.create({
            data: { projectId, name: defaultModuleName, position: 0 },
          });
          moduleMap.set(defaultModuleName.toLowerCase(), created.id);
          modulesCreated.push(defaultModuleName);
        }
      }

      // 4. Create test cases
      let created = 0;
      for (const item of dto.items) {
        // Increment testCaseSeq
        const project = await tx.project.update({
          where: { id: projectId },
          data: { testCaseSeq: { increment: 1 } },
          select: { prefix: true, testCaseSeq: true },
        });
        const testCaseKey = project.prefix
          ? `${project.prefix}-TC-${project.testCaseSeq}`
          : null;

        const moduleId = item.moduleName
          ? moduleMap.get(item.moduleName.trim().toLowerCase())!
          : moduleMap.get(defaultModuleName.toLowerCase())!;

        const testCase = await tx.testCase.create({
          data: {
            projectId,
            creatorId,
            testCaseKey,
            title: item.title,
            preconditions: item.preconditions,
            expectedResult: item.expectedResult,
            priority: item.priority,
            tags: item.tags ?? [],
            estimatedMinutes: item.estimatedMinutes,
            moduleId,
          },
        });

        if (item.steps?.length) {
          await tx.testCaseStep.createMany({
            data: item.steps.map((s) => ({
              testCaseId: testCase.id,
              position: s.position,
              action: s.action,
              expectedResult: s.expectedResult,
            })),
          });
        }

        created++;
      }

      return { created, modulesCreated };
    });
  }
}
