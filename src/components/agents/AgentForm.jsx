import React, { useState, useEffect, useRef } from 'react';
import { X, SlidersHorizontal, Save } from 'lucide-react';
import { resolveAgent, encodeAgentData } from '@/lib/agentData';

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const SEV_COLORS = { CRITICAL: '#C0392B', HIGH: '#D68910', MEDIUM: '#2E86AB', LOW: '#27AE60' };
const EXPERTISE_LEVELS = ['Junior', 'Mid-Level', 'Senior', 'Principal', 'World-Class'];
const REASONING_STYLES = ['Analytical', 'Intuitive', 'Contrarian', 'Systematic', 'Probabilistic'];
const COMMON_DOMAINS = ['cyber', 'geopolitical', 'financial', 'operational', 'strategic'];

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-bold tracking-widest mb-1.5 font-mono text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, className = '' }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3 py-2 text-sm rounded outline-none bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50 transition-colors ${className}`}
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2 text-sm rounded outline-none bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50 transition-colors resize-y"
    />
  );
}

function TagInput({ tags, onChange }) {
  const [input, setInput] = useState('');

  const add = (raw) => {
    const t = raw.trim().toLowerCase();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setInput('');
  };

  const remove = (t) => onChange(tags.filter(x => x !== t));

  return (
    <div className="space-y-2">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map(t => (
            <span key={t} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-muted border border-border text-foreground capitalize">
              {t}
              <button onClick={() => remove(t)} className="text-muted-foreground hover:text-destructive ml-0.5">×</button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(input); } }}
          placeholder="Type a tag and press Enter…"
          className="flex-1 px-3 py-1.5 text-xs rounded outline-none bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50 transition-colors"
        />
        <button
          onClick={() => add(input)}
          disabled={!input.trim()}
          className="px-3 py-1.5 text-xs rounded bg-muted border border-border text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
        >
          Add
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {COMMON_DOMAINS.filter(d => !tags.includes(d)).map(d => (
          <button
            key={d}
            onClick={() => add(d)}
            className="text-[11px] px-2 py-0.5 rounded border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors capitalize"
          >
            + {d}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AgentForm({ agent, domains = [], onSave, onCancel, saving }) {
  const [form, setForm] = useState({
    name: '', discipline: '', team: 'red', domain_id: '', domain_tags: [],
    persona_description: '', cognitive_bias: '', focus: '', professional_background: '',
    expertise_level: 'Senior', reasoning_style: 'Analytical', severity_default: 'HIGH',
    vector_human: 50, vector_technical: 50, vector_physical: 30, vector_futures: 40,
    avatar_color: '', status: 'active',
  });

  useEffect(() => {
    if (agent) {
      const a = resolveAgent(agent);
      setForm({
        name:                    a.name                    || '',
        discipline:              a.discipline              || '',
        team:                    a.team                    || 'red',
        domain_id:               a.domain_id               || '',
        domain_tags:             a.domain_tags             || [],
        persona_description:     a.persona_description     || '',
        cognitive_bias:          a.cognitive_bias          || '',
        focus:                   a.focus                   || '',
        professional_background: a.professional_background || '',
        expertise_level:         a.expertise_level         || 'Senior',
        reasoning_style:         a.reasoning_style         || 'Analytical',
        severity_default:        a.severity_default        || 'HIGH',
        vector_human:            a.vector_human            ?? 50,
        vector_technical:        a.vector_technical        ?? 50,
        vector_physical:         a.vector_physical         ?? 30,
        vector_futures:          a.vector_futures          ?? 40,
        avatar_color:            a.avatar_color            || '',
        status:                  a.status                  || 'active',
      });
    }
  }, [agent]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    onSave({ ...form, system_prompt: encodeAgentData(form) });
  };

  return (
    // Modal overlay
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[680px] max-h-[92vh] overflow-y-auto rounded-lg bg-card border border-border">

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border bg-card">
          <h2 className="text-xs font-bold tracking-widest font-mono text-primary">
            {agent?.id ? 'EDIT AGENT' : 'NEW AGENT'}
          </h2>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* ── Identity ── */}
          <div>
            <p className="text-[10px] font-bold tracking-widest font-mono text-muted-foreground mb-3">AGENT IDENTITY</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Field label="NAME">
                    <TextInput value={form.name} onChange={v => set('name', v)} placeholder="e.g. Supply Chain Threat Analyst" />
                  </Field>
                </div>
                <Field label="DISCIPLINE">
                  <TextInput value={form.discipline} onChange={v => set('discipline', v)} placeholder="e.g. SCRM / Hardware Security" />
                </Field>
                <Field label="TEAM">
                  <div className="flex gap-2">
                    {['red', 'blue'].map(t => (
                      <button
                        key={t}
                        onClick={() => set('team', t)}
                        className="flex-1 py-2 text-xs font-bold font-mono rounded capitalize transition-all"
                        style={{
                          backgroundColor: form.team === t
                            ? (t === 'red' ? 'rgba(220,38,38,0.15)' : 'rgba(37,99,235,0.15)')
                            : 'hsl(var(--muted)/0.5)',
                          color: form.team === t
                            ? (t === 'red' ? '#DC2626' : '#2563EB')
                            : 'hsl(var(--muted-foreground))',
                          border: `1px solid ${form.team === t ? (t === 'red' ? 'rgba(220,38,38,0.4)' : 'rgba(37,99,235,0.4)') : 'hsl(var(--border))'}`,
                        }}
                      >
                        {t} Team
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              {domains.length > 0 && (
                <Field label="DOMAIN">
                  <select
                    value={form.domain_id}
                    onChange={e => set('domain_id', e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded outline-none bg-muted/50 border border-border text-foreground focus:border-primary/50 transition-colors"
                  >
                    <option value="">— No domain —</option>
                    {domains.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </Field>
              )}

              <Field label="SEARCH TAGS">
                <TagInput tags={form.domain_tags} onChange={v => set('domain_tags', v)} />
              </Field>
            </div>
          </div>

          {/* ── Profile ── */}
          <div>
            <p className="text-[10px] font-bold tracking-widest font-mono text-muted-foreground mb-3">PROFILE</p>
            <div className="space-y-3">
              <Field label="PERSONA DESCRIPTION">
                <TextArea value={form.persona_description} onChange={v => set('persona_description', v)}
                  placeholder="Who is this expert, how do they think, what have they seen…" rows={3} />
              </Field>
              <Field label="COGNITIVE BIAS">
                <TextArea value={form.cognitive_bias} onChange={v => set('cognitive_bias', v)}
                  placeholder="What this expert systematically underweights or misses…" rows={2} />
              </Field>
              <Field label="FOCUS">
                <TextArea value={form.focus} onChange={v => set('focus', v)}
                  placeholder="What this agent focuses on in any scenario…"
                  rows={2} />
              </Field>
            </div>
          </div>

          {/* ── Persona Tuning ── */}
          <div className="rounded-lg p-4 bg-muted/30 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
              <p className="text-[10px] font-bold tracking-widest font-mono text-primary">PERSONA TUNING</p>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-primary/10 text-primary border border-primary/20">influences LLM output</span>
            </div>
            <div className="space-y-3">
              <Field label="PROFESSIONAL BACKGROUND">
                <TextArea value={form.professional_background} onChange={v => set('professional_background', v)}
                  placeholder="e.g. 15 years at NSA, then private sector threat intelligence. Led post-9/11 HUMINT reforms…"
                  rows={2} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold tracking-widest font-mono text-muted-foreground mb-2">EXPERTISE LEVEL</label>
                  <div className="flex flex-wrap gap-1.5">
                    {EXPERTISE_LEVELS.map(lvl => (
                      <button key={lvl} onClick={() => set('expertise_level', lvl)}
                        className="px-2 py-1 rounded text-xs font-medium transition-all"
                        style={{
                          backgroundColor: form.expertise_level === lvl ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                          color: form.expertise_level === lvl ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                          border: `1px solid ${form.expertise_level === lvl ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
                        }}>
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold tracking-widest font-mono text-muted-foreground mb-2">REASONING STYLE</label>
                  <div className="flex flex-wrap gap-1.5">
                    {REASONING_STYLES.map(s => (
                      <button key={s} onClick={() => set('reasoning_style', s)}
                        className="px-2 py-1 rounded text-xs font-medium transition-all"
                        style={{
                          backgroundColor: form.reasoning_style === s ? '#2E86AB' : 'hsl(var(--muted))',
                          color: form.reasoning_style === s ? '#fff' : 'hsl(var(--muted-foreground))',
                          border: `1px solid ${form.reasoning_style === s ? '#2E86AB' : 'hsl(var(--border))'}`,
                        }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Vector Weights ── */}
          <div>
            <p className="text-[10px] font-bold tracking-widest font-mono text-muted-foreground mb-3">VECTOR WEIGHTS</p>
            <div className="space-y-3">
              {[
                { k: 'vector_human',     label: 'Human',     color: '#C0392B' },
                { k: 'vector_technical', label: 'Technical', color: '#2E86AB' },
                { k: 'vector_physical',  label: 'Physical',  color: '#27AE60' },
                { k: 'vector_futures',   label: 'Futures',   color: '#7B2D8B' },
              ].map(({ k, label, color }) => (
                <div key={k} className="flex items-center gap-3">
                  <span className="text-xs w-20 flex-shrink-0 text-muted-foreground">{label}</span>
                  <input
                    type="range" min={0} max={100} value={form[k] || 0}
                    onChange={e => set(k, parseInt(e.target.value))}
                    className="flex-1 h-1.5 rounded cursor-pointer"
                    style={{ accentColor: color }}
                  />
                  <input
                    type="number" min={0} max={100} value={form[k] || 0}
                    onChange={e => set(k, parseInt(e.target.value) || 0)}
                    className="w-12 px-2 py-1 text-xs text-center rounded outline-none bg-muted/50 border border-border text-foreground"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ── Default Severity ── */}
          <div>
            <p className="text-[10px] font-bold tracking-widest font-mono text-muted-foreground mb-3">DEFAULT SEVERITY</p>
            <div className="flex gap-2">
              {SEVERITIES.map(s => (
                <button key={s} onClick={() => set('severity_default', s)}
                  className="flex-1 py-2 text-xs font-bold font-mono rounded transition-all"
                  style={{
                    backgroundColor: form.severity_default === s ? SEV_COLORS[s] : `${SEV_COLORS[s]}22`,
                    color: form.severity_default === s
                      ? (s === 'HIGH' ? '#0D1B2A' : '#fff')
                      : SEV_COLORS[s],
                  }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex justify-end gap-2 px-6 py-4 border-t border-border bg-card">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded border border-border text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!form.name || saving}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Save className="w-4 h-4" />}
            {agent?.id ? 'Update Agent' : 'Create Agent'}
          </button>
        </div>
      </div>
    </div>
  );
}
