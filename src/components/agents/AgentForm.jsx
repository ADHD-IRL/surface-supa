import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Save, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolveAgent, encodeAgentData } from '@/lib/agentData';

const COMMON_DOMAINS = ['cyber', 'geopolitical', 'financial', 'operational', 'strategic'];
const EXPERTISE_LEVELS = ['Junior', 'Mid-Level', 'Senior', 'Principal', 'World-Class'];
const REASONING_STYLES = ['Analytical', 'Intuitive', 'Contrarian', 'Systematic', 'Probabilistic'];
const SEVERITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const COLORS = ['#DC2626','#B91C1C','#991B1B','#2563EB','#1D4ED8','#1E40AF','#059669','#7C3AED','#D97706','#64748B'];

function VectorSlider({ label, value, onChange }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-mono font-semibold w-8 text-right">{value}</span>
      </div>
      <input
        type="range" min={0} max={100} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full accent-primary cursor-pointer"
      />
    </div>
  );
}

function DomainTagInput({ tags, onChange }) {
  const [input, setInput] = useState('');
  const inputRef = useRef(null);

  const addTag = (raw) => {
    const tag = raw.trim().toLowerCase();
    if (!tag || tags.includes(tag)) return;
    onChange([...tags, tag]);
    setInput('');
  };

  const removeTag = (t) => onChange(tags.filter(x => x !== t));

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && tags.length) {
      removeTag(tags[tags.length - 1]);
    }
  };

  return (
    <div className="space-y-2">
      {/* Existing tag chips */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map(t => (
            <Badge key={t} variant="secondary" className="text-xs px-2 py-0.5 gap-1 capitalize">
              {t}
              <button onClick={() => removeTag(t)} className="ml-0.5 hover:text-destructive">
                <X className="w-2.5 h-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Free-text input */}
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a domain tag and press Enter…"
          className="text-xs h-8"
        />
        <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => addTag(input)} disabled={!input.trim()}>
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Common domain quick-add */}
      <div className="flex flex-wrap gap-1.5">
        {COMMON_DOMAINS.filter(d => !tags.includes(d)).map(d => (
          <button
            key={d}
            onClick={() => addTag(d)}
            className="px-2 py-0.5 rounded text-[11px] font-medium capitalize border border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
          >
            + {d}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AgentForm({ agent, onSave, onCancel, saving }) {
  const [form, setForm] = useState({
    name: '', discipline: '', team: 'red', domain_tags: [],
    expertise_level: 'Senior', reasoning_style: 'Analytical', severity_default: 'HIGH',
    persona_description: '', cognitive_bias: '', red_team_focus: '',
    vector_human: 50, vector_technical: 50, vector_physical: 30, vector_futures: 40,
    avatar_color: '#DC2626', status: 'active',
  });

  useEffect(() => {
    if (agent) {
      const a = resolveAgent(agent);
      setForm({
        name:                a.name                || '',
        discipline:          a.discipline          || '',
        team:                a.team                || 'red',
        domain_tags:         a.domain_tags         || [],
        expertise_level:     a.expertise_level     || 'Senior',
        reasoning_style:     a.reasoning_style     || 'Analytical',
        severity_default:    a.severity_default    || 'HIGH',
        persona_description: a.persona_description || '',
        cognitive_bias:      a.cognitive_bias      || '',
        red_team_focus:      a.red_team_focus      || '',
        vector_human:        a.vector_human        ?? 50,
        vector_technical:    a.vector_technical    ?? 50,
        vector_physical:     a.vector_physical     ?? 30,
        vector_futures:      a.vector_futures      ?? 40,
        avatar_color:        a.avatar_color        || '#DC2626',
        status:              a.status              || 'active',
      });
    }
  }, [agent]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const sevColor = { LOW: 'text-green-600', MEDIUM: 'text-amber-600', HIGH: 'text-orange-600', CRITICAL: 'text-red-600' };

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{agent ? 'Edit Agent' : 'Create Agent'}</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCancel}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Identity */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Name</Label>
          <Input placeholder="e.g. Supply Chain Threat Analyst" value={form.name} onChange={e => set('name', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Discipline</Label>
          <Input placeholder="e.g. SCRM / Hardware Security" value={form.discipline} onChange={e => set('discipline', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Team</Label>
          <Select value={form.team} onValueChange={v => set('team', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="red">Red Team — Attacker</SelectItem>
              <SelectItem value="blue">Blue Team — Defender</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Expertise Level</Label>
          <Select value={form.expertise_level} onValueChange={v => set('expertise_level', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {EXPERTISE_LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Reasoning Style</Label>
          <Select value={form.reasoning_style} onValueChange={v => set('reasoning_style', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {REASONING_STYLES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Default Severity</Label>
          <Select value={form.severity_default} onValueChange={v => set('severity_default', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SEVERITY_LEVELS.map(s => (
                <SelectItem key={s} value={s}><span className={sevColor[s]}>{s}</span></SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Avatar Color</Label>
          <div className="flex gap-2 pt-1.5">
            {COLORS.map(color => (
              <button key={color} onClick={() => set('avatar_color', color)}
                className={cn("w-6 h-6 rounded-full transition-transform", form.avatar_color === color && "ring-2 ring-offset-2 ring-primary scale-110")}
                style={{ backgroundColor: color }} />
            ))}
          </div>
        </div>
      </div>

      {/* Domain Tags */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold">Domain Tags</Label>
        <p className="text-xs text-muted-foreground -mt-1">Tags define the agent's category — used to group and filter agents.</p>
        <DomainTagInput
          tags={form.domain_tags}
          onChange={tags => set('domain_tags', tags)}
        />
      </div>

      {/* Persona section */}
      <div className="border-t border-border pt-4 space-y-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Persona</p>

        <div className="space-y-2">
          <Label className="text-xs font-semibold">Persona Description</Label>
          <Textarea placeholder="3–4 sentences: career history, expertise, worldview..."
            value={form.persona_description} onChange={e => set('persona_description', e.target.value)}
            className="min-h-[80px] resize-y text-sm" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Cognitive Bias</Label>
          <Textarea placeholder="What does this agent systematically underweight or miss?"
            value={form.cognitive_bias} onChange={e => set('cognitive_bias', e.target.value)}
            className="min-h-[60px] resize-y text-sm" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold">
            {form.team === 'red' ? 'Red Team Focus' : 'Blue Team Focus'}
          </Label>
          <Textarea
            placeholder={form.team === 'red'
              ? "What threats and attack paths does this agent hunt for?"
              : "What defenses and detection methods does this agent champion?"}
            value={form.red_team_focus} onChange={e => set('red_team_focus', e.target.value)}
            className="min-h-[60px] resize-y text-sm" />
        </div>
      </div>

      {/* Threat vectors */}
      <div className="border-t border-border pt-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Threat Vector Weights</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          <VectorSlider label="Human"     value={form.vector_human}     onChange={v => set('vector_human', v)} />
          <VectorSlider label="Technical" value={form.vector_technical} onChange={v => set('vector_technical', v)} />
          <VectorSlider label="Physical"  value={form.vector_physical}  onChange={v => set('vector_physical', v)} />
          <VectorSlider label="Futures"   value={form.vector_futures}   onChange={v => set('vector_futures', v)} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave({ ...form, system_prompt: encodeAgentData(form) })} disabled={!form.name || saving} className="gap-2">
          {saving
            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <><Save className="w-4 h-4" /> {agent ? 'Update' : 'Create'} Agent</>}
        </Button>
      </div>
    </Card>
  );
}
