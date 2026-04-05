import type { LucideIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  variant?: 'default' | 'warning' | 'danger';
}

export function StatCard({ title, value, icon: Icon, variant = 'default' }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[13px] font-semibold tracking-[0.01em]">
            {title}
          </CardTitle>
          <Icon
            className={cn(
              'size-4 text-muted-foreground',
              variant === 'danger' && 'text-[var(--status-blocked)]',
              variant === 'warning' && 'text-[var(--status-in-review)]',
            )}
          />
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <span
          className={cn(
            'text-[28px] font-semibold leading-[1.2] tracking-[-0.03em]',
            variant === 'danger' && 'text-[var(--status-blocked)]',
            variant === 'warning' && 'text-[var(--status-in-review)]',
          )}
        >
          {value}
        </span>
      </CardContent>
    </Card>
  );
}
