import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, FolderKanban, Loader2 } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';

// Header search bar with an anchored results dropdown (not a centered modal).
// Fluid width: caps at 360px on desktop, fills available header space on mobile.
export function GlobalSearch() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');

  // Cmd/Ctrl+K focuses the bar (and opens the dropdown).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Close on click outside.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Debounce the typed input into the query that fires the request (200ms).
  useEffect(() => {
    const t = setTimeout(() => setQ(input), 200);
    return () => clearTimeout(t);
  }, [input]);

  const { data, isFetching } = useGlobalSearch(q);
  const trimmed = q.trim();
  const hasQuery = trimmed.length >= 2;
  const projects = data?.projects ?? [];
  const tasks = data?.tasks ?? [];
  const hasResults = projects.length > 0 || tasks.length > 0;

  const go = (path: string) => {
    setOpen(false);
    setInput('');
    setQ('');
    inputRef.current?.blur();
    navigate(path);
  };

  return (
    <div ref={rootRef} className="relative w-full max-w-[360px]">
      <Command
        shouldFilter={false}
        className="overflow-visible bg-transparent p-0"
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
      >
        <CommandInput
          ref={inputRef}
          placeholder="Search projects and tasks…"
          value={input}
          onValueChange={setInput}
          onFocus={() => setOpen(true)}
        />

        {open && (
          <div className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
            <CommandList>
              {!hasQuery && (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  <p>Type to search projects and tasks.</p>
                  <p className="mt-1 text-xs">
                    Tip: enter a task key like{' '}
                    <span className="font-medium text-foreground">PM-42</span> to
                    jump straight to it.
                  </p>
                </div>
              )}

              {hasQuery && isFetching && !hasResults && (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Searching…
                </div>
              )}

              {hasQuery && !isFetching && !hasResults && (
                <CommandEmpty>
                  No projects or tasks match “{trimmed}”.
                </CommandEmpty>
              )}

              {projects.length > 0 && (
                <CommandGroup heading="Projects">
                  {projects.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={`project-${p.id}`}
                      onSelect={() => go(`/projects/${p.prefix}/dashboard`)}
                      className="[&>svg:last-child]:hidden"
                    >
                      <FolderKanban className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{p.name}</span>
                      {p.prefix && (
                        <Badge variant="secondary" className="ml-auto">
                          {p.prefix}
                        </Badge>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {tasks.length > 0 && (
                <CommandGroup heading="Tasks">
                  {tasks.map((t) => (
                    <CommandItem
                      key={t.id}
                      value={`task-${t.id}`}
                      onSelect={() =>
                        go(`/projects/${t.projectPrefix}/tasks/${t.taskKey}`)
                      }
                      className="[&>svg:last-child]:hidden"
                    >
                      <CheckSquare className="mt-0.5 size-4 shrink-0 self-start text-muted-foreground" />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate">{t.title}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {t.projectName}
                          {t.statusName ? ` · ${t.statusName}` : ''}
                        </span>
                      </div>
                      {t.taskKey && (
                        <Badge variant="outline" className="ml-auto self-start">
                          {t.taskKey}
                        </Badge>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </div>
        )}
      </Command>
    </div>
  );
}
