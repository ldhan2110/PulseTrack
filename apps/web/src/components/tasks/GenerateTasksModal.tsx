// apps/web/src/components/tasks/GenerateTasksModal.tsx
import { useState, useRef, useEffect } from 'react';
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
import { Sparkles, Upload, X, FileText, AlertCircle, RotateCcw, Terminal, Code } from 'lucide-react';
import type { AiGenerationStep } from '@/lib/types';

const STEP_LABELS: Record<string, string> = {
  queued: 'Queued — waiting for available slot...',
  pulling: 'Pulling latest code...',
  'building-graph': 'Building code knowledge graph...',
  scanning: 'Scanning codebase with code-graph...',
  generating: 'Generating tasks with AI...',
  parsing: 'Parsing results...',
};

const STEP_PROGRESS: Record<string, number> = {
  queued: 10,
  pulling: 20,
  'building-graph': 35,
  scanning: 50,
  generating: 72,
  parsing: 90,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (formData: FormData) => void;
  isProcessing: boolean;
  step: AiGenerationStep | 'idle' | 'queued' | 'completed' | 'failed';
  error?: string | null;
  displayLines?: string[];
  rawText?: string;
  onCancel?: () => void;
  onRetry?: () => void;
}

function TerminalOutput({
  displayLines,
  rawText,
}: {
  displayLines: string[];
  rawText: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showRaw, setShowRaw] = useState(false);

  const hasDisplayLines = displayLines.length > 0;

  // Auto-scroll on new content
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [displayLines, rawText, showRaw]);

  // For raw view, show last ~60 lines
  const rawLines = rawText.split('\n');
  const rawDisplay = rawLines.length > 60 ? rawLines.slice(-60).join('\n') : rawText;

  // For display view, show last ~30 lines
  const visibleLines = displayLines.length > 30 ? displayLines.slice(-30) : displayLines;

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 border-b border-zinc-700">
        <span className="size-2.5 rounded-full bg-red-500/80" />
        <span className="size-2.5 rounded-full bg-yellow-500/80" />
        <span className="size-2.5 rounded-full bg-green-500/80" />
        <span className="ml-2 text-[10px] font-medium text-zinc-400 flex-1">
          {showRaw ? 'Raw Output' : 'AI Activity'}
        </span>
        {hasDisplayLines && (
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors px-1.5 py-0.5 rounded hover:bg-zinc-700/50"
          >
            {showRaw ? (
              <>
                <Terminal className="size-3" />
                Activity
              </>
            ) : (
              <>
                <Code className="size-3" />
                Raw
              </>
            )}
          </button>
        )}
      </div>
      <div ref={scrollRef} className="max-h-56 overflow-y-auto p-3">
        {showRaw || !hasDisplayLines ? (
          <pre className="text-xs font-mono whitespace-pre-wrap wrap-break-word text-zinc-300 leading-relaxed">
            {rawDisplay || 'Waiting for output...'}
            <span className="inline-block w-1.5 h-3.5 bg-zinc-400 animate-pulse ml-0.5 align-text-bottom" />
          </pre>
        ) : (
          <div className="space-y-0.5">
            {visibleLines.map((line, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-xs font-mono text-zinc-300"
              >
                <span className="text-emerald-500 shrink-0 mt-px">{'>'}</span>
                <span className="wrap-break-word">{line}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
              <span className="text-emerald-500 shrink-0">{'>'}</span>
              <span className="inline-block w-1.5 h-3.5 bg-zinc-400 animate-pulse align-text-bottom" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = '.pdf,.docx,.txt,.md,.png,.jpg,.jpeg';

export function GenerateTasksModal({ open, onOpenChange, onSubmit, isProcessing, step, error, displayLines, rawText, onCancel, onRetry }: Props) {
  const [prompt, setPrompt] = useState('');
  const [scanCodebase, setScanCodebase] = useState(false);
  const [breakIntoSubTasks, setBreakIntoSubTasks] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form state when modal closes
  useEffect(() => {
    if (!open) {
      setPrompt('');
      setScanCodebase(false);
      setBreakIntoSubTasks(false);
      setFiles([]);
    }
  }, [open]);

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
      <DialogContent className={isProcessing ? 'sm:max-w-[680px]' : 'sm:max-w-[560px]'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-purple-500" />
            Generate Tasks with AI
          </DialogTitle>
        </DialogHeader>

        {step === 'failed' ? (
          <div className="py-8 space-y-4">
            <div className="flex flex-col items-center gap-3 text-center">
              <AlertCircle className="size-10 text-destructive" />
              <h3 className="text-base font-semibold">Generation Failed</h3>
              <p className="text-sm text-muted-foreground max-w-[400px]">
                {error ?? 'An unexpected error occurred'}
              </p>
            </div>
          </div>
        ) : isProcessing ? (
          <div className="py-4 space-y-4">
            <div className="text-sm text-muted-foreground text-center">
              {STEP_LABELS[step] ?? 'Processing...'}
            </div>
            <Progress value={STEP_PROGRESS[step] ?? 0} className="h-2" />
            <TerminalOutput
              displayLines={displayLines ?? []}
              rawText={rawText ?? ''}
            />
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
          {step === 'failed' ? (
            <>
              <Button variant="outline" onClick={() => { onRetry?.(); }}>
                Close
              </Button>
              <Button onClick={() => { onRetry?.(); }}>
                <RotateCcw className="size-4 mr-1" />
                Try Again
              </Button>
            </>
          ) : isProcessing ? (
            <Button variant="ghost" onClick={() => { onCancel?.(); }}>
              Cancel
            </Button>
          ) : (
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
