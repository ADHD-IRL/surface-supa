import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, X, Upload, ArrowRight, Link2, GitBranch, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const DOMAINS = ['cyber', 'geopolitical', 'financial', 'operational', 'strategic'];

export default function NewSession() {
  const navigate = useNavigate();
  const location = useLocation();
  const template = location.state?.template || null;

  const [form, setForm] = useState({
    title:          template ? `${template.title} (Re-run)` : '',
    scenario:       template?.scenario       || '',
    reference_urls: template?.reference_urls || [],
    file_urls:      template?.file_urls      || [],
    mode:           template?.mode           || 'standard',
    selected_agents:template?.selected_agents|| [],
    domain_focus:   template?.domain_focus   || [],
  });
  const [urlInput, setUrlInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [openDomains, setOpenDomains] = useState({});

  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: () => base44.entities.Agent.filter({ status: 'active' }),
  });

  const { data: domains = [] } = useQuery({
    queryKey: ['domains'],
    queryFn: async () => {
      try { return await base44.entities.Domain.list(); } catch { return []; }
    },
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

  const toggleDomainOpen = (key) =>
    setOpenDomains(prev => ({ ...prev, [key]: !prev[key] }));

  const toggleDomain = (domain) => {
    setForm(f => ({
      ...f,
      domain_focus: f.domain_focus.includes(domain)
        ? f.domain_focus.filter(d => d !== domain)
        : [...f.domain_focus, domain],
    }));
  };

  const domainMap = Object.fromEntries(domains.map(d => [d.id, d]));

  const agentsByDomain = (() => {
    const groups = new Map();
    for (const agent of agents) {
      const key = agent.domain_id || '__uncategorized__';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(agent);
    }
    return [...groups.entries()].sort(([a], [b]) => {
      if (a === '__uncategorized__') return 1;
      if (b === '__uncategorized__') return -1;
      const nameA = domainMap[a]?.name ?? a;
      const nameB = domainMap[b]?.name ?? b;
      return nameA.localeCompare(nameB);
    });
  })();

  const toggleAllInDomain = (domainAgents) => {
    const ids = domainAgents.map(a => a.id);
    const allSelected = ids.every(id => form.selected_agents.includes(id));
    setForm(f => ({
      ...f,
      selected_agents: allSelected
        ? f.selected_agents.filter(id => !ids.includes(id))
        : [...new Set([...f.selected_agents, ...ids])],
    }));
  };

  const handleSubmit = () => {
    if (!form.title || !form.scenario) return;
    const selectedAgents = form.selected_agents.length > 0
      ? form.selected_agents
      : agents.map(a => a.id);
    createMutation.mutate({
      ...form,
      selected_agents: selectedAgents,
      status: 'draft',
      ...(template ? {
        parent_session_id:    template.id,
        parent_session_title: template.title,
      } : {}),
    });
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        {template ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight">Edit &amp; Re-run</h1>
            <div className="flex items-center gap-1.5 mt-1">
              <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Based on{' '}
                <Link
                  to={`/sessions/${template.id}`}
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {template.title}
                </Link>
              </p>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight">New Session</h1>
            <p className="text-sm text-muted-foreground mt-1">Set up a Red/Blue team adversarial analysis</p>
          </>
        )}
      </div>

      {template && (
        <Card className="px-4 py-3 bg-muted/40 border-dashed flex items-start gap-3">
          <GitBranch className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="text-sm text-muted-foreground leading-relaxed">
            Edit the fields below to adjust your scenario, mode, or agents. Saving will create a
            <span className="font-medium text-foreground"> new independent session</span> — the
            original will not be modified.
          </div>
        </Card>
      )}

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
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Select Agents</Label>
            <div className="flex gap-2">
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground underline"
                onClick={() => setForm(f => ({ ...f, selected_agents: agents.map(a => a.id) }))}
              >
                All
              </button>
              <span className="text-xs text-muted-foreground">/</span>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground underline"
                onClick={() => setForm(f => ({ ...f, selected_agents: [] }))}
              >
                None
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-1">Leave empty to use all active agents</p>

          <div className="border rounded-md overflow-hidden divide-y divide-border">
            {agentsByDomain.map(([domainKey, domainAgents]) => {
              const domain = domainMap[domainKey];
              const domainName = domain?.name ?? (domainKey === '__uncategorized__' ? 'Uncategorized' : domainKey);
              const domainColor = domain?.color ?? '#546E7A';
              const selectedInDomain = domainAgents.filter(a => form.selected_agents.includes(a.id)).length;
              const allSelected = selectedInDomain === domainAgents.length;
              const isOpen = openDomains[domainKey] ?? false;

              return (
                <Collapsible key={domainKey} open={isOpen} onOpenChange={() => toggleDomainOpen(domainKey)}>
                  <CollapsibleTrigger asChild>
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50",
                      isOpen && "bg-muted/30"
                    )}>
                      <ChevronRight className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform flex-shrink-0", isOpen && "rotate-90")} />
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: domainColor }} />
                      <span className="text-sm font-medium flex-1 truncate">{domainName}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {selectedInDomain > 0 ? `${selectedInDomain}/` : ''}{domainAgents.length}
                      </span>
                      <button
                        type="button"
                        className={cn(
                          "text-xs px-1.5 py-0.5 rounded flex-shrink-0",
                          allSelected
                            ? "bg-primary/10 text-primary hover:bg-primary/20"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                        onClick={(e) => { e.stopPropagation(); toggleAllInDomain(domainAgents); }}
                      >
                        {allSelected ? 'Deselect' : 'Select all'}
                      </button>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="divide-y divide-border border-t border-border">
                      {domainAgents.map(agent => {
                        const isSelected = form.selected_agents.includes(agent.id);
                        const isRed = agent.team === 'red';
                        return (
                          <button
                            key={agent.id}
                            type="button"
                            onClick={() => toggleAgent(agent.id)}
                            className={cn(
                              "w-full flex items-center gap-2.5 px-5 py-2 text-left hover:bg-muted/40 transition-colors",
                              isSelected && (isRed ? "bg-red-500/5" : "bg-blue-500/5")
                            )}
                          >
                            <div className={cn(
                              "w-3 h-3 rounded border flex-shrink-0 flex items-center justify-center",
                              isSelected
                                ? isRed ? "bg-red-500 border-red-500" : "bg-blue-500 border-blue-500"
                                : "border-muted-foreground/40"
                            )}>
                              {isSelected && <span className="text-white text-[8px] leading-none">✓</span>}
                            </div>
                            <span className="text-sm flex-1 truncate">{agent.name}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-1 py-0 capitalize flex-shrink-0",
                                isRed ? "border-red-500/30 text-red-500" : "border-blue-500/30 text-blue-500"
                              )}
                            >
                              {agent.team}
                            </Badge>
                          </button>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>

          {form.selected_agents.length > 0 && (
            <p className="text-xs text-muted-foreground">{form.selected_agents.length} agent{form.selected_agents.length !== 1 ? 's' : ''} selected</p>
          )}
        </div>
      </Card>

      <div className="flex items-center justify-between">
        {template ? (
          <Button variant="ghost" onClick={() => navigate(`/sessions/${template.id}`)} className="gap-2 text-muted-foreground">
            <ArrowRight className="w-4 h-4 rotate-180" /> Back to original
          </Button>
        ) : <div />}
        <Button
          onClick={handleSubmit}
          disabled={!form.title || !form.scenario || createMutation.isPending}
          className="gap-2"
        >
          {createMutation.isPending ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : template ? (
            <><GitBranch className="w-4 h-4" /> Save as New Version</>
          ) : (
            <>Create &amp; Start Session <ArrowRight className="w-4 h-4" /></>
          )}
        </Button>
      </div>
    </div>
  );
}