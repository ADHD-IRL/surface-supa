import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, CheckSquare2, Square, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolveAgent } from '@/lib/agentData';

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

export default function AgentCard({ agent: rawAgent, onEdit, onDelete, selectable, selected, onSelect }) {
  const agent = resolveAgent(rawAgent);
  const hasVectors = agent.vector_human != null || agent.vector_technical != null;
  const firstSentence = (agent.persona_description || '').split(/[.!?]/)[0].trim();

  return (
    <Card
      onClick={selectable ? onSelect : undefined}
      className={cn(
        "p-5 bg-card border transition-colors",
        selectable
          ? "cursor-pointer select-none"
          : "hover:border-primary/20",
        selected
          ? "border-primary ring-1 ring-primary bg-primary/5"
          : "border-border"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Identity */}
        <div className="min-w-0 flex-1">
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

        {/* Actions or selection indicator */}
        <div className="flex gap-1 flex-shrink-0" onClick={e => selectable && e.stopPropagation()}>
          {selectable ? (
            selected
              ? <CheckSquare2 className="w-5 h-5 text-primary" />
              : <Square className="w-5 h-5 text-muted-foreground/40" />
          ) : (
            <>
              {onEdit && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(agent)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              )}
              {onDelete && !agent.is_default && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(agent)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Category */}
      {agent.category && (
        <div className="flex items-center gap-1 mt-2">
          <FolderOpen className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          <span className="text-[11px] text-muted-foreground truncate">{agent.category}</span>
        </div>
      )}

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
