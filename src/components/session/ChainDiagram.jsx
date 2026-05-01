import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const stepColors = {
  initial: 'bg-amber-500',
  exploit: 'bg-red-team',
  lateral: 'bg-orange-500',
  impact: 'bg-red-700',
  defense: 'bg-blue-team',
  default: 'bg-slate-500',
};

export default function ChainDiagram({ chains }) {
  if (!chains?.length) return null;

  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
        Attack / Effect Chains
      </h3>
      <div className="space-y-6">
        {chains.map((chain, ci) => (
          <div key={ci}>
            <p className="text-sm font-semibold mb-3">{chain.name}</p>
            <div className="flex items-start gap-1 overflow-x-auto pb-2">
              {chain.steps?.map((step, si) => (
                <React.Fragment key={si}>
                  {si > 0 && (
                    <div className="flex items-center pt-4 flex-shrink-0">
                      <svg width="24" height="12" viewBox="0 0 24 12" className="text-muted-foreground">
                        <path d="M0 6h18M14 2l6 4-6 4" stroke="currentColor" strokeWidth="1.5" fill="none" />
                      </svg>
                    </div>
                  )}
                  <div className="flex flex-col items-center min-w-[100px] max-w-[140px] flex-shrink-0">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold",
                        stepColors[step.type] || stepColors.default
                      )}
                    >
                      {si + 1}
                    </div>
                    <p className="text-xs font-medium text-center mt-2 leading-tight">{step.label}</p>
                    {step.description && (
                      <p className="text-xs text-muted-foreground text-center mt-0.5 leading-tight">{step.description}</p>
                    )}
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}