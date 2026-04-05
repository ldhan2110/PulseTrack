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
import { Alert } from '@/components/ui/alert';
import { useCreateSprint } from '@/hooks/useSprints';
import type { Sprint } from '@/lib/types';

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
  required,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="text-[13px] font-semibold leading-none">
      {children}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  );
}

interface CreateSprintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  existingSprints: Sprint[];
}

interface FormErrors {
  name?: string;
  startDate?: string;
  endDate?: string;
  overlap?: string;
}

export function CreateSprintDialog({
  open,
  onOpenChange,
  projectId,
  existingSprints,
}: CreateSprintDialogProps) {
  const createSprint = useCreateSprint(projectId);

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  const resetForm = () => {
    setName('');
    setStartDate('');
    setEndDate('');
    setErrors({});
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) resetForm();
    onOpenChange(val);
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (startDate && endDate) {
      if (new Date(endDate) <= new Date(startDate)) {
        newErrors.endDate = 'End date must be after start date';
      }

      // Check for overlap with existing sprints (only non-closed ones)
      if (!newErrors.endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);

        const overlapping = existingSprints.find((s) => {
          if (s.status === 'CLOSED' || !s.startDate || !s.endDate) return false;
          const sStart = new Date(s.startDate);
          const sEnd = new Date(s.endDate);
          return start < sEnd && end > sStart;
        });

        if (overlapping) {
          newErrors.overlap = `Sprint dates overlap with ${overlapping.name}. Adjust the dates to continue.`;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    createSprint.mutate(
      {
        name: name.trim(),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      },
      {
        onSuccess: () => {
          resetForm();
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Create Sprint</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            {errors.overlap && (
              <Alert variant="destructive" className="text-sm">
                {errors.overlap}
              </Alert>
            )}

            <Field>
              <FieldLabel htmlFor="sprint-name" required>
                Name
              </FieldLabel>
              <Input
                id="sprint-name"
                placeholder="Sprint name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={!!errors.name}
                autoFocus
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name}</p>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="sprint-start">Start Date</FieldLabel>
                <Input
                  id="sprint-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  aria-invalid={!!errors.startDate}
                />
                {errors.startDate && (
                  <p className="text-xs text-destructive">{errors.startDate}</p>
                )}
              </Field>

              <Field>
                <FieldLabel htmlFor="sprint-end">End Date</FieldLabel>
                <Input
                  id="sprint-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  aria-invalid={!!errors.endDate}
                />
                {errors.endDate && (
                  <p className="text-xs text-destructive">{errors.endDate}</p>
                )}
              </Field>
            </div>
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={createSprint.isPending}
            >
              Discard
            </Button>
            <Button type="submit" disabled={createSprint.isPending}>
              {createSprint.isPending ? 'Creating...' : 'Create Sprint'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
