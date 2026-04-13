import { Injectable, Logger } from '@nestjs/common';
import { Subject } from 'rxjs';
import { PlannerService } from './planner.service';
import { PlannerAiService } from './planner-ai.service';

interface SseEvent {
  type: string;
  data: unknown;
}

@Injectable()
export class PlannerChatService {
  private readonly logger = new Logger(PlannerChatService.name);
  private readonly activeStreams = new Map<string, Subject<SseEvent>>();

  constructor(
    private readonly plannerService: PlannerService,
    private readonly aiService: PlannerAiService,
  ) {}

  async sendMessage(
    sessionId: string,
    content: string,
    files: Express.Multer.File[],
  ): Promise<{ messageId: string; streamToken: string }> {
    const userMessage = await this.plannerService.createMessage(sessionId, 'USER', content);

    for (const file of files) {
      await this.plannerService.createAttachment(userMessage.id, file);
    }

    const streamToken = `${sessionId}-${userMessage.id}`;

    this.processAiResponse(sessionId, content, streamToken, []).catch((err) => {
      this.logger.error('AI processing failed', err);
      const subject = this.activeStreams.get(streamToken);
      if (subject) {
        subject.next({ type: 'error', data: { message: 'AI processing failed' } });
        subject.complete();
        this.activeStreams.delete(streamToken);
      }
    });

    return { messageId: userMessage.id, streamToken };
  }

  getStream(streamToken: string): Subject<SseEvent> {
    let subject = this.activeStreams.get(streamToken);
    if (!subject) {
      subject = new Subject<SseEvent>();
      this.activeStreams.set(streamToken, subject);
    }
    return subject;
  }

  private async processAiResponse(
    sessionId: string,
    userMessage: string,
    streamToken: string,
    attachmentTexts: string[],
  ) {
    const subject = this.getStream(streamToken);

    const session = await this.plannerService.getSession(sessionId);

    const aiConfig = await this.aiService.getDecryptedApiKey(session.projectId);
    if (!aiConfig) {
      subject.next({ type: 'error', data: { message: 'AI not configured for this project. Go to Settings > AI Config.' } });
      subject.complete();
      this.activeStreams.delete(streamToken);
      return;
    }

    const messages = await this.plannerService.listMessages(sessionId);
    const chatHistory = messages.map((m) => ({ role: m.role, content: m.content }));

    const context = this.aiService.buildContext(
      session.scopes,
      chatHistory,
      userMessage,
      attachmentTexts,
    );

    let fullResponse = '';
    const stream = this.aiService.streamChatResponse(
      aiConfig.provider, aiConfig.model, aiConfig.apiKey, context,
    );

    const delimiter = '---PLANNER_ACTIONS---';
    let delimiterDetected = false;

    for await (const chunk of stream) {
      fullResponse += chunk;

      if (!delimiterDetected && fullResponse.includes(delimiter)) {
        delimiterDetected = true;
        continue;
      }

      if (!delimiterDetected) {
        subject.next({ type: 'token', data: { text: chunk } });
      }
    }

    const { chatContent, actions } = this.aiService.parseActions(fullResponse);

    const assistantMsg = await this.plannerService.createMessage(sessionId, 'ASSISTANT', chatContent);
    subject.next({ type: 'message_complete', data: { messageId: assistantMsg.id } });

    for (const action of actions) {
      try {
        if (action.action === 'add_scope' && action.title) {
          const scope = await this.plannerService.createScope(
            sessionId,
            { title: action.title, description: action.description },
            true,
          );
          subject.next({ type: 'scope_added', data: scope });
        } else if (action.action === 'add_feature' && action.scopeTitle && action.title) {
          const scopes = await this.plannerService.listScopes(sessionId);
          const targetScope = scopes.find((s) => s.title === action.scopeTitle);
          if (targetScope) {
            const feature = await this.plannerService.createFeature(
              targetScope.id,
              { title: action.title, description: action.description },
              true,
              assistantMsg.id,
            );
            subject.next({ type: 'feature_added', data: { ...feature, scopeId: targetScope.id } });
          }
        } else if (action.action === 'update_scope' && action.id) {
          const scope = await this.plannerService.updateScope(action.id, {
            title: action.title,
            description: action.description,
          });
          subject.next({ type: 'scope_updated', data: scope });
        } else if (action.action === 'update_feature' && action.id) {
          const feature = await this.plannerService.updateFeature(action.id, {
            title: action.title,
            description: action.description,
          });
          subject.next({ type: 'feature_updated', data: feature });
        } else if (action.action === 'suggest') {
          subject.next({ type: 'action_suggested', data: { type: action.type, reason: action.reason } });
        }
      } catch (e) {
        this.logger.warn(`Failed to execute planner action: ${JSON.stringify(action)}`, e);
      }
    }

    subject.next({ type: 'done', data: {} });
    subject.complete();
    this.activeStreams.delete(streamToken);
  }
}
