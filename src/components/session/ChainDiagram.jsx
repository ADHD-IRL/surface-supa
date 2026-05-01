import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const stepConfig = {
  initial:  { label: 'Initial Access', className: 'bg-amber-500 text-white',   badgeClass: 'bg-amber-500/10 text-amber-700 border-amber-500/30' },
  exploit:  { label: 'Exploit',        className: 'bg-red-team text-white',     badgeClass: 'bg-red-team/10 text-red-team border-red-team/30' },
  lateral:  { label: 'Lateral Move',   className: 'bg-orange-500 text-white',   badgeClass: 'bg-orange-500/10 text-orange-700 border-orange-500/30' },
  impact:   { label: 'Impact',         className: 'bg-red-700 text-white',      badgeClass: 'bg-red-700/10 text-red-800 border-red-700/30' },
  defense:  { label: 'Defense',        className: 'bg-blue-team text-white',    badgeClass: 'bg-blue-team/10 text-blue-team border-blue-team/30' },
  default:  { label: 'Step',           className: 'bg-slate-500 text-white',    badgeClass: 'bg-slate-500/10 text-slate-600 border-slate-500/30' },
};

function getStepConfig(type) {
  return stepConfig[type] || stepConfig.default;
}

export default function ChainDiagram({ chains }) {
  if (!chains?.length) return null;

  return (
    <div className="space-y-4">
      {chains.map((chain, ci) => (
        <Card key={ci} className="overflow-hidden">
          <div className="px-6 py-3 border-b border-border bg-muted/30">
            <h4 className="text-sm font-semibold">{chain.name}</h4>
          </div>
          <table className="w-full border-collapse">
            <colgroup>
              <col style={{ width: '40px' }} />
              <col style={{ width: '140px' }} />
              <col style={{ width: '110px' }} />
              <col />
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">#</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Step</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Type</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Description</th>
              </tr>
            </thead>
            <tbody>
              {chain.steps?.map((step, si) => {
                const cfg = getStepConfig(step.type);
                const isLast = si === chain.steps.length - 1;
                return (
                  <tr key={si} className={cn("border-b border-border last:border-b-0", si % 2 === 0 ? "bg-background" : "bg-muted/10")}>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col items-center gap-1">
                        <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0", cfg.className)}>
                          {si + 1}
                        </div>
                        {!isLast && (
                          <div className="w-px h-3 bg-border" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className="text-sm font-medium leading-snug">{step.label}</p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Badge variant="outline" className={cn("text-xs capitalize whitespace-nowrap", cfg.badgeClass)}>
                        {step.type || 'step'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className="text-sm text-muted-foreground leading-relaxed">{step.description || '—'}</p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}
