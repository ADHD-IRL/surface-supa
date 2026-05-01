import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function AgentStatusGrid({ agents }) {
  if (!agents?.length) return null;

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Agent Status</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {agents.map((agent) => (
          <Card key={agent.id} className="p-4 bg-card border border-border flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ backgroundColor: agent.avatar_color || (agent.team === 'red' ? '#DC2626' : '#2563EB') }}
            >
              {agent.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate">{agent.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs px-1.5 py-0",
                    agent.team === 'red'
                      ? "border-red-team/30 text-red-team bg-red-team/5"
                      : "border-blue-team/30 text-blue-team bg-blue-team/5"
                  )}
                >
                  {agent.team}
                </Badge>
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  agent.status === 'active' ? "bg-green-500" : "bg-slate-400"
                )} />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}