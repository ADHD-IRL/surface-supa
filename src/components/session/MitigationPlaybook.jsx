import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import { CheckCircle2, Clock, AlertTriangle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const priorityConfig = {
  immediate: { label: 'Immediate', className: 'bg-red-team/10 text-red-team border-red-team/20', icon: AlertTriangle },
  'short-term': { label: 'Short-term', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: Clock },
  'long-term': { label: 'Long-term', className: 'bg-blue-team/10 text-blue-team border-blue-team/20', icon: CheckCircle2 },
};

function getPriorityConfig(priority = '') {
  const key = priority.toLowerCase();
  return priorityConfig[key] || priorityConfig['short-term'];
}

export default function MitigationPlaybook({ playbook }) {
  if (!playbook) return null;

  return (
    <div className="space-y-6">
      {/* Overview */}
      {playbook.overview && (
        <Card className="p-6 border-l-4 border-l-green-team">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Playbook Overview</h3>
          <div className="prose prose-sm max-w-none text-foreground">
            <ReactMarkdown>{playbook.overview}</ReactMarkdown>
          </div>
        </Card>
      )}

      {/* Actions */}
      {playbook.actions?.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Action Items</h3>
          {playbook.actions.map((action, i) => {
            const config = getPriorityConfig(action.priority);
            const Icon = config.icon;
            return (
              <Card key={i} className="p-5">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h4 className="font-semibold text-sm">{action.title}</h4>
                      <Badge variant="outline" className={cn("text-xs px-1.5 py-0 capitalize flex items-center gap-1", config.className)}>
                        <Icon className="w-3 h-3" />
                        {config.label}
                      </Badge>
                      {action.timeline && (
                        <span className="text-xs text-muted-foreground">{action.timeline}</span>
                      )}
                    </div>
                    {action.description && (
                      <p className="text-sm text-muted-foreground mb-3">{action.description}</p>
                    )}
                    {action.steps?.length > 0 && (
                      <ol className="space-y-1.5">
                        {action.steps.map((step, si) => (
                          <li key={si} className="flex items-start gap-2 text-sm">
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                    {action.owner && (
                      <p className="text-xs text-muted-foreground mt-3 font-medium">Owner: {action.owner}</p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}