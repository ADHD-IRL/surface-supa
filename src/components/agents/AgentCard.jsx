import React from 'react';
import { Edit2, Copy, Trash2, CheckSquare2, Square } from 'lucide-react';
import { resolveAgent } from '@/lib/agentData';

// Deterministic color from a tag string
const PALETTE = ['#F0A500','#2E86AB','#27AE60','#C0392B','#7B2D8B','#E67E22','#16A085','#8E44AD','#1A5276','#B7950B'];
export function tagColor(tag) {
  if (!tag) return '#546E7A';
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

const SEV = {
  CRITICAL: { bg: '#C0392B', text: '#fff' },
  HIGH:     { bg: '#D68910', text: '#0D1B2A' },
  MEDIUM:   { bg: '#2E86AB', text: '#fff' },
  LOW:      { bg: '#27AE60', text: '#fff' },
};

const VECTORS = [
  { key: 'vector_human',     label: 'Human',     color: '#C0392B' },
  { key: 'vector_technical', label: 'Technical', color: '#2E86AB' },
  { key: 'vector_physical',  label: 'Physical',  color: '#27AE60' },
  { key: 'vector_futures',   label: 'Futures',   color: '#7B2D8B' },
];

export default function AgentCard({ agent: rawAgent, onEdit, onDelete, onClone, selectable, selected, onSelect }) {
  const agent = resolveAgent(rawAgent);
  const primaryTag = agent.domain_tags?.[0];
  const barColor = agent.avatar_color || tagColor(primaryTag);
  const sev = SEV[agent.severity_default] || SEV.HIGH;
  const hasVectors = [agent.vector_human, agent.vector_technical, agent.vector_physical, agent.vector_futures]
    .some(v => v != null);

  return (
    <div
      onClick={selectable ? onSelect : undefined}
      className="rounded overflow-hidden transition-all duration-150"
      style={{
        backgroundColor: 'hsl(var(--card))',
        border: `1px solid ${selected ? barColor : 'hsl(var(--border))'}`,
        boxShadow: selected ? `0 0 0 1px ${barColor}44` : 'none',
        cursor: selectable ? 'pointer' : 'default',
      }}
    >
      {/* Domain color bar */}
      <div className="h-1" style={{ backgroundColor: barColor }} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-semibold text-sm text-foreground truncate">{agent.name}</h3>
              {agent.is_default && (
                <span className="text-[10px] text-muted-foreground italic">default</span>
              )}
            </div>
            {agent.discipline && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{agent.discipline}</p>
            )}
          </div>

          {/* Badges + selection */}
          <div className="flex items-center gap-1.5 flex-shrink-0" onClick={selectable ? e => e.stopPropagation() : undefined}>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-bold tracking-wider font-mono"
              style={{
                backgroundColor: agent.team === 'red' ? 'rgba(220,38,38,0.12)' : 'rgba(37,99,235,0.12)',
                color: agent.team === 'red' ? '#DC2626' : '#2563EB',
                border: `1px solid ${agent.team === 'red' ? 'rgba(220,38,38,0.3)' : 'rgba(37,99,235,0.3)'}`,
              }}
            >
              {agent.team === 'red' ? 'RED' : 'BLUE'}
            </span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-bold tracking-wider font-mono"
              style={{ backgroundColor: sev.bg, color: sev.text }}
            >
              {agent.severity_default || 'HIGH'}
            </span>
            {selectable && (
              <button onClick={onSelect} className="ml-0.5">
                {selected
                  ? <CheckSquare2 className="w-4 h-4 text-primary" />
                  : <Square className="w-4 h-4 text-muted-foreground/40" />}
              </button>
            )}
          </div>
        </div>

        {/* Vector bars */}
        {hasVectors && (
          <div className="mt-3 space-y-1.5">
            {VECTORS.map(({ key, label, color }) => {
              const val = agent[key] ?? 0;
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-[10px] w-16 flex-shrink-0 text-muted-foreground font-mono">{label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${val}%`, backgroundColor: color }} />
                  </div>
                  <span className="text-[10px] w-7 text-right text-muted-foreground font-mono">{val}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Cognitive bias quote */}
        {agent.cognitive_bias && (
          <p className="text-xs text-muted-foreground mt-3 italic line-clamp-2">
            "{agent.cognitive_bias}"
          </p>
        )}

        {/* Domain tags */}
        {agent.domain_tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {agent.domain_tags.slice(0, 4).map(t => {
              const c = tagColor(t);
              return (
                <span
                  key={t}
                  className="text-[10px] px-1.5 py-0.5 rounded capitalize"
                  style={{ backgroundColor: `${c}18`, color: c, border: `1px solid ${c}33` }}
                >
                  {t}
                </span>
              );
            })}
          </div>
        )}

        {/* Action footer */}
        {!selectable && (
          <div className="flex gap-1 mt-3 pt-3 border-t border-border">
            {onEdit && (
              <button
                onClick={e => { e.stopPropagation(); onEdit(agent); }}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <Edit2 className="w-3 h-3" /> Edit
              </button>
            )}
            {onClone && (
              <button
                onClick={e => { e.stopPropagation(); onClone(agent); }}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <Copy className="w-3 h-3" /> Clone
              </button>
            )}
            {onDelete && !agent.is_default && (
              <button
                onClick={e => { e.stopPropagation(); onDelete(agent); }}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors text-muted-foreground hover:text-destructive hover:bg-destructive/5 ml-auto"
              >
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
