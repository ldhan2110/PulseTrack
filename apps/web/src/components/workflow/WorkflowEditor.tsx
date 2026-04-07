import { useState, useCallback } from 'react';
import {
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  type Connection,
  type Edge,
  type Node,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWorkflow, useSaveWorkflow } from '@/hooks/useWorkflow';
import { useMembers } from '@/hooks/useMembers';
import { StatusNode, type StatusNodeData } from './StatusNode';
import { AssigneeRulePanel } from './AssigneeRulePanel';
import type { WorkflowStatus, SaveWorkflowPayload, AutoDateField, AutoDateAction } from '@/lib/types';

const nodeTypes = { statusNode: StatusNode };

const DATE_FIELD_LABELS: Record<AutoDateField, string> = {
  actualStartDate: 'Actual Start Date',
  actualEndDate: 'Actual End Date',
  plannedStartDate: 'Planned Start Date',
  plannedEndDate: 'Planned End Date',
};

interface StatusFormData {
  name: string;
  key: string;
  color: string;
  isDefault: boolean;
  isClosed: boolean;
  autoDateField: AutoDateField | null;
  autoDateAction: AutoDateAction | null;
}

const EMPTY_FORM: StatusFormData = {
  name: '',
  key: '',
  color: '#6b7280',
  isDefault: false,
  isClosed: false,
  autoDateField: null,
  autoDateAction: null,
};

function statusToNode(
  status: WorkflowStatus,
  position: { x: number; y: number },
  callbacks: { onEdit: (id: string) => void; onDelete: (id: string) => void },
  canManage: boolean,
): Node {
  return {
    id: status.id ?? status.key,
    type: 'statusNode',
    position,
    data: {
      name: status.name,
      color: status.color,
      key: status.key,
      isDefault: status.isDefault,
      isClosed: status.isClosed,
      onEdit: callbacks.onEdit,
      onDelete: callbacks.onDelete,
      canManage,
    } satisfies StatusNodeData,
  };
}

interface WorkflowEditorProps {
  projectId: string;
  canManage: boolean;
}

