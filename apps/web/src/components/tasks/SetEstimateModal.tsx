import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface SetEstimateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEstimateMinutes: number | null;
  onSave: (minutes: number | null) => void;
}

export function SetEstimateModal({
  open,
  onOpenChange,
  currentEstimateMinutes,
  onSave,
}: SetEstimateModalProps) {
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');

  // Sync form with current estimate when modal opens
  useEffect(() => {
    if (open) {
      if (currentEstimateMinutes && currentEstimateMinutes > 0) {
        setHours(String(Math.floor(currentEstimateMinutes / 60) || ''));
        setMinutes(String(currentEstimateMinutes % 60 || ''));
      } else {
        setHours('');
        setMinutes('');
      }
    }
  }, [open, currentEstimateMinutes]);

  const handleSave = () => {
    const h = parseInt(hours) || 0;
    const m = parseInt(minutes) || 0;
    const total = h * 60 + m;
    onSave(total > 0 ? total : null);
    onOpenChange(false);
  };

  const handleClear = () => {
    onSave(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle>Set Estimate</DialogTitle>
        </DialogHeader>
        <div className="flex gap-3 py-4">
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
        </div>
        <DialogFooter className="flex justify-between sm:justify-between">
          <Button variant="destructive" size="sm" onClick={handleClear}>
            Clear
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
