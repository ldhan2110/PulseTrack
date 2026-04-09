import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertWikiConfigDto } from './dto/upsert-wiki-config.dto';

@Injectable()
export class WikiConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async findByProjectId(projectId: string) {
    return this.prisma.wikiConfig.findUnique({ where: { projectId } });
  }

  async upsert(projectId: string, dto: UpsertWikiConfigDto) {
    return this.prisma.wikiConfig.upsert({
      where: { projectId },
      create: {
        projectId,
        wikiPath: dto.wikiPath,
        autoUpdate: dto.autoUpdate ?? 'manual',
        sections: dto.sections ?? ['architecture', 'modules', 'features', 'business-logic', 'api-reference', 'data-models', 'glossary'],
      },
      update: {
        wikiPath: dto.wikiPath,
        ...(dto.autoUpdate !== undefined && { autoUpdate: dto.autoUpdate }),
        ...(dto.sections !== undefined && { sections: dto.sections }),
      },
    });
  }
}
