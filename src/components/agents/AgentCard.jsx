import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AgentCard({ agent, onEdit, onDelete }) {
  return (
    <Card className="p-5 bg-card border border-border hover:border-primary/20 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0"
            style={{ backgroundColor: agent.avatar_color || (agent.team === 'red' ? '#DC2626' : '#2563EB') }}
          >
            {agent.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">{agent.name}</h3>
              {agent.is_default && (
                <span className="text-xs text-muted-foreground italic">default</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
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
              {agent.domain_tags?.map(tag => (
                <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0 capitalize">
                  {tag}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2 capitalize">{agent.tone} tone</p>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(agent)}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          {!agent.is_default && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(agent)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}