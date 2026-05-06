import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { encrypt, decrypt, maskToken } from '../common/encryption.util';
import type {
  CreateProjectVariableDto,
  UpdateProjectVariableDto,
} from './dto/create-project-variable.dto';

@Injectable()
export class ProjectVariablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get encryptionKey(): string {
    return this.config.getOrThrow<string>('ENCRYPTION_KEY');
  }

  async findAll(projectId: string) {
    const vars = await this.prisma.projectVariable.findMany({
      where: { projectId },
      orderBy: { key: 'asc' },
    });

    return vars.map((v) => ({
      ...v,
      value: v.isSecret ? maskToken(decrypt(v.value, this.encryptionKey)) : v.value,
    }));
  }

  async create(projectId: string, dto: CreateProjectVariableDto) {
    const value = dto.isSecret
      ? encrypt(dto.value, this.encryptionKey)
      : dto.value;

    return this.prisma.projectVariable.create({
      data: { projectId, key: dto.key, value, isSecret: dto.isSecret ?? false },
    });
  }

  async update(id: string, dto: UpdateProjectVariableDto) {
    const existing = await this.prisma.projectVariable.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Variable not found');

    const data: Record<string, unknown> = {};
    if (dto.value !== undefined) {
      const shouldEncrypt = dto.isSecret ?? existing.isSecret;
      data.value = shouldEncrypt
        ? encrypt(dto.value, this.encryptionKey)
        : dto.value;
    }
    if (dto.isSecret !== undefined) data.isSecret = dto.isSecret;

    return this.prisma.projectVariable.update({ where: { id }, data });
  }

  async delete(id: string) {
    return this.prisma.projectVariable.delete({ where: { id } });
  }

  /** Used internally by processor — returns decrypted values */
  async getDecryptedVariables(projectId: string) {
    const vars = await this.prisma.projectVariable.findMany({
      where: { projectId },
    });

    return vars.map((v) => ({
      key: v.key,
      value: v.isSecret ? decrypt(v.value, this.encryptionKey) : v.value,
    }));
  }
}
