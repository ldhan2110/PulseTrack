import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { UpsertAutomationDto } from './dto/upsert-automation.dto';

@Injectable()
export class TestAutomationService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(testCaseId: string, data: UpsertAutomationDto) {
    return this.prisma.testCaseAutomation.upsert({
      where: { testCaseId },
      create: { testCaseId, ...data },
      update: data,
    });
  }

  async findByTestCaseId(testCaseId: string) {
    return this.prisma.testCaseAutomation.findUnique({
      where: { testCaseId },
      include: {
        runs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            runner: {
              select: { id: true, name: true, username: true, imageUrl: true },
            },
          },
        },
      },
    });
  }

  async delete(testCaseId: string) {
    return this.prisma.testCaseAutomation.delete({
      where: { testCaseId },
    });
  }
}
