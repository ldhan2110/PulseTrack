import { useState } from 'react';
import { Plus, Pencil, Trash2, Wrench } from 'lucide-react';
import { RichTextEditor } from '@/components/tasks/RichTextEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSkills, useCreateSkill, useUpdateSkill, useDeleteSkill } from '@/hooks/useSkills';
import type { Skill } from '@/lib/types';

interface Props {
  projectId: string;
  canManage: boolean;
}

// ponytail: slug for the stable key; future runtime looks skills up by it. Users never type it.
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function SkillsSection({ projectId, canManage }: Props) {
  const { data: skills } = useSkills(projectId);
  const createSkill = useCreateSkill(projectId);
  const updateSkill = useUpdateSkill(projectId);
  const deleteSkill = useDeleteSkill(projectId);

  const [editing, setEditing] = useState<Skill | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Skill | null>(null);

  if (!canManage) return null;

  const openCreate = () => {
    setEditing(null);
    setIsNew(true);
    setName('');
    setDescription('');
    setContent('');
  };

  const openEdit = (skill: Skill) => {
    setEditing(skill);
    setIsNew(false);
    setName(skill.name);
    setDescription(skill.description ?? '');
    setContent(skill.content);
  };

  const closeDialog = () => {
    setEditing(null);
    setIsNew(false);
  };

  const dialogOpen = isNew || editing !== null;

  const handleSave = async () => {
    if (isNew) {
      await createSkill.mutateAsync({
        key: slugify(name),
        name,
        description: description || undefined,
        content,
      });
    } else if (editing) {
      await updateSkill.mutateAsync({
        skillId: editing.id,
        data: { name, description: description || undefined, content },
      });
    }
    closeDialog();
  };

  const saving = createSkill.isPending || updateSkill.isPending;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Wrench className="size-5" />
          Skills
        </CardTitle>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-4" />
          New Skill
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {!skills?.length && (
          <p className="text-sm text-muted-foreground">No skills yet.</p>
        )}
        {skills?.map((skill) => (
          <div
            key={skill.id}
            className="flex items-center justify-between rounded-md border p-3"
          >
            <div className="min-w-0">
              <p className="font-medium truncate">{skill.name}</p>
              {skill.description && (
                <p className="text-sm text-muted-foreground truncate">{skill.description}</p>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Switch
                checked={skill.enabled}
                onCheckedChange={(enabled) =>
                  updateSkill.mutate({ skillId: skill.id, data: { enabled } })
                }
              />
              <Button variant="ghost" size="icon" onClick={() => openEdit(skill)}>
                <Pencil className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(skill)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="w-[90vw] max-w-5xl sm:max-w-5xl px-8 pb-8 pt-3">
          <DialogHeader className="pr-10">
            <DialogTitle>{isNew ? 'New Skill' : 'Edit Skill'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-2">
            <div className="space-y-2">
              <Label htmlFor="skill-name">Name</Label>
              <Input
                id="skill-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Wiki Generation"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="skill-desc">Description</Label>
              <Input
                id="skill-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <RichTextEditor
                key={editing?.id ?? 'new'}
                initialContent={content}
                onSave={setContent}
                onChange={setContent}
                editable
                alwaysEditing
                contentMaxHeight="max-h-[480px]"
                placeholder="Write skill content…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim() || !content.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete skill?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) deleteSkill.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
