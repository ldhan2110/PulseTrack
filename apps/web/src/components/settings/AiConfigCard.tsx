import { useState, useEffect } from 'react';
import { Bot, Eye, EyeOff, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useAiConfig, useUpsertAiConfig, useUpdateProjectContext, useGenerateProjectContext } from '@/hooks/useAiConfig';
import { useRepositoryConfig } from '@/hooks/useRepositoryConfig';
import type { AiProvider, AiAdapterType } from '@/lib/types';

const PROVIDER_MODELS: Record<Exclude<AiProvider, 'custom'>, string[]> = {
  claude: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash'],
  codex: ['o3', 'o4-mini', 'gpt-4.1'],
};

const CONTEXT_MAX_LENGTH = 10000;

interface Props {
  projectId: string;
  canManage: boolean;
}

export function AiConfigCard({ projectId, canManage }: Props) {
  const { data: config } = useAiConfig(projectId);
  const { data: repoConfig } = useRepositoryConfig(projectId);
  const upsert = useUpsertAiConfig(projectId);
  const updateContext = useUpdateProjectContext(projectId);
  const generateContext = useGenerateProjectContext(projectId);

  const [provider, setProvider] = useState<AiProvider>('claude');
  const [model, setModel] = useState('claude-sonnet-4-6');
  const [apiKey, setApiKey] = useState('');
  const [projectContext, setProjectContext] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [adapterType, setAdapterType] = useState<AiAdapterType>('openai');
  const [showKey, setShowKey] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (config && !initialized) {
      setProvider(config.provider);
      setModel(config.model);
      setApiKey('');
      setBaseUrl(config.baseUrl ?? '');
      setAdapterType(config.adapterType ?? 'openai');
      setProjectContext(config.projectContext ?? '');
      setInitialized(true);
    }
  }, [config, initialized]);

  // Update model list when provider changes
  const handleProviderChange = (value: AiProvider) => {
    setProvider(value);
    if (value === 'custom') {
      setModel('');
    } else {
      setModel(PROVIDER_MODELS[value][0]);
      setBaseUrl('');
      setAdapterType('openai');
    }
  };

  const handleSave = () => {
    upsert.mutate(
      {
        provider,
        model,
        apiKey: apiKey || (config?.apiKey ?? ''),
        ...(provider === 'custom' && baseUrl ? { baseUrl } : {}),
        ...(provider === 'custom' ? { adapterType } : {}),
      },
      { onSuccess: () => setInitialized(false) },
    );
  };

  const handleSaveContext = () => {
    updateContext.mutate({ projectContext });
  };

  const handleGenerate = () => {
    generateContext.mutate(undefined, {
      onSuccess: (data) => {
        setProjectContext(data.projectContext);
      },
    });
  };

  const canGenerate =
    repoConfig?.cloneStatus === 'cloned' &&
    config !== null &&
    config !== undefined &&
    !generateContext.isPending;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bot className="size-5 text-purple-500" />
          <CardTitle>AI Configuration</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>AI Provider</Label>
            <Select
              value={provider}
              onValueChange={(v) => handleProviderChange(v as AiProvider)}
              disabled={!canManage}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="claude">Claude</SelectItem>
                <SelectItem value="gemini">Gemini</SelectItem>
                <SelectItem value="codex">Codex</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Model</Label>
            {provider === 'custom' ? (
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="pu/claude-sonnet-4-6"
                disabled={!canManage}
              />
            ) : (
              <Select
                value={model}
                onValueChange={setModel}
                disabled={!canManage}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_MODELS[provider].map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {provider === 'custom' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>API Format</Label>
                <Select
                  value={adapterType}
                  onValueChange={(v) => setAdapterType(v as AiAdapterType)}
                  disabled={!canManage}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI Compatible</SelectItem>
                    <SelectItem value="anthropic">Anthropic Compatible</SelectItem>
                    <SelectItem value="gemini">Gemini Compatible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="baseUrl">Base URL</Label>
                <Input
                  id="baseUrl"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://your-llm-endpoint.com/v1"
                  disabled={!canManage}
                />
              </div>
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label htmlFor="apiKey">API Key</Label>
          <div className="relative">
            <Input
              id="apiKey"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={config?.apiKey || 'Enter API key'}
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
            disabled={upsert.isPending}
            size="sm"
          >
            {upsert.isPending ? 'Saving...' : 'Save AI Settings'}
          </Button>
        )}

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="projectContext">Project Context</Label>
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                disabled={!canGenerate}
                title={
                  !canGenerate
                    ? repoConfig?.cloneStatus !== 'cloned'
                      ? 'Clone repository first'
                      : 'Save AI configuration first'
                    : 'Scan codebase and generate context'
                }
              >
                <Sparkles className="size-4 mr-1" />
                {generateContext.isPending ? 'Generating...' : 'Generate with AI'}
              </Button>
            )}
          </div>
          <Textarea
            id="projectContext"
            value={projectContext}
            onChange={(e) => {
              if (e.target.value.length <= CONTEXT_MAX_LENGTH) {
                setProjectContext(e.target.value);
              }
            }}
            placeholder="Describe your project's tech stack, architecture, and conventions..."
            rows={5}
            disabled={!canManage || generateContext.isPending}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Provide context about your codebase for better AI results</span>
            <span>{projectContext.length} / {CONTEXT_MAX_LENGTH}</span>
          </div>
          {canManage && (
            <Button
              onClick={handleSaveContext}
              disabled={updateContext.isPending}
              size="sm"
            >
              {updateContext.isPending ? 'Saving...' : 'Save Context'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
