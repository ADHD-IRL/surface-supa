import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const sevConfig = {
  CRITICAL: 'bg-red-600 text-white',
  HIGH:     'bg-orange-500 text-white',
  MEDIUM:   'bg-amber-400 text-black',
  LOW:      'bg-green-500 text-white',
};

function VectorBar({ label, value }) {
  const pct = Math.min(Math.max(value ?? 0, 0), 100);
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-muted-foreground w-12 shrink-0">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground w-6 text-right">{pct}</span>
    </div>
  );
}

export default function AgentCard({ agent, onEdit, onDelete }) {
  const hasVectors = agent.vector_human != null || agent.vector_technical != null;
  const firstSentence = (agent.persona_description || '').split(/[.!?]/)[0].trim();

  return (
    <Card className="p-5 bg-card border border-border hover:border-primary/20 transition-colors">
      <div className="flex items-start justify-between gap-2">
        {/* Avatar + identity */}
        <div className="flex items-start gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0 text-sm"
            style={{ backgroundColor: agent.avatar_color || (agent.team === 'red' ? '#DC2626' : '#2563EB') }}
          >
            {agent.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm truncate">{agent.name}</h3>
              {agent.is_default && <span className="text-xs text-muted-foreground italic">default</span>}
            </div>
            {agent.discipline && (
              <p className="text-xs text-muted-foreground truncate">{agent.discipline}</p>
            )}
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <Badge variant="outline" className={cn("text-xs px-1.5 py-0",
                agent.team === 'red'
                  ? "border-red-team/30 text-red-team bg-red-team/5"
                  : "border-blue-team/30 text-blue-team bg-blue-team/5")}>
                {agent.team}
              </Badge>
              {agent.severity_default && (
                <Badge className={cn("text-xs px-1.5 py-0", sevConfig[agent.severity_default] || sevConfig.HIGH)}>
                  {agent.severity_default}
                </Badge>
              )}
              {agent.expertise_level && (
                <Badge variant="outline" className="text-xs px-1.5 py-0 text-muted-foreground">
                  {agent.expertise_level}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-1 flex-shrink-0">
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

      {/* Persona snippet */}
      {firstSentence && (
        <p className="text-xs text-muted-foreground mt-3 leading-relaxed line-clamp-2">
          {firstSentence}.
        </p>
      )}

      {/* Domain tags */}
      {agent.domain_tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {agent.domain_tags.map(tag => (
            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{tag}</Badge>
          ))}
        </div>
      )}

      {/* Threat vectors */}
      {hasVectors && (
        <div className="mt-3 space-y-1 border-t border-border pt-3">
          <VectorBar label="Human"     value={agent.vector_human} />
          <VectorBar label="Technical" value={agent.vector_technical} />
          <VectorBar label="Physical"  value={agent.vector_physical} />
          <VectorBar label="Futures"   value={agent.vector_futures} />
        </div>
      )}
    </Card>
  );
}
