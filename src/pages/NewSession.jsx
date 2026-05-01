import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, X, Upload, ArrowRight, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const DOMAINS = ['cyber', 'geopolitical', 'financial', 'operational', 'strategic'];

export default function NewSession() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    scenario: '',
    reference_urls: [],
    file_urls: [],
    mode: 'standard',
    selected_agents: [],
    domain_focus: [],
  });
  const [urlInput, setUrlInput] = useState('');
  const [uploading, setUploading] = useState(false);

  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: () => base44.entities.Agent.filter({ status: 'active' }),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Session.create(data),
    onSuccess: (session) => navigate(`/sessions/${session.id}`),
  });

  const addUrl = () => {
    if (urlInput.trim()) {
      setForm(f => ({ ...f, reference_urls: [...f.reference_urls, urlInput.trim()] }));
      setUrlInput('');
    }
  };

  const removeUrl = (index) => {
    setForm(f => ({ ...f, reference_urls: f.reference_urls.filter((_, i) => i !== index) }));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, file_urls: [...f.file_urls, file_url] }));
    setUploading(false);
  };

  const toggleAgent = (agentId) => {
    setForm(f => ({
      ...f,
      selected_agents: f.selected_agents.includes(agentId)
        ? f.selected_agents.filter(id => id !== agentId)
        : [...f.selected_agents, agentId],
    }));
  };

  const toggleDomain = (domain) => {
    setForm(f => ({
      ...f,
      domain_focus: f.domain_focus.includes(domain)
        ? f.domain_focus.filter(d => d !== domain)
        : [...f.domain_focus, domain],
    }));
  };

  const handleSubmit = () => {
    if (!form.title || !form.scenario) return;
    const selectedAgents = form.selected_agents.length > 0
      ? form.selected_agents
      : agents.map(a => a.id);
    createMutation.mutate({ ...form, selected_agents: selectedAgents, status: 'draft' });
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Session</h1>
        <p className="text-sm text-muted-foreground mt-1">Set up a Red/Blue team adversarial analysis</p>
      </div>

      <Card className="p-6 space-y-6">
        {/* Title */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Session Title</Label>
          <Input
            placeholder="e.g., Q2 Supply Chain Vulnerability Assessment"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          />
        </div>

        {/* Scenario */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Scenario Description</Label>
          <Textarea
            placeholder="Describe the scenario, system, or situation you want to stress-test..."
            value={form.scenario}
            onChange={e => setForm(f => ({ ...f, scenario: e.target.value }))}
            className="min-h-[120px] resize-y"
          />
        </div>

        {/* Domain Focus */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Domain Focus</Label>
          <div className="flex flex-wrap gap-2">
            {DOMAINS.map(domain => (
              <button
                key={domain}
                onClick={() => toggleDomain(domain)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium capitalize border transition-colors",
                  form.domain_focus.includes(domain)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-border hover:border-primary/30"
                )}
              >
                {domain}
              </button>
            ))}
          </div>
        </div>

        {/* Mode */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Analysis Mode</Label>
          <Select value={form.mode} onValueChange={v => setForm(f => ({ ...f, mode: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rapid">Rapid — Quick 1-round scan</SelectItem>
              <SelectItem value="standard">Standard — 2-round debate</SelectItem>
              <SelectItem value="deep">Deep — Extended multi-round analysis</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reference URLs */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Reference URLs</Label>
          <div className="flex gap-2">
            <Input
              placeholder="https://example.com/report"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addUrl()}
            />
            <Button variant="outline" size="icon" onClick={addUrl}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          {form.reference_urls.map((url, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-lg">
              <Link2 className="w-3 h-3 flex-shrink-0" />
              <span className="truncate flex-1">{url}</span>
              <button onClick={() => removeUrl(i)}><X className="w-3 h-3" /></button>
            </div>
          ))}
        </div>

        {/* File Upload */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Upload Files</Label>
          <label className="flex items-center gap-2 px-4 py-3 border border-dashed border-border rounded-lg cursor-pointer hover:border-primary/30 transition-colors">
            <Upload className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {uploading ? 'Uploading...' : 'Click to upload supporting documents'}
            </span>
            <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
          </label>
          {form.file_urls.length > 0 && (
            <p className="text-xs text-muted-foreground">{form.file_urls.length} file(s) attached</p>
          )}
        </div>

        {/* Agent Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Select Agents</Label>
          <p className="text-xs text-muted-foreground -mt-1">Leave empty to use all active agents</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {agents.map(agent => (
              <button
                key={agent.id}
                onClick={() => toggleAgent(agent.id)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border text-left transition-colors",
                  form.selected_agents.includes(agent.id)
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                )}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                  style={{ backgroundColor: agent.avatar_color || (agent.team === 'red' ? '#DC2626' : '#2563EB') }}
                >
                  {agent.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{agent.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{agent.team} team</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={!form.title || !form.scenario || createMutation.isPending}
          className="gap-2"
        >
          {createMutation.isPending ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>Create & Start Session <ArrowRight className="w-4 h-4" /></>
          )}
        </Button>
      </div>
    </div>
  );
}