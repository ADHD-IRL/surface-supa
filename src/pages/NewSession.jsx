import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { tagColor } from '@/components/agents/AgentCard';
import { resolveAgent } from '@/lib/agentData';
import { Plus, X, Upload, ArrowRight, Link2, GitBranch, ChevronRight, Sparkles, Clock, Save, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const MODE_OPTIONS = [
  {
    value: 'rapid',
    label: 'Rapid',
    sub: 'One round of independent assessments — no rebuttals.',
    time: '~30s · 1 LLM call/agent',
    badge: 'Fast',
  },
  {
    value: 'standard',
    label: 'Standard',
    sub: 'R1 independent assessments + R2 rebuttals + synthesis.',
    time: '~2m · 2 LLM calls/agent',
    badge: 'Default',
  },
  {
    value: 'deep',
    label: 'Deep',
    sub: 'Two full R1 + R2 cycles for high-stakes scenarios.',
    time: '~5m · 4 LLM calls/agent',
    badge: 'Thorough',
  },
];

const RUNTIME_ESTIMATE = { rapid: '~30s', standard: '~2m', deep: '~5m' };

const DRAFT_KEY = 'surface-new-session-draft';

function ModeCard({ option, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg border p-3.5 text-left transition-colors w-full',
        active
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'border-border hover:border-border/80 bg-card',
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={cn(
          'w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
          active ? 'border-primary' : 'border-muted-foreground/40',
        )}>
          {active && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
        </span>
        <span className="text-sm font-semibold">{option.label}</span>
        <span className="ml-auto text-[9px] uppercase tracking-wider text-muted-foreground font-mono">{option.badge}</span>
      </div>
      <p className="text-xs text-muted-foreground leading-snug">{option.sub}</p>
      <p className="text-[11px] text-muted-foreground/70 mt-2 font-mono">{option.time}</p>
    </button>
  );
}

export default function NewSession() {
  const navigate = useNavigate();
  const location = useLocation();
  const template = location.state?.template || null;

  const [form, setForm] = useState(() => {
    // For re-runs, use template data; for new sessions, try to restore draft
    if (template) {
      return {
        title:          `${template.title} (Re-run)`,
        scenario:       template.scenario       || '',
        reference_urls: template.reference_urls || [],
        file_urls:      template.file_urls      || [],
        mode:           template.mode           || 'standard',
        selected_agents:template.selected_agents|| [],
      };
    }
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      title: '', scenario: '', reference_urls: [], file_urls: [],
      mode: 'standard', selected_agents: [],
    };
  });

  // Roster mode: 'default' = use all agents, 'handpick' = manual picker
  const [rosterMode, setRosterMode] = useState(() =>
    template?.selected_agents?.length ? 'handpick' : 'default',
  );

  // Attachment tab
  const [attachmentTab, setAttachmentTab] = useState('url');
  const [urlInput, setUrlInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [openDomains, setOpenDomains] = useState({});
  const [teamFilter, setTeamFilter] = useState('all');

  // Draft autosave
  const [lastSaved, setLastSaved] = useState(null);
  useEffect(() => {
    if (template) return; // don't autosave re-run forms
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
        setLastSaved(new Date());
      } catch {}
    }, 800);
    return () => clearTimeout(t);
  }, [form, template]);

  const savedAgo = lastSaved
    ? (() => {
        const s = Math.round((Date.now() - lastSaved) / 1000);
        return s < 5 ? 'just now' : `${s}s ago`;
      })()
    : null;

  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => (await base44.entities.Agent.filter({ status: 'active' })).map(resolveAgent),
  });

  const { data: fetchedDomains = null } = useQuery({
    queryKey: ['domains'],
    queryFn: async () => {
      try { return await base44.entities.Domain.list(); } catch { return null; }
    },
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Session.create(data),
    onSuccess: (session) => {
      if (!template) {
        try { localStorage.removeItem(DRAFT_KEY); } catch {}
      }
      navigate(`/sessions/${session.id}`);
    },
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

  const effectiveDomains = (() => {
    if (fetchedDomains?.length > 0) return fetchedDomains;
    const seen = new Set();
    const list = [];
    agents.forEach(a => {
      const key = a.domain_id || a.discipline?.split(/[\/,]/)[0]?.trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        list.push({ id: key, name: key, color: tagColor(key) });
      }
    });
    return list.sort((a, b) => a.name.localeCompare(b.name));
  })();

  const domainMap = Object.fromEntries(effectiveDomains.map(d => [d.id, d]));

  const agentsByDomain = (() => {
    const groups = new Map();
    for (const agent of agents) {
      const key = agent.domain_id
        || agent.discipline?.split(/[\/,]/)[0]?.trim()
        || '__uncategorized__';
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

  // Summary bar derived values
  const activeAgentCount = rosterMode === 'default' ? agents.length : form.selected_agents.length || agents.length;
  const redCount = rosterMode === 'default'
    ? agents.filter(a => a.team === 'red').length
    : (form.selected_agents.length
        ? agents.filter(a => form.selected_agents.includes(a.id) && a.team === 'red').length
        : agents.filter(a => a.team === 'red').length);
  const blueCount = activeAgentCount - redCount;
  const modeOption = MODE_OPTIONS.find(m => m.value === form.mode) || MODE_OPTIONS[1];

  const handleSubmit = () => {
    if (!form.title || !form.scenario) return;
    const selectedAgents = rosterMode === 'default' || form.selected_agents.length === 0
      ? agents.map(a => a.id)
      : form.selected_agents;
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
    <div className="p-6 lg:p-8 max-w-3xl mx-auto pb-28">
      {/* Page header */}
      <div className="mb-6">
        {template ? (
          <>
            <div className="flex items-center gap-1.5 mb-1">
              <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
              <Link
                to={`/sessions/${template.id}`}
                className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                {template.title}
              </Link>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Edit &amp; Re-run</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Adjust the fields below — saving creates a new independent session.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight">New Session</h1>
            <p className="text-sm text-muted-foreground mt-1">Set up a Red/Blue team adversarial analysis</p>
          </>
        )}

        {/* Autosave indicator */}
        {!template && savedAgo && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 font-mono mt-2">
            <Save className="w-3 h-3" /> Draft saved · {savedAgo}
          </div>
        )}
      </div>

      <Card className="p-6 space-y-6">
        {/* Title */}
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">Session Title</Label>
          <Input
            placeholder="e.g., Q2 Supply Chain Vulnerability Assessment"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          />
        </div>

        {/* Scenario with hint */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Scenario Description</Label>
          </div>
          <Textarea
            placeholder="Describe the scenario, system, or situation you want to stress-test..."
            value={form.scenario}
            onChange={e => setForm(f => ({ ...f, scenario: e.target.value }))}
            className="min-h-[120px] resize-y"
          />
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
            <Sparkles className="w-3 h-3 flex-shrink-0" />
            Best results with 100–500 words. Include: org context, asset/system, threat horizon, constraints.
          </div>
        </div>

        {/* Analysis Mode — radio cards */}
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">Analysis Mode</Label>
          <div className="grid grid-cols-3 gap-2.5">
            {MODE_OPTIONS.map(option => (
              <ModeCard
                key={option.value}
                option={option}
                active={form.mode === option.value}
                onClick={() => setForm(f => ({ ...f, mode: option.value }))}
              />
            ))}
          </div>
        </div>

        {/* Agent Roster — preset cards */}
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">Agent Roster</Label>
          <div className="space-y-2">
            {/* Default preset */}
            <button
              type="button"
              onClick={() => { setRosterMode('default'); setForm(f => ({ ...f, selected_agents: [] })); }}
              className={cn(
                'w-full rounded-lg border px-3.5 py-3 text-left transition-colors flex items-start gap-3',
                rosterMode === 'default'
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border hover:border-border/80 bg-card',
              )}
            >
              <span className={cn(
                'w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0',
                rosterMode === 'default' ? 'border-primary' : 'border-muted-foreground/40',
              )}>
                {rosterMode === 'default' && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">Default roster</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  All {agents.length || '…'} active agents across all domains
                </div>
              </div>
              {agents.length > 0 && (
                <Badge variant="outline" className="text-[10px] flex-shrink-0">
                  {agents.length} agents
                </Badge>
              )}
            </button>

            {/* Hand-pick */}
            <button
              type="button"
              onClick={() => setRosterMode('handpick')}
              className={cn(
                'w-full rounded-lg border px-3.5 py-3 text-left transition-colors flex items-start gap-3',
                rosterMode === 'handpick'
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border hover:border-border/80 bg-card',
              )}
            >
              <span className={cn(
                'w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0',
                rosterMode === 'handpick' ? 'border-primary' : 'border-muted-foreground/40',
              )}>
                {rosterMode === 'handpick' && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">Hand-pick agents…</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {rosterMode === 'handpick' && form.selected_agents.length > 0
                    ? `${form.selected_agents.length} agent${form.selected_agents.length !== 1 ? 's' : ''} selected`
                    : 'Choose by domain or individually'}
                </div>
              </div>
              {rosterMode === 'handpick' && form.selected_agents.length > 0 && (
                <Badge variant="outline" className="text-[10px] flex-shrink-0">
                  {form.selected_agents.length} selected
                </Badge>
              )}
            </button>
          </div>

          {/* Expanded agent picker (hand-pick mode) */}
          {rosterMode === 'handpick' && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex rounded-md border border-border overflow-hidden text-xs">
                  {[
                    { value: 'all', label: 'Both' },
                    { value: 'red', label: 'Red' },
                    { value: 'blue', label: 'Blue' },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTeamFilter(value)}
                      className={cn(
                        'px-2.5 py-1 font-medium transition-colors',
                        teamFilter === value
                          ? value === 'red'  ? 'bg-red-500/10 text-red-500'
                          : value === 'blue' ? 'bg-blue-500/10 text-blue-500'
                          : 'bg-muted text-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                    onClick={() => setForm(f => ({
                      ...f,
                      selected_agents: agents.filter(a => teamFilter === 'all' || a.team === teamFilter).map(a => a.id),
                    }))}
                  >
                    All
                  </button>
                  <span className="text-xs text-muted-foreground">/</span>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                    onClick={() => {
                      const visibleIds = new Set(agents.filter(a => teamFilter === 'all' || a.team === teamFilter).map(a => a.id));
                      setForm(f => ({ ...f, selected_agents: f.selected_agents.filter(id => !visibleIds.has(id)) }));
                    }}
                  >
                    None
                  </button>
                </div>
              </div>

              <div className="border rounded-md overflow-hidden divide-y divide-border">
                {agentsByDomain.map(([domainKey, domainAgents]) => {
                  const visibleAgents = teamFilter === 'all' ? domainAgents : domainAgents.filter(a => a.team === teamFilter);
                  if (!visibleAgents.length) return null;
                  const domain = domainMap[domainKey];
                  const domainName = domain?.name ?? (domainKey === '__uncategorized__' ? 'Uncategorized' : domainKey);
                  const domainColor = domain?.color ?? tagColor(domainKey);
                  const selectedInDomain = visibleAgents.filter(a => form.selected_agents.includes(a.id)).length;
                  const allSelected = selectedInDomain === visibleAgents.length;
                  const isOpen = openDomains[domainKey] ?? false;
                  return (
                    <Collapsible key={domainKey} open={isOpen} onOpenChange={() => toggleDomainOpen(domainKey)}>
                      <CollapsibleTrigger asChild>
                        <div className={cn(
                          'flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50',
                          isOpen && 'bg-muted/30',
                        )}>
                          <ChevronRight className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform flex-shrink-0', isOpen && 'rotate-90')} />
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: domainColor }} />
                          <span className="text-sm font-medium flex-1 truncate">{domainName}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {selectedInDomain > 0 ? `${selectedInDomain}/` : ''}{visibleAgents.length}
                          </span>
                          <button
                            type="button"
                            className={cn(
                              'text-xs px-1.5 py-0.5 rounded flex-shrink-0',
                              allSelected
                                ? 'bg-primary/10 text-primary hover:bg-primary/20'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                            )}
                            onClick={(e) => { e.stopPropagation(); toggleAllInDomain(visibleAgents); }}
                          >
                            {allSelected ? 'Deselect' : 'Select all'}
                          </button>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="divide-y divide-border border-t border-border">
                          {visibleAgents.map(agent => {
                            const isSelected = form.selected_agents.includes(agent.id);
                            const isRed = agent.team === 'red';
                            return (
                              <button
                                key={agent.id}
                                type="button"
                                onClick={() => toggleAgent(agent.id)}
                                className={cn(
                                  'w-full flex items-center gap-2.5 px-5 py-2 text-left hover:bg-muted/40 transition-colors',
                                  isSelected && (isRed ? 'bg-red-500/5' : 'bg-blue-500/5'),
                                )}
                              >
                                <div className={cn(
                                  'w-3 h-3 rounded border flex-shrink-0 flex items-center justify-center',
                                  isSelected
                                    ? isRed ? 'bg-red-500 border-red-500' : 'bg-blue-500 border-blue-500'
                                    : 'border-muted-foreground/40',
                                )}>
                                  {isSelected && <span className="text-white text-[8px] leading-none">✓</span>}
                                </div>
                                <span className="text-sm flex-1 truncate">{agent.name}</span>
                                {teamFilter === 'all' && (
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      'text-[10px] px-1 py-0 capitalize flex-shrink-0',
                                      isRed ? 'border-red-500/30 text-red-500' : 'border-blue-500/30 text-blue-500',
                                    )}
                                  >
                                    {agent.team}
                                  </Badge>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Reference materials — tabbed URL / File */}
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">
            Reference materials{' '}
            <span className="text-xs font-normal text-muted-foreground ml-1">optional</span>
          </Label>
          <div className="rounded-md border border-border">
            {/* Tab bar */}
            <div className="flex border-b border-border text-xs">
              <button
                type="button"
                onClick={() => setAttachmentTab('url')}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-2 font-medium transition-colors',
                  attachmentTab === 'url'
                    ? 'border-b-2 border-primary text-primary -mb-px'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Link2 className="w-3.5 h-3.5" /> URLs
                {form.reference_urls.length > 0 && (
                  <span className="font-mono text-muted-foreground ml-1">{form.reference_urls.length}</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setAttachmentTab('file')}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-2 font-medium transition-colors',
                  attachmentTab === 'file'
                    ? 'border-b-2 border-primary text-primary -mb-px'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Upload className="w-3.5 h-3.5" /> Files
                {form.file_urls.length > 0 && (
                  <span className="font-mono text-muted-foreground ml-1">{form.file_urls.length}</span>
                )}
              </button>
              <span className="ml-auto self-center px-3 text-[10px] text-muted-foreground font-mono hidden sm:block">
                {attachmentTab === 'url' ? 'URLs added to scenario context' : 'Files sent as attachments'}
              </span>
            </div>

            {/* URL tab */}
            {attachmentTab === 'url' && (
              <div className="p-3 space-y-2">
                {form.reference_urls.map((url, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-muted/50 px-2.5 py-1.5 rounded">
                    <Link2 className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
                    <span className="truncate flex-1 text-foreground">{url}</span>
                    <button type="button" onClick={() => removeUrl(i)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    placeholder="https://example.com/report"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addUrl()}
                    className="text-sm h-9"
                  />
                  <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" onClick={addUrl}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* File tab */}
            {attachmentTab === 'file' && (
              <div className="p-3">
                <label className="flex items-center gap-2 px-4 py-3 border border-dashed border-border rounded-lg cursor-pointer hover:border-primary/30 transition-colors">
                  <Upload className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {uploading ? 'Uploading…' : 'Click to upload supporting documents'}
                  </span>
                  <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                </label>
                {form.file_urls.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">{form.file_urls.length} file{form.file_urls.length !== 1 ? 's' : ''} attached</p>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Sticky summary bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur-sm px-6 lg:px-8 py-3 z-10">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm min-w-0 overflow-hidden">
            <Badge variant="outline" className="text-xs capitalize flex-shrink-0">{modeOption.label}</Badge>
            <span className="text-muted-foreground flex-shrink-0">·</span>
            <span className="flex-shrink-0">
              <strong>{activeAgentCount}</strong>
              {agents.length > 0 && activeAgentCount > 0 && (
                <span className="text-muted-foreground"> ({redCount}R / {blueCount}B)</span>
              )}
            </span>
            <span className="text-muted-foreground flex-shrink-0">·</span>
            <span className="inline-flex items-center gap-1 text-muted-foreground flex-shrink-0">
              <Clock className="w-3.5 h-3.5" />{RUNTIME_ESTIMATE[form.mode]}
            </span>
            {form.reference_urls.length + form.file_urls.length > 0 && (
              <>
                <span className="text-muted-foreground flex-shrink-0">·</span>
                <span className="inline-flex items-center gap-1 text-muted-foreground flex-shrink-0">
                  <Link2 className="w-3.5 h-3.5" />
                  {form.reference_urls.length + form.file_urls.length} reference{form.reference_urls.length + form.file_urls.length !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            {template ? (
              <Button variant="ghost" size="sm" onClick={() => navigate(`/sessions/${template.id}`)} className="gap-1.5 text-muted-foreground">
                <ArrowRight className="w-4 h-4 rotate-180" /> Back
              </Button>
            ) : null}
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
                <>Create &amp; Start <ArrowRight className="w-4 h-4" /></>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
