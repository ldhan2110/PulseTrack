import { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { StatusCount } from '@/lib/types';

interface DashboardStatusStripProps {
  total: number;
  byStatus: StatusCount[];
  projectPrefix: string;
}

export function DashboardStatusStrip({ total, byStatus, projectPrefix }: DashboardStatusStripProps) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      observer.disconnect();
    };
  }, [updateScrollState]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  const cells = [
    { key: 'total', name: 'Total', value: total, color: undefined as string | undefined, to: `/projects/${projectPrefix}/backlog` },
    ...byStatus.map((s) => ({
      key: s.statusId,
      name: s.name,
      value: s.count,
      color: s.color,
      to: `/projects/${projectPrefix}/backlog?status=${s.statusId}`,
    })),
  ];

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Team Tasks
      </span>
      <div className="relative group/strip">
        {canScrollLeft && (
          <Button
            variant="outline"
            size="icon"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 size-8 rounded-full shadow-md bg-background/90 backdrop-blur-sm"
            onClick={() => scroll('left')}
          >
            <ChevronLeft className="size-4" />
          </Button>
        )}

        <Card className="p-0">
          <div
            ref={scrollRef}
            className="flex divide-x divide-border overflow-x-auto scrollbar-hide scroll-smooth"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {cells.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => navigate(c.to)}
                className="flex min-w-[130px] shrink-0 flex-col items-start gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
                  {c.color && (
                    <span className="size-2 rounded-full" style={{ backgroundColor: c.color }} />
                  )}
                  {c.name}
                </span>
                <span className="text-[28px] font-bold leading-none tracking-[-0.03em]">
                  {c.value}
                </span>
              </button>
            ))}
          </div>
        </Card>

        {canScrollRight && (
          <Button
            variant="outline"
            size="icon"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 size-8 rounded-full shadow-md bg-background/90 backdrop-blur-sm"
            onClick={() => scroll('right')}
          >
            <ChevronRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
