import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import IORedis from 'ioredis';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { modelFor } from '../agents/ai-client';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { UpdateProposalDto } from './dto/update-proposal.dto';

const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 40_000;
const STREAM_TTL_SECONDS = 300;
const ALLOWED_EXTENSIONS = new Set(['.txt', '.md', '.pdf', '.docx']);

type StreamState = { sessionId: string; messageId: string; userId: string };
type Proposal = { title: string; description?: string; features: Array<{ title: string; description?: string }> };

@Injectable()
export class PlannerChatService {
  private readonly redis: IORedis;

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {
    this.redis = new IORedis(this.config.getOrThrow<string>('REDIS_URL'), { maxRetriesPerRequest: 1 });
  }

  async submit(sessionId: string, userId: string, content: string, files: Express.Multer.File[]) {
    const session = await this.prisma.plannerSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Planner session not found');
    await this.ensureMember(session.projectId, userId);
    if (!content.trim() && files.length === 0) throw new BadRequestException('A message or attachment is required');
    if (files.length > MAX_FILES) throw new BadRequestException(`At most ${MAX_FILES} files can be attached`);

    const extracted = await Promise.all(files.map((file) => this.extractFile(file)));
    const message = await this.prisma.plannerMessage.create({
      data: { sessionId, role: 'USER', content: content.trim() || 'Attached files' },
      include: { attachments: true },
    });
    await Promise.all(files.map(async (file, index) => {
      const storedName = `${randomUUID()}-${this.safeName(file.originalname)}`;
      const directory = join(process.cwd(), 'uploads', 'planner');
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, storedName), file.buffer);
      await this.prisma.plannerAttachment.create({
        data: { messageId: message.id, fileName: file.originalname, storedName, fileUrl: `/api/uploads/planner/${storedName}`, mimeType: file.mimetype, size: file.size },
      });
      return extracted[index];
    }));

    const streamToken = randomBytes(32).toString('base64url');
    await this.redis.set(`planner:stream:${streamToken}`, JSON.stringify({ sessionId, messageId: message.id, userId, extracted } satisfies StreamState & { extracted: string[] }), 'EX', STREAM_TTL_SECONDS);
    return { messageId: message.id, streamToken };
  }

  async stream(sessionId: string, streamToken: string, res: import('express').Response) {
    const key = `planner:stream:${streamToken}`;
    const raw = await this.redis.eval('local v=redis.call("GET",KEYS[1]); if v then redis.call("DEL",KEYS[1]); end; return v', 1, key) as string | null;
    if (!raw) throw new ForbiddenException('The chat stream token is invalid or has expired');
    const state = JSON.parse(raw) as StreamState & { extracted: string[] };
    if (state.sessionId !== sessionId) throw new ForbiddenException('The chat stream token does not match this session');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const emit = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    try {
      const session = await this.prisma.plannerSession.findUnique({
        where: { id: sessionId },
        include: { project: { include: { aiConfig: true } }, scopes: { include: { features: true }, orderBy: { position: 'asc' } }, messages: { orderBy: { createdAt: 'asc' }, take: 20 } },
      });
      if (!session) throw new NotFoundException('Planner session not found');
      const cfg = session.project.aiConfig;
      if (!cfg) throw new ServiceUnavailableException('AI configuration is required for Project Planner');
      const model = modelFor(cfg, this.config.getOrThrow<string>('ENCRYPTION_KEY'));
      const scopeContext = session.scopes.map((scope) => `${scope.title}: ${scope.description ?? ''} [${scope.features.map((f) => f.title).join(', ')}]`).join('\n');
      const history = session.messages.map((message) => `${message.role}: ${message.content}`).join('\n');
      const attachmentContext = state.extracted.filter(Boolean).join('\n\n').slice(0, MAX_EXTRACTED_CHARS);
      const system = `You are a project planning assistant. Give concise, practical planning advice. Existing scope:\n${scopeContext || '(none)'}\n\nIf a new scope would help, append exactly one JSON block on a new line: <proposal>{"title":"...","description":"...","features":[{"title":"...","description":"..."}]}</proposal>. Do not use a proposal for ordinary answers.`;
      const stream = await model.stream([new SystemMessage(system), new HumanMessage(`${history}\n\nAttachment text:\n${attachmentContext}`)]);
      let full = '';
      for await (const chunk of stream) {
        const text = typeof chunk.content === 'string' ? chunk.content : '';
        full += text;
        emit('token', { text });
      }
      const { reply, proposal } = this.parseProposal(full);
      const assistant = await this.prisma.plannerMessage.create({
        data: { sessionId, role: 'ASSISTANT', content: reply, ...(proposal && { proposal: proposal as object, proposalStatus: 'PENDING' }) },
      });
      emit('message_complete', { messageId: assistant.id });
      if (proposal) emit('action_suggested', { messageId: assistant.id, type: 'scope_proposal', reason: `Proposed scope: ${proposal.title}`, proposal });
      emit('done', {});
    } catch (error) {
      emit('error', { message: error instanceof Error ? error.message : 'Planner response failed' });
      emit('done', {});
    } finally { res.end(); }
  }

  async updateProposal(messageId: string, userId: string, dto: UpdateProposalDto) {
    const message = await this.getProposal(messageId, userId);
    if (message.proposalStatus !== 'PENDING') throw new BadRequestException('This proposal is no longer pending');
    return this.prisma.plannerMessage.update({ where: { id: messageId }, data: { proposal: dto as unknown as Prisma.InputJsonValue } });
  }

  async acceptProposal(messageId: string, userId: string, dto: UpdateProposalDto) {
    const message = await this.getProposal(messageId, userId);
    if (message.proposalStatus !== 'PENDING') throw new BadRequestException('This proposal is no longer pending');
    return this.prisma.$transaction(async (tx) => {
      const max = await tx.plannerScope.aggregate({ where: { sessionId: message.sessionId }, _max: { position: true } });
      const scope = await tx.plannerScope.create({ data: { sessionId: message.sessionId, title: dto.title, description: dto.description, position: (max._max.position ?? -1) + 1, aiGenerated: true } });
      if (dto.features.length) await tx.plannerFeature.createMany({ data: dto.features.map((feature, position) => ({ scopeId: scope.id, title: feature.title, description: feature.description, position, aiGenerated: true, sourceMessageId: messageId })) });
      await tx.plannerMessage.update({ where: { id: messageId }, data: { proposal: dto as unknown as Prisma.InputJsonValue, proposalStatus: 'ACCEPTED' } });
      return scope;
    });
  }

  async dismissProposal(messageId: string, userId: string) {
    const message = await this.getProposal(messageId, userId);
    if (message.proposalStatus !== 'PENDING') throw new BadRequestException('This proposal is no longer pending');
    return this.prisma.plannerMessage.update({ where: { id: messageId }, data: { proposalStatus: 'DISMISSED' } });
  }

  private async getProposal(messageId: string, userId: string) {
    const message = await this.prisma.plannerMessage.findUnique({ where: { id: messageId }, include: { session: true } });
    if (!message || !message.proposal) throw new NotFoundException('Planner proposal not found');
    await this.ensureMember(message.session.projectId, userId);
    return message;
  }
  private async ensureMember(projectId: string, userId: string) { if (!await this.prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } })) throw new ForbiddenException('Not a project member'); }
  private safeName(name: string) { return name.replace(/[^a-zA-Z0-9._-]/g, '_'); }
  private async extractFile(file: Express.Multer.File) {
    const extension = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension) || file.size > MAX_FILE_BYTES) throw new BadRequestException('Attachments must be TXT, Markdown, PDF, or DOCX files up to 10 MB');
    let text = '';
    if (extension === '.txt' || extension === '.md') text = file.buffer.toString('utf8');
    else if (extension === '.docx') text = (await mammoth.extractRawText({ buffer: file.buffer })).value;
    else { const parser = new PDFParse({ data: file.buffer }); try { text = (await parser.getText()).text; } finally { await parser.destroy(); } }
    if (text.length > MAX_EXTRACTED_CHARS) throw new BadRequestException('Attachment text exceeds the 40,000 character limit');
    return text;
  }
  private parseProposal(content: string): { reply: string; proposal?: Proposal } {
    const match = content.match(/\n?<proposal>([\s\S]+?)<\/proposal>\s*$/);
    if (!match) return { reply: content };
    try { const proposal = JSON.parse(match[1]) as Proposal; if (!proposal.title || !Array.isArray(proposal.features)) throw new Error(); return { reply: content.slice(0, match.index).trim(), proposal }; } catch { return { reply: content }; }
  }
}
