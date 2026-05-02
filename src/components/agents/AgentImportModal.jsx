import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Upload, CheckCircle2, AlertCircle, Loader2, FileText, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Parser (AgentDebate markdown format) ─────────────────────────────────────

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
    name: '', discipline: '', category: '', persona_description: '', cognitive_bias: '',
    red_team_focus: '', severity_default: 'HIGH',
    vector_human: 50, vector_technical: 50, vector_physical: 30, vector_futures: 40,
    domain_tags: [], expertise_level: 'Senior', reasoning_style: 'Analytical',
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

  const category = findAndGet('Category');
  if (category) agent.category = category.trim();

  const persona = findAndGet('Persona');
  if (persona) agent.persona_description = persona;

  const bias = findAndGet('Cognitive Bias');
  if (bias) agent.cognitive_bias = bias;

  const focus = findAndGet('Primary Focus') || findAndGet('Red Team Focus') || findAndGet('Red-Team Focus');
  if (focus) agent.red_team_focus = focus;

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

  const tagsLine = findAndGet('Tags');
  if (tagsLine) {
    const tags = tagsLine.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    const KNOWN_DOMAINS = ['cyber', 'geopolitical', 'financial', 'operational', 'strategic'];
    agent.domain_tags = tags.filter(t => KNOWN_DOMAINS.includes(t));
  }

  const domainTagsLine = findAndGet('Domain Tags');
  if (domainTagsLine && !/all domains/i.test(domainTagsLine)) {
    const dTags = domainTagsLine.split(/[,;]/).map(t => t.trim().toLowerCase()).filter(Boolean);
    const KNOWN_DOMAINS = ['cyber', 'geopolitical', 'financial', 'operational', 'strategic'];
    const mapped = dTags.filter(t => KNOWN_DOMAINS.includes(t));
    if (mapped.length) agent.domain_tags = [...new Set([...agent.domain_tags, ...mapped])];
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

// ── Severity badge ────────────────────────────────────────────────────────────

const sevConfig = {
  CRITICAL: 'bg-red-600 text-white',
  HIGH:     'bg-orange-500 text-white',
  MEDIUM:   'bg-amber-400 text-black',
  LOW:      'bg-green-500 text-white',
};

// ── Format guide shown in the modal ──────────────────────────────────────────

const FORMAT_EXAMPLE = `## Agent Name / Discipline

**Category:** My Custom Category

**Persona:** 3–4 sentence career history and worldview.

**Cognitive Bias:** What this agent systematically underweights.

**Primary Focus:** What threats or defenses this agent hunts for.

**Severity:** HIGH

**Vectors:**
- Human: 70
- Technical: 50
- Physical: 30
- Futures: 40

**Tags:** cyber, supply-chain

---

## Another Agent Name`;

// ── Component ─────────────────────────────────────────────────────────────────

export default function AgentImportModal({ onImport, onCancel, importing }) {
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState(null);
  const [teamMap, setTeamMap] = useState({});
  const [categoryMap, setCategoryMap] = useState({});
  const [selected, setSelected] = useState(new Set());
  const [showFormat, setShowFormat] = useState(false);
  const [error, setError] = useState('');

  const handleParse = () => {
    setError('');
    if (!text.trim()) { setError('Paste some agent markdown first.'); return; }
    const agents = parseAgentMarkdown(text);
    if (!agents.length) { setError('No agent blocks found. Check the format guide below.'); return; }
    setParsed(agents);
    const defaultTeams = {};
    const defaultCategories = {};
    const defaultSelected = new Set();
    agents.forEach((a, i) => {
      defaultTeams[i] = 'red';
      defaultCategories[i] = a.category || '';
      defaultSelected.add(i);
    });
    setTeamMap(defaultTeams);
    setCategoryMap(defaultCategories);
    setSelected(defaultSelected);
  };

  const toggleSelected = (i) => setSelected(s => {
    const n = new Set(s);
    n.has(i) ? n.delete(i) : n.add(i);
    return n;
  });

  const handleImport = () => {
    const agents = [...selected].map(i => ({
      ...parsed[i],
      team: teamMap[i] || 'red',
      category: categoryMap[i] || '',
      avatar_color: teamMap[i] === 'blue' ? '#2563EB' : '#DC2626',
      status: 'active',
    }));
    onImport(agents);
  };

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Import Agents</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Paste AgentDebate markdown format — one or many agents</p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCancel}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {!parsed ? (
        <>
          <Textarea
            placeholder="## Agent Name / Discipline&#10;&#10;**Persona:** ...&#10;**Cognitive Bias:** ...&#10;**Primary Focus:** ...&#10;**Severity:** HIGH&#10;..."
            value={text}
            onChange={e => { setText(e.target.value); setError(''); }}
            className="min-h-[220px] resize-y font-mono text-xs"
          />
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-team">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          <button
            onClick={() => setShowFormat(f => !f)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            {showFormat ? 'Hide' : 'Show'} format guide
          </button>
          {showFormat && (
            <pre className="text-[10px] font-mono bg-muted rounded-lg p-4 overflow-x-auto text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {FORMAT_EXAMPLE}
            </pre>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button onClick={handleParse} disabled={!text.trim()} className="gap-2">
              <Upload className="w-4 h-4" /> Parse Agents
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{parsed.length}</span> agent{parsed.length !== 1 ? 's' : ''} parsed —{' '}
              <span className="font-semibold text-foreground">{selected.size}</span> selected for import
            </p>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setParsed(null)}>
              ← Edit markdown
            </Button>
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {parsed.map((agent, i) => (
              <div
                key={i}
                onClick={() => toggleSelected(i)}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  selected.has(i)
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30 opacity-60"
                )}
              >
                <CheckCircle2 className={cn("w-4 h-4 mt-0.5 flex-shrink-0 transition-colors",
                  selected.has(i) ? "text-primary" : "text-muted-foreground/40")} />

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{agent.name}</span>
                    {agent.discipline !== agent.name && (
                      <span className="text-xs text-muted-foreground">{agent.discipline}</span>
                    )}
                    <Badge className={cn("text-xs px-1.5 py-0", sevConfig[agent.severity_default] || sevConfig.HIGH)}>
                      {agent.severity_default}
                    </Badge>
                  </div>
                  {agent.persona_description && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{agent.persona_description}</p>
                  )}
                  {agent.domain_tags?.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {agent.domain_tags.map(t => (
                        <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{t}</Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Category + team pickers per agent */}
                <div onClick={e => e.stopPropagation()} className="flex flex-col gap-1.5 flex-shrink-0 items-end">
                  <Select
                    value={teamMap[i] || 'red'}
                    onValueChange={v => setTeamMap(m => ({ ...m, [i]: v }))}
                  >
                    <SelectTrigger className="h-7 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="red">
                        <span className="text-red-team font-medium">Red Team</span>
                      </SelectItem>
                      <SelectItem value="blue">
                        <span className="text-blue-team font-medium">Blue Team</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="relative">
                    <FolderOpen className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                    <Input
                      value={categoryMap[i] || ''}
                      onChange={e => setCategoryMap(m => ({ ...m, [i]: e.target.value }))}
                      placeholder="Category…"
                      className="h-7 w-28 text-xs pl-6 pr-2"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="text-xs h-7"
                onClick={() => setSelected(new Set(parsed.map((_, i) => i)))}>
                Select all
              </Button>
              <Button variant="ghost" size="sm" className="text-xs h-7"
                onClick={() => setSelected(new Set())}>
                Deselect all
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onCancel}>Cancel</Button>
              <Button onClick={handleImport} disabled={selected.size === 0 || importing} className="gap-2">
                {importing
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Upload className="w-4 h-4" />}
                Import {selected.size > 0 ? `${selected.size} ` : ''}Agent{selected.size !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
