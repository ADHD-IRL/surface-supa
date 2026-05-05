import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Upload, Trash2, CheckSquare, Square, Loader2, Search, X, Bot, FileDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import AgentCard, { tagColor } from '@/components/agents/AgentCard';
import AgentForm from '@/components/agents/AgentForm';
import AgentImportModal from '@/components/agents/AgentImportModal';
import PromptExportModal from '@/components/agents/PromptExportModal';
import { resolveAgent, encodeAgentData } from '@/lib/agentData';

const SEVERITY_ORDER  = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const EXPERTISE_ORDER = { 'World-Class': 0, Principal: 1, Senior: 2, 'Mid-Level': 3, Junior: 4 };

export default function AgentManager() {
  const queryClient = useQueryClient();

  const [modal, setModal] = useState(null);
  const [search, setSearch]               = useState('');
  const [filterDomainId, setFilterDomainId] = useState('');
  const [sortBy, setSortBy]               = useState('name');
  const [groupBy, setGroupBy]             = useState('team');
  const [bulkMode, setBulkMode]           = useState(false);
  const [selected, setSelected]           = useState(new Set());

  // ── Data ──────────────────────────────────────────────────────────────────

  const { data: rawAgents = [], isLoading: agentsLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => base44.entities.Agent.list(),
  });

  // Domain entities — null when schema not yet deployed
  const { data: fetchedDomains = null } = useQuery({
    queryKey: ['domains'],
    queryFn: async () => {
      try { return await base44.entities.Domain.list(); } catch { return null; }
    },
    retry: false,
  });

  const agents = useMemo(() => rawAgents.map(resolveAgent), [rawAgents]);

  // Use fetched Domain entities when available; otherwise derive from agent.domain_id strings
  const domains = useMemo(() => {
    if (fetchedDomains?.length > 0) return fetchedDomains;
    const seen = new Set();
    const list = [];
    agents.forEach(a => {
      if (a.domain_id && !seen.has(a.domain_id)) {
        seen.add(a.domain_id);
        list.push({ id: a.domain_id, name: a.domain_id, color: tagColor(a.domain_id) });
      }
    });
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [fetchedDomains, agents]);

  const domainMap = useMemo(() => {
    const m = {};
    domains.forEach(d => { m[d.id] = d; });
    return m;
  }, [domains]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Agent.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['agents'] }); setModal(null); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Agent.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['agents'] }); setModal(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Agent.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids) => Promise.all(ids.map(id => base44.entities.Agent.delete(id))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setSelected(new Set());
      setBulkMode(false);
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSave = (formData) => {
    if (modal?.id) {
      updateMutation.mutate({ id: modal.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (agent) => {
    if (confirm(`Delete "${agent.name}"?`)) deleteMutation.mutate(agent.id);
  };

  const handleClone = (agent) => {
    // eslint-disable-next-line no-unused-vars
    const { id, created_at, ...rest } = agent;
    createMutation.mutate({ ...rest, name: `${rest.name} (Copy)` });
  };

  const toggleSelect = (id) => setSelected(s => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const handleImport = async (list) => {
    const uniqueNames = [...new Set(list.map(a => a._domain_name).filter(Boolean))];

    // Resolve domain names → ids. Try Domain entity first; fall back to name-as-id.
    const domainIdMap = {};
    if (uniqueNames.length > 0) {
      let currentDomains = [];
      try { currentDomains = await base44.entities.Domain.list(); } catch { /* schema not deployed */ }
      await Promise.all(uniqueNames.map(async (name) => {
        const norm = name.trim().toLowerCase();
        const existing = currentDomains.find(d => d.name.toLowerCase() === norm);
        if (existing) {
          domainIdMap[name] = existing.id;
        } else {
          try {
            const created = await base44.entities.Domain.create({ name: name.trim(), color: tagColor(name) });
            domainIdMap[name] = created.id;
          } catch {
            domainIdMap[name] = name.trim(); // use name directly when entity API unavailable
          }
        }
      }));
    }

    const payloads = list.map(a => {
      // eslint-disable-next-line no-unused-vars
      const { _domain_name, ...rest } = a;
      const domain_id = _domain_name ? (domainIdMap[_domain_name] ?? _domain_name.trim()) : '';
      const payload = { ...rest, domain_id };
      payload.system_prompt = encodeAgentData(payload);
      return payload;
    });

    for (const payload of payloads) {
      await base44.entities.Agent.create(payload);
    }

    queryClient.invalidateQueries({ queryKey: ['agents'] });
    queryClient.invalidateQueries({ queryKey: ['domains'] });
    setModal(null);
  };

  // ── Derived data ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => agents.filter(a => {
    const matchSearch = !search
      || a.name?.toLowerCase().includes(search.toLowerCase())
      || a.discipline?.toLowerCase().includes(search.toLowerCase())
      || a.domain_tags?.some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchDomain = !filterDomainId
      || (filterDomainId === '__unassigned' ? !a.domain_id : a.domain_id === filterDomainId);
    return matchSearch && matchDomain;
  }), [agents, search, filterDomainId]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (sortBy === 'name')      return a.name.localeCompare(b.name);
    if (sortBy === 'severity')  return (SEVERITY_ORDER[a.severity_default] ?? 4) - (SEVERITY_ORDER[b.severity_default] ?? 4);
    if (sortBy === 'expertise') return (EXPERTISE_ORDER[a.expertise_level] ?? 5) - (EXPERTISE_ORDER[b.expertise_level] ?? 5);
    return 0;
  }), [filtered, sortBy]);

  const groups = useMemo(() => {
    if (groupBy === 'team') {
      return [
        { key: 'red',  label: 'Red Team — Attackers',  color: '#DC2626', items: sorted.filter(a => a.team === 'red') },
        { key: 'blue', label: 'Blue Team — Defenders', color: '#2563EB', items: sorted.filter(a => a.team === 'blue') },
      ];
    }
    if (groupBy === 'domain') {
      const domainList = filterDomainId && filterDomainId !== '__unassigned'
        ? domains.filter(d => d.id === filterDomainId)
        : domains;
      const assigned = new Set();
      const result = domainList.map(d => {
        const items = sorted.filter(a => a.domain_id === d.id);
        items.forEach(a => assigned.add(a.id));
        return { key: d.id, label: d.name, color: d.color || tagColor(d.name), items };
      });
      result.push({ key: 'unassigned', label: 'No Domain', color: '#546E7A', items: sorted.filter(a => !assigned.has(a.id)) });
      return result.filter(g => g.items.length > 0);
    }
    if (groupBy === 'severity') {
      const SC = { CRITICAL: '#C0392B', HIGH: '#D68910', MEDIUM: '#2E86AB', LOW: '#27AE60' };
      return ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(s => ({
        key: s, label: s, color: SC[s], items: sorted.filter(a => (a.severity_default || 'HIGH') === s),
      })).filter(g => g.items.length > 0);
    }
    return [];
  }, [sorted, groupBy, domains, filterDomainId]);

  const deletableSelected = [...selected].filter(id => {
    const a = agents.find(x => x.id === id);
    return a && !a.is_default;
  });

  const redCount  = agents.filter(a => a.team === 'red').length;
  const blueCount = agents.filter(a => a.team === 'blue').length;
  const activeDomain = filterDomainId ? domainMap[filterDomainId] : null;

  if (agentsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">

      {/* ── Domain sidebar ── */}
      <aside className="w-52 flex-shrink-0 border-r border-border p-4 space-y-4 sticky top-0 h-screen overflow-y-auto">

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search agents…"
            className="w-full pl-8 pr-3 h-8 text-xs rounded border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40"
          />
        </div>

        <div>
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-2">Domains</p>
          <div className="space-y-0.5">
            <button
              onClick={() => setFilterDomainId('')}
              className={cn(
                "w-full text-left text-xs px-2 py-1.5 rounded-md flex items-center justify-between transition-colors",
                !filterDomainId ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <span>All Domains</span>
              <span className="text-[10px] font-mono">{agents.length}</span>
            </button>

            {domains.map(d => {
              const count = agents.filter(a => a.domain_id === d.id).length;
              const active = filterDomainId === d.id;
              const color = d.color || tagColor(d.name);
              return (
                <button
                  key={d.id}
                  onClick={() => setFilterDomainId(active ? '' : d.id)}
                  className={cn(
                    "w-full text-left text-xs px-2 py-1.5 rounded-md flex items-center gap-2 transition-colors",
                    active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="flex-1 truncate">{d.name}</span>
                  <span className="text-[10px] font-mono flex-shrink-0">{count}</span>
                </button>
              );
            })}

            {(() => {
              const count = agents.filter(a => !a.domain_id).length;
              if (!count) return null;
              const active = filterDomainId === '__unassigned';
              return (
                <button
                  onClick={() => setFilterDomainId(active ? '' : '__unassigned')}
                  className={cn(
                    "w-full text-left text-xs px-2 py-1.5 rounded-md flex items-center gap-2 transition-colors",
                    active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 flex-shrink-0" />
                  <span className="flex-1 italic">Unassigned</span>
                  <span className="text-[10px] font-mono flex-shrink-0">{count}</span>
                </button>
              );
            })()}
          </div>
        </div>

        <div className="border-t border-border pt-3">
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-2">Teams</p>
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between px-2">
              <span className="font-bold font-mono text-[11px]" style={{ color: '#DC2626' }}>RED</span>
              <span className="font-mono text-muted-foreground">{redCount}</span>
            </div>
            <div className="flex items-center justify-between px-2">
              <span className="font-bold font-mono text-[11px]" style={{ color: '#2563EB' }}>BLUE</span>
              <span className="font-mono text-muted-foreground">{blueCount}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0">

        <div className="border-b border-border px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Bot className="w-5 h-5 text-muted-foreground" />
            <div>
              <h1 className="text-sm font-bold tracking-widest font-mono">AGENTS</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {activeDomain
                  ? <><span className="font-medium text-foreground">{activeDomain.name}</span> — {filtered.length} agent{filtered.length !== 1 ? 's' : ''}</>
                  : filterDomainId === '__unassigned'
                    ? <><span className="font-medium text-foreground">Unassigned</span> — {filtered.length} agent{filtered.length !== 1 ? 's' : ''}</>
                    : <>{agents.length} agent{agents.length !== 1 ? 's' : ''} in library</>
                }
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setBulkMode(b => !b); setSelected(new Set()); }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border transition-colors",
                bulkMode
                  ? "border-primary text-primary bg-primary/5"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              {bulkMode ? 'Cancel' : 'Select'}
            </button>
            <button
              onClick={() => setModal('export')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <FileDown className="w-3.5 h-3.5" /> Export Prompts
            </button>
            <button
              onClick={() => setModal('import')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Upload className="w-3.5 h-3.5" /> Import
            </button>
            <button
              onClick={() => setModal('new')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> New Agent
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">

          {bulkMode && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-muted rounded border border-border">
              <button onClick={() => setSelected(new Set(agents.filter(a => !a.is_default).map(a => a.id)))}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                <CheckSquare className="w-3.5 h-3.5" /> All
              </button>
              <button onClick={() => setSelected(new Set())}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                <Square className="w-3.5 h-3.5" /> None
              </button>
              <span className="text-xs text-muted-foreground ml-auto">{selected.size} selected</span>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    disabled={deletableSelected.length === 0 || bulkDeleteMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 transition-colors"
                  >
                    {bulkDeleteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    Delete {deletableSelected.length > 0 ? deletableSelected.length : ''}
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {deletableSelected.length} agent{deletableSelected.length !== 1 ? 's' : ''}?</AlertDialogTitle>
                    <AlertDialogDescription>This permanently removes the selected agents and cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => bulkDeleteMutation.mutate(deletableSelected)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete {deletableSelected.length}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Group</span>
              <Select value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="team">Team</SelectItem>
                  <SelectItem value="domain">Domain</SelectItem>
                  <SelectItem value="severity">Severity</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Sort</span>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="severity">Severity</SelectItem>
                  <SelectItem value="expertise">Expertise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {filterDomainId && (
              <button onClick={() => setFilterDomainId('')}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground ml-auto transition-colors">
                {activeDomain && (
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeDomain.color || tagColor(activeDomain.name) }} />
                )}
                <span>{activeDomain ? activeDomain.name : 'Unassigned'}</span>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {groups.map(group => (
            <div key={group.key}>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
                <h2 className="text-[10px] font-bold uppercase tracking-widest font-mono text-muted-foreground">
                  {group.label}
                </h2>
                <span className="text-[10px] font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5">
                  {group.items.length}
                </span>
              </div>
              {group.items.length === 0 ? (
                <p className="text-sm text-muted-foreground pl-4">No agents in this group</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {group.items.map(agent => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      domain={agent.domain_id ? domainMap[agent.domain_id] : undefined}
                      onEdit={bulkMode ? undefined : (a) => setModal(a)}
                      onDelete={bulkMode ? undefined : handleDelete}
                      onClone={bulkMode ? undefined : handleClone}
                      selectable={bulkMode}
                      selected={selected.has(agent.id)}
                      onSelect={() => toggleSelect(agent.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}

          {agents.length === 0 && (
            <div className="text-center py-20 text-muted-foreground space-y-3">
              <Bot className="w-10 h-10 mx-auto text-muted-foreground/30" />
              <p className="text-sm">No agents yet.</p>
              <p className="text-xs">Import a .md file or create your first agent.</p>
            </div>
          )}

          {agents.length > 0 && filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-sm">No agents match the current filter.</p>
              <button onClick={() => { setSearch(''); setFilterDomainId(''); }}
                className="text-xs text-primary mt-2 hover:underline">Clear filters</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {(modal === 'new' || (modal && typeof modal === 'object')) && (
        <AgentForm
          agent={typeof modal === 'object' ? modal : null}
          domains={domains}
          onSave={handleSave}
          onCancel={() => setModal(null)}
          saving={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {modal === 'import' && (
        <AgentImportModal
          onImport={handleImport}
          onCancel={() => setModal(null)}
          importing={false}
        />
      )}

      {modal === 'export' && (
        <PromptExportModal
          agents={agents}
          domainMap={domainMap}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}