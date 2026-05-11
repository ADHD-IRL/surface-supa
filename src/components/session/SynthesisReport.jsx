import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { AlertTriangle, CheckCircle2, GitBranch, Eye, Shield, Zap, ChevronRight, HelpCircle, TrendingUp } from 'lucide-react';
import { SCRS_BANDS, getPosture } from '@/lib/scrsEngine';

function SectionCard({ title, icon: Icon, iconColor, children, className }) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="flex items-center gap-2.5 px-5 py-3 border-b border-border bg-muted/30">
        {Icon && <Icon className={cn("w-4 h-4", iconColor || "text-muted-foreground")} />}
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      </div>
      <div className="p-5">
        {children}
      </div>
    </Card>
  );
}

function MarkdownSection({ text }) {
  if (!text) return <p className="text-sm text-muted-foreground italic">Not available</p>;
  return (
    <div className="prose prose-sm max-w-none text-foreground">
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}

function CompoundChainsSection({ chains }) {
  if (!chains?.length) return <p className="text-sm text-muted-foreground italic">No compound chains identified</p>;
  return (
    <div className="space-y-6">
      {chains.map((chain, ci) => (
        <div key={ci}>
          <h4 className="text-sm font-semibold text-foreground mb-3">{chain.name}</h4>
          <div className="space-y-2">
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
                  <div className={cn("flex-1 pb-2", !isLast && "border-b border-border/40")}>
                    <p className="text-sm text-foreground leading-relaxed pt-1">{step.step_text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ScrsGauge({ scrs, breakdown }) {
  if (scrs == null) return null;
  const posture = getPosture(scrs);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3 border-b border-border bg-muted/30">
        <Zap className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">SCRS — Systemic Critical Risk Score</h3>
      </div>
      <div className="p-5 space-y-4">
        {/* Score display */}
        <div className="flex items-center gap-4">
          <div
            className="text-5xl font-black tabular-nums"
            style={{ color: posture.color }}
          >
            {scrs}
          </div>
          <div>
            <div
              className="text-lg font-bold"
              style={{ color: posture.color }}
            >
              {posture.label}
            </div>
            <div className="text-sm text-muted-foreground">{posture.description}</div>
          </div>
        </div>

        {/* Gauge bar */}
        <div className="relative h-4 rounded-full overflow-hidden bg-muted">
          {/* Gradient background */}
          <div
            className="absolute inset-0 rounded-full"
            style={{ background: 'linear-gradient(to right, #27AE60, #2E86AB, #D68910, #C0392B)' }}
          />
          {/* Needle / marker */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-white shadow-md rounded-full"
            style={{ left: `calc(${scrs}% - 2px)` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
          <span>0</span>
          <span>25</span>
          <span>50</span>
          <span>75</span>
          <span>100</span>
        </div>

        {/* Breakdown table */}
        {breakdown && (
          <div className="border border-border rounded-md overflow-hidden mt-2">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Component</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Value</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Base Score (agent severity × expertise)', breakdown.baseScore],
                  ['Resilience Modifier (chain resilience)', breakdown.resilienceModifier],
                  ['Countermeasure Modifier', breakdown.countermeasureModifier],
                ].map(([label, val]) => (
                  <tr key={label} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2 text-muted-foreground">{label}</td>
                    <td className={cn("px-4 py-2 text-right font-mono font-semibold tabular-nums", val > 0 ? "text-foreground" : val < 0 ? "text-green-team" : "text-muted-foreground")}>
                      {val > 0 ? `+${val}` : val}
                    </td>
                  </tr>
                ))}
                <tr className="bg-muted/30">
                  <td className="px-4 py-2 font-semibold text-foreground">SCRS Total</td>
                  <td className="px-4 py-2 text-right font-black tabular-nums text-lg" style={{ color: posture.color }}>{scrs}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Band reference */}
        <div className="flex flex-wrap gap-2 pt-1">
          {SCRS_BANDS.map(band => (
            <div
              key={band.label}
              className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", scrs >= band.min && scrs <= band.max ? "ring-2 ring-offset-1" : "opacity-50")}
              style={{
                background: band.bg,
                borderColor: band.border,
                color: band.color,
                ...(scrs >= band.min && scrs <= band.max ? { ringColor: band.color } : {}),
              }}
            >
              {band.label} ({band.min}–{band.max})
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default function SynthesisReport({ synthesis, sessionAgents = [], agents = [] }) {
  if (!synthesis) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">Synthesis report not yet generated</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <SectionCard title="Consensus Findings" icon={CheckCircle2} iconColor="text-green-team">
        <MarkdownSection text={synthesis.consensus_findings} />
      </SectionCard>

      <SectionCard title="Contested Findings" icon={GitBranch} iconColor="text-amber-500">
        <MarkdownSection text={synthesis.contested_findings} />
      </SectionCard>

      <SectionCard title="Compound Threat Chains" icon={ChevronRight} iconColor="text-red-team">
        <CompoundChainsSection chains={synthesis.compound_chains} />
      </SectionCard>

      <SectionCard title="Blind Spots" icon={Eye} iconColor="text-muted-foreground">
        <div className="border-l-4 border-amber-500/40 pl-4">
          <MarkdownSection text={synthesis.blind_spots} />
        </div>
      </SectionCard>

      <SectionCard title="Priority Mitigations" icon={Shield} iconColor="text-blue-team">
        <MarkdownSection text={synthesis.priority_mitigations} />
      </SectionCard>

      <SectionCard title="Sharpest Insights" icon={AlertTriangle} iconColor="text-primary">
        <MarkdownSection text={synthesis.sharpest_insights} />
      </SectionCard>

      {synthesis.key_uncertainties && (
        <SectionCard title="Key Uncertainties" icon={HelpCircle} iconColor="text-amber-500">
          <MarkdownSection text={synthesis.key_uncertainties} />
        </SectionCard>
      )}

      {synthesis.escalation_indicators && (
        <SectionCard title="Escalation Indicators" icon={TrendingUp} iconColor="text-red-team">
          <div className="border-l-4 border-red-team/30 pl-4">
            <MarkdownSection text={synthesis.escalation_indicators} />
          </div>
        </SectionCard>
      )}

      <ScrsGauge scrs={synthesis.scrs_score} breakdown={synthesis.scrs_breakdown} />
    </div>
  );
}
