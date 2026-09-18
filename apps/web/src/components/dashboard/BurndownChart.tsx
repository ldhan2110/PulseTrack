import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { TrendingDown } from 'lucide-react';

interface BurndownDataPoint {
  date: string;
  ideal: number;
  actual: number;
}

interface BurndownChartProps {
  data: BurndownDataPoint[];
}

export function BurndownChart({ data }: BurndownChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-2 text-center">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
          <TrendingDown className="size-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">No burndown data yet</p>
        <p className="text-xs text-muted-foreground">
          Sprint progress will chart here once tasks with story points are underway.
        </p>
      </div>
    );
  }

  const formatted = data.map((d) => ({
    ...d,
    label: format(parseISO(d.date), 'MMM d'),
  }));

  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={300}>
      <LineChart data={formatted} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          label={{ value: 'Story Points', angle: -90, position: 'insideLeft', fontSize: 12, dy: 40 }}
        />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--popover)',
            color: 'var(--popover-foreground)',
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="ideal"
          name="Ideal"
          stroke="var(--muted-foreground)"
          strokeDasharray="4 4"
          dot={false}
          strokeWidth={2}
        />
        <Line
          type="monotone"
          dataKey="actual"
          name="Actual"
          stroke="var(--primary)"
          dot={false}
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
