import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  BookOpen, Cpu, Shield, Swords, Users, BarChart2, FileDown,
  ChevronRight, CheckCircle2, Zap, GitBranch, Brain, Target, Plus
} from 'lucide-react';

// ── Shared primitives ──────────────────────────────────────────────────────────

function Section({ id, title, icon: Icon, children, className }) {
  return (
    <section id={id} className={cn('space-y-4', className)}>
      <div className="flex items-center gap-2.5 pb-2 border-b border-border">
        {Icon && <Icon className="w-4 h-4 text-primary flex-shrink-0" />}
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function SubSection({ title, children }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Callout({ variant = 'info', children }) {
  const styles = {
    info:    'bg-blue-500/8 border-blue-500/30 text-blue-200',
    warn:    'bg-amber-500/8 border-amber-500/30 text-amber-200',
    success: 'bg-green-500/8 border-green-500/30 text-green-200',
    red:     'bg-red-500/8  border-red-500/30  text-red-200',
  };
  return (
    <div className={cn('border rounded-md px-4 py-3 text-sm leading-relaxed', styles[variant])}>
      {children}
    </div>
  );
}

function Step({ n, title, children }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary">
        {n}
      </div>
      <div className="flex-1 pb-4">
        <p className="text-sm font-semibold text-foreground mb-1">{title}</p>
        <div className="text-sm text-muted-foreground leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function PropRow({ name, type, desc }) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2 pr-4 font-mono text-xs text-primary align-top whitespace-nowrap">{name}</td>
      <td className="py-2 pr-4 align-top">
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">{type}</Badge>
      </td>
      <td className="py-2 text-sm text-muted-foreground leading-relaxed">{desc}</td>
    </tr>
  );
}

function SevBadge({ sev }) {
  const cls = {
    CRITICAL: 'bg-red-500/10 text-red-400 border-red-500/30',
    HIGH:     'bg-orange-500/10 text-orange-400 border-orange-500/30',
    MEDIUM:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    LOW:      'bg-green-500/10 text-green-400 border-green-500/30',
  }[sev] || '';
  return <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', cls)}>{sev}</Badge>;
}

// ── Table of contents ──────────────────────────────────────────────────────────

const USER_TOC = [
  { id: 'ug-what',     label: 'What is Surface?' },
  { id: 'ug-start',    label: 'Getting Started' },
  { id: 'ug-session',  label: 'Creating a Session' },
  { id: 'ug-run',      label: 'Running an Analysis' },
  { id: 'ug-results',  label: 'Reading Results' },
  { id: 'ug-agents',   label: 'Managing Agents' },
  { id: 'ug-export',   label: 'Exporting Reports' },
];

const TECH_TOC = [
  { id: 'tc-arch',     label: 'Architecture' },
  { id: 'tc-v2',       label: 'V2 Debate Format' },
  { id: 'tc-scrs',     label: 'SCRS Scoring' },
  { id: 'tc-models',   label: 'Data Models' },
  { id: 'tc-agents',   label: 'Agent Configuration' },
  { id: 'tc-prompts',  label: 'Prompt System' },
];

function Toc({ items }) {
  return (
    <Card className="p-4 sticky top-6">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">On this page</p>
      <ul className="space-y-1">
        {items.map(item => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors py-0.5"
            >
              <ChevronRight className="w-3 h-3 flex-shrink-0" />
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ── User Guide ─────────────────────────────────────────────────────────────────

function UserGuide() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-8 items-start">
      <div className="space-y-10 min-w-0">

        <Section id="ug-what" title="What is Surface?" icon={Shield}>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Surface is an adversarial risk intelligence platform that orchestrates structured debates
            between AI agents to surface risks that single-perspective analysis misses.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Rather than asking one model "what could go wrong?", Surface assigns multiple specialist
            personas to <span className="text-red-400 font-medium">Red Team</span> (attacker mindset — exploit
            paths, threat vectors) and <span className="text-blue-400 font-medium">Blue Team</span> (defender
            mindset — detection gaps, systemic resilience failures) roles. Agents challenge each other's
            assessments across two rounds, forcing a richer, more adversarial analysis than any single
            prompt can produce.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: Swords, label: 'Red Team', desc: 'Threat identification, attack vectors, exploitation paths', color: 'text-red-400' },
              { icon: Shield, label: 'Blue Team', desc: 'Detection gaps, defensive exposure, resilience failures', color: 'text-blue-400' },
              { icon: Brain,  label: 'Synthesis', desc: 'Consensus findings, blind spots, SCRS composite score', color: 'text-primary' },
            ].map(({ icon: Icon, label, desc, color }) => (
              <Card key={label} className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Icon className={cn('w-4 h-4', color)} />
                  <span className="text-sm font-semibold">{label}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </Card>
            ))}
          </div>
        </Section>

        <Section id="ug-start" title="Getting Started" icon={Zap}>
          <div className="space-y-0">
            <Step n={1} title="Open the Dashboard">
              The Dashboard shows your recent sessions, agent roster, and summary statistics.
              Click <strong>New Session</strong> in the sidebar or the Dashboard button to begin.
            </Step>
            <Step n={2} title="Create agents (optional)">
              Surface ships with default agents. To customise, go to <strong>Agents</strong> in the sidebar.
              You can import a JSON roster or create agents manually with tailored personas, biases and focus areas.
            </Step>
            <Step n={3} title="Create and run a session">
              Write a scenario, select agents, choose a mode, then click <strong>Run Analysis</strong>.
              The debate runs automatically — no further input is needed until it completes.
            </Step>
            <Step n={4} title="Review results">
              When complete, the session opens to four tabs: <em>Debate</em>, <em>Report</em>,
              <em>Risks</em>, and <em>Chains</em>. Export a PDF for stakeholder sharing.
            </Step>
          </div>
        </Section>

        <Section id="ug-session" title="Creating a Session" icon={Plus}>
          <SubSection title="Required fields">
            <div className="text-sm text-muted-foreground space-y-1">
              <p><span className="font-medium text-foreground">Title</span> — A short name for the analysis (e.g. "Q3 Vendor Onboarding Risk Review")</p>
              <p><span className="font-medium text-foreground">Scenario</span> — The situation to analyse. Be specific: include the organisation type, context, constraints, and what you want agents to focus on.</p>
            </div>
          </SubSection>
          <SubSection title="Optional fields">
            <div className="text-sm text-muted-foreground space-y-1">
              <p><span className="font-medium text-foreground">Reference URLs</span> — Links to relevant documents, policies, or threat reports. Agents receive these as context.</p>
              <p><span className="font-medium text-foreground">File uploads</span> — PDFs or text files attached to the session for agent reference.</p>
              <p><span className="font-medium text-foreground">Agent selection</span> — Leave empty to use all active agents, or pick specific agents. Agents are grouped by domain.</p>
              <p><span className="font-medium text-foreground">Mode</span> — Controls how many rounds run:</p>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {[
                { mode: 'Rapid', desc: '1 R1+R2 cycle, fastest', badge: 'bg-blue-500/10 text-blue-400' },
                { mode: 'Standard', desc: '1 R1+R2 cycle, default', badge: 'bg-green-500/10 text-green-400' },
                { mode: 'Deep', desc: '2 full R1+R2 cycles', badge: 'bg-amber-500/10 text-amber-400' },
              ].map(({ mode, desc, badge }) => (
                <Card key={mode} className="p-3 space-y-1">
                  <Badge className={cn('text-xs', badge)}>{mode}</Badge>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </Card>
              ))}
            </div>
          </SubSection>
          <Callout variant="info">
            <strong>Tip:</strong> Use a prior completed session as a template via <strong>Re-run</strong> on the session detail page.
            The new session inherits the scenario and agent selection, letting you test scenario variants.
          </Callout>
        </Section>

        <Section id="ug-run" title="Running an Analysis" icon={Target}>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Click <strong>Run Analysis</strong> on the session detail page. Surface automatically runs
            the full V2 debate pipeline — no interaction needed while it runs.
          </p>
          <SubSection title="Live progress indicators">
            <div className="text-sm text-muted-foreground space-y-2">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                <p><span className="font-medium text-foreground">Round 1 — Independent Assessments</span>: Each agent analyses the scenario independently. You'll see a per-agent progress indicator showing which agent is currently generating.</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                <p><span className="font-medium text-foreground">Round 2 — Rebuttals</span>: Each agent reads all R1 assessments and writes a rebuttal naming specific allies and opponents.</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <p><span className="font-medium text-foreground">Synthesis</span>: A final pass generates consensus findings, contested points, compound chains, blind spots, mitigations, and the SCRS score.</p>
              </div>
            </div>
          </SubSection>
          <Callout variant="warn">
            Do not close the page while the analysis is running. If the session status shows <Badge variant="outline" className="text-xs text-red-400 border-red-400/30">Failed</Badge>, open
            browser DevTools → Console to see the specific error, then click Run Analysis again.
          </Callout>
        </Section>

        <Section id="ug-results" title="Reading Results" icon={BarChart2}>
          <SubSection title="Debate tab">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Shows all agent assessments split into two cards — <strong>Round 1</strong> (independent views)
              and <strong>Round 2</strong> (rebuttals). Each row shows the agent name, team badge,
              severity rating, and full markdown text. A severity shift arrow (↑/↓) appears when an agent
              revised their rating between rounds.
            </p>
          </SubSection>
          <SubSection title="Report tab">
            <div className="text-sm text-muted-foreground space-y-1.5">
              <p>The synthesis report has six named sections:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Consensus Findings</strong> — risks multiple agents agreed on, ordered by severity</li>
                <li><strong>Contested Findings</strong> — significant disagreements between named agents</li>
                <li><strong>Compound Chains</strong> — multi-step threat sequences that emerged from agents building on each other</li>
                <li><strong>Blind Spots</strong> — vectors no agent adequately covered</li>
                <li><strong>Priority Mitigations</strong> — immediate/short-term/long-term recommended actions</li>
                <li><strong>Sharpest Insights</strong> — the most surprising or important statements, attributed to agents</li>
              </ul>
              <p className="pt-1">Below the sections, the <strong>SCRS gauge</strong> shows the Systemic Critical Risk Score (0–100) with a colour-coded posture label.</p>
            </div>
          </SubSection>
          <SubSection title="Risks tab">
            <p className="text-sm text-muted-foreground leading-relaxed">
              For V1 sessions: a risk registry table with likelihood × impact scoring and a 5×5 heatmap.
              For V2 sessions: the priority mitigations from synthesis, displayed as an action list.
            </p>
          </SubSection>
          <SubSection title="Chains tab">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Attack chains visualised as step-by-step diagrams. Each chain shows the sequence from
              initial access through to impact, with step labels and descriptions.
            </p>
          </SubSection>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { label: 'CRITICAL', desc: 'SCRS 80–100 — Immediate action required', sev: 'CRITICAL' },
              { label: 'HIGH',     desc: 'SCRS 60–79 — Prioritise controls', sev: 'HIGH' },
              { label: 'MEDIUM',   desc: 'SCRS 40–59 — Planned controls sufficient', sev: 'MEDIUM' },
              { label: 'LOW',      desc: 'SCRS 0–39 — Residual risk acceptable', sev: 'LOW' },
            ].map(({ label, desc, sev }) => (
              <div key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
                <SevBadge sev={sev} />
                <span>{desc}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section id="ug-agents" title="Managing Agents" icon={Users}>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Navigate to <strong>Agents</strong> in the sidebar. Each agent belongs to a team
            (Red or Blue) and a domain. Key fields that shape debate quality:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                <PropRow name="persona_description" type="string" desc="3–4 sentence career history and worldview. Sets the agent's voice and perspective." />
                <PropRow name="cognitive_bias"      type="string" desc="What this agent systematically underweights. Used to generate authentic blind spots." />
                <PropRow name="focus"               type="string" desc="Primary focus: threats hunted (red) or defences championed (blue)." />
                <PropRow name="reasoning_style"     type="enum"   desc="Analytical, Intuitive, Contrarian, Systematic, or Probabilistic — shapes argumentation style." />
                <PropRow name="expertise_level"     type="enum"   desc="Junior through World-Class. Affects SCRS score weighting (World-Class = 1.0×, Junior = 0.6×)." />
                <PropRow name="severity_default"    type="enum"   desc="Baseline severity lens. Contrarian agents may default HIGH to challenge consensus." />
              </tbody>
            </table>
          </div>
          <Callout variant="info">
            <strong>Import agents</strong> via the Import button — paste a JSON array of agent objects.
            Domains referenced in the import are created automatically.
          </Callout>
        </Section>

        <Section id="ug-export" title="Exporting Reports" icon={FileDown}>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Click <strong>Export PDF</strong> on any completed session. The PDF is generated client-side
            and downloads immediately — no server round-trip.
          </p>
          <SubSection title="V1 PDF includes">
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-0.5 ml-2">
              <li>Cover page with session title and date</li>
              <li>Session metadata (mode, agents, scenario)</li>
              <li>Risk registry table with likelihood × impact scoring</li>
              <li>Attack chains</li>
              <li>Full debate transcript (red/blue per round)</li>
              <li>Mitigation playbook (if generated)</li>
            </ul>
          </SubSection>
          <SubSection title="V2 PDF includes">
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-0.5 ml-2">
              <li>Cover page</li>
              <li>Scenario summary</li>
              <li>Per-agent R1 assessments with severity ratings</li>
              <li>Per-agent R2 rebuttals with severity revision arrows</li>
              <li>All six synthesis sections</li>
              <li>SCRS score with colour-coded posture</li>
            </ul>
          </SubSection>
        </Section>

      </div>

      {/* ToC */}
      <div className="hidden lg:block">
        <Toc items={USER_TOC} />
      </div>
    </div>
  );
}

// ── Technical Overview ─────────────────────────────────────────────────────────

function TechOverview() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-8 items-start">
      <div className="space-y-10 min-w-0">

        <Section id="tc-arch" title="Architecture" icon={Cpu}>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Surface is a single-page React application backed by the base44 platform. There is no
            custom backend — all persistence and LLM calls are handled by the base44 SDK.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: 'Frontend',    items: ['React 18 + Vite', 'TanStack Query v5', 'Tailwind CSS + shadcn/ui', 'React Router v6'] },
              { label: 'Backend',     items: ['base44 entity API', 'base44 InvokeLLM', 'base44 UploadFile', 'base44 Auth'] },
              { label: 'Persistence', items: ['Session entity (JSONB fields)', 'Agent entity', 'Domain entity', 'UploadFile CDN for large payloads'] },
              { label: 'PDF Export',  items: ['jsPDF (client-side)', 'No server round-trip', 'Generated on demand'] },
            ].map(({ label, items }) => (
              <Card key={label} className="p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
                <ul className="text-sm text-muted-foreground space-y-0.5">
                  {items.map(i => <li key={i} className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-primary flex-shrink-0" />{i}</li>)}
                </ul>
              </Card>
            ))}
          </div>
          <SubSection title="Key source files">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  <PropRow name="src/pages/SessionDetail.jsx"          type="page"      desc="Central orchestrator — runs the debate mutation, renders all tabs." />
                  <PropRow name="src/lib/agentData.js"                 type="library"   desc="All prompt builders: buildR1Prompt, buildR2Prompt, buildSynthesisPrompt, parseSeverityFromText, extractSynthesisSections." />
                  <PropRow name="src/lib/scrsEngine.js"                type="library"   desc="SCRS computation: computeSCRS, SCRS_BANDS, getPosture." />
                  <PropRow name="src/lib/asyncPool.js"                 type="utility"   desc="Bounded-concurrency async iterator for parallel LLM calls." />
                  <PropRow name="src/components/session/DebateRound.jsx"   type="component" desc="DebateRound (V1) + DebateRoundV2 exports for per-agent display." />
                  <PropRow name="src/components/session/SynthesisReport.jsx" type="component" desc="Six-section synthesis display + SCRS gauge." />
                </tbody>
              </table>
            </div>
          </SubSection>
        </Section>

        <Section id="tc-v2" title="V2 Debate Format" icon={GitBranch}>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The V2 format replaces the sequential Red→Blue per-round loop with a structured
            three-phase pipeline that produces richer, more adversarial outputs.
          </p>
          <div className="space-y-3">
            {[
              {
                phase: 'Phase 1 — R1 (Independent Assessment)',
                color: 'border-amber-500/40 bg-amber-500/5',
                items: [
                  'All selected agents run simultaneously (asyncPool, concurrency=1)',
                  'Each agent receives only the scenario — no visibility of peers',
                  'Prompt instructs: opening position, top threat, second threat, invalidating assumption, key finding',
                  'Final line must be SEVERITY: [CRITICAL|HIGH|MEDIUM|LOW]',
                  'parseSeverityFromText() strips the severity line and stores assessment + severity separately',
                ],
              },
              {
                phase: 'Phase 2 — R2 (Rebuttals)',
                color: 'border-blue-500/40 bg-blue-500/5',
                items: [
                  'All R1 assessments collected; each agent receives the full set excluding their own',
                  'Prompt instructs: name strongest ally, name strongest opponent, revise severity if persuaded',
                  'Forces named attribution — agents cannot vaguely "agree" or "disagree"',
                  'Severity revision tracked (round1_severity vs round2_revised_severity)',
                ],
              },
              {
                phase: 'Phase 3 — Synthesis',
                color: 'border-primary/40 bg-primary/5',
                items: [
                  'Single LLM call with all R1+R2 content (truncated to 500/400 chars each to fit context)',
                  'Six ## headings instruct structured output: CONSENSUS FINDINGS, CONTESTED FINDINGS, COMPOUND CHAINS, BLIND SPOTS, PRIORITY MITIGATIONS, SHARPEST INSIGHTS',
                  'extractSynthesisSections() splits on ## headings; COMPOUND CHAINS parsed into [{name, steps}]',
                  'computeSCRS() calculates composite risk score from severity weights × expertise multipliers',
                  'Full JSON payload uploaded via UploadFile; URL stored in executive_summary as "v2url:<url>"',
                ],
              },
            ].map(({ phase, color, items }) => (
              <Card key={phase} className={cn('p-4 border', color)}>
                <p className="text-sm font-semibold text-foreground mb-2">{phase}</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-primary mt-0.5 flex-shrink-0">›</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
          <SubSection title="Storage strategy">
            <p className="text-sm text-muted-foreground leading-relaxed">
              All V2 data is stored in existing Session fields to avoid schema deployment dependencies:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  <PropRow name="executive_summary" type="string" desc='"v2url:<cdn_url>" — URL to the uploaded JSON blob containing agent_results + all synthesis sections.' />
                  <PropRow name="attack_chains"     type="array"  desc="Compound chains from synthesis in V1-compatible format ({id, name, steps:[{label, description}]})." />
                  <PropRow name="status"            type="enum"   desc="running → completed (or failed). debate_format=v2 written but may not be returned by backend." />
                </tbody>
              </table>
            </div>
          </SubSection>
          <SubSection title="V2 JSON payload schema">
            <Card className="p-4 bg-muted/30 font-mono text-xs text-muted-foreground space-y-0.5">
              <p>{'{'}</p>
              <p className="pl-4">"_v2": true,</p>
              <p className="pl-4">"agent_results": [{'{'} agent_id, agent_name, team, discipline,</p>
              <p className="pl-8">round1_assessment, round1_severity,</p>
              <p className="pl-8">round2_rebuttal, round2_revised_severity, status {'}'}],</p>
              <p className="pl-4">"consensus_findings": "string",</p>
              <p className="pl-4">"contested_findings": "string",</p>
              <p className="pl-4">"blind_spots": "string",</p>
              <p className="pl-4">"priority_mitigations": "string",</p>
              <p className="pl-4">"sharpest_insights": "string",</p>
              <p className="pl-4">"scrs_score": 0–100,</p>
              <p className="pl-4">"scrs_breakdown": {'{'} baseScore, resilienceModifier, countermeasureModifier, coveragePct, ... {'}'}</p>
              <p>{'}'}</p>
            </Card>
          </SubSection>
        </Section>

        <Section id="tc-scrs" title="SCRS Scoring" icon={BarChart2}>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The <strong>Systemic Critical Risk Score (SCRS)</strong> is a 0–100 composite that aggregates
            agent severity findings, weighted by expertise, adjusted for chain resilience and applied
            countermeasures.
          </p>
          <SubSection title="Formula">
            <Card className="p-4 bg-muted/30 font-mono text-sm space-y-1">
              <p className="text-foreground">SCRS = clamp(BaseScore + ResilienceModifier + CountermeasureModifier, 0, 100)</p>
              <p className="text-muted-foreground text-xs mt-2">BaseScore = (Σ SEV_WEIGHT[sev] × EXPERTISE_MULT[level]) / (n × 4) × 100</p>
            </Card>
          </SubSection>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SubSection title="Severity weights (SEV_WEIGHT)">
              <div className="space-y-1">
                {[['CRITICAL','4'],['HIGH','3'],['MEDIUM','2'],['LOW','1']].map(([s,w]) => (
                  <div key={s} className="flex items-center gap-2 text-sm">
                    <SevBadge sev={s} />
                    <span className="text-muted-foreground">× {w}</span>
                  </div>
                ))}
              </div>
            </SubSection>
            <SubSection title="Expertise multipliers">
              <div className="space-y-1 text-sm text-muted-foreground">
                {[['World-Class','1.0'],['Principal','0.9'],['Senior','0.8'],['Mid-Level','0.7'],['Junior','0.6']].map(([l,m]) => (
                  <div key={l} className="flex justify-between"><span>{l}</span><span className="font-mono text-foreground">×{m}</span></div>
                ))}
              </div>
            </SubSection>
          </div>
          <SubSection title="Modifiers">
            <div className="text-sm text-muted-foreground space-y-1">
              <p><span className="font-medium text-foreground">Resilience Modifier</span>: Each compound chain contributes 0 (HIGH resilience), −5 (MEDIUM), or −10 (LOW). Capped at −25 total.</p>
              <p><span className="font-medium text-foreground">Countermeasure Modifier</span>: Coverage of HIGH-leverage chain steps reduces score by up to −20 points.</p>
            </div>
          </SubSection>
          <SubSection title="Posture bands">
            <div className="space-y-1">
              {[
                { range:'80–100', label:'CRITICAL', sev:'CRITICAL', desc:'Immediate action required' },
                { range:'60–79',  label:'HIGH',     sev:'HIGH',     desc:'Significant exposure — prioritise controls' },
                { range:'40–59',  label:'MEDIUM',   sev:'MEDIUM',   desc:'Manageable with planned controls' },
                { range:'0–39',   label:'LOW',      sev:'LOW',      desc:'Residual risk acceptable' },
              ].map(({ range, sev, desc }) => (
                <div key={range} className="flex items-center gap-3 text-sm">
                  <span className="font-mono text-xs text-muted-foreground w-14">{range}</span>
                  <SevBadge sev={sev} />
                  <span className="text-muted-foreground">{desc}</span>
                </div>
              ))}
            </div>
          </SubSection>
        </Section>

        <Section id="tc-models" title="Data Models" icon={Cpu}>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Entity schemas live in <code className="text-xs bg-muted px-1 py-0.5 rounded">base44/entities/*.jsonc</code>.
            base44 auto-creates columns on first write for fields defined in the schema.
            Fields added after initial deployment may not be returned by queries until the backend
            schema is redeployed — Surface works around this by using only pre-existing fields.
          </p>
          {[
            {
              name: 'Session',
              required: 'title, scenario',
              key: [
                ['status', 'enum', 'draft | running | completed | failed'],
                ['mode', 'enum', 'standard | deep | rapid'],
                ['selected_agents', 'string[]', 'Agent IDs included in this session'],
                ['executive_summary', 'string', 'V2: "v2url:<cdn>" pointing to uploaded JSON. V1: plain text.'],
                ['attack_chains', 'array', 'Compound threat chains in V1-compatible step format'],
                ['rounds', 'array', 'V1 debate rounds with red_responses / blue_responses per round'],
                ['risk_registry', 'array', 'V1: [{id, title, category, likelihood, impact, mitigation, owner, status}]'],
                ['mitigation_playbook', 'object', 'V1: {overview, actions:[{priority, title, description, steps[]}]}'],
              ],
            },
            {
              name: 'Agent',
              required: 'name, team',
              key: [
                ['team', 'enum', 'red | blue'],
                ['expertise_level', 'enum', 'Junior | Mid-Level | Senior | Principal | World-Class'],
                ['reasoning_style', 'enum', 'Analytical | Intuitive | Contrarian | Systematic | Probabilistic'],
                ['system_prompt', 'string', 'JSON blob (_v: 1) storing all rich fields for base44 compat. Decoded by resolveAgent().'],
                ['domain_id', 'string', 'FK to Domain entity. Used for grouping in agent selector.'],
                ['is_default', 'boolean', 'Built-in agents show a badge; can be deactivated but not deleted.'],
              ],
            },
            {
              name: 'Domain',
              required: 'name',
              key: [
                ['name', 'string', 'e.g. "Cyber", "Geopolitical", "Supply Chain"'],
                ['color', 'string', 'Hex color used for domain pill and agent selector grouping'],
              ],
            },
          ].map(({ name, required, key }) => (
            <SubSection key={name} title={name}>
              <p className="text-xs text-muted-foreground mb-2">Required: <code className="bg-muted px-1 rounded">{required}</code></p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {key.map(([f, t, d]) => <PropRow key={f} name={f} type={t} desc={d} />)}
                  </tbody>
                </table>
              </div>
            </SubSection>
          ))}
        </Section>

        <Section id="tc-agents" title="Agent Configuration" icon={Users}>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Agents are stored with a dual-field pattern for base44 compatibility. Rich fields
            (persona_description, cognitive_bias, focus, vectors, etc.) are encoded into
            <code className="text-xs bg-muted px-1 py-0.5 rounded mx-1">system_prompt</code>
            as a JSON blob at save time. <code className="text-xs bg-muted px-1 py-0.5 rounded">resolveAgent()</code>
            decodes this on read and merges it with any scalar fields returned by the API.
          </p>
          <SubSection title="system_prompt JSON blob structure">
            <Card className="p-4 bg-muted/30 font-mono text-xs text-muted-foreground space-y-0.5">
              <p>{'{'}</p>
              <p className="pl-4">"_v": 1,</p>
              <p className="pl-4">"name": "...", "team": "red|blue", "discipline": "...",</p>
              <p className="pl-4">"persona_description": "3–4 sentences",</p>
              <p className="pl-4">"professional_background": "...",</p>
              <p className="pl-4">"cognitive_bias": "What this agent underweights",</p>
              <p className="pl-4">"focus": "Primary threat focus or defence championed",</p>
              <p className="pl-4">"expertise_level": "Senior",</p>
              <p className="pl-4">"reasoning_style": "Analytical",</p>
              <p className="pl-4">"severity_default": "HIGH",</p>
              <p className="pl-4">"vector_human": 50, "vector_technical": 70,</p>
              <p className="pl-4">"vector_physical": 30, "vector_futures": 40</p>
              <p>{'}'}</p>
            </Card>
          </SubSection>
          <Callout variant="info">
            The <strong>cognitive_bias</strong> field is the highest-leverage field for debate quality.
            When agents have different biases they generate authentic disagreements rather than
            converging on consensus. Good examples: "overweights technical controls, underweights
            insider threat", "assumes regulatory compliance equals security".
          </Callout>
        </Section>

        <Section id="tc-prompts" title="Prompt System" icon={Brain}>
          <p className="text-sm text-muted-foreground leading-relaxed">
            All prompt builders live in <code className="text-xs bg-muted px-1 py-0.5 rounded">src/lib/agentData.js</code>.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                <PropRow name="buildR1Prompt(agent, scenarioContext)" type="fn" desc="Returns R1 prompt. Header = agentHeader() (persona, bias, role label) + scenario + 5-point structure + SEVERITY instruction." />
                <PropRow name="buildR2Prompt(agent, scenarioContext, othersAssessments)" type="fn" desc="Returns R2 prompt. Includes formatted R1s from all other agents. Instructs: ally, opponent, revision." />
                <PropRow name="buildSynthesisPrompt(session, agentRows, scenarioContext)" type="fn" desc="Returns synthesis prompt. Truncates each agent's R1 to 500 chars, R2 to 400 chars. Six ## heading instructions." />
                <PropRow name="parseSeverityFromText(text)" type="fn" desc='Extracts "SEVERITY: X" from last line. Returns {assessment, severity}. Falls back to last-3-lines scan then "HIGH".' />
                <PropRow name="extractSynthesisSections(rawText)" type="fn" desc="Splits on ## headings, returns 6-key object. Compound chains parsed into [{name, steps:[{step_number, step_text}]}]." />
                <PropRow name="formatOthersAssessments(agentRows, excludeId)" type="fn" desc="Formats peer R1s for R2 prompt. Excludes the calling agent. Skips agents with no R1 text." />
              </tbody>
            </table>
          </div>
          <Callout variant="warn">
            <strong>Context window:</strong> The synthesis prompt includes all agent R1s (truncated to 500 chars each)
            and R2s (400 chars each). With 8+ agents this approaches ~12,000 tokens. If synthesis fails with a
            context length error, reduce the number of selected agents or shorten the scenario.
          </Callout>
        </Section>

      </div>

      {/* ToC */}
      <div className="hidden lg:block">
        <Toc items={TECH_TOC} />
      </div>
    </div>
  );
}

// ── Page root ──────────────────────────────────────────────────────────────────

export default function Docs() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Documentation</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          User guide and technical reference for Surface adversarial risk intelligence.
        </p>
      </div>

      <Tabs defaultValue="user">
        <TabsList>
          <TabsTrigger value="user" className="gap-2">
            <BookOpen className="w-3.5 h-3.5" /> User Guide
          </TabsTrigger>
          <TabsTrigger value="tech" className="gap-2">
            <Cpu className="w-3.5 h-3.5" /> Technical Overview
          </TabsTrigger>
        </TabsList>
        <TabsContent value="user" className="mt-6">
          <UserGuide />
        </TabsContent>
        <TabsContent value="tech" className="mt-6">
          <TechOverview />
        </TabsContent>
      </Tabs>
    </div>
  );
}
