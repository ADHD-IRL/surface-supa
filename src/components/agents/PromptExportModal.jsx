import React, { useState, useMemo } from 'react';
import { X, Download, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildAgentSystemPrompt, resolveAgent } from '@/lib/agentData';
import { tagColor } from '@/components/agents/AgentCard';

function buildExportDocument(agents, scenario, domainMap) {
  const redAgents  = agents.filter(a => a.team === 'red');
  const blueAgents = agents.filter(a => a.team === 'blue');

  const agentLine = (a) => {
    const domain = a.domain_id ? (domainMap[a.domain_id]?.name || a.domain_id) : null;
    const parts = [a.name, a.discipline, domain].filter(Boolean);
    return parts.join(' | ');
  };

  const agentBlock = (a, index) => {
    const prompt = buildAgentSystemPrompt(a);
    const domain = a.domain_id ? (domainMap[a.domain_id]?.name || a.domain_id) : null;
    return [
      `### Agent ${index + 1}: ${a.name}`,
      `**Team:** ${a.team === 'red' ? 'Red (Attacker)' : 'Blue (Defender)'}`,
      domain ? `**Domain:** ${domain}` : null,
      a.discipline ? `**Discipline:** ${a.discipline}` : null,
      a.expertise_level ? `**Expertise:** ${a.expertise_level}` : null,
      a.reasoning_style ? `**Reasoning Style:** ${a.reasoning_style}` : null,
      a.severity_default ? `**Severity Lens:** ${a.severity_default}` : null,
      '',
      '**System Prompt (paste into your LLM):**',
      '```',
      prompt || '(no prompt configured)',
      '```',
    ].filter(v => v !== null).join('\n');
  };

  const scenarioSection = scenario.trim()
    ? [
        '## Scenario / Topic',
        scenario.trim(),
        '',
        '> Paste this scenario into each agent\'s first user message.',
        '',
      ].join('\n')
    : '';

  const lines = [
    '# Agent Debate — Manual Session Guide',
    '',
    `> Generated ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })} · ${agents.length} agent${agents.length !== 1 ? 's' : ''}`,
    '',
    '---',
    '',
    '## Overview',
    '',
    `This document contains system prompts for ${agents.length} agent${agents.length !== 1 ? 's' : ''} and instructions for running a structured debate manually across any LLM platform (ChatGPT, Claude, Gemini, etc.).`,
    '',
    '| Team | Agent |',
    '|------|-------|',
    ...redAgents.map(a  => `| 🔴 Red  | ${agentLine(a)} |`),
    ...blueAgents.map(a => `| 🔵 Blue | ${agentLine(a)} |`),
    '',
    '---',
    '',
    scenarioSection,
    '---',
    '',
    '## How to Run a Manual Session',
    '',
    '### Setup',
    '1. Open a **separate chat window** for each agent in your LLM of choice.',
    '2. Paste the agent\'s **System Prompt** (below) into the system/instructions field.',
    '3. Copy the **Scenario / Topic** into a text file — you\'ll paste it repeatedly.',
    '',
    '### Round 1 — Independent Assessment',
    '**Prompt to paste into EACH agent window:**',
    '```',
    (scenario.trim() || '<paste your scenario here>') + '\n\nProvide your independent threat assessment of this scenario. Be specific about the risks, attack vectors, or defensive gaps you identify. Do not hedge — state your position clearly.',
    '```',
    '',
    '> Collect each agent\'s response before moving to Round 2.',
    '',
    '### Round 2 — Cross-Examination',
    '**Prompt to paste into EACH agent window (after Round 1):**',
    '```',
    'Here are the assessments from the other agents in this debate:\n\n[PASTE OTHER AGENTS\' ROUND 1 RESPONSES HERE]\n\nChallenge the points you disagree with most. Identify gaps, overstatements, or missed vectors. Be direct.',
    '```',
    '',
    '### Round 3 — Synthesis (optional)',
    '**Prompt to paste into EACH agent window:**',
    '```',
    'Given the full debate so far, what is your final position? What have you updated your views on, and what do you maintain? Summarize in 3-5 bullet points.',
    '```',
    '',
    '### Facilitator Notes',
    '- **Contradiction = signal**: When agents disagree sharply, that gap is worth exploring.',
    '- **Red agents** should push on attack feasibility; **Blue agents** should push on detection and mitigation.',
    '- If an agent\'s response feels thin, prompt: *"What specific evidence or precedent supports that claim?"*',
    '- Track where multiple agents independently converge — those are your highest-confidence findings.',
    '',
    '---',
    '',
    '## Agent System Prompts',
    '',
    redAgents.length > 0 ? '### Red Team — Attackers\n' : null,
    ...redAgents.map((a, i) => agentBlock(a, i) + '\n'),
    blueAgents.length > 0 ? '### Blue Team — Defenders\n' : null,
    ...blueAgents.map((a, i) => agentBlock(a, redAgents.length + i) + '\n'),
    '---',
    '',
    '*End of manual session guide.*',
  ].filter(v => v !== null).join('\n');

  return lines;
}

