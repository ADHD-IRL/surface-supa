import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowRight, Search, Loader2, Trash2, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

function scrsColor(score) {
  if (score == null) return null;
  return score >= 80 ? '#dc2626' : score >= 60 ? '#ea580c' : score >= 40 ? '#ca8a04' : '#16a34a';
}

function relativeTime(dateStr) {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return '—';
  }
}

const STATUS_FILTERS = ['all', 'completed', 'running', 'failed', 'draft'];
const STATUS_LABEL = { all: 'All', completed: 'Completed', running: 'Running', failed: 'Failed', draft: 'Drafts' };

const STATUS_BADGE = {
  draft:     { label: 'Draft',            className: 'bg-muted text-muted-foreground border-border' },
  running:   { label: 'Running',          className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  completed: { label: 'Ready to review',  className: 'bg-green-500/10 text-green-700 border-green-500/20 dark:text-green-400' },
  failed:    { label: 'Needs attention',  className: 'bg-red-500/10 text-red-600 border-red-500/20' },
};

function SessionRow({ session, onDeleteClick, sessionMap, inset = false }) {
  const navigate = useNavigate();
  const cfg = STATUS_BADGE[session.status] || STATUS_BADGE.draft;
  const color = scrsColor(session.scrs_score);
  const modeLabel = session.mode
    ? session.mode.charAt(0).toUpperCase() + session.mode.slice(1)
    : null;
  const agentCount = session.selected_agents?.length;

  // Delta vs parent
  let delta = null;
  if (session.parent_session_id && session.scrs_score != null) {
    const parent = sessionMap[session.parent_session_id];
    if (parent?.scrs_score != null) {
      const d = session.scrs_score - parent.scrs_score;
      delta = d > 0 ? `+${d}` : String(d);
    }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer group',
        inset && 'pl-8',
      )}
      onClick={() => navigate(`/sessions/${session.id}`)}
    >
      {inset && <span className="text-muted-foreground/40 text-xs font-mono -ml-1 mr-0 flex-shrink-0">└</span>}

      {/* SCRS color left bar */}
      <span
        className="w-1 h-8 rounded-full flex-shrink-0"
        style={{ background: color ?? 'hsl(var(--border))' }}
      />

      {/* Main content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm truncate">{session.title || 'Untitled'}</span>
          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 flex-shrink-0 whitespace-nowrap', cfg.className)}>
            {session.status === 'running' && <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" />}
            {cfg.label}
          </Badge>
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
          {modeLabel && <span>{modeLabel}</span>}
          {agentCount > 0 && <><span>·</span><span>{agentCount} agent{agentCount !== 1 ? 's' : ''}</span></>}
          <span>·</span>
          <span>{relativeTime(session.created_date)}</span>
          {session.mitigation_playbook && (
            <>
              <span>·</span>
              <span>{session.mitigation_playbook.split('\n').filter(l => /^\s*[-•*]|\d+\./.test(l)).length || 1} mitigations</span>
            </>
          )}
        </div>
      </div>

      {/* SCRS score + delta */}
      {session.scrs_score != null && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">SCRS</div>
            <div className="text-base font-bold tabular-nums" style={{ color }}>{session.scrs_score}</div>
          </div>
          {delta && (
            <span className={cn('text-[11px] font-medium tabular-nums', delta.startsWith('+') ? 'text-red-600' : 'text-emerald-600')}>
              {delta}
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Link
          to={`/sessions/${session.id}`}
          onClick={e => e.stopPropagation()}
          className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onDeleteClick(session); }}
          className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/5"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function RunningCard({ session }) {
  const agentCount = session.selected_agents?.length;
  const modeLabel = session.mode ? session.mode.charAt(0).toUpperCase() + session.mode.slice(1) : 'Standard';
  return (
    <Link to={`/sessions/${session.id}`} className="block rounded-lg bg-card border border-amber-200 p-4 hover:border-amber-300 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-semibold text-sm">{session.title || 'Untitled'}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {modeLabel}{agentCount > 0 && ` · ${agentCount} agents`} · started {relativeTime(session.created_date)}
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          In progress
        </div>
      </div>
      {/* Indeterminate progress bar */}
      <div className="h-1 rounded-full bg-muted overflow-hidden">
        <div className="h-full w-1/3 rounded-full bg-amber-400 animate-pulse" style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
    </Link>
  );
}

function buildLineageGroups(sessions, sessionMap) {
  const childrenOf = {};
  const roots = [];
  const ids = new Set(sessions.map(s => s.id));

  for (const s of sessions) {
    if (s.parent_session_id && ids.has(s.parent_session_id)) {
      if (!childrenOf[s.parent_session_id]) childrenOf[s.parent_session_id] = [];
      childrenOf[s.parent_session_id].push(s);
    } else {
      roots.push(s);
    }
  }
  return { roots, childrenOf };
}

export default function SessionsList({
  sessions, onDelete, deletingId,
  statusFilter, setStatusFilter,
  searchQuery, setSearchQuery,
  groupByLineage, setGroupByLineage,
}) {
  const [deleteTarget, setDeleteTarget] = useState(null);

  const runningSessions = sessions.filter(s => s.status === 'running');

  const sessionMap = Object.fromEntries(sessions.map(s => [s.id, s]));

  // Filter non-running sessions
  const listSessions = sessions.filter(s => {
    if (s.status === 'running') return false;
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        s.title?.toLowerCase().includes(q) ||
        s.scenario?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const { roots, childrenOf } = buildLineageGroups(listSessions, sessionMap);

  const isEmpty = sessions.length === 0;

  return (
    <div>
      {/* Pinned: running sessions */}
      {runningSessions.length > 0 && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50/40 dark:bg-amber-950/10 p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <h2 className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                In progress · {runningSessions.length}
              </h2>
            </div>
            <span className="text-[11px] text-amber-700/60 font-mono">live · refetching every 5s</span>
          </div>
          <div className="space-y-2">
            {runningSessions.map(s => <RunningCard key={s.id} session={s} />)}
          </div>
        </div>
      )}

      {/* Filter row */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">Sessions</h2>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search title or scenario…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="h-8 pl-8 pr-3 text-xs"
          />
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-1 ml-1">
          {STATUS_FILTERS.map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setStatusFilter(f)}
              className={cn(
                'px-2.5 py-1 text-[11px] rounded-full transition-colors',
                statusFilter === f
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {STATUS_LABEL[f]}
            </button>
          ))}
        </div>

        <span className="text-[11px] text-muted-foreground mx-1">·</span>

        {/* Group by toggle */}
        <button
          type="button"
          onClick={() => setGroupByLineage(v => !v)}
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          Group: <span className="text-foreground font-medium">{groupByLineage ? 'Lineage ▾' : 'None ▾'}</span>
        </button>
      </div>

      {/* Session list */}
      {isEmpty ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">No sessions yet. Create your first risk analysis session.</p>
          <Link to="/sessions/new">
            <Button className="mt-4 gap-2">
              New Session <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      ) : listSessions.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground text-sm">No sessions match your filter.</p>
          <button
            type="button"
            className="text-xs text-primary hover:underline mt-2"
            onClick={() => { setStatusFilter('all'); setSearchQuery(''); }}
          >
            Clear filters
          </button>
        </div>
      ) : groupByLineage ? (
        // Lineage-grouped view
        <div className="space-y-2">
          {roots.map(root => {
            const children = childrenOf[root.id] || [];
            const hasChildren = children.length > 0;
            return (
              <div key={root.id} className="rounded-xl border border-border bg-card overflow-hidden">
                <SessionRow
                  session={root}
                  onDeleteClick={setDeleteTarget}
                  sessionMap={sessionMap}
                />
                {hasChildren && (
                  <div className="border-t border-border/60 relative">
                    <span className="absolute left-5 top-0 bottom-0 w-px bg-border/60" />
                    {children.map(child => (
                      <div key={child.id} className="border-t border-border/40 first:border-t-0">
                        <SessionRow
                          session={child}
                          onDeleteClick={setDeleteTarget}
                          sessionMap={sessionMap}
                          inset
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        // Flat view
        <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
          {listSessions.map(session => (
            <SessionRow
              key={session.id}
              session={session}
              onDeleteClick={setDeleteTarget}
              sessionMap={sessionMap}
            />
          ))}
        </div>
      )}

      {/* Delete confirm dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{' '}
              <span className="font-medium text-foreground">"{deleteTarget?.title}"</span>{' '}
              and all its artifacts. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { onDelete(deleteTarget.id); setDeleteTarget(null); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
