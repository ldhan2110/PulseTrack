// apps/api/src/planner/planner.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { CreateScopeDto } from './dto/create-scope.dto';
import { UpdateScopeDto } from './dto/update-scope.dto';
import { CreateFeatureDto } from './dto/create-feature.dto';
import { UpdateFeatureDto } from './dto/update-feature.dto';
import { ReorderDto } from './dto/reorder.dto';

const SESSION_INCLUDE = {
  scopes: {
    orderBy: { position: 'asc' as const },
    include: {
      features: {
        orderBy: { position: 'asc' as const },
      },
    },
  },
};

@Injectable()
export class PlannerService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Sessions ──────────────────────────────────────────────

  async listSessions(projectId: string) {
    return this.prisma.plannerSession.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { scopes: true, messages: true } },
      },
    });
  }

  async getSession(sessionId: string) {
    const session = await this.prisma.plannerSession.findUnique({
      where: { id: sessionId },
      include: SESSION_INCLUDE,
    });
    if (!session) throw new NotFoundException('Planner session not found');
    return session;
  }

  async createSession(projectId: string, dto: CreateSessionDto) {
    return this.prisma.plannerSession.create({
      data: {
        projectId,
        name: dto.name,
        description: dto.description,
      },
      include: SESSION_INCLUDE,
    });
  }

  async updateSession(sessionId: string, dto: UpdateSessionDto) {
    await this.ensureSessionExists(sessionId);
    return this.prisma.plannerSession.update({
      where: { id: sessionId },
      data: dto,
      include: SESSION_INCLUDE,
    });
  }

  async deleteSession(sessionId: string) {
    await this.ensureSessionExists(sessionId);
    return this.prisma.plannerSession.delete({ where: { id: sessionId } });
  }

  // ─── Scopes ────────────────────────────────────────────────

  async listScopes(sessionId: string) {
    return this.prisma.plannerScope.findMany({
      where: { sessionId },
      orderBy: { position: 'asc' },
      include: {
        features: { orderBy: { position: 'asc' } },
      },
    });
  }

  async createScope(sessionId: string, dto: CreateScopeDto, aiGenerated = false) {
    const maxPos = await this.prisma.plannerScope.aggregate({
      where: { sessionId },
      _max: { position: true },
    });
    return this.prisma.plannerScope.create({
      data: {
        sessionId,
        title: dto.title,
        description: dto.description,
        position: (maxPos._max.position ?? -1) + 1,
        aiGenerated,
      },
      include: { features: { orderBy: { position: 'asc' } } },
    });
  }

  async updateScope(scopeId: string, dto: UpdateScopeDto) {
    return this.prisma.plannerScope.update({
      where: { id: scopeId },
      data: dto,
      include: { features: { orderBy: { position: 'asc' } } },
    });
  }

  async deleteScope(scopeId: string) {
    return this.prisma.plannerScope.delete({ where: { id: scopeId } });
  }

  async reorderScopes(sessionId: string, dto: ReorderDto) {
    await this.prisma.$transaction(
      dto.orderedIds.map((id, index) =>
        this.prisma.plannerScope.update({
          where: { id },
          data: { position: index },
        }),
      ),
    );
    return this.listScopes(sessionId);
  }

  // ─── Features ──────────────────────────────────────────────

  async createFeature(
    scopeId: string,
    dto: CreateFeatureDto,
    aiGenerated = false,
    sourceMessageId?: string,
  ) {
    const maxPos = await this.prisma.plannerFeature.aggregate({
      where: { scopeId },
      _max: { position: true },
    });
    return this.prisma.plannerFeature.create({
      data: {
        scopeId,
        title: dto.title,
        description: dto.description,
        position: (maxPos._max.position ?? -1) + 1,
        aiGenerated,
        sourceMessageId,
      },
    });
  }

  async updateFeature(featureId: string, dto: UpdateFeatureDto) {
    return this.prisma.plannerFeature.update({
      where: { id: featureId },
      data: dto,
    });
  }

  async deleteFeature(featureId: string) {
    return this.prisma.plannerFeature.delete({ where: { id: featureId } });
  }

  async reorderFeatures(scopeId: string, dto: ReorderDto) {
    await this.prisma.$transaction(
      dto.orderedIds.map((id, index) =>
        this.prisma.plannerFeature.update({
          where: { id },
          data: { position: index },
        }),
      ),
    );
    return this.prisma.plannerFeature.findMany({
      where: { scopeId },
      orderBy: { position: 'asc' },
    });
  }

  // ─── Messages ──────────────────────────────────────────────

  async listMessages(sessionId: string, take = 50, skip = 0) {
    return this.prisma.plannerMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take,
      skip,
      include: { attachments: true },
    });
  }

  async createMessage(
    sessionId: string,
    role: 'USER' | 'ASSISTANT' | 'SYSTEM',
    content: string,
  ) {
    return this.prisma.plannerMessage.create({
      data: { sessionId, role, content },
      include: { attachments: true },
    });
  }

  async createAttachment(
    messageId: string,
    file: { originalname: string; filename: string; path: string; mimetype: string; size: number },
  ) {
    return this.prisma.plannerAttachment.create({
      data: {
        messageId,
        fileName: file.originalname,
        storedName: file.filename,
        fileUrl: file.path,
        mimeType: file.mimetype,
        size: file.size,
      },
    });
  }

  // ─── Helpers ───────────────────────────────────────────────

  private async ensureSessionExists(sessionId: string) {
    const session = await this.prisma.plannerSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Planner session not found');
    return session;
  }
}
