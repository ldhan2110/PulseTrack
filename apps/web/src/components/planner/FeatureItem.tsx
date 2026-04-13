import { useState } from 'react';
import { GripVertical, Pencil, Trash2, Check, X } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PlannerFeature } from '@/lib/types';

interface FeatureItemProps {
  feature: PlannerFeature;
  onUpdate: (data: { title?: string; description?: string }) => void;
  onDelete: () => void;
}

export function FeatureItem({ feature, onUpdate, onDelete }: FeatureItemProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(feature.title);
  const [description, setDescription] = useState(feature.description ?? '');

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: feature.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSave = () => {
    onUpdate({ title, description: description || undefined });
    setEditing(false);
  };

  const handleCancel = () => {
    setTitle(feature.title);
    setDescription(feature.description ?? '');
    setEditing(false);
  };

  return (
    <div ref={setNodeRef} style={style} className="group flex items-start gap-1 rounded-md border bg-background/50 px-2 py-1.5 text-sm">
      <button {...attributes} {...listeners} className="mt-0.5 cursor-grab text-muted-foreground/40 hover:text-muted-foreground">
        <GripVertical className="size-3.5" />
      </button>
      {editing ? (
        <div className="flex-1 space-y-1">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-7 text-sm" />
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="h-7 text-sm" />
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={handleSave}><Check className="size-3" /></Button>
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={handleCancel}><X className="size-3" /></Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-medium truncate">{feature.title}</span>
            {feature.aiGenerated && (
              <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">AI</span>
            )}
          </div>
          {feature.description && (
            <p className="text-xs text-muted-foreground truncate">{feature.description}</p>
          )}
        </div>
      )}
      {!editing && (
        <div className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="icon" variant="ghost" className="size-6" onClick={() => setEditing(true)}>
            <Pencil className="size-3" />
          </Button>
          <Button size="icon" variant="ghost" className="size-6" onClick={onDelete}>
            <Trash2 className="size-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
