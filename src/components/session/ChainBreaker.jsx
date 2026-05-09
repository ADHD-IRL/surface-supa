import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { computeSCRS, getPosture } from '@/lib/scrsEngine';
import { Shield, ChevronDown, ChevronUp } from 'lucide-react';

const LEV_CLASS = {
  HIGH:   'bg-red-500/10 text-red-400 border-red-500/30',
  MEDIUM: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  LOW:    'bg-green-500/10 text-green-400 border-green-500/30',
};

const RES_CLASS = {
  HIGH:   'border-red-500/40 text-red-400',
  MEDIUM: 'border-amber-500/40 text-amber-400',
  LOW:    'border-green-500/40 text-green-400',
};

function ScrsBar({ currentScrs, projectedScrs }) {
  if (currentScrs == null) return null;
  const currentPosture = getPosture(currentScrs);
  const projectedPosture = projectedScrs != null ? getPosture(projectedScrs) : null;
  const drop = projectedScrs != null ? currentScrs - projectedScrs : 0;

  return (
    <Card className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 border-border bg-muted/20">
      <div className="flex items-center gap-3 flex-1">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Current SCRS</p>
          <span className="text-3xl font-black tabular-nums" style={{ color: currentPosture.color }}>
            {currentScrs}
          </span>
          <span className="text-xs font-semibold ml-1.5" style={{ color: currentPosture.color }}>
            {currentPosture.label}
          </span>
        </div>

        {projectedScrs != null && (
          <>
            <div className="text-muted-foreground text-xl">→</div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Projected SCRS</p>
              <span className="text-3xl font-black tabular-nums" style={{ color: projectedPosture.color }}>
                {projectedScrs}
              </span>
              <span className="text-xs font-semibold ml-1.5" style={{ color: projectedPosture.color }}>
                {projectedPosture.label}
              </span>
              {drop > 0 && (
                <span className="text-xs text-green-400 font-semibold ml-2">−{drop} pts</span>
              )}
            </div>
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {projectedScrs == null
          ? 'Apply mitigations below to see projected score'
          : drop > 0
            ? `Applying selected mitigations reduces risk by ${drop} point${drop !== 1 ? 's' : ''}`
            : 'No SCRS reduction from selected mitigations (apply HIGH-leverage steps for maximum impact)'}
      </p>
    </Card>
  );
}

function stepDelta(ci, si, scrsBaseParams, chainAnalysesForScrs) {
  const base = computeSCRS({ ...scrsBaseParams, appliedCMs: [] }).scrs;
  const step = chainAnalysesForScrs?.[ci]?.steps?.[si];
  if (!step) return 0;
  const withCM = computeSCRS({ ...scrsBaseParams, appliedCMs: [{ leverage: step.leverage || 'MEDIUM' }] }).scrs;
  return base - withCM;
}

export default function ChainBreaker({
  chainBreakData,
  chains = [],
  appliedSteps,
  onToggle,
  currentScrs,
  projectedScrs,
  scrsBaseParams,
  chainAnalysesForScrs,
}) {
  // No chain_analyses yet — show plain step list
  if (!chainBreakData) {
    return (
      <div className="space-y-4">
        {chains.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No compound chains identified</p>
          </Card>
        ) : chains.map((chain, ci) => (
          <Card key={ci} className="overflow-hidden">
            <div className="px-6 py-3 border-b border-border bg-muted/30">
              <h4 className="text-sm font-semibold">{chain.name}</h4>
            </div>
            <div className="p-5 space-y-3">
              {(chain.steps || []).map((step, si) => {
                const isLast = si === chain.steps.length - 1;
                return (
                  <div key={si} className="flex items-start gap-3">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                        {step.step_number || si + 1}
                      </div>
                      {!isLast && <div className="w-px h-4 bg-border mt-1" />}
                    </div>
                    <p className="text-sm text-foreground leading-relaxed pt-1 pb-2">{step.step_text}</p>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    );
  }

  // chain_analyses loaded — show mitigation cards + SCRS simulator
  return (
    <div className="space-y-4">
      <ScrsBar currentScrs={currentScrs} projectedScrs={projectedScrs} />

      {chainBreakData.map((ca, ci) => {
        const chain = chains[ci] || { name: ca.chain_name, steps: [] };
        const resilience = (ca.chain_resilience || 'MEDIUM').toUpperCase();

        return (
          <Card key={ci} className="overflow-hidden">
            {/* Chain header */}
            <div className="px-5 py-3 border-b border-border bg-muted/30 flex flex-wrap items-start gap-2">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-foreground">{chain.name || ca.chain_name}</h4>
                {ca.resilience_rationale && (
                  <p className="text-xs text-muted-foreground mt-0.5">{ca.resilience_rationale}</p>
                )}
              </div>
              <Badge variant="outline" className={cn('text-xs flex-shrink-0', RES_CLASS[resilience] || RES_CLASS.MEDIUM)}>
                {resilience} resilience
              </Badge>
            </div>

            {/* Steps */}
            <div className="divide-y divide-border">
              {(chain.steps || []).map((step, si) => {
                const caStep = (ca.steps || []).find(s => s.step_number === (step.step_number || si + 1));
                const key = `${ci}-${si}`;
                const isApplied = appliedSteps?.has(key);
                const leverage = (caStep?.leverage || 'MEDIUM').toUpperCase();
                const delta = stepDelta(ci, si, scrsBaseParams, chainAnalysesForScrs);
                const isLast = si === chain.steps.length - 1;

                return (
                  <div key={si} className={cn('p-4 transition-colors', isApplied && 'bg-green-500/5')}>
                    <div className="flex items-start gap-3">
                      {/* Step indicator */}
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className={cn(
                          'w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold',
                          isApplied
                            ? 'bg-green-500/20 border-green-500/40 text-green-400'
                            : 'bg-primary/10 border-primary/20 text-primary'
                        )}>
                          {step.step_number || si + 1}
                        </div>
                        {!isLast && <div className="w-px h-3 bg-border mt-1" />}
                      </div>

                      <div className="flex-1 min-w-0 space-y-2">
                        {/* Step text */}
                        <p className="text-sm text-foreground leading-relaxed">{step.step_text}</p>

                        {/* Mitigation card */}
                        {caStep && (
                          <div className={cn(
                            'rounded-md border p-3 space-y-2 transition-colors',
                            isApplied ? 'border-green-500/30 bg-green-500/5' : 'border-border bg-muted/30'
                          )}>
                            <div className="flex flex-wrap items-start gap-2">
                              <Shield className={cn('w-3.5 h-3.5 mt-0.5 flex-shrink-0', isApplied ? 'text-green-400' : 'text-muted-foreground')} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground leading-snug">{caStep.mitigation_title}</p>
                                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{caStep.mitigation_description}</p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', LEV_CLASS[leverage] || LEV_CLASS.MEDIUM)}>
                                  {leverage} leverage
                                </Badge>
                                {caStep.mitigation_owner && (
                                  <span className="text-xs text-muted-foreground">{caStep.mitigation_owner}</span>
                                )}
                                {caStep.mitigation_timeline && (
                                  <span className="text-xs text-muted-foreground">· {caStep.mitigation_timeline}</span>
                                )}
                                {delta > 0 && (
                                  <span className="text-xs font-semibold text-green-400">−{delta} pts if applied</span>
                                )}
                              </div>

                              <Button
                                size="sm"
                                variant={isApplied ? 'default' : 'outline'}
                                onClick={() => onToggle?.(key)}
                                className={cn(
                                  'text-xs h-7 px-2.5 flex-shrink-0',
                                  isApplied
                                    ? 'bg-green-600 hover:bg-green-700 text-white border-green-600'
                                    : 'border-border hover:border-green-500/50 hover:text-green-400'
                                )}
                              >
                                {isApplied ? '✓ Applied' : 'Apply'}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
