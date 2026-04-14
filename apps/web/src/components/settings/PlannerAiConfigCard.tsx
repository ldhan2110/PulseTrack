import { useState, useEffect, useMemo } from 'react';
import { Wand2, Eye, EyeOff, Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  usePlannerAiConfig,
  useUpsertPlannerAiConfig,
  useOpenRouterModels,
} from '@/hooks/usePlannerAiConfig';

const PINNED_MODEL_IDS = new Set([
  'anthropic/claude-sonnet-4',
  'anthropic/claude-opus-4',
  'google/gemini-2.5-pro',
  'openai/gpt-4.1',
  'deepseek/deepseek-r1',
]);

function formatPrice(perToken: string): string {
  const val = parseFloat(perToken) * 1_000_000;
  if (val === 0) return 'free';
  if (val < 0.01) return `$${val.toFixed(4)}/M`;
  return `$${val.toFixed(2)}/M`;
}

interface Props {
  projectId: string;
  canManage: boolean;
}

export function PlannerAiConfigCard({ projectId, canManage }: Props) {
  const { data: config } = usePlannerAiConfig(projectId);
  const upsert = useUpsertPlannerAiConfig(projectId);
  const { data: allModels, isLoading: modelsLoading } = useOpenRouterModels();

  const [model, setModel] = useState('anthropic/claude-sonnet-4');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (config && !initialized) {
      setModel(config.model);
      setApiKey('');
      setInitialized(true);
    }
  }, [config, initialized]);

  const { pinned, filtered } = useMemo(() => {
    if (!allModels) return { pinned: [], filtered: [] };

    const pinnedModels = allModels.filter((m) => PINNED_MODEL_IDS.has(m.id));
    const lowerSearch = search.toLowerCase();

    const rest = lowerSearch
      ? allModels
          .filter(
            (m) =>
              !PINNED_MODEL_IDS.has(m.id) &&
              (m.id.toLowerCase().includes(lowerSearch) ||
                m.name.toLowerCase().includes(lowerSearch)),
          )
          .slice(0, 50)
      : [];

    return { pinned: pinnedModels, filtered: rest };
  }, [allModels, search]);

  const selectedLabel = useMemo(() => {
    if (!allModels) return model;
    const found = allModels.find((m) => m.id === model);
    return found ? found.name : model;
  }, [allModels, model]);

  const handleSave = () => {
    upsert.mutate({
      provider: 'openrouter',
      model,
      ...(apiKey && { apiKey }),
    });
    setInitialized(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Wand2 className="size-5 text-blue-500" />
          <CardTitle>Planner AI (OpenRouter)</CardTitle>
        </div>
        <CardDescription>
          Configure OpenRouter as the AI provider for the Project Planner.
          Falls back to the general AI configuration if not set.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Model</Label>
          <Popover open={comboOpen} onOpenChange={setComboOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={comboOpen}
                className="w-full justify-between font-normal"
                disabled={!canManage}
              >
                <span className="truncate">{selectedLabel || 'Select a model...'}</span>
                <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Search models..."
                  value={search}
                  onValueChange={setSearch}
                />
                <CommandList>
                  {modelsLoading && (
                    <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Loading models...
                    </div>
                  )}

                  {!modelsLoading && pinned.length === 0 && filtered.length === 0 && (
                    <CommandEmpty>
                      {search ? (
                        <span className="text-xs text-muted-foreground">
                          No models found. Using custom: <strong>{search}</strong>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Type to search models...
                        </span>
                      )}
                    </CommandEmpty>
                  )}

                  {pinned.length > 0 && (
                    <CommandGroup heading="Popular">
                      {pinned.map((m) => (
                        <CommandItem
                          key={m.id}
                          value={m.id}
                          onSelect={() => {
                            setModel(m.id);
                            setComboOpen(false);
                            setSearch('');
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 size-4 shrink-0',
                              model === m.id ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                          <span className="flex-1 truncate">{m.name}</span>
                          <span className="ml-2 text-[10px] text-muted-foreground whitespace-nowrap">
                            {formatPrice(m.pricing.prompt)}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}

                  {filtered.length > 0 && (
                    <CommandGroup heading={`Results (${filtered.length})`}>
                      {filtered.map((m) => (
                        <CommandItem
                          key={m.id}
                          value={m.id}
                          onSelect={() => {
                            setModel(m.id);
                            setComboOpen(false);
                            setSearch('');
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 size-4 shrink-0',
                              model === m.id ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                          <span className="flex-1 truncate">{m.name}</span>
                          <span className="ml-2 text-[10px] text-muted-foreground whitespace-nowrap">
                            {formatPrice(m.pricing.prompt)}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}

                  {search && !filtered.find((m) => m.id === search) && (
                    <CommandGroup heading="Custom">
                      <CommandItem
                        value={`custom:${search}`}
                        onSelect={() => {
                          setModel(search);
                          setComboOpen(false);
                          setSearch('');
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 size-4 shrink-0',
                            model === search ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                        <span className="flex-1 truncate">
                          Use &quot;{search}&quot;
                        </span>
                        <span className="ml-2 text-[10px] text-muted-foreground">custom</span>
                      </CommandItem>
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <p className="text-[11px] text-muted-foreground">{model}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="plannerApiKey">API Key</Label>
          <div className="relative">
            <Input
              id="plannerApiKey"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={config?.apiKey || 'Enter OpenRouter API key'}
              disabled={!canManage}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        {canManage && (
          <Button
            onClick={handleSave}
            disabled={upsert.isPending || !model.trim() || (!config && !apiKey)}
            size="sm"
          >
            {upsert.isPending ? 'Saving...' : 'Save Planner AI Settings'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