export default function PromptExportModal({ agents: rawAgents, domainMap = {}, onClose }) {
  const agents = useMemo(() => rawAgents.map(resolveAgent), [rawAgents]);

  const [scenario, setScenario] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set(agents.map(a => a.id)));
  const [copied, setCopied] = useState(false);
  const [expandedAgent, setExpandedAgent] = useState(null);

  const selectedAgents = useMemo(
    () => agents.filter(a => selectedIds.has(a.id)),
    [agents, selectedIds]
  );

  const doc = useMemo(
    () => buildExportDocument(selectedAgents, scenario, domainMap),
    [selectedAgents, scenario, domainMap]
  );

  const toggleAgent = (id) => {
    setSelectedIds(s => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(doc);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([doc], { type: 'text/markdown' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `agent-session-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const redAgents  = agents.filter(a => a.team === 'red');
  const blueAgents = agents.filter(a => a.team === 'blue');

  const TeamSection = ({ label, color, items }) => (
    <div>
      <p className="text-[10px] font-bold tracking-widest uppercase mb-1.5" style={{ color }}>{label}</p>
      <div className="space-y-1">
        {items.map(a => {
          const checked = selectedIds.has(a.id);
          const domain  = a.domain_id ? (domainMap[a.domain_id]?.name || a.domain_id) : null;
          const expanded = expandedAgent === a.id;
          const prompt   = buildAgentSystemPrompt(a);
          return (
            <div key={a.id} className="border border-border rounded-md overflow-hidden">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleAgent(a.id)}
                  className="accent-primary flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{a.name}</p>
                  {domain && <p className="text-[10px] text-muted-foreground truncate">{domain}</p>}
                </div>
                <button
                  onClick={() => setExpandedAgent(expanded ? null : a.id)}
                  className="text-muted-foreground hover:text-foreground p-0.5 flex-shrink-0"
                  title="Preview prompt"
                >
                  {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
              {expanded && (
                <div className="border-t border-border bg-muted/30 px-3 py-2">
                  <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto">
                    {prompt || '(no prompt)'}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-5xl mx-4 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-sm font-bold tracking-widest font-mono">EXPORT PROMPTS</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Generate a manual session guide for use in any LLM</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">

          {/* Left panel — config */}
          <div className="w-64 flex-shrink-0 border-r border-border p-4 space-y-4 overflow-y-auto">

            <div>
              <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase block mb-1.5">
                Scenario / Topic
              </label>
              <textarea
                value={scenario}
                onChange={e => setScenario(e.target.value)}
                placeholder="Describe the scenario or threat to debate…"
                rows={4}
                className="w-full text-xs rounded border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground p-2 resize-none outline-none focus:border-primary/40"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Optional — embedded in round 1 prompt</p>
            </div>

            <div className="border-t border-border pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Agents</span>
                <div className="flex gap-2 text-[10px] text-muted-foreground">
                  <button onClick={() => setSelectedIds(new Set(agents.map(a => a.id)))} className="hover:text-foreground">All</button>
                  <button onClick={() => setSelectedIds(new Set())} className="hover:text-foreground">None</button>
                </div>
              </div>
              {redAgents.length > 0 && <TeamSection label="Red Team" color="#DC2626" items={redAgents} />}
              {blueAgents.length > 0 && <TeamSection label="Blue Team" color="#2563EB" items={blueAgents} />}
            </div>
          </div>

          {/* Right panel — preview */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border flex-shrink-0 bg-muted/20">
              <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                Preview — {selectedAgents.length} agent{selectedAgents.length !== 1 ? 's' : ''}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border transition-colors",
                    copied
                      ? "border-green-500 text-green-600 bg-green-500/10"
                      : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Download .md
                </button>
              </div>
            </div>
            <pre className="flex-1 overflow-auto p-4 text-[11px] font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {doc}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
