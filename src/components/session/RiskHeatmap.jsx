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
  if (score >= 5) return 'bg-amber-400';
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
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Risk Heatmap</h3>
      <TooltipProvider>
        <div className="flex">
          {/* Y axis label */}
          <div className="flex flex-col items-center mr-2 justify-center">
            <span className="text-xs text-muted-foreground font-medium -rotate-90 whitespace-nowrap">Impact →</span>
          </div>
          <div className="flex-1">
            <div className="grid grid-cols-5 gap-1">
              {grid.map((row, ri) =>
                row.map((cell, ci) => (
                  <Tooltip key={`${ri}-${ci}`}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "aspect-square rounded-md flex items-center justify-center text-xs font-bold text-white transition-transform hover:scale-105 cursor-default",
                          getCellColor(ci + 1, 5 - ri),
                          cell.length > 0 ? 'opacity-100 ring-2 ring-white/30' : 'opacity-30'
                        )}
                      >
                        {cell.length > 0 ? cell.length : ''}
                      </div>
                    </TooltipTrigger>
                    {cell.length > 0 && (
                      <TooltipContent>
                        <div className="space-y-1 max-w-xs">
                          {cell.map((r, i) => (
                            <p key={i} className="text-xs">{r.title}</p>
                          ))}
                        </div>
                      </TooltipContent>
                    )}
                  </Tooltip>
                ))
              )}
            </div>
            {/* X axis labels */}
            <div className="grid grid-cols-5 gap-1 mt-1">
              {LIKELIHOOD_LABELS.map(l => (
                <div key={l} className="text-center text-xs text-muted-foreground">{l}</div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-1">Likelihood →</p>
          </div>
        </div>
      </TooltipProvider>
    </Card>
  );
}