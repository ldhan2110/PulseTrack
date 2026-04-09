import { useState } from 'react';
import { MessageSquarePlus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  useWikiAnnotations,
  useCreateWikiAnnotation,
  useUpdateWikiAnnotation,
  useDeleteWikiAnnotation,
} from '@/hooks/useWiki';
import type { WikiAnnotation } from '@/lib/types';

interface Props {
  projectId: string;
  pagePath: string;
  currentUserId: string;
}

export function WikiAnnotations({ projectId, pagePath, currentUserId }: Props) {
  const { data: annotations = [] } = useWikiAnnotations(projectId, pagePath);
  const createAnnotation = useCreateWikiAnnotation(projectId);
  const updateAnnotation = useUpdateWikiAnnotation(projectId);
  const deleteAnnotation = useDeleteWikiAnnotation(projectId);

  const [showForm, setShowForm] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newSectionRef, setNewSectionRef] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const handleCreate = () => {
    if (!newContent.trim()) return;
    createAnnotation.mutate(
      { pagePath, sectionRef: newSectionRef || undefined, content: newContent },
      {
        onSuccess: () => {
          setNewContent('');
          setNewSectionRef('');
          setShowForm(false);
        },
      },
    );
  };

  const handleUpdate = (annotationId: string) => {
    if (!editContent.trim()) return;
    updateAnnotation.mutate(
      { annotationId, content: editContent },
      { onSuccess: () => setEditingId(null) },
    );
  };

  return (
    <div className="border-t pt-4 mt-6">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-amber-500 flex items-center gap-1.5">
          Team Annotations ({annotations.length})
        </h4>
        <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
          <MessageSquarePlus className="size-3.5 mr-1.5" />
          Add Note
        </Button>
      </div>

      {showForm && (
        <div className="space-y-2 mb-4 p-3 rounded-md bg-muted/50">
          <Input
            value={newSectionRef}
            onChange={(e) => setNewSectionRef(e.target.value)}
            placeholder="Section reference (e.g., Business Rules)"
            className="text-sm"
          />
          <Textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Write your annotation..."
            rows={3}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={createAnnotation.isPending}>
              {createAnnotation.isPending ? 'Saving...' : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {annotations.map((a: WikiAnnotation) => (
          <div key={a.id} className="border-l-[3px] border-amber-500 pl-3 py-2 rounded-r bg-muted/30">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-amber-500">{a.author.name || a.author.username}</span>
                {a.sectionRef && (
                  <span className="bg-muted px-1.5 py-0.5 rounded text-muted-foreground">re: {a.sectionRef}</span>
                )}
                <span className="text-muted-foreground">{new Date(a.createdAt).toLocaleDateString()}</span>
              </div>
              {a.authorId === currentUserId && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    onClick={() => { setEditingId(a.id); setEditContent(a.content); }}
                  >
                    <Pencil className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    onClick={() => deleteAnnotation.mutate(a.id)}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              )}
            </div>
            {editingId === a.id ? (
              <div className="space-y-2 mt-2">
                <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={2} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleUpdate(a.id)} disabled={updateAnnotation.isPending}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-foreground/80">{a.content}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
