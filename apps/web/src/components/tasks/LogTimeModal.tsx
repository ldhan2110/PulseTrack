import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface LogTimeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { minutes: number; comment?: string; loggedAt?: string }) => void;
  isLoading?: boolean;
}

export function LogTimeModal({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: LogTimeModalProps) {
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [comment, setComment] = useState('');
  const [loggedAt, setLoggedAt] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setHours('');
      setMinutes('');
      setComment('');
      setLoggedAt(new Date().toISOString().split('T')[0]);
    }
  }, [open]);

  const totalMinutes = (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0);

  const handleSubmit = () => {
    if (totalMinutes <= 0) return;

    onSubmit({
      minutes: totalMinutes,
      comment: comment.trim() || undefined,
      loggedAt: loggedAt || undefined,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Log Time</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Hours</label>
              <input
                type="number"
                min={0}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="0"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                autoFocus
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Minutes</label>
              <input
                type="number"
                min={0}
                max={59}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="0"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-[1.5]">
              <label className="text-xs text-muted-foreground mb-1 block">Date</label>
              <input
                type="date"
                value={loggedAt}
                onChange={(e) => setLoggedAt(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Comment</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What did you work on?"
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={isLoading || totalMinutes <= 0}>
            {isLoading ? 'Logging...' : 'Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