export function WorkflowEditor({ projectId, canManage }: WorkflowEditorProps) {
  const { data: workflow, isLoading } = useWorkflow(projectId);
  const { data: members = [] } = useMembers(projectId);
  const saveWorkflow = useSaveWorkflow(projectId);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [initialized, setInitialized] = useState(false);

  // Status editing
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [formData, setFormData] = useState<StatusFormData>(EMPTY_FORM);

  // Assignee rules
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);
  const [assigneeRules, setAssigneeRules] = useState<Record<string, string[]>>({});

  const handleEdit = useCallback((nodeId: string) => {
    setNodes((nds) => {
      const node = nds.find((n) => n.id === nodeId);
      if (!node) return nds;
      const d = node.data as unknown as StatusNodeData;
      setFormData({
        name: d.name,
        key: d.key,
        color: d.color,
        isDefault: d.isDefault,
        isClosed: d.isClosed,
        autoDateField: (d.autoDateField as AutoDateField) ?? null,
        autoDateAction: (d.autoDateAction as AutoDateAction) ?? null,
      });
      setEditingNodeId(nodeId);
      setEditDialogOpen(true);
      return nds;
    });
  }, [setNodes]);

  const handleDelete = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  }, [setNodes, setEdges]);

  // Initialize from workflow data
  if (workflow && !initialized) {
    const layout = (workflow.layout ?? {}) as Record<string, { x: number; y: number }>;
    const callbacks = { onEdit: handleEdit, onDelete: handleDelete };

    const initialNodes = workflow.statuses.map((s, i) => {
      const pos = layout[s.key] ?? { x: i * 220, y: 100 };
      return statusToNode(s, pos, callbacks, canManage);
    });

    const initialEdges: Edge[] = workflow.transitions.map((t) => ({
      id: `${t.fromStatusId}-${t.toStatusId}`,
      source: t.fromStatusId,
      target: t.toStatusId,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { strokeWidth: 2 },
    }));

    // Initialize assignee rules
    const statusById = Object.fromEntries(workflow.statuses.map((s) => [s.id, s]));
    const rules: Record<string, string[]> = {};
    for (const [statusId, ruleMembers] of Object.entries(workflow.assigneeRules)) {
      const status = statusById[statusId];
      if (status) {
        rules[status.key] = ruleMembers.map((m) => m.memberId);
      }
    }

    setNodes(initialNodes);
    setEdges(initialEdges);
    setAssigneeRules(rules);
    setInitialized(true);
  }

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!canManage) return;
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { strokeWidth: 2 },
          },
          eds,
        ),
      );
    },
    [canManage, setEdges],
  );

  const handleAddStatus = () => {
    setFormData(EMPTY_FORM);
    setEditingNodeId(null);
    setEditDialogOpen(true);
  };

  const handleFormSave = () => {
    if (editingNodeId) {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === editingNodeId
            ? {
                ...n,
                data: {
                  ...formData,
                  onEdit: handleEdit,
                  onDelete: handleDelete,
                  canManage,
                } satisfies StatusNodeData,
              }
            : n,
        ),
      );
    } else {
      const id = `new_${Date.now()}`;
      const maxX = Math.max(0, ...nodes.map((n) => n.position.x));
      const newNode: Node = {
        id,
        type: 'statusNode',
        position: { x: maxX + 220, y: 100 },
        data: {
          ...formData,
          onEdit: handleEdit,
          onDelete: handleDelete,
          canManage,
        } satisfies StatusNodeData,
      };
      setNodes((nds) => [...nds, newNode]);
    }

    setEditDialogOpen(false);
  };

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const d = node.data as unknown as StatusNodeData;
    setSelectedNodeKey(d.key);
  }, []);

  const handleToggleAssignee = (memberId: string) => {
    if (!selectedNodeKey) return;
    setAssigneeRules((prev) => {
      const current = prev[selectedNodeKey] ?? [];
      const next = current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId];
      return { ...prev, [selectedNodeKey]: next };
    });
  };

  const handleSave = () => {
    const statuses = nodes.map((n, i) => {
      const d = n.data as unknown as StatusNodeData;
      return {
        name: d.name,
        key: d.key,
        color: d.color,
        position: i,
        isDefault: d.isDefault,
        isClosed: d.isClosed,
        autoDateField: (d.autoDateField as AutoDateField) ?? null,
        autoDateAction: (d.autoDateAction as AutoDateAction) ?? null,
      };
    });

    const nodeKeyById = Object.fromEntries(
      nodes.map((n) => [n.id, (n.data as unknown as StatusNodeData).key]),
    );

    const transitions = edges.map((e) => ({
      fromStatusKey: nodeKeyById[e.source],
      toStatusKey: nodeKeyById[e.target],
    }));

    const assigneeRulePayload = Object.entries(assigneeRules)
      .filter(([, ids]) => ids.length > 0)
      .map(([statusKey, memberIds]) => ({ statusKey, memberIds }));

    const layout: Record<string, { x: number; y: number }> = {};
    for (const n of nodes) {
      const d = n.data as unknown as StatusNodeData;
      layout[d.key] = { x: n.position.x, y: n.position.y };
    }

    const payload: SaveWorkflowPayload = {
      statuses,
      transitions,
      assigneeRules: assigneeRulePayload,
      layout,
    };

    saveWorkflow.mutate(payload, {
      onSuccess: () => {
        setInitialized(false);
      },
    });
  };

  const selectedNode = selectedNodeKey
    ? nodes.find((n) => (n.data as unknown as StatusNodeData).key === selectedNodeKey)
    : null;
  const selectedNodeData = selectedNode?.data as unknown as StatusNodeData | undefined;

  if (isLoading) return null;

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleAddStatus}>
            <Plus className="size-4 mr-1" />
            Add Status
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saveWorkflow.isPending}>
            <Save className="size-4 mr-1" />
            Save Workflow
          </Button>
        </div>
      )}

      <div className="flex border rounded-lg overflow-hidden" style={{ height: 500 }}>
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={canManage ? onNodesChange : undefined}
            onEdgesChange={canManage ? onEdgesChange : undefined}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            nodeTypes={nodeTypes}
            fitView
            nodesDraggable={canManage}
            nodesConnectable={canManage}
            elementsSelectable={canManage}
            deleteKeyCode={canManage ? 'Backspace' : null}
          >
            <Controls />
            <Background />
          </ReactFlow>
        </div>

        {selectedNodeData && (
          <AssigneeRulePanel
            statusName={selectedNodeData.name}
            statusKey={selectedNodeData.key}
            members={members}
            selectedMemberIds={assigneeRules[selectedNodeData.key] ?? []}
            onToggle={handleToggleAssignee}
            onClose={() => setSelectedNodeKey(null)}
          />
        )}
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingNodeId ? 'Edit Status' : 'Add Status'}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => {
                  const name = e.target.value;
                  const key = name.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_');
                  setFormData((f) => ({ ...f, name, key: editingNodeId ? f.key : key }));
                }}
                placeholder="e.g. In Review"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Key</Label>
              <Input
                value={formData.key}
                onChange={(e) => setFormData((f) => ({ ...f, key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') }))}
                placeholder="e.g. IN_REVIEW"
                disabled={!!editingNodeId}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData((f) => ({ ...f, color: e.target.value }))}
                  className="size-8 rounded border cursor-pointer"
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData((f) => ({ ...f, color: e.target.value }))}
                  className="w-28"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Default status for new tasks</Label>
              <Switch
                checked={formData.isDefault}
                onCheckedChange={(v) => setFormData((f) => ({ ...f, isDefault: v }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Closed (counts as "done")</Label>
              <Switch
                checked={formData.isClosed}
                onCheckedChange={(v) => setFormData((f) => ({ ...f, isClosed: v }))}
              />
            </div>
            <div className="border-t pt-3 mt-1 flex flex-col gap-3">
              <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Date Automation</Label>
              <div className="flex flex-col gap-1.5">
                <Label>Action on enter</Label>
                <Select
                  value={formData.autoDateAction ?? 'none'}
                  onValueChange={(v) => setFormData((f) => ({
                    ...f,
                    autoDateAction: v === 'none' ? null : (v as AutoDateAction),
                    autoDateField: v === 'none' ? null : f.autoDateField,
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="set">Set date to now</SelectItem>
                    <SelectItem value="clear">Clear date</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.autoDateAction && (
                <div className="flex flex-col gap-1.5">
                  <Label>Date field</Label>
                  <Select
                    value={formData.autoDateField ?? ''}
                    onValueChange={(v) => setFormData((f) => ({ ...f, autoDateField: v as AutoDateField }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a date field" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(DATE_FIELD_LABELS) as [AutoDateField, string][]).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleFormSave} disabled={!formData.name || !formData.key || (!!formData.autoDateAction && !formData.autoDateField)}>
              {editingNodeId ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
