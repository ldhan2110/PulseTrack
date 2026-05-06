import { useRef, useCallback } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { Loader2 } from 'lucide-react';

interface LogEntry {
  level: string;
  message: string;
  timestamp: number;
}

interface AutomationEditorProps {
  script: string;
  onChange: (value: string) => void;
  logs: LogEntry[];
  isSaving: boolean;
}

export function AutomationEditor({
  script,
  onChange,
  logs,
  isSaving,
}: AutomationEditorProps) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const handleEditorMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
  }, []);

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) onChange(value);
    },
    [onChange],
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b">
        <span className="text-[10px] text-muted-foreground font-mono">
          test-script.js
        </span>
        {isSaving && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Saving...
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <Editor
          defaultLanguage="javascript"
          value={script}
          onChange={handleChange}
          onMount={handleEditorMount}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            tabSize: 2,
            automaticLayout: true,
            padding: { top: 8, bottom: 8 },
            suggest: {
              showKeywords: true,
              showSnippets: true,
            },
          }}
          loading={
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Loading editor...
            </div>
          }
        />
      </div>

      <div className="h-[120px] border-t flex flex-col">
        <div className="flex items-center justify-between px-3 py-1 bg-muted/30 border-b">
          <span className="text-[10px] text-muted-foreground">Console</span>
          <span className="text-[9px] text-muted-foreground">
            {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-1.5 font-mono text-[10px] bg-background/50">
          {logs.length === 0 ? (
            <span className="text-muted-foreground">No output yet</span>
          ) : (
            logs.map((log, i) => (
              <div
                key={i}
                className={
                  log.level === 'error'
                    ? 'text-red-400'
                    : log.level === 'warn'
                      ? 'text-yellow-400'
                      : 'text-green-400'
                }
              >
                {log.message}
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}
