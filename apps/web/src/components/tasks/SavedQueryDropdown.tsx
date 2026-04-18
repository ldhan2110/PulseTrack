import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, Star, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SavedFilter } from '@/lib/types';

interface SavedQueryDropdownProps {
  savedFilters: SavedFilter[];
  activeFilterId: string | null;
  isModified: boolean;
  onSelect: (filter: SavedFilter) => void;
  onSave: (name: string, isDefault: boolean) => void;
  onSetDefault: (id: string, isDefault: boolean) => void;
  onDelete: (id: string) => void;
}

export function SavedQueryDropdown({
  savedFilters,
  activeFilterId,
  isModified,
  onSelect,
  onSave,
  onSetDefault,
  onDelete,
}: SavedQueryDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newName, setNewName] = useState('');

  const activeFilter = savedFilters.find((f) => f.id === activeFilterId);
  const label = activeFilter
    ? `${activeFilter.name}${isModified ? ' (modified)' : ''}`
    : 'Saved Queries';

  const handleSave = () => {
    if (!newName.trim()) return;
    onSave(newName.trim(), false);
    setNewName('');
    setIsSaving(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 gap-1.5',
            activeFilterId && 'border-primary',
          )}
        >
          {label}
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
          {savedFilters.length === 0 && !isSaving && (
            <p className="text-xs text-muted-foreground px-2 py-1.5">No saved queries yet</p>
          )}
          {savedFilters.map((filter) => (
            <div
              key={filter.id}
              className={cn(
                'flex items-center gap-1 rounded px-2 py-1.5 hover:bg-muted text-sm group cursor-pointer',
                filter.id === activeFilterId && 'bg-muted',
              )}
              onClick={() => { onSelect(filter); setIsOpen(false); }}
            >
              <span className="flex-1 truncate">{filter.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onSetDefault(filter.id, !filter.isDefault); }}
                className="shrink-0 p-0.5 hover:bg-muted-foreground/10 rounded"
                title={filter.isDefault ? 'Remove as default' : 'Set as default'}
              >
                <Star
                  className={cn(
                    'size-3.5',
                    filter.isDefault ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground opacity-0 group-hover:opacity-100',
                  )}
                />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(filter.id); }}
                className="shrink-0 p-0.5 hover:bg-destructive/10 rounded opacity-0 group-hover:opacity-100"
                title="Delete"
              >
                <Trash2 className="size-3.5 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>

        <div className="border-t mt-1 pt-1">
          {isSaving ? (
            <div className="flex items-center gap-1">
              <Input
                placeholder="Query name..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setIsSaving(false); }}
                className="h-7 text-xs flex-1"
                autoFocus
              />
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={handleSave}>
                Save
              </Button>
            </div>
          ) : (
            <button
              className="w-full text-left text-sm text-muted-foreground px-2 py-1.5 hover:bg-muted rounded"
              onClick={() => setIsSaving(true)}
            >
              Save current filters...
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
