import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ArrowRight, Clock, AlertTriangle, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const statusConfig = {
  draft:     { label: 'Draft',     icon: Clock,         className: 'bg-muted text-muted-foreground' },
  running:   { label: 'Running',   icon: Loader2,       className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  completed: { label: 'Completed', icon: CheckCircle2,  className: 'bg-green-team/10 text-green-team border-green-team/20' },
  failed:    { label: 'Failed',    icon: AlertTriangle, className: 'bg-red-team/10 text-red-team border-red-team/20' },
};

export default function SessionsList({ sessions, onDelete, deletingId }) {
  if (!sessions?.length) {
    return (
      <Card className="p-12 text-center bg-card border border-border">
        <p className="text-muted-foreground">No sessions yet. Create your first risk analysis session.</p>
        <Link to="/sessions/new">
          <Button className="mt-4 gap-2">
            Create Session <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent Sessions</h2>
        <Link to="/sessions/new">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs">
            New Session <ArrowRight className="w-3 h-3" />
          </Button>
        </Link>
      </div>
      <div className="space-y-2">
        {sessions.map((session) => {
          const config = statusConfig[session.status] || statusConfig.draft;
          const Icon = config.icon;
          const isDeleting = deletingId === session.id;
          return (
            <Card
              key={session.id}
              className="p-4 bg-card border border-border hover:border-primary/30 transition-colors group"
            >
              <div className="flex items-center justify-between gap-3">
                <Link to={`/sessions/${session.id}`} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-semibold text-sm truncate">{session.title}</h3>
                    <Badge variant="outline" className={cn("text-xs px-1.5 py-0 flex-shrink-0", config.className)}>
                      <Icon className={cn("w-3 h-3 mr-1", session.status === 'running' && "animate-spin")} />
                      {config.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(session.created_date), 'MMM d, yyyy')}
                    </span>
                    {session.domain_focus?.length > 0 && (
                      <div className="flex gap-1">
                        {session.domain_focus.slice(0, 3).map((d) => (
                          <span key={d} className="text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground">{d}</span>
                        ))}
                      </div>
                    )}
                    {session.risk_registry?.length > 0 && (
                      <span className="text-xs text-red-team font-medium">{session.risk_registry.length} risks</span>
                    )}
                  </div>
                </Link>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <Link to={`/sessions/${session.id}`}>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </Link>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-7 h-7 text-muted-foreground hover:text-red-team hover:bg-red-team/5 opacity-0 group-hover:opacity-100 transition-opacity"
                        disabled={isDeleting}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isDeleting
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete session?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete <span className="font-medium text-foreground">"{session.title}"</span> and
                          all its artifacts — debate rounds, risk registry, attack chains, and any generated playbook.
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onDelete(session.id)}
                          className="bg-red-team text-white hover:bg-red-team/90"
                        >
                          Delete session
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
