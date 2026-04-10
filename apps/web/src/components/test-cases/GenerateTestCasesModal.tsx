// apps/web/src/components/test-cases/GenerateTestCasesModal.tsx
import { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sparkles,
  Upload,
  X,
  AlertTriangle,
  RefreshCw,
  Search,
  Check,
} from 'lucide-react';
import type { Task, AiGenerationStep } from '@/lib/types';

const STEP_PROGRESS: Record<string, number> = {
  queued: 10,
  pulling: 20,
  'building-graph': 35,
  scanning: 50,
  generating: 72,
  parsing: 90,
};

const STEP_LABELS: Record<string, string> = {
  queued: 'Queued…',
  pulling: 'Pulling latest code…',
  'building-graph': 'Building code graph…',
  scanning: 'Scanning codebase…',
  generating: 'Generating test cases…',
  parsing: 'Parsing output…',
};

interface GenerateTestCasesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  isProcessing: boolean;
  step: AiGenerationStep | 'idle' | 'queued' | 'completed' | 'failed';
  error: string | null;
  rawText: string;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
  onRetry: () => void;
}

export function GenerateTestCasesModal({
  open,
  onOpenChange,
  tasks,
  isProcessing,
  step,
  error,
  rawText,
  onSubmit,
  onCancel,
  onRetry,
}: GenerateTestCasesModalProps) {
  const [prompt, setPrompt] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [generateSteps, setGenerateSteps] = useState(true);
  const [scanCodebase, setScanCodebase] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [taskSearch, setTaskSearch] = useState('');
  const [sprintFilter, setSprintFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const [showRaw, setShowRaw] = useState(false);

  const isIdle = step === 'idle';
  const isFailed = step === 'failed';

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [rawText]);

  // Reset form when closing
  useEffect(() => {
    if (!open) {
      setPrompt('');
      setSelectedTaskIds(new Set());
      setGenerateSteps(true);
      setScanCodebase(false);
      setFiles([]);
      setTaskSearch('');
      setSprintFilter('ALL');
      setStatusFilter('ALL');
      setShowRaw(false);
    }
  }, [open]);

  const toggleTask = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const filteredTasks = tasks.filter((t) => {
    if (taskSearch && !t.title.toLowerCase().includes(taskSearch.toLowerCase()) && !t.taskKey?.toLowerCase().includes(taskSearch.toLowerCase())) return false;
    if (sprintFilter !== 'ALL' && t.sprintId !== sprintFilter) return false;
    if (statusFilter !== 'ALL' && t.status?.name !== statusFilter) return false;
    return true;
  });

  // Collect unique sprints and statuses from tasks for filters
  const sprints = [...new Map(tasks.filter((t) => t.sprintId && t.sprint).map((t) => [t.sprintId, t.sprint!.name])).entries()];
  const statuses = [...new Set(tasks.map((t) => t.status?.name).filter(Boolean))] as string[];

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files ?? []);
    setFiles((prev) => [...prev, ...newFiles].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (selectedTaskIds.size === 0 || prompt.length < 10) return;
    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('taskIds', JSON.stringify([...selectedTaskIds]));
    formData.append('generateSteps', String(generateSteps));
    formData.append('scanCodebase', String(scanCodebase));
    for (const file of files) {
      formData.append('documents', file);
    }
    onSubmit(formData);
  };

  const canSubmit = selectedTaskIds.size > 0 && prompt.length >= 10;
  const progress = STEP_PROGRESS[step] ?? 0;

  return (
    <Dialog open={open} onOpenChange={isProcessing ? undefined : onOpenChange}>
      <DialogContent className="w-[40vw] max-w-none max-h-[85vh] overflow-y-auto" style={{ maxWidth: "none" }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4" />
            Generate Test Cases with AI
          </DialogTitle>
          <DialogDescription>
            Select user stories and provide instructions to generate test cases.
          </DialogDescription>
        </DialogHeader>

        {isIdle || isFailed ? (
          <>
            {isFailed && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <AlertTriangle className="size-4 shrink-0" />
                <span className="flex-1">{error}</span>
                <Button variant="ghost" size="sm" onClick={onRetry}>
                  <RefreshCw className="size-3.5 mr-1" /> Retry
                </Button>
              </div>
            )}

            {/* Task Selection */}
            <div className="space-y-2">
              <Label>Select User Stories</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    placeholder="Filter by title or key..."
                    className="h-8 pl-7 text-sm"
                  />
                </div>
                {sprints.length > 0 && (
                  <Select value={sprintFilter} onValueChange={setSprintFilter}>
                    <SelectTrigger className="h-8 w-[140px] text-xs">
                      <SelectValue placeholder="Sprint" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Sprints</SelectItem>
                      {sprints.map(([id, name]) => (
                        <SelectItem key={id} value={id!}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {statuses.length > 0 && (
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-8 w-[140px] text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Statuses</SelectItem>
                      {statuses.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="border rounded-md max-h-[180px] overflow-y-auto">
                {filteredTasks.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">No tasks found</div>
                ) : (
                  filteredTasks.map((task) => (
                    <div
                      key={task.id}
                      className={`flex items-center gap-3 px-3 py-2 border-b last:border-b-0 cursor-pointer hover:bg-muted/50 ${
                        selectedTaskIds.has(task.id) ? 'bg-primary/5' : ''
                      }`}
                      onClick={() => toggleTask(task.id)}
                    >
                      <div className={`size-4 rounded border flex items-center justify-center ${
                        selectedTaskIds.has(task.id) ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                      }`}>
                        {selectedTaskIds.has(task.id) && <Check className="size-3 text-primary-foreground" />}
                      </div>
                      {task.taskKey && (
                        <span className="text-xs font-medium text-primary shrink-0">{task.taskKey}</span>
                      )}
                      <span className="text-sm truncate flex-1">{task.title}</span>
                      {task.priority && (
                        <Badge variant="outline" className="text-[10px] shrink-0">{task.priority}</Badge>
                      )}
                    </div>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">{selectedTaskIds.size} story(ies) selected</p>
            </div>

            {/* Prompt */}
            <div className="space-y-2">
              <Label>Additional Instructions</Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., Focus on edge cases for invalid inputs, include API response validation, cover both UI and API layers..."
                className="min-h-[80px] resize-y"
                maxLength={5000}
              />
              <p className="text-xs text-muted-foreground">{prompt.length} / 5000</p>
            </div>

            {/* Toggles */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="generate-steps"
                  checked={generateSteps}
                  onCheckedChange={setGenerateSteps}
                />
                <Label htmlFor="generate-steps" className="text-sm cursor-pointer">
                  Generate Detailed Steps
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="scan-codebase"
                  checked={scanCodebase}
                  onCheckedChange={setScanCodebase}
                />
                <Label htmlFor="scan-codebase" className="text-sm cursor-pointer">
                  Scan Codebase
                </Label>
              </div>
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <div
                className="border-2 border-dashed rounded-md p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Drop files here or click to upload (max 5 files, 10MB each)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg"
                  onChange={handleFileAdd}
                  className="hidden"
                />
              </div>
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {files.map((file, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      {file.name}
                      <X className="size-3 cursor-pointer" onClick={() => removeFile(i)} />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!canSubmit}>
                <Sparkles className="size-3.5 mr-1.5" />
                Generate Test Cases
              </Button>
            </DialogFooter>
          </>
        ) : (
          /* Processing State */
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{STEP_LABELS[step] ?? 'Processing…'}</span>
                <span className="text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>

            <div
              ref={terminalRef}
              className="bg-[#0d1117] rounded-md p-3 font-mono text-xs text-[#8b949e] max-h-[250px] overflow-y-auto whitespace-pre-wrap"
            >
              {rawText || 'Waiting for output...'}
            </div>

            <div className="flex justify-between items-center">
              <Button variant="ghost" size="sm" onClick={() => setShowRaw(!showRaw)}>
                {showRaw ? 'Formatted' : 'Raw'} output
              </Button>
              <Button variant="outline" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
