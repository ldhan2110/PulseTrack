// apps/web/src/components/tasks/GenerateTasksModal.tsx
import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Sparkles, Upload, X, FileText } from 'lucide-react';
import type { AiGenerationStep } from '@/lib/types';

const STEP_LABELS: Record<string, string> = {
  queued: 'Queued — waiting for available slot...',
  pulling: 'Pulling latest code...',
  scanning: 'Scanning codebase with code-graph...',
  generating: 'Generating tasks with AI...',
  parsing: 'Parsing results...',
};

const STEP_PROGRESS: Record<string, number> = {
  queued: 10,
  pulling: 25,
  scanning: 45,
  generating: 70,
  parsing: 90,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (formData: FormData) => void;
  isProcessing: boolean;
  step: AiGenerationStep | 'idle' | 'queued' | 'completed' | 'failed';
}

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = '.pdf,.docx,.txt,.md,.png,.jpg,.jpeg';

export function GenerateTasksModal({ open, onOpenChange, onSubmit, isProcessing, step }: Props) {
  const [prompt, setPrompt] = useState('');
  const [scanCodebase, setScanCodebase] = useState(false);
  const [breakIntoSubTasks, setBreakIntoSubTasks] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    const valid = selected.filter((f) => f.size <= MAX_FILE_SIZE);
    setFiles((prev) => [...prev, ...valid].slice(0, MAX_FILES));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (prompt.trim().length < 10) return;
    const formData = new FormData();
    formData.append('prompt', prompt.trim());
    formData.append('scanCodebase', String(scanCodebase));
    formData.append('breakIntoSubTasks', String(breakIntoSubTasks));
    files.forEach((f) => formData.append('documents', f));
    onSubmit(formData);
  };

  const canSubmit = prompt.trim().length >= 10 && !isProcessing;

  return (
    <Dialog open={open} onOpenChange={isProcessing ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-purple-500" />
            Generate Tasks with AI
          </DialogTitle>
        </DialogHeader>

        {isProcessing ? (
          <div className="py-8 space-y-4">
            <div className="text-sm text-muted-foreground text-center">
              {STEP_LABELS[step] ?? 'Processing...'}
            </div>
            <Progress value={STEP_PROGRESS[step] ?? 0} className="h-2" />
            <p className="text-xs text-center text-muted-foreground">
              You can close this dialog — we'll notify you when it's done.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ai-prompt">
                Describe the tasks you need
              </Label>
              <Textarea
                id="ai-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Create tasks for implementing a user authentication system with login, registration, and password reset..."
                rows={4}
                maxLength={5000}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Minimum 10 characters</span>
                <span>{prompt.length} / 5000</span>
              </div>
            </div>

            {/* File upload */}
            <div className="space-y-2">
              <Label>Reference Documents (optional)</Label>
              <div
                className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-5 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-1">
                  Click to upload PDFs, docs, or images
                </p>
                <p className="text-xs text-muted-foreground">
                  Max {MAX_FILES} files, 10MB each
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_TYPES}
                onChange={handleFileSelect}
                className="hidden"
              />
              {files.length > 0 && (
                <div className="space-y-1">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm bg-muted rounded px-2 py-1">
                      <FileText className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate flex-1">{f.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {(f.size / 1024).toFixed(0)}KB
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Toggles */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="scan-codebase" className="text-sm font-medium">
                    Scan Codebase
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    AI scans relevant code using code-graph for better context
                  </p>
                </div>
                <Switch
                  id="scan-codebase"
                  checked={scanCodebase}
                  onCheckedChange={setScanCodebase}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="break-subtasks" className="text-sm font-medium">
                    Break into Sub-tasks
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    AI generates parent tasks with detailed sub-tasks
                  </p>
                </div>
                <Switch
                  id="break-subtasks"
                  checked={breakIntoSubTasks}
                  onCheckedChange={setBreakIntoSubTasks}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {!isProcessing && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!canSubmit}>
                <Sparkles className="size-4 mr-1" />
                Generate
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
