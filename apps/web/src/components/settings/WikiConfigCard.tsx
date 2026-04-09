import { useState, useEffect } from 'react';
import { BookOpen, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useWikiConfig, useUpsertWikiConfig } from '@/hooks/useWiki';
import { useWikiGeneration } from '@/hooks/useWikiGeneration';

const ALL_SECTIONS = [
  'architecture', 'modules', 'features', 'business-logic',
  'api-reference', 'data-models', 'glossary',
];

const AUTO_UPDATE_OPTIONS = [
  { value: 'manual', label: 'Manual Only' },
  { value: 'on-pull', label: 'On Git Pull' },
  { value: 'scheduled', label: 'Scheduled' },
];

interface Props {
  projectId: string;
  canManage: boolean;
}

export function WikiConfigCard({ projectId, canManage }: Props) {
  const { data: config } = useWikiConfig(projectId);
  const upsert = useUpsertWikiConfig(projectId);
  const { generate, step, isActive } = useWikiGeneration(projectId);

  const [wikiPath, setWikiPath] = useState('');
  const [autoUpdate, setAutoUpdate] = useState('manual');
  const [sections, setSections] = useState<string[]>(ALL_SECTIONS);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (config && !initialized) {
      setWikiPath(config.wikiPath);
      setAutoUpdate(config.autoUpdate);
      setSections(config.sections);
      setInitialized(true);
    }
  }, [config, initialized]);

  useEffect(() => {
    if (!config && !initialized && projectId) {
      setWikiPath(`/wiki/${projectId}`);
      setInitialized(true);
    }
  }, [config, initialized, projectId]);

  const toggleSection = (section: string) => {
    setSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section],
    );
  };

  const handleSave = () => {
    upsert.mutate({ wikiPath, autoUpdate, sections });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BookOpen className="size-5 text-blue-500" />
          <CardTitle>Wiki</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Wiki Storage Path</Label>
          <Input
            value={wikiPath}
            onChange={(e) => setWikiPath(e.target.value)}
            placeholder="/wiki/project-id"
            disabled={!canManage}
          />
        </div>

        <div className="space-y-2">
          <Label>Auto-Update Mode</Label>
          <div className="flex gap-2">
            {AUTO_UPDATE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => canManage && setAutoUpdate(opt.value)}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  autoUpdate === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
                disabled={!canManage}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Wiki Sections</Label>
          <div className="flex flex-wrap gap-2">
            {ALL_SECTIONS.map((section) => (
              <Badge
                key={section}
                variant={sections.includes(section) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => canManage && toggleSection(section)}
              >
                {sections.includes(section) ? '✓ ' : '+ '}
                {section}
              </Badge>
            ))}
          </div>
        </div>

        {config?.lastGeneratedAt && (
          <p className="text-xs text-muted-foreground">
            Last generated: {new Date(config.lastGeneratedAt).toLocaleString()}
          </p>
        )}

        {canManage && (
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={upsert.isPending}>
              {upsert.isPending ? 'Saving...' : 'Save Settings'}
            </Button>
            <Button
              variant="outline"
              onClick={() => generate.mutate()}
              disabled={isActive || generate.isPending}
            >
              <RefreshCw className={`size-4 mr-2 ${isActive ? 'animate-spin' : ''}`} />
              {isActive ? `Generating (${step})...` : 'Generate Wiki Now'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
