import { useState } from 'react';
import { ChevronDown, ChevronRight, GripVertical, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PlannerScope } from '@/lib/types';
import { FeatureItem } from './FeatureItem';

interface ScopeGroupProps {
  scope: PlannerScope;
  onUpdateScope: (data: { title?: string; description?: string }) => void;
  onDeleteScope: () => void;
  onCreateFeature: (data: { title: string; description?: string }) => void;
  onUpdateFeature: (featureId: string, data: { title?: string; description?: string }) => void;
  onDeleteFeature: (featureId: string) => void;
  onReorderFeatures: (orderedIds: string[]) => void;
}

export function ScopeGroup({
  scope, onUpdateScope, onDeleteScope, onCreateFeature, onUpdateFeature, onDeleteFeature, onReorderFeatures,
}: ScopeGroupProps) {
  const [expanded, setExpanded] = useState(true);
  const [editingScope, setEditingScope] = useState(false);
  const [title, setTitle] = useState(scope.title);
  const [description, setDescription] = useState(scope.description ?? '');
  const [addingFeature, setAddingFeature] = useState(false);
  const [newFeatureTitle, setNewFeatureTitle] = useState('');

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: scope.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleSaveScope = () => {
    onUpdateScope({ title, description: description || undefined });
    setEditingScope(false);
  };

  const handleAddFeature = () => {
    if (!newFeatureTitle.trim()) return;
    onCreateFeature({ title: newFeatureTitle.trim() });
    setNewFeatureTitle('');
    setAddingFeature(false);
  };

  const handleFeatureDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = scope.features.map((f) => f.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    const newOrder = [...ids];
    newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, active.id as string);
    onReorderFeatures(newOrder);
  };

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border bg-card">
      <div className="group flex items-center gap-2 px-3 py-2">
        <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground/40 hover:text-muted-foreground">
          <GripVertical className="size-4" />
        </button>
        <button onClick={() => setExpanded(!expanded)} className="text-primary/70">
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        {editingScope ? (
          <div className="flex-1 space-y-1">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-7 text-sm" />
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="h-7 text-sm" />
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={handleSaveScope}><Check className="size-3" /></Button>
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingScope(false)}><X className="size-3" /></Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{scope.title}</span>
                {scope.aiGenerated && (
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">AI</span>
                )}
                <span className="text-xs text-muted-foreground">{scope.features.length} features</span>
              </div>
              {scope.description && (
                <p className="text-xs text-muted-foreground truncate">{scope.description}</p>
              )}
            </div>
            <div className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button size="icon" variant="ghost" className="size-6" onClick={() => setAddingFeature(true)}>
                <Plus className="size-3" />
              </Button>
              <Button size="icon" variant="ghost" className="size-6" onClick={() => setEditingScope(true)}>
                <Pencil className="size-3" />
              </Button>
              <Button size="icon" variant="ghost" className="size-6" onClick={onDeleteScope}>
                <Trash2 className="size-3" />
              </Button>
            </div>
          </>
        )}
      </div>

      {expanded && (
        <div className="space-y-1 px-3 pb-2 pl-9">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleFeatureDragEnd}>
            <SortableContext items={scope.features.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              {scope.features.map((feature) => (
                <FeatureItem
                  key={feature.id}
                  feature={feature}
                  onUpdate={(data) => onUpdateFeature(feature.id, data)}
                  onDelete={() => onDeleteFeature(feature.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
          {addingFeature && (
            <div className="flex items-center gap-1">
              <Input
                value={newFeatureTitle}
                onChange={(e) => setNewFeatureTitle(e.target.value)}
                placeholder="Feature title..."
                className="h-7 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddFeature();
                  if (e.key === 'Escape') setAddingFeature(false);
                }}
              />
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={handleAddFeature}><Check className="size-3" /></Button>
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setAddingFeature(false)}><X className="size-3" /></Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
