import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

function Spark({ points = [], color = '#2563eb', w = 120, h = 32 }) {
  if (points.length < 2) return null;
  const max = Math.max(...points), min = Math.min(...points);
  const span = max - min || 1;
  const dx = w / (points.length - 1);
  const cy = (v) => (h - ((v - min) / span) * (h - 4) - 2).toFixed(1);
  const path = points.map((v, i) => `${i ? 'L' : 'M'}${(i * dx).toFixed(1)},${cy(v)}`).join(' ');
  return (
    <svg width={w} height={h} className="overflow-visible flex-shrink-0">
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={(points.length - 1) * dx} cy={cy(points[points.length - 1])} r="2.5" fill={color} />
    </svg>
  );
}

function weeklyAvgScrs(sessions) {
  const now = Date.now();
  const points = [];
  for (let i = 7; i >= 0; i--) {
    const start = now - (i + 1) * 7 * 86400000;
    const end = now - i * 7 * 86400000;
    const week = sessions.filter(s => {
      const d = new Date(s.created_date).getTime();
      return d >= start && d < end && s.status === 'completed' && s.scrs_score != null;
    });
    if (week.length > 0) {
      points.push(Math.round(week.reduce((sum, x) => sum + x.scrs_score, 0) / week.length));
    } else if (points.length > 0) {
      points.push(points[points.length - 1]);
    }
  }
  return points.length >= 2 ? points : null;
}

function resolveScrsColor(score) {
  if (score == null) return null;
  return score >= 80 ? '#dc2626' : score >= 60 ? '#ea580c' : score >= 40 ? '#ca8a04' : '#16a34a';
}

export default function StatsCards({ sessions, agents }) {
  const now = Date.now();
  const ms30 = 30 * 86400000;

  const last30 = sessions.filter(s =>
    s.status === 'completed' && s.scrs_score != null &&
    now - new Date(s.created_date).getTime() < ms30
  );
  const prev30 = sessions.filter(s =>
    s.status === 'completed' && s.scrs_score != null &&
    now - new Date(s.created_date).getTime() >= ms30 &&
    now - new Date(s.created_date).getTime() < ms30 * 2
  );

  const avgScrs = last30.length
    ? Math.round(last30.reduce((sum, s) => sum + s.scrs_score, 0) / last30.length)
    : null;
  const avgPrev = prev30.length
    ? Math.round(prev30.reduce((sum, s) => sum + s.scrs_score, 0) / prev30.length)
    : null;
  const scrsDelta = avgScrs != null && avgPrev != null ? avgScrs - avgPrev : null;
  const sparkPoints = weeklyAvgScrs(sessions);
  const avgColor = resolveScrsColor(avgScrs) ?? 'hsl(var(--muted-foreground))';

  const critical = sessions.filter(s => s.scrs_score != null && s.scrs_score >= 80);
  const running = sessions.filter(s => s.status === 'running');

  const mitigSessions = sessions.filter(s => s.mitigation_playbook?.trim());
  const mitigCount = mitigSessions.reduce((sum, s) => {
    const lines = s.mitigation_playbook.split('\n').filter(l => /^\s*[-•*]|\d+\./.test(l));
    return sum + (lines.length || 1);
  }, 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
      {/* Avg SCRS · 30d */}
      <Card className="p-5 bg-card border border-border">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Avg SCRS · 30d</p>
        <div className="flex items-end justify-between mt-1 gap-2">
          <div>
            <p className="text-3xl font-bold tracking-tight tabular-nums" style={{ color: avgColor }}>
              {avgScrs ?? '—'}
            </p>
            {scrsDelta != null && (
              <p className={cn('text-[11px] font-medium mt-0.5', scrsDelta > 0 ? 'text-red-600' : 'text-emerald-600')}>
                {scrsDelta > 0 ? '▲' : '▼'} {Math.abs(scrsDelta)} vs prev
              </p>
            )}
            {avgScrs == null && (
              <p className="text-[11px] text-muted-foreground mt-0.5">no scored sessions</p>
            )}
          </div>
          {sparkPoints && <Spark points={sparkPoints} color={avgColor} />}
        </div>
      </Card>

      {/* In CRITICAL band */}
      <Card className={cn(
        'p-5 border',
        critical.length > 0
          ? 'border-red-200 bg-red-50/30 dark:border-red-900/40 dark:bg-red-950/20'
          : 'border-border bg-card',
      )}>
        <p className={cn(
          'text-[10px] font-medium uppercase tracking-wider',
          critical.length > 0 ? 'text-red-500' : 'text-muted-foreground',
        )}>
          In CRITICAL band
        </p>
        <p className={cn(
          'text-3xl font-bold mt-1 tracking-tight',
          critical.length > 0 ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground',
        )}>
          {critical.length}
        </p>
        {critical.length > 0 ? (
          <p className="text-[11px] text-red-600/80 mt-1 truncate">
            {critical.slice(0, 2).map(s => s.title?.split(/[—–]/)[0]?.trim() || s.title).join(' · ')}
            {critical.length > 2 && ` +${critical.length - 2}`}
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground mt-1">SCRS ≥ 80</p>
        )}
      </Card>

      {/* Active runs */}
      <Card className="p-5 bg-card border border-border">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Active runs</p>
        <div className="flex items-center gap-2 mt-1">
          {running.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
          )}
          <p className={cn(
            'text-3xl font-bold tracking-tight tabular-nums',
            running.length > 0 ? 'text-amber-600' : 'text-muted-foreground',
          )}>
            {running.length}
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          {running.length > 0
            ? `${running.length} session${running.length !== 1 ? 's' : ''} in progress`
            : 'No active runs'}
        </p>
      </Card>

      {/* Open mitigations */}
      <Card className="p-5 bg-card border border-border">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Open mitigations</p>
        <div className="mt-1">
          <p className="text-3xl font-bold tracking-tight tabular-nums text-foreground">{mitigCount}</p>
          {mitigSessions.length > 0 ? (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              across {mitigSessions.length} session{mitigSessions.length !== 1 ? 's' : ''}
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground mt-0.5">from generated playbooks</p>
          )}
        </div>
      </Card>
    </div>
  );
}
