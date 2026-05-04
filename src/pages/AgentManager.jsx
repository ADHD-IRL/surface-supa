import React, { useState, useMemo, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Upload, Trash2, CheckSquare, Square, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import AgentCard from '@/components/agents/AgentCard';
import AgentForm from '@/components/agents/AgentForm';
import AgentImportModal from '@/components/agents/AgentImportModal';

const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const EXPERTISE_ORDER = { 'World-Class': 0, Principal: 1, Senior: 2, 'Mid-Level': 3, Junior: 4 };
const DOMAIN_COLORS = {
  cyber:        'border-blue-500/30 text-blue-600 bg-blue-50 dark:bg-blue-950/30',
  geopolitical: 'border-purple-500/30 text-purple-600 bg-purple-50 dark:bg-purple-950/30',
  financial:    'border-green-500/30 text-green-600 bg-green-50 dark:bg-green-950/30',
  operational:  'border-amber-500/30 text-amber-600 bg-amber-50 dark:bg-amber-950/30',
  strategic:    'border-rose-500/30 text-rose-600 bg-rose-50 dark:bg-rose-950/30',
  untagged:     'border-border text-muted-foreground bg-muted/40',
};
const DEFAULT_DOMAIN_COLOR = 'border-slate-400/30 text-slate-600 bg-slate-50 dark:bg-slate-950/30';

export default function AgentManager() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [sortBy, setSortBy] = useState('name');
  const [groupBy, setGroupBy] = useState('team');

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => base44.entities.Agent.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Agent.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setShowForm(false);
      setEditing(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Agent.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setShowForm(false);
      setEditing(null);
    },
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

  const importMutation = useMutation({
    mutationFn: (agentList) => Promise.all(agentList.map(a => base44.entities.Agent.create(a))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setShowImport(false);
    },
  });

  const handleSave = (formData) => {
    if (editing && editing !== 'new') {
      updateMutation.mutate({ id: editing.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const formRef = useRef(null);

  const handleEdit = (agent) => {
    setShowImport(false);
    setEditing(agent);
    setShowForm(true);
  };

  useEffect(() => {
    if (showForm && formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      formRef.current.focus?.();
    }
  }, [showForm, editing]);

  const handleDelete = (agent) => {
    if (confirm(`Delete agent "${agent.name}"?`)) {
      deleteMutation.mutate(agent.id);
    }
  };

  const toggleSelect = (id) => setSelected(s => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const selectAll = () => setSelected(new Set(agents.filter(a => !a.is_default).map(a => a.id)));
  const selectNone = () => setSelected(new Set());

  const sorted = useMemo(() => {
    return [...agents].sort((a, b) => {
      if (sortBy === 'name')      return a.name.localeCompare(b.name);
      if (sortBy === 'severity')  return (SEVERITY_ORDER[a.severity_default] ?? 4) - (SEVERITY_ORDER[b.severity_default] ?? 4);
      if (sortBy === 'expertise') return (EXPERTISE_ORDER[a.expertise_level] ?? 5) - (EXPERTISE_ORDER[b.expertise_level] ?? 5);
      return 0;
    });
  }, [agents, sortBy]);

  // Stats
  const redCount  = agents.filter(a => a.team === 'red').length;
  const blueCount = agents.filter(a => a.team === 'blue').length;
  const allDomains = useMemo(() => {
    const seen = new Set();
    agents.forEach(a => a.domain_tags?.forEach(t => seen.add(t)));
    return [...seen].sort();
  }, [agents]);
  const domainCounts = useMemo(() => {
    const counts = {};
    allDomains.forEach(d => { counts[d] = agents.filter(a => a.domain_tags?.includes(d)).length; });
    return counts;
  }, [agents, allDomains]);

  // Grouping
  const groups = useMemo(() => {
    if (groupBy === 'team') {
      return [
        { key: 'red',  label: 'Red Team — Attackers',  labelClass: 'text-red-team',  dot: 'bg-red-team',  items: sorted.filter(a => a.team === 'red') },
        { key: 'blue', label: 'Blue Team — Defenders', labelClass: 'text-blue-team', dot: 'bg-blue-team', items: sorted.filter(a => a.team === 'blue') },
      ];
    }
    if (groupBy === 'domain') {
      const tagged = new Set();
      const result = allDomains.map(d => {
        const items = sorted.filter(a => a.domain_tags?.includes(d));
        items.forEach(a => tagged.add(a.id));
        return { key: d, label: d.charAt(0).toUpperCase() + d.slice(1), items };
      });
      result.push({ key: 'untagged', label: 'No Domain Tags', items: sorted.filter(a => !tagged.has(a.id)) });
      return result.filter(g => g.items.length > 0);
    }
    if (groupBy === 'severity') {
      return ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(s => ({
        key: s, label: s, items: sorted.filter(a => (a.severity_default || 'HIGH') === s),
      })).filter(g => g.items.length > 0);
    }
    if (groupBy === 'category') {
      const cats = [...new Set(sorted.map(a => a.category || ''))].sort((a, b) => {
        if (!a) return 1;
        if (!b) return -1;
        return a.localeCompare(b);
      });
      return cats.map(c => ({
        key: c || '__none',
        label: c || 'Uncategorized',
        items: sorted.filter(a => (a.category || '') === c),
      })).filter(g => g.items.length > 0);
    }
    return [];
  }, [sorted, groupBy]);

  const deletableSelected = [...selected].filter(id => {
    const a = agents.find(x => x.id === id);
    return a && !a.is_default;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {agents.length} total — <span className="text-red-team font-medium">{redCount} red</span> / <span className="text-blue-team font-medium">{blueCount} blue</span>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button
            variant={bulkMode ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => { setBulkMode(b => !b); setSelected(new Set()); }}
            className="gap-2"
          >
            <CheckSquare className="w-4 h-4" />
            {bulkMode ? 'Cancel' : 'Select'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setShowImport(true); }} className="gap-2">
            <Upload className="w-4 h-4" /> Import
          </Button>
          <Button size="sm" onClick={() => { setShowImport(false); setEditing('new'); setShowForm(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Create
          </Button>
        </div>
      </div>

      {/* Domain counts bar */}
      {allDomains.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {allDomains.map(d => (
            <Badge key={d} variant="outline" className={cn('text-xs px-2 py-0.5 capitalize', DOMAIN_COLORS[d] || DEFAULT_DOMAIN_COLOR)}>
              {d} <span className="ml-1 font-bold">{domainCounts[d]}</span>
            </Badge>
          ))}
        </div>
      )}

      {/* Bulk action bar */}
      {bulkMode && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-muted rounded-lg border border-border">
          <button onClick={selectAll} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <CheckSquare className="w-3.5 h-3.5" /> Select all
          </button>
          <button onClick={selectNone} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <Square className="w-3.5 h-3.5" /> None
          </button>
          <span className="text-xs text-muted-foreground ml-auto">
            {selected.size} selected
          </span>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                disabled={deletableSelected.length === 0 || bulkDeleteMutation.isPending}
                className="gap-2 h-7 text-xs"
              >
                {bulkDeleteMutation.isPending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Trash2 className="w-3.5 h-3.5" />}
                Delete {deletableSelected.length > 0 ? deletableSelected.length : ''} Agent{deletableSelected.length !== 1 ? 's' : ''}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {deletableSelected.length} agent{deletableSelected.length !== 1 ? 's' : ''}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes the selected agents. Default agents are excluded. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => bulkDeleteMutation.mutate(deletableSelected)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete {deletableSelected.length} Agent{deletableSelected.length !== 1 ? 's' : ''}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Group</span>
          <Select value={groupBy} onValueChange={setGroupBy}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="team">Team</SelectItem>
              <SelectItem value="domain">Domain</SelectItem>
              <SelectItem value="severity">Severity</SelectItem>
              <SelectItem value="category">Category</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Sort</span>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="severity">Severity</SelectItem>
              <SelectItem value="expertise">Expertise</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Forms */}
      {showImport && (
        <AgentImportModal
          onImport={(agentList) => importMutation.mutate(agentList)}
          onCancel={() => setShowImport(false)}
          importing={importMutation.isPending}
        />
      )}
      {showForm && (
        <div ref={formRef} tabIndex={-1} className="outline-none scroll-mt-6">
        <AgentForm
          agent={editing !== 'new' ? editing : null}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          saving={createMutation.isPending || updateMutation.isPending}
        />
        </div>
      )}

      {/* Agent groups */}
      {groups.map(group => (
        <div key={group.key}>
          <h2 className={cn(
            'text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2',
            group.labelClass || 'text-muted-foreground'
          )}>
            {group.dot && <span className={cn('w-2 h-2 rounded-full', group.dot)} />}
            {!group.dot && groupBy === 'domain' && (
              <span className={cn('w-2 h-2 rounded-full border-2', DOMAIN_COLORS[group.key]?.replace(/bg-\S+/, ''))} />
            )}
            <span className="capitalize">{group.label}</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal ml-1">
              {group.items.length}
            </Badge>
          </h2>
          {group.items.length === 0 ? (
            <p className="text-sm text-muted-foreground pl-4">No agents in this group</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {group.items.map(agent => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onEdit={bulkMode ? undefined : handleEdit}
                  onDelete={bulkMode ? undefined : handleDelete}
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
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm">No agents yet. Import or create your first agent.</p>
        </div>
      )}
    </div>
  );
}
