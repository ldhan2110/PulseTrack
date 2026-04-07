import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';

export interface StatusNodeData {
  name: string;
  color: string;
  key: string;
  isDefault: boolean;
  isClosed: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  canManage: boolean;
  [key: string]: unknown;
}

function StatusNodeComponent({ id, data }: NodeProps) {
  const { name, color, isDefault, isClosed, onEdit, onDelete, canManage } = data as unknown as StatusNodeData;

  return (
    <div className="relative group">
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground !w-2 !h-2" />
      <div
        className="rounded-lg border bg-card shadow-sm min-w-[140px] overflow-hidden"
        style={{ borderTopColor: color, borderTopWidth: 3 }}
      >
        <div className="px-3 py-2 flex flex-col gap-1">
          <span className="text-sm font-semibold">{name}</span>
          <div className="flex items-center gap-1">
            {isDefault && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                Default
              </Badge>
            )}
            {isClosed && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                Closed
              </Badge>
            )}
          </div>
        </div>
        {canManage && (
          <div className="absolute -top-2 -right-2 hidden group-hover:flex gap-1">
            <Button
              variant="secondary"
              size="icon"
              className="size-6 rounded-full shadow-md"
              onClick={(e) => { e.stopPropagation(); onEdit(id); }}
            >
              <Pencil className="size-3" />
            </Button>
            {!isDefault && !isClosed && (
              <Button
                variant="destructive"
                size="icon"
                className="size-6 rounded-full shadow-md"
                onClick={(e) => { e.stopPropagation(); onDelete(id); }}
              >
                <Trash2 className="size-3" />
              </Button>
            )}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-muted-foreground !w-2 !h-2" />
    </div>
  );
}

export const StatusNode = memo(StatusNodeComponent);
