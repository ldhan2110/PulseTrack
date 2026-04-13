import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { PlannerScope } from '@/lib/types';
import { ScopeGroup } from './ScopeGroup';

interface ScopeListProps {
  scopes: PlannerScope[];
  onUpdateScope: (scopeId: string, data: { title?: string; description?: string }) => void;
  onDeleteScope: (scopeId: string) => void;
  onReorderScopes: (orderedIds: string[]) => void;
  onCreateFeature: (scopeId: string, data: { title: string; description?: string }) => void;
  onUpdateFeature: (scopeId: string, featureId: string, data: { title?: string; description?: string }) => void;
  onDeleteFeature: (scopeId: string, featureId: string) => void;
  onReorderFeatures: (scopeId: string, orderedIds: string[]) => void;
}

export function ScopeList({
  scopes, onUpdateScope, onDeleteScope, onReorderScopes, onCreateFeature, onUpdateFeature, onDeleteFeature, onReorderFeatures,
}: ScopeListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = scopes.map((s) => s.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    const newOrder = [...ids];
    newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, active.id as string);
    onReorderScopes(newOrder);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={scopes.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {scopes.map((scope) => (
            <ScopeGroup
              key={scope.id}
              scope={scope}
              onUpdateScope={(data) => onUpdateScope(scope.id, data)}
              onDeleteScope={() => onDeleteScope(scope.id)}
              onCreateFeature={(data) => onCreateFeature(scope.id, data)}
              onUpdateFeature={(fId, data) => onUpdateFeature(scope.id, fId, data)}
              onDeleteFeature={(fId) => onDeleteFeature(scope.id, fId)}
              onReorderFeatures={(ids) => onReorderFeatures(scope.id, ids)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
