import React from 'react';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const LIKELIHOOD_LABELS = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost Certain'];
const IMPACT_LABELS = ['Negligible', 'Minor', 'Moderate', 'Major', 'Catastrophic'];

function getCellColor(likelihood, impact) {
  const score = likelihood * impact;
  if (score >= 16) return 'bg-red-600';
  if (score >= 10) return 'bg-orange-500';
  if (score >= 5)  return 'bg-amber-400';
  return 'bg-green-500';
}

export default function RiskHeatmap({ risks }) {
  if (!risks?.length) return null;

  // Build grid: rows = impact (5 to 1), cols = likelihood (1 to 5)
  const grid = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => []));
  risks.forEach(risk => {
    const l = Math.min(Math.max(Math.round(risk.likelihood || 1), 1), 5);
    const i = Math.min(Math.max(Math.round(risk.impact || 1), 1), 5);
    grid[5 - i][l - 1].push(risk);
  });

  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-5">Risk Heatmap</h3>
      <TooltipProvider>
        <div className="flex gap-3 items-start">
          {/* Y axis label */}
          <div className="flex flex-col items-center justify-center self-stretch w-6 shrink-0">
            <span
              className="text-xs text-muted-foreground font-medium whitespace-nowrap select-none"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
              Impact ↑
            </span>
          </div>

          {/* Grid + X axis */}
          <div className="flex-1 min-w-0">
            {/* Y axis labels + grid rows */}
            <div className="flex gap-2 items-start">
              {/* Impact row labels */}
              <div className="flex flex-col gap-1 w-20 shrink-0">
                {IMPACT_LABELS.slice().reverse().map(label => (
                  <div key={label} className="h-10 flex items-center justify-end">
                    <span className="text-xs text-muted-foreground text-right leading-tight">{label}</span>
                  </div>
                ))}
              </div>

              {/* Heatmap cells */}
              <div className="flex-1 min-w-0">
                <div className="grid grid-cols-5 gap-1">
                  {grid.map((row, ri) =>
                    row.map((cell, ci) => (
                      <Tooltip key={`${ri}-${ci}`}>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "h-10 rounded flex items-center justify-center text-xs font-bold text-white transition-transform hover:scale-105 cursor-default select-none",
                              getCellColor(ci + 1, 5 - ri),
                              cell.length > 0 ? 'opacity-100 ring-2 ring-white/30' : 'opacity-25'
                            )}
                          >
                            {cell.length > 0 ? cell.length : ''}
                          </div>
                        </TooltipTrigger>
                        {cell.length > 0 && (
                          <TooltipContent side="top">
                            <div className="space-y-1 max-w-xs">
                              <p className="text-xs font-semibold mb-1">
                                L:{ci + 1} × I:{5 - ri} = {(ci + 1) * (5 - ri)}
                              </p>
                              {cell.map((r, i) => (
                                <p key={i} className="text-xs">• {r.title}</p>
                              ))}
                            </div>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    ))
                  )}
                </div>

                {/* X axis labels */}
                <div className="grid grid-cols-5 gap-1 mt-2">
                  {LIKELIHOOD_LABELS.map(l => (
                    <div key={l} className="text-center text-xs text-muted-foreground leading-tight px-0.5">{l}</div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-center mt-1.5 font-medium">Likelihood →</p>
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-5 pt-4 border-t border-border flex-wrap">
          <span className="text-xs text-muted-foreground font-medium">Score:</span>
          {[
            { label: 'Low (1–4)',      color: 'bg-green-500' },
            { label: 'Medium (5–9)',   color: 'bg-amber-400' },
            { label: 'High (10–15)',   color: 'bg-orange-500' },
            { label: 'Critical (16+)', color: 'bg-red-600' },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={cn("w-3 h-3 rounded-sm", color)} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </TooltipProvider>
    </Card>
  );
}
