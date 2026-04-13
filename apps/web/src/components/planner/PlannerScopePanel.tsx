import { useState } from 'react';
import { Plus, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PlannerScope } from '@/lib/types';
import {
  useCreatePlannerScope, useUpdatePlannerScope, useDeletePlannerScope, useReorderPlannerScopes,
  useCreatePlannerFeature, useUpdatePlannerFeature, useDeletePlannerFeature, useReorderPlannerFeatures,
} from '@/hooks/usePlanner';
import { ScopeList } from './ScopeList';
import { ScopeActionsToolbar } from './ScopeActionsToolbar';

interface PlannerScopePanelProps {
  sessionId: string;
  scopes: PlannerScope[];
}

export function PlannerScopePanel({ sessionId, scopes }: PlannerScopePanelProps) {
  const [addingScope, setAddingScope] = useState(false);
  const [newScopeTitle, setNewScopeTitle] = useState('');

  const createScope = useCreatePlannerScope(sessionId);
  const updateScope = useUpdatePlannerScope(sessionId);
  const deleteScope = useDeletePlannerScope(sessionId);
  const reorderScopes = useReorderPlannerScopes(sessionId);
  const createFeature = useCreatePlannerFeature(sessionId);
  const updateFeature = useUpdatePlannerFeature(sessionId);
  const deleteFeature = useDeletePlannerFeature(sessionId);
  const reorderFeatures = useReorderPlannerFeatures(sessionId);

  const featureCount = scopes.reduce((sum, s) => sum + s.features.length, 0);

  const handleAddScope = () => {
    if (!newScopeTitle.trim()) return;
    createScope.mutate({ title: newScopeTitle.trim() });
    setNewScopeTitle('');
    setAddingScope(false);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Scopes <span className="text-primary/60">({scopes.length})</span>
        </span>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setAddingScope(true)}>
          <Plus className="size-3" /> Add Scope
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {scopes.length === 0 && !addingScope && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Scopes will appear here as you discuss requirements with the AI.
          </div>
        )}
        <ScopeList
          scopes={scopes}
          onUpdateScope={(id, data) => updateScope.mutate({ scopeId: id, data })}
          onDeleteScope={(id) => deleteScope.mutate(id)}
          onReorderScopes={(ids) => reorderScopes.mutate(ids)}
          onCreateFeature={(scopeId, data) => createFeature.mutate({ scopeId, data })}
          onUpdateFeature={(scopeId, featureId, data) => updateFeature.mutate({ scopeId, featureId, data })}
          onDeleteFeature={(scopeId, featureId) => deleteFeature.mutate({ scopeId, featureId })}
          onReorderFeatures={(scopeId, ids) => reorderFeatures.mutate({ scopeId, orderedIds: ids })}
        />
        {addingScope && (
          <div className="flex items-center gap-1 rounded-lg border p-2">
            <Input
              value={newScopeTitle}
              onChange={(e) => setNewScopeTitle(e.target.value)}
              placeholder="Scope title..."
              className="h-7 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddScope();
                if (e.key === 'Escape') setAddingScope(false);
              }}
            />
            <Button size="sm" variant="ghost" className="h-6" onClick={handleAddScope}><Check className="size-3" /></Button>
            <Button size="sm" variant="ghost" className="h-6" onClick={() => setAddingScope(false)}><X className="size-3" /></Button>
          </div>
        )}
      </div>
      <ScopeActionsToolbar
        scopeCount={scopes.length}
        featureCount={featureCount}
        onGeneratePrd={() => {}}
        onExport={() => {}}
        onSummarize={() => {}}
      />
    </div>
  );
}
