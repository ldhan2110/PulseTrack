import { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ListTodo, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatCard } from './StatCard';
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

  return (
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

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div className="shrink-0">
          <StatCard title="Total Tasks" value={total} icon={ListTodo} onClick={() => navigate(`/projects/${projectPrefix}/backlog`)} />
        </div>
        {byStatus.map((s) => (
          <div key={s.statusId} className="shrink-0">
            <StatCard
              title={s.name}
              value={s.count}
              icon={Circle}
              accentColor={s.color}
              onClick={() => navigate(`/projects/${projectPrefix}/backlog?status=${s.statusId}`)}
            />
          </div>
        ))}
      </div>

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
  );
}
