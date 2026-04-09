import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTestSuiteDto } from './dto/create-test-suite.dto';
import { UpdateTestSuiteDto } from './dto/update-test-suite.dto';

const USER_SELECT = { id: true, username: true, email: true, name: true, imageUrl: true };

@Injectable()
export class TestSuitesService {
  constructor(private prisma: PrismaService) {}

  async findAll(projectId: string) {
    return this.prisma.testSuite.findMany({
      where: { projectId },
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(suiteId: string) {
    return this.prisma.testSuite.findUnique({
      where: { id: suiteId },
      include: {
        _count: { select: { members: true } },
        members: {
          orderBy: { position: 'asc' },
          include: {
            testCase: {
              select: {
                id: true,
                testCaseKey: true,
                title: true,
                status: true,
                priority: true,
                tags: true,
                creator: { select: USER_SELECT },
              },
            },
          },
        },
      },
    });
  }

  async create(projectId: string, dto: CreateTestSuiteDto) {
    return this.prisma.testSuite.create({
      data: {
        projectId,
        name: dto.name,
        description: dto.description,
      },
      include: { _count: { select: { members: true } } },
    });
  }

  async update(suiteId: string, dto: UpdateTestSuiteDto) {
    return this.prisma.testSuite.update({
      where: { id: suiteId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
      include: { _count: { select: { members: true } } },
    });
  }

  async delete(suiteId: string) {
    return this.prisma.testSuite.delete({ where: { id: suiteId } });
  }

  async addMembers(suiteId: string, testCaseIds: string[]) {
    // Skip duplicates
    const existing = await this.prisma.testSuiteMember.findMany({
      where: { suiteId, testCaseId: { in: testCaseIds } },
      select: { testCaseId: true },
    });
    const existingIds = new Set(existing.map((m) => m.testCaseId));
    const newIds = testCaseIds.filter((id) => !existingIds.has(id));

    if (newIds.length === 0) return { added: 0 };

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

  async removeMember(suiteId: string, testCaseId: string) {
    return this.prisma.testSuiteMember.delete({
      where: { suiteId_testCaseId: { suiteId, testCaseId } },
    });
  }
}
