import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

const DOMAINS = ['cyber', 'geopolitical', 'financial', 'operational', 'strategic'];
const TONES = ['aggressive', 'analytical', 'cautious', 'provocative', 'measured'];
const COLORS = ['#DC2626', '#B91C1C', '#991B1B', '#2563EB', '#1D4ED8', '#1E40AF', '#059669', '#7C3AED', '#D97706', '#64748B'];

export default function AgentForm({ agent, onSave, onCancel, saving }) {
  const [form, setForm] = useState({
    name: '',
    team: 'red',
    domain_tags: [],
    tone: 'analytical',
    system_prompt: '',
    avatar_color: '#DC2626',
    status: 'active',
  });

  useEffect(() => {
    if (agent) {
      setForm({
        name: agent.name || '',
        team: agent.team || 'red',
        domain_tags: agent.domain_tags || [],
        tone: agent.tone || 'analytical',
        system_prompt: agent.system_prompt || '',
        avatar_color: agent.avatar_color || '#DC2626',
        status: agent.status || 'active',
      });
    }
  }, [agent]);

  const toggleDomain = (domain) => {
    setForm(f => ({
      ...f,
      domain_tags: f.domain_tags.includes(domain)
        ? f.domain_tags.filter(d => d !== domain)
        : [...f.domain_tags, domain],
    }));
  };

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{agent ? 'Edit Agent' : 'Create Agent'}</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCancel}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Name</Label>
          <Input
            placeholder="Agent name"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Team</Label>
          <Select value={form.team} onValueChange={v => setForm(f => ({ ...f, team: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="red">Red Team (Attacker)</SelectItem>
              <SelectItem value="blue">Blue Team (Defender)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold">Tone</Label>
        <Select value={form.tone} onValueChange={v => setForm(f => ({ ...f, tone: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {TONES.map(t => (
              <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold">Domain Tags</Label>
        <div className="flex flex-wrap gap-2">
          {DOMAINS.map(domain => (
            <button
              key={domain}
              onClick={() => toggleDomain(domain)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium capitalize border transition-colors",
                form.domain_tags.includes(domain)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:border-primary/30"
              )}
            >
              {domain}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold">Avatar Color</Label>
        <div className="flex gap-2">
          {COLORS.map(color => (
            <button
              key={color}
              onClick={() => setForm(f => ({ ...f, avatar_color: color }))}
              className={cn(
                "w-7 h-7 rounded-full transition-transform",
                form.avatar_color === color && "ring-2 ring-offset-2 ring-primary scale-110"
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold">System Prompt</Label>
        <Textarea
          placeholder="Define the agent's personality, expertise, and behavior..."
          value={form.system_prompt}
          onChange={e => setForm(f => ({ ...f, system_prompt: e.target.value }))}
          className="min-h-[120px] resize-y font-mono text-xs"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          onClick={() => onSave(form)}
          disabled={!form.name || saving}
          className="gap-2"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <><Save className="w-4 h-4" /> {agent ? 'Update' : 'Create'} Agent</>
          )}
        </Button>
      </div>
    </Card>
  );
}