import { useState, useEffect } from 'react';
import { Wand2, Eye, EyeOff, Check, ChevronsUpDown } from 'lucide-react';
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
import { usePlannerAiConfig, useUpsertPlannerAiConfig } from '@/hooks/usePlannerAiConfig';

const POPULAR_MODELS = [
  { value: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4' },
  { value: 'anthropic/claude-opus-4', label: 'Claude Opus 4' },
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'openai/gpt-4.1', label: 'GPT-4.1' },
  { value: 'deepseek/deepseek-r1', label: 'DeepSeek R1' },
];

interface Props {
  projectId: string;
  canManage: boolean;
}

export function PlannerAiConfigCard({ projectId, canManage }: Props) {
  const { data: config } = usePlannerAiConfig(projectId);
  const upsert = useUpsertPlannerAiConfig(projectId);

  const [model, setModel] = useState('anthropic/claude-sonnet-4');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (config && !initialized) {
      setModel(config.model);
      setApiKey('');
      setInitialized(true);
    }
  }, [config, initialized]);

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
                {model || 'Select a model...'}
                <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
              <Command>
                <CommandInput
                  placeholder="Search or type model slug..."
                  value={model}
                  onValueChange={setModel}
                />
                <CommandList>
                  <CommandEmpty>
                    <span className="text-xs text-muted-foreground">
                      Using custom model: <strong>{model}</strong>
                    </span>
                  </CommandEmpty>
                  <CommandGroup heading="Popular models">
                    {POPULAR_MODELS.map((m) => (
                      <CommandItem
                        key={m.value}
                        value={m.value}
                        onSelect={(value) => {
                          setModel(value);
                          setComboOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 size-4',
                            model === m.value ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                        <span className="flex-1">{m.label}</span>
                        <span className="text-xs text-muted-foreground">{m.value}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
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
