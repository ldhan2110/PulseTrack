import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCreateProject } from '@/hooks/useProjects';

// FieldGroup + Field composition per shadcn skill rules
function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-4">{children}</div>;
}

function Field({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5">{children}</div>;
}

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="text-[13px] font-semibold leading-none">
      {children}
    </label>
  );
}

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectDialog({ open, onOpenChange }: CreateProjectDialogProps) {
  const [name, setName] = useState('');
  const [prefix, setPrefix] = useState('');
  const [prefixError, setPrefixError] = useState('');
  const [description, setDescription] = useState('');
  const createProject = useCreateProject();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !prefix.trim() || prefixError) return;
    createProject.mutate(
      { name: name.trim(), prefix: prefix.trim(), description: description.trim() || undefined },
      {
        onSuccess: () => {
          setName('');
          setPrefix('');
          setPrefixError('');
          setDescription('');
          onOpenChange(false);
        },
      },
    );
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setName('');
      setPrefix('');
      setPrefixError('');
      setDescription('');
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[520px] max-w-full">
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="project-name">Name</FieldLabel>
              <Input
                id="project-name"
                placeholder="Enter project name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="project-prefix">Task Key Prefix *</FieldLabel>
              <Input
                id="project-prefix"
                placeholder="e.g. PM, ACME"
                value={prefix}
                onChange={(e) => {
                  const upper = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
                  setPrefix(upper);
                  if (upper && !/^[A-Z]{2,10}$/.test(upper)) {
                    setPrefixError('Must be 2-10 uppercase letters');
                  } else {
                    setPrefixError('');
                  }
                }}
              />
              {prefixError && <p className="text-xs text-destructive">{prefixError}</p>}
              {prefix && !prefixError && (
                <p className="text-xs text-muted-foreground">
                  Tasks will be: {prefix}-1, {prefix}-2, ...
                </p>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="project-description">Description</FieldLabel>
              <Textarea
                id="project-description"
                placeholder="Describe the project (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={createProject.isPending}
            >
              Discard
            </Button>
            <Button type="submit" disabled={!name.trim() || !prefix.trim() || !!prefixError || createProject.isPending}>
              {createProject.isPending ? 'Creating...' : 'Create Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
