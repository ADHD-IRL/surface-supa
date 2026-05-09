import React from 'react';
import { cn } from '@/lib/utils';

function getBand(score) {
  return score >= 80 ? 'CRITICAL' : score >= 60 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW';
}

function getBandColor(score) {
  return score >= 80 ? '#dc2626' : score >= 60 ? '#ea580c' : score >= 40 ? '#ca8a04' : '#16a34a';
}

export default function StatsCards({ sessions, agents = [] }) {
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
    ? Math.round(last30.reduce((s, x) => s + x.scrs_score, 0) / last30.length)
    : null;
  const avgPrev = prev30.length
    ? Math.round(prev30.reduce((s, x) => s + x.scrs_score, 0) / prev30.length)
    : null;
  const scrsDelta = avgScrs != null && avgPrev != null ? avgScrs - avgPrev : null;

  // Sessions-by-band counts (last 30d)
  const bandCounts = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  last30.forEach(s => { bandCounts[getBand(s.scrs_score)]++; });
  const bandTotal = last30.length;

  // Trend data for area chart
  const completedWithScore = sessions
    .filter(s => s.status === 'completed' && s.scrs_score != null)
    .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
  const hasTrend = completedWithScore.length >= 2;

  // Build SVG path for area chart
  const buildAreaPath = (points, w, h) => {
    if (points.length < 2) return { line: '', area: '' };
    const max = Math.max(...points.map(p => p.scrs_score));
    const min = Math.min(...points.map(p => p.scrs_score));
    const span = max - min || 1;
    const dx = w / (points.length - 1);
    const cy = (v) => (h - ((v - min) / span) * (h - 8) - 4).toFixed(1);
    const coords = points.map((p, i) => ({ x: (i * dx).toFixed(1), y: cy(p.scrs_score) }));
    const line = coords.map((c, i) => `${i ? 'L' : 'M'}${c.x},${c.y}`).join(' ');
    const area = `${line} L${coords[coords.length - 1].x},${h} L${coords[0].x},${h} Z`;
    return { line, area, coords };
  };

  const trendPoints = completedWithScore.slice(-20);
  const { line: trendLine, area: trendArea, coords: trendCoords } = hasTrend
    ? buildAreaPath(trendPoints, 400, 80)
    : { line: '', area: '', coords: [] };

  // Current avg of last30 vs all completed
  const allCompleted = sessions.filter(s => s.status === 'completed' && s.scrs_score != null);
  const running = sessions.filter(s => s.status === 'running');

  // Donut data
  const donutBands = [
    { key: 'CRITICAL', color: '#ef4444', label: 'Critical' },
    { key: 'HIGH',     color: '#fb923c', label: 'High' },
    { key: 'MEDIUM',   color: '#fbbf24', label: 'Medium' },
    { key: 'LOW',      color: '#86efac', label: 'Low' },
  ];
  const donutCounts = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  allCompleted.forEach(s => { donutCounts[getBand(s.scrs_score)]++; });
  const donutTotal = allCompleted.length;

  // Build donut segments
  const donutR = 38;
  const donutCx = 50;
  const donutCy = 50;
  const circumference = 2 * Math.PI * donutR;
  let donutOffset = 0;
  const donutSegments = donutBands.map(b => {
    const count = donutCounts[b.key];
    const fraction = donutTotal > 0 ? count / donutTotal : 0;
    const dashLen = fraction * circumference;
    const seg = { ...b, count, fraction, dashLen, offset: donutOffset };
    donutOffset += dashLen;
    return seg;
  }).filter(s => s.count > 0);

  // Open mitigations
  const mitigSessions = sessions.filter(s => s.mitigation_playbook?.trim());
  const mitigCount = mitigSessions.reduce((sum, s) => {
    const lines = s.mitigation_playbook.split('\n').filter(l => /^\s*[-•*]|\d+\./.test(l));
    return sum + (lines.length || 1);
  }, 0);

  // Roster
  const redAgents = agents.filter(a => a.team === 'red');
  const blueAgents = agents.filter(a => a.team === 'blue');
  const redPct = agents.length > 0 ? Math.round((redAgents.length / agents.length) * 100) : 50;

  return (
    <div className="flex gap-4 mb-7" style={{ alignItems: 'stretch' }}>
      {/* Column 1 — Posture gradient card */}
      <div
        className="rounded-2xl p-6 flex flex-col text-white shrink-0"
        style={{
          width: 380,
          background: 'linear-gradient(135deg, #f97316 0%, #ea580c 40%, #dc2626 100%)',
        }}
      >
        {/* Posture label + delta */}
        <div className="flex items-start justify-between mb-1">
          <div className="text-sm font-semibold uppercase tracking-widest opacity-80">Posture</div>
          {scrsDelta != null && (
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: 'rgba(255,255,255,0.2)' }}>
              {scrsDelta > 0 ? '▲' : '▼'} {Math.abs(scrsDelta)} vs prev period
            </span>
          )}
        </div>

        {/* Big number */}
        <div className="flex items-end gap-3 mt-1 mb-0.5">
          <div className="text-6xl font-bold leading-none tabular-nums">
            {avgScrs ?? '—'}
          </div>
          <div className="mb-2">
            <div className="text-2xl font-semibold leading-tight">
              {avgScrs != null ? getBand(avgScrs) : 'No data'}
            </div>
            <div className="text-xs opacity-70 mt-0.5">avg SCRS · 30d</div>
          </div>
        </div>

        {/* Sessions-by-band bar */}
        <div className="mt-auto pt-4">
          {bandTotal > 0 ? (
            <>
              <div className="flex h-7 rounded-lg overflow-hidden gap-0.5">
                {[
                  { key: 'LOW',      color: '#16a34a', label: 'LOW' },
                  { key: 'MEDIUM',   color: '#ca8a04', label: 'MED' },
                  { key: 'HIGH',     color: '#ea580c', label: 'HIGH' },
                  { key: 'CRITICAL', color: '#dc2626', label: 'CRIT' },
                ].filter(b => bandCounts[b.key] > 0).map(b => (
                  <div
                    key={b.key}
                    className="flex items-center justify-center text-white text-[11px] font-bold rounded"
                    style={{ flex: bandCounts[b.key], background: b.color, opacity: 0.9 }}
                    title={`${b.key}: ${bandCounts[b.key]}`}
                  >
                    {bandCounts[b.key]}
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-1.5">
                {[
                  { key: 'LOW',      label: 'LOW' },
                  { key: 'MEDIUM',   label: 'MED' },
                  { key: 'HIGH',     label: 'HIGH' },
                  { key: 'CRITICAL', label: 'CRIT' },
                ].map(b => (
                  <span key={b.key} className="text-[10px] opacity-60 font-medium">{b.label}</span>
                ))}
              </div>
            </>
          ) : (
            <div className="text-xs opacity-50 text-center py-2">No scored sessions in last 30d</div>
          )}
        </div>
      </div>

      {/* Column 2 — SCRS trend area chart */}
      <div className="flex-1 rounded-2xl border border-border bg-card p-5 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium mb-1">SCRS Trend</div>
            {avgScrs != null && (
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tabular-nums" style={{ color: getBandColor(avgScrs) }}>{avgScrs}</span>
                {scrsDelta != null && (
                  <span className={cn('text-xs font-semibold', scrsDelta > 0 ? 'text-red-600' : 'text-emerald-600')}>
                    {scrsDelta > 0 ? '▲' : '▼'} {Math.abs(scrsDelta)}
                  </span>
                )}
              </div>
            )}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-3 h-0.5 rounded" style={{ background: '#f97316' }} />
              <span>Avg</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-0.5 rounded border-t-2 border-dashed border-red-500" />
              <span>Critical band</span>
            </div>
          </div>
        </div>

        {/* SVG chart */}
        {hasTrend ? (
          <div className="flex-1">
            <svg
              viewBox="0 0 400 80"
              className="w-full h-20"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#f97316" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {/* Area fill */}
              <path d={trendArea} fill="url(#areaGrad)" />
              {/* Line */}
              <path d={trendLine} fill="none" stroke="#f97316" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {/* Critical threshold line at y=80 (we need to map it) */}
              {(() => {
                const scores = trendPoints.map(p => p.scrs_score);
                const max = Math.max(...scores);
                const min = Math.min(...scores);
                const span = max - min || 1;
                const threshY = (80 - ((80 - min) / span) * (80 - 8) - 4);
                if (threshY >= 0 && threshY <= 80) {
                  return <line x1="0" y1={threshY.toFixed(1)} x2="400" y2={threshY.toFixed(1)} stroke="#dc2626" strokeWidth="1.5" strokeDasharray="6,4" opacity="0.7" />;
                }
                return null;
              })()}
              {/* Session dots */}
              {trendCoords && trendCoords.map((c, i) => {
                const isLast = i === trendCoords.length - 1;
                return isLast ? (
                  <circle key={i} cx={c.x} cy={c.y} r="4" fill="#f97316" stroke="white" strokeWidth="2" />
                ) : (
                  <circle key={i} cx={c.x} cy={c.y} r="2.5" fill="white" stroke="#f97316" strokeWidth="1.5" />
                );
              })}
            </svg>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-muted-foreground">No trend data yet</p>
          </div>
        )}

        {/* Below chart: running + completed counts */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
          {running.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-amber-600 font-medium">{running.length} running</span>
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">{allCompleted.length}</span> completed
          </div>
        </div>
      </div>

      {/* Column 3 — Posture donut */}
      <div className="rounded-2xl border border-border bg-card p-5 flex flex-col shrink-0" style={{ width: 240 }}>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium mb-3">Sessions by posture</div>

        {/* Donut + legend */}
        {donutTotal > 0 ? (
          <div className="flex items-center gap-3">
            {/* SVG donut */}
            <div className="shrink-0">
              <svg width="100" height="100" className="-rotate-90">
                {/* Track */}
                <circle
                  cx={donutCx}
                  cy={donutCy}
                  r={donutR}
                  fill="none"
                  stroke="hsl(var(--muted))"
                  strokeWidth="14"
                />
                {donutSegments.map(seg => (
                  <circle
                    key={seg.key}
                    cx={donutCx}
                    cy={donutCy}
                    r={donutR}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="14"
                    strokeDasharray={`${seg.dashLen.toFixed(2)} ${(circumference - seg.dashLen).toFixed(2)}`}
                    strokeDashoffset={`-${seg.offset.toFixed(2)}`}
                  />
                ))}
                {/* Center text — rotate back */}
                <text
                  x={donutCx}
                  y={donutCy - 6}
                  textAnchor="middle"
                  style={{ fontSize: 16, fontWeight: 700, fill: 'hsl(var(--foreground))' }}
                  transform={`rotate(90 ${donutCx} ${donutCy})`}
                >
                  {donutTotal}
                </text>
                <text
                  x={donutCx}
                  y={donutCy + 8}
                  textAnchor="middle"
                  style={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  transform={`rotate(90 ${donutCx} ${donutCy})`}
                >
                  sessions
                </text>
              </svg>
            </div>
            {/* Legend */}
            <div className="flex-1 space-y-1.5">
              {donutBands.map(b => {
                const cnt = donutCounts[b.key];
                if (!cnt) return null;
                return (
                  <div key={b.key} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: b.color }} />
                      <span className="text-muted-foreground">{b.label}</span>
                    </div>
                    <span className="font-semibold tabular-nums">{cnt}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-20">
            <p className="text-xs text-muted-foreground">No completed sessions</p>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-border mt-4 pt-3 space-y-2.5">
          {/* Open mitigations */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">Open mitigations</span>
            <span className="text-sm font-bold tabular-nums">{mitigCount}</span>
          </div>

          {/* Roster mini bar */}
          {agents.length > 0 && (
            <div>
              <div className="flex h-2 rounded-full overflow-hidden mb-1.5">
                <div className="bg-red-500 h-full" style={{ width: `${redPct}%` }} />
                <div className="bg-blue-500 h-full flex-1" />
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-red-600 font-medium">{redAgents.length} Red</span>
                <span className="text-blue-600 font-medium">{blueAgents.length} Blue</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
