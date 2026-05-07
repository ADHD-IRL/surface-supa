import React, { useState, useRef } from 'react';
import { X, Upload, CheckCircle2, AlertCircle, Loader2, FileText, ChevronDown, ChevronUp, Tag } from 'lucide-react';
import { encodeAgentData } from '@/lib/agentData';
import { tagColor } from '@/components/agents/AgentCard';

// ── Parser ────────────────────────────────────────────────────────────────────

function getSection(lines, startIdx, label) {
  const sameLine = lines[startIdx].replace(new RegExp(`.*\\*\\*${label}:\\*\\*\\s*`, 'i'), '').trim();
  if (sameLine) return sameLine;
  const result = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^\*\*\w/.test(lines[i]) || /^#{1,3}\s/.test(lines[i]) || /^---/.test(lines[i])) break;
    if (lines[i].trim()) result.push(lines[i].replace(/^-\s*/, '').trim());
  }
  return result.join(' ') || null;
}

function parseAgentBlock(blockLines) {
  const agent = {
    name: '', discipline: '', persona_description: '', cognitive_bias: '',
    focus: '', professional_background: '',
    severity_default: 'HIGH',
    vector_human: 50, vector_technical: 50, vector_physical: 30, vector_futures: 40,
    domain_tags: [], expertise_level: 'Senior', reasoning_style: 'Analytical',
    _domain_name: '',
  };

  const h2 = blockLines.find(l => l.startsWith('## '));
  if (h2) {
    const nameMatch = h2.match(/^##\s+(?:[\w-]+\s+[—–-]+\s+)?(.+)/);
    if (nameMatch) agent.name = nameMatch[1].trim();
    const discMatch = agent.name.match(/[\/,]\s*(.+)$/);
    agent.discipline = discMatch ? discMatch[1].trim() : agent.name;
  }

  const findAndGet = (label) => {
    const idx = blockLines.findIndex(l => new RegExp(`\\*\\*${label}:\\*\\*`, 'i').test(l));
    return idx === -1 ? null : getSection(blockLines, idx, label);
  };

  // **Category:** or **Domain:** → primary domain (creates/finds Domain entity on import)
  const category = findAndGet('Domain') || findAndGet('Category');
  if (category) {
    agent._domain_name = category.trim();
  }

  const persona = findAndGet('Persona');
  if (persona) agent.persona_description = persona;

  const bias = findAndGet('Cognitive Bias');
  if (bias) agent.cognitive_bias = bias;

  const focus = findAndGet('Primary Focus') || findAndGet('Red Team Focus') || findAndGet('Red-Team Focus');
  if (focus) agent.focus = focus;

  const sev = findAndGet('Severity');
  if (sev) {
    const s = sev.trim().toUpperCase().replace(/[^A-Z]/g, '');
    if (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(s)) agent.severity_default = s;
  }

  const vecIdx = blockLines.findIndex(l => /\*\*Vectors:\*\*/i.test(l));
  if (vecIdx !== -1) {
    for (let i = vecIdx; i < Math.min(vecIdx + 8, blockLines.length); i++) {
      const l = blockLines[i];
      const h = l.match(/human:\s*(\d+)/i);     if (h) agent.vector_human     = parseInt(h[1]);
      const t = l.match(/technical:\s*(\d+)/i); if (t) agent.vector_technical = parseInt(t[1]);
      const p = l.match(/physical:\s*(\d+)/i);  if (p) agent.vector_physical  = parseInt(p[1]);
      const f = l.match(/futures:\s*(\d+)/i);   if (f) agent.vector_futures   = parseInt(f[1]);
    }
  }

  // **Tags:** and **Domain Tags:** → keyword search tags only
  const tagsLine = findAndGet('Tags');
  if (tagsLine) {
    tagsLine.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
      .forEach(t => { if (!agent.domain_tags.includes(t)) agent.domain_tags.push(t); });
  }

  const domainTagsLine = findAndGet('Domain Tags');
  if (domainTagsLine && !/all domains/i.test(domainTagsLine)) {
    domainTagsLine.split(/[,;]/).map(t => t.trim().toLowerCase()).filter(Boolean)
      .forEach(t => { if (!agent.domain_tags.includes(t)) agent.domain_tags.push(t); });
  }

  return agent;
}

export function parseAgentMarkdown(text) {
  const lines = text.split('\n');
  const blocks = [];
  let current = [];
  for (const line of lines) {
    if (line.startsWith('## ') && current.length > 0) {
      blocks.push(current);
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.some(l => l.startsWith('## '))) blocks.push(current);
  return blocks.map(parseAgentBlock).filter(a => a.name);
}

// ── Severity colors ───────────────────────────────────────────────────────────

const SEV_COLORS = { CRITICAL: '#C0392B', HIGH: '#D68910', MEDIUM: '#2E86AB', LOW: '#27AE60' };

// ── Format guide ──────────────────────────────────────────────────────────────

const FORMAT_EXAMPLE = `## Agent Name / Discipline

**Domain:** Cyber Operations

**Persona:** 3–4 sentence career history and worldview.

**Cognitive Bias:** What this agent systematically underweights.

**Primary Focus:** What threats or defenses this agent hunts for.

**Severity:** HIGH

**Vectors:**
- Human: 70
- Technical: 50
- Physical: 30
- Futures: 40

**Tags:** cyber, supply-chain, community-planning

---

## Another Agent Name`;

// ── Component ─────────────────────────────────────────────────────────────────

export default function AgentImportModal({ onImport, onCancel, importing }) {
  const [mode, setMode] = useState('file');   // 'file' | 'paste'
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState(null);
  const [teamMap, setTeamMap] = useState({});
  const [selected, setSelected] = useState(new Set());
  const [showFormat, setShowFormat] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const fileRef = useRef();

  const parseText = (src) => {
    setError('');
    const agents = parseAgentMarkdown(src);
    if (!agents.length) { setError('No agent blocks found — check the format guide.'); return; }
    setParsed(agents);
    const teams = {};
    const sel = new Set();
    agents.forEach((_, i) => { teams[i] = 'red'; sel.add(i); });
    setTeamMap(teams);
    setSelected(sel);
  };

  const handleFiles = (files) => {
    const file = files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError('');
    setParsed(null);
    const reader = new FileReader();
    reader.onload = e => parseText(e.target.result);
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const toggleSelected = (i) => setSelected(s => {
    const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n;
  });

  const handleImport = () => {
    const agents = [...selected].map(i => {
      const base = {
        ...parsed[i],
        team: teamMap[i] || 'red',
        avatar_color: '',
        status: 'active',
      };
      base.system_prompt = encodeAgentData(base);
      return base;
    });
    onImport(agents);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[640px] max-h-[90vh] overflow-y-auto rounded-lg bg-card border border-border">

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border bg-card">
          <h2 className="text-xs font-bold tracking-widest font-mono text-primary">IMPORT AGENTS</h2>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Format guide toggle */}
          <div className="rounded border border-border bg-muted/30">
            <button
              onClick={() => setShowFormat(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold tracking-widest font-mono text-muted-foreground"
            >
              <span className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-primary" />
                MARKDOWN FORMAT GUIDE
              </span>
              {showFormat ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showFormat && (
              <div className="px-4 pb-4 border-t border-border space-y-3">
                <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                  <li><span className="text-primary font-mono">## Agent Name</span> — H2 heading starts each agent (required)</li>
                  <li><span className="text-primary font-mono">**Domain:**</span> — domain category (auto-created if new)</li>
                  <li><span className="text-primary font-mono">**Persona:**</span> — who this expert is and how they think</li>
                  <li><span className="text-primary font-mono">**Cognitive Bias:**</span> — what they systematically underweight</li>
                  <li><span className="text-primary font-mono">**Primary Focus:**</span> — what they hunt for</li>
                  <li><span className="text-primary font-mono">**Severity:**</span> — CRITICAL / HIGH / MEDIUM / LOW</li>
                  <li><span className="text-primary font-mono">**Vectors:**</span> — Human / Technical / Physical / Futures (0–100)</li>
                  <li><span className="text-primary font-mono">**Tags:**</span> — comma-separated keyword search tags</li>
                </ul>
                <pre className="text-[10px] font-mono bg-background rounded p-3 overflow-x-auto text-muted-foreground border border-border whitespace-pre-wrap leading-relaxed">
                  {FORMAT_EXAMPLE}
                </pre>
              </div>
            )}
          </div>

          {!parsed ? (
            <>
              {/* Mode toggle */}
              <div className="flex rounded overflow-hidden border border-border w-fit">
                {[['file', 'Drop File'], ['paste', 'Paste Text']].map(([m, label]) => (
                  <button key={m} onClick={() => setMode(m)}
                    className="px-4 py-1.5 text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: mode === m ? 'hsl(var(--primary))' : 'transparent',
                      color: mode === m ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                    }}>
                    {label}
                  </button>
                ))}
              </div>

              {mode === 'file' ? (
                /* File drop zone */
                <div
                  onDrop={handleDrop}
                  onDragOver={e => e.preventDefault()}
                  onClick={() => fileRef.current.click()}
                  className="rounded border-2 border-dashed border-border hover:border-primary/40 flex flex-col items-center justify-center py-12 cursor-pointer transition-colors"
                >
                  <Upload className="w-8 h-8 mb-3 text-muted-foreground" />
                  {fileName ? (
                    <p className="text-sm font-medium text-primary">{fileName} — click to replace</p>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-foreground">Drop a .md file here or click to browse</p>
                      <p className="text-xs text-muted-foreground mt-1">One file containing one or more agents</p>
                    </>
                  )}
                  <input ref={fileRef} type="file" accept=".md,.txt" className="hidden"
                    onChange={e => handleFiles(e.target.files)} />
                </div>
              ) : (
                /* Paste textarea */
                <textarea
                  value={text}
                  onChange={e => { setText(e.target.value); setError(''); }}
                  placeholder="## Agent Name / Discipline&#10;&#10;**Persona:** ...&#10;**Tags:** cyber, supply-chain&#10;..."
                  className="w-full min-h-[200px] px-3 py-2 text-xs font-mono rounded border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground resize-y outline-none focus:border-primary/50"
                />
              )}

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button onClick={onCancel} className="px-4 py-2 text-sm rounded border border-border text-muted-foreground hover:text-foreground transition-colors">
                  Cancel
                </button>
                {mode === 'paste' && (
                  <button onClick={() => parseText(text)} disabled={!text.trim()}
                    className="flex items-center gap-2 px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                    <Upload className="w-4 h-4" /> Parse Agents
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Parsed preview */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{parsed.length}</span> agent{parsed.length !== 1 ? 's' : ''} parsed —{' '}
                  <span className="font-semibold text-foreground">{selected.size}</span> selected
                </p>
                <button onClick={() => { setParsed(null); setFileName(''); setText(''); }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  ← Edit
                </button>
              </div>

              {/* Bulk team selector */}
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 rounded border border-border">
                <span className="text-xs text-muted-foreground mr-1">Set all to</span>
                <button onClick={() => setTeamMap(m => Object.fromEntries(Object.keys(m).map(k => [k, 'red'])))}
                  className="px-3 py-1 rounded text-xs font-bold font-mono border border-red-500/30 text-red-600 bg-red-500/5 hover:bg-red-500/15 transition-colors">
                  RED TEAM
                </button>
                <button onClick={() => setTeamMap(m => Object.fromEntries(Object.keys(m).map(k => [k, 'blue'])))}
                  className="px-3 py-1 rounded text-xs font-bold font-mono border border-blue-500/30 text-blue-600 bg-blue-500/5 hover:bg-blue-500/15 transition-colors">
                  BLUE TEAM
                </button>
              </div>

              {/* Agent list */}
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {parsed.map((agent, i) => {
                  const isSelected = selected.has(i);
                  const primaryTag = agent.domain_tags?.[0];
                  const barColor = tagColor(primaryTag);
                  const sevColor = SEV_COLORS[agent.severity_default] || SEV_COLORS.HIGH;
                  return (
                    <div
                      key={i}
                      onClick={() => toggleSelected(i)}
                      className="rounded overflow-hidden cursor-pointer transition-all"
                      style={{
                        border: `1px solid ${isSelected ? barColor : 'hsl(var(--border))'}`,
                        backgroundColor: isSelected ? `${barColor}08` : 'hsl(var(--card))',
                        opacity: isSelected ? 1 : 0.6,
                      }}
                    >
                      <div className="h-0.5" style={{ backgroundColor: barColor }} />
                      <div className="flex items-start gap-3 p-3">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 transition-colors"
                          style={{ color: isSelected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground)/0.4)' }} />

                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-foreground">{agent.name}</span>
                            {agent.discipline !== agent.name && (
                              <span className="text-xs text-muted-foreground">{agent.discipline}</span>
                            )}
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold font-mono"
                              style={{ backgroundColor: `${sevColor}22`, color: sevColor }}>
                              {agent.severity_default}
                            </span>
                          </div>
                          {agent._domain_name && (
                            <div className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tagColor(agent._domain_name) }} />
                              <span className="text-[10px] font-medium text-foreground">{agent._domain_name}</span>
                            </div>
                          )}
                          {agent.persona_description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">{agent.persona_description}</p>
                          )}
                          {agent.domain_tags?.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                              <Tag className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                              {agent.domain_tags.map(t => {
                                const c = tagColor(t);
                                return (
                                  <span key={t} className="text-[10px] px-1.5 py-0.5 rounded capitalize"
                                    style={{ backgroundColor: `${c}18`, color: c, border: `1px solid ${c}33` }}>
                                    {t}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Team picker */}
                        <div onClick={e => e.stopPropagation()} className="flex-shrink-0">
                          <div className="flex rounded overflow-hidden border border-border">
                            {['red', 'blue'].map(t => (
                              <button key={t} onClick={() => setTeamMap(m => ({ ...m, [i]: t }))}
                                className="px-2 py-1 text-[10px] font-bold font-mono transition-colors"
                                style={{
                                  backgroundColor: teamMap[i] === t
                                    ? (t === 'red' ? 'rgba(220,38,38,0.15)' : 'rgba(37,99,235,0.15)')
                                    : 'transparent',
                                  color: teamMap[i] === t
                                    ? (t === 'red' ? '#DC2626' : '#2563EB')
                                    : 'hsl(var(--muted-foreground))',
                                }}>
                                {t.toUpperCase()}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Select all / none */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <button onClick={() => setSelected(new Set(parsed.map((_, i) => i)))} className="hover:text-foreground transition-colors">Select all</button>
                <span>·</span>
                <button onClick={() => setSelected(new Set())} className="hover:text-foreground transition-colors">Deselect all</button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {parsed && (
          <div className="sticky bottom-0 flex justify-end gap-2 px-6 py-4 border-t border-border bg-card">
            <button onClick={onCancel} className="px-4 py-2 text-sm rounded border border-border text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={selected.size === 0 || importing}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Import {selected.size > 0 ? `${selected.size} ` : ''}Agent{selected.size !== 1 ? 's' : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
