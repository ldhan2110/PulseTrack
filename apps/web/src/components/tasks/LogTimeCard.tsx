import { useState } from 'react';
import { Button } from '../ui/button';

interface LogTimeCardProps {
  onSubmit: (data: { minutes: number; comment?: string; loggedAt?: string }) => void;
  isLoading?: boolean;
}

export function LogTimeCard({ onSubmit, isLoading }: LogTimeCardProps) {
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [comment, setComment] = useState('');
  const [loggedAt, setLoggedAt] = useState(() => new Date().toISOString().split('T')[0]);

  const handleSubmit = () => {
    const h = parseInt(hours) || 0;
    const m = parseInt(minutes) || 0;
    const totalMinutes = h * 60 + m;
    if (totalMinutes <= 0) return;

    onSubmit({
      minutes: totalMinutes,
      comment: comment.trim() || undefined,
      loggedAt: loggedAt || undefined,
    });

    setHours('');
    setMinutes('');
    setComment('');
    setLoggedAt(new Date().toISOString().split('T')[0]);
  };

  return (
    <div className="border border-border rounded-lg p-3 space-y-3">
      <h4 className="text-sm font-semibold">Log Time</h4>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-[10px] text-muted-foreground">Hours</label>
          <input
            type="number"
            min={0}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="0"
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          />
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-muted-foreground">Minutes</label>
          <input
            type="number"
            min={0}
            max={59}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="0"
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          />
        </div>
        <div className="flex-[1.5]">
          <label className="text-[10px] text-muted-foreground">Date</label>
          <input
            type="date"
            value={loggedAt}
            onChange={(e) => setLoggedAt(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] text-muted-foreground">Comment</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What did you work on..."
          rows={2}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs resize-none"
        />
      </div>

      <Button onClick={handleSubmit} disabled={isLoading} className="w-full" size="sm">
        {isLoading ? 'Logging...' : 'Log Time'}
      </Button>
    </div>
  );
}
