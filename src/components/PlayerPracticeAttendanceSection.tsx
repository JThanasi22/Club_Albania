'use client';

import { useMemo, useState } from 'react';
import { Pie, PieChart, Cell } from 'recharts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';
import { formatAttendanceDateTime, formatAttendanceDisplayDate } from '@/lib/attendance';
import {
  getMissedPracticePercent,
  getMissedPracticeTier,
  MISSED_PRACTICE_TIER_COLORS,
  type PlayerAttendanceSummary,
} from '@/lib/playerAttendanceSummary';
import { getAttendanceLang } from '@/lang/attendance';
import { cn } from '@/lib/utils';

const L = getAttendanceLang('sq');

type PlayerPracticeAttendanceSectionProps = {
  playerName: string;
  summary?: PlayerAttendanceSummary;
};

export function PlayerPracticeAttendanceSection({
  playerName,
  summary,
}: PlayerPracticeAttendanceSectionProps) {
  const [missListOpen, setMissListOpen] = useState(false);
  const missedPct = getMissedPracticePercent(summary);
  const total = summary?.totalPractices ?? 0;
  const missed = summary?.missedCount ?? 0;
  const present = total - missed;
  const tier = getMissedPracticeTier(missedPct);
  const colors = MISSED_PRACTICE_TIER_COLORS[tier];

  const chartConfig = useMemo(
    () =>
      ({
        missed: { label: L.practiceMissed, color: colors.missed },
        present: { label: L.practicePresent, color: colors.present },
      }) satisfies ChartConfig,
    [colors.missed, colors.present],
  );

  const chartData = useMemo(() => {
    if (total === 0) return [];
    if (missed === 0) {
      return [{ key: 'present', value: present }];
    }
    if (present === 0) {
      return [{ key: 'missed', value: missed }];
    }
    return [
      { key: 'missed', value: missed },
      { key: 'present', value: present },
    ];
  }, [total, missed, present]);

  const tierTextClass =
    tier === 'good'
      ? 'text-green-600 dark:text-green-400'
      : tier === 'warning'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';

  return (
    <>
      <div className="rounded-lg border border-border bg-gray-50 dark:bg-gray-800 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">{L.practiceAttendanceSectionTitle}</p>
          {total > 0 && (
            <span className={cn('text-sm font-semibold tabular-nums', tierTextClass)}>
              {L.practiceMissRate(missedPct)}
            </span>
          )}
        </div>

        {total === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{L.noPracticeAttendance}</p>
        ) : (
          <button
            type="button"
            onClick={() => setMissListOpen(true)}
            className="flex w-full flex-col items-center gap-2 rounded-md py-2 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={L.openMissedPracticesModal(playerName, missedPct)}
          >
            <ChartContainer config={chartConfig} className="mx-auto aspect-square h-36 w-36">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="key"
                  innerRadius={42}
                  outerRadius={64}
                  strokeWidth={0}
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={
                        entry.key === 'missed'
                          ? colors.missed
                          : entry.key === 'present' && missed === 0
                            ? colors.missed
                            : colors.present
                      }
                    />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <p className="text-xs text-muted-foreground">{L.tapChartForMisses}</p>
          </button>
        )}
      </div>

      <Dialog open={missListOpen} onOpenChange={setMissListOpen}>
        <DialogContent className="max-h-[min(85dvh,640px)] w-[calc(100vw-1rem)] max-w-md gap-0 overflow-hidden p-0 flex flex-col">
          <DialogHeader className="shrink-0 space-y-1 px-6 pt-6 pb-4 pr-12 text-left">
            <DialogTitle>{L.missedPracticesModalTitle(playerName)}</DialogTitle>
            <DialogDescription>
              {missed === 0
                ? L.missedPracticesEmpty
                : L.missedPracticesModalDescription(missed, total, missedPct)}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
            {missed === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{L.missedPracticesEmpty}</p>
            ) : (
              <ul className="space-y-2">
                {summary!.misses.map((m) => (
                  <li
                    key={m.sessionId}
                    className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm shadow-sm"
                  >
                    <p className="font-medium text-foreground">
                      {formatAttendanceDisplayDate(m.dateKey)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {L.missedPracticeRecorded(formatAttendanceDateTime(m.recordedAt))}
                    </p>
                    <p className="text-xs text-muted-foreground">{m.teamName}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
