import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import keycloak from '../auth/keycloak';
import type { PlannerScope, PlannerFeature } from '../lib/types';

const API_BASE = '/api';

interface SSECallbacks {
  onToken: (text: string) => void;
  onMessageComplete: (messageId: string) => void;
  onScopeAdded: (scope: PlannerScope) => void;
  onScopeUpdated: (scope: PlannerScope) => void;
  onFeatureAdded: (feature: PlannerFeature & { scopeId: string }) => void;
  onFeatureUpdated: (feature: PlannerFeature) => void;
  onActionSuggested: (data: { type: string; reason: string }) => void;
  onError: (message: string) => void;
  onDone: () => void;
}

export function usePlannerSSE(sessionId: string) {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const connect = useCallback(
    (streamToken: string, callbacks: SSECallbacks) => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const token = keycloak.token;
      const url = `${API_BASE}/planner-sessions/${sessionId}/chat-stream?token=${encodeURIComponent(streamToken)}&access_token=${encodeURIComponent(token ?? '')}`;
      const es = new EventSource(url);
      eventSourceRef.current = es;
      setIsStreaming(true);

      es.addEventListener('token', (e) => {
        const data = JSON.parse(e.data);
        callbacks.onToken(data.text);
      });

      es.addEventListener('message_complete', (e) => {
        const data = JSON.parse(e.data);
        callbacks.onMessageComplete(data.messageId);
        void queryClient.invalidateQueries({ queryKey: ['planner-messages', sessionId] });
      });

      es.addEventListener('scope_added', (e) => {
        const data = JSON.parse(e.data);
        callbacks.onScopeAdded(data);
        void queryClient.invalidateQueries({ queryKey: ['planner-scopes', sessionId] });
      });

      es.addEventListener('scope_updated', (e) => {
        const data = JSON.parse(e.data);
        callbacks.onScopeUpdated(data);
        void queryClient.invalidateQueries({ queryKey: ['planner-scopes', sessionId] });
      });

      es.addEventListener('feature_added', (e) => {
        const data = JSON.parse(e.data);
        callbacks.onFeatureAdded(data);
        void queryClient.invalidateQueries({ queryKey: ['planner-scopes', sessionId] });
      });

      es.addEventListener('feature_updated', (e) => {
        const data = JSON.parse(e.data);
        callbacks.onFeatureUpdated(data);
        void queryClient.invalidateQueries({ queryKey: ['planner-scopes', sessionId] });
      });

      es.addEventListener('action_suggested', (e) => {
        const data = JSON.parse(e.data);
        callbacks.onActionSuggested(data);
      });

      es.addEventListener('error', (e) => {
        if (e instanceof MessageEvent) {
          const data = JSON.parse(e.data);
          callbacks.onError(data.message);
        }
        setIsStreaming(false);
      });

      es.addEventListener('done', () => {
        callbacks.onDone();
        es.close();
        eventSourceRef.current = null;
        setIsStreaming(false);
      });

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        setIsStreaming(false);
      };
    },
    [sessionId, queryClient],
  );

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsStreaming(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return { connect, disconnect, isStreaming };
}
