import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, MinusCircle, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolveAgent } from '@/lib/agentData';

function AgentRow({ agent: rawAgent, roundsDone, roundsTotal, note, noteColor }) {
  const agent = resolveAgent(rawAgent);
  const isRed = agent.team === 'red';
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className={cn('w-2 h-2 rounded-full flex-shrink-0', isRed ? 'bg-red-team' : 'bg-blue-team')} />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium truncate">{agent.name}</span>
        {agent.discipline && (
          <span className="text-xs text-muted-foreground ml-2 truncate">{agent.discipline}</span>
        )}
      </div>
      <Badge
        variant="outline"
        className={cn('text-[10px] px-1.5 py-0 flex-shrink-0',
          isRed ? 'border-red-team/30 text-red-team' : 'border-blue-team/30 text-blue-team'
        )}
      >
        {isRed ? 'Red' : 'Blue'}
      </Badge>
      {roundsDone !== undefined && (
        <span className="text-xs font-mono text-muted-foreground flex-shrink-0 w-8 text-right">
          {roundsDone}/{roundsTotal}
        </span>
      )}
      {note && (
        <span className={cn('text-xs italic flex-shrink-0', noteColor || 'text-muted-foreground')}>
          {note}
        </span>
      )}
    </div>
  );
}

function normalizeRound(round) {
  if (!round) return round;
  if ('red_responses' in round) return round;
  return {
    ...round,
    red_responses: round.red_response
      ? [{ agent_id: round.red_agent_id, agent_name: round.red_agent_name || 'Red Agent', response: round.red_response }]
      : [],
    blue_responses: round.blue_response
      ? [{ agent_id: round.blue_agent_id, agent_name: round.blue_agent_name || 'Blue Agent', response: round.blue_response }]
      : [],
  };
}

export default function DebateRoster({ session, agents, sessionAgents }) {
  const isV2           = session.debate_format === 'v2';
  const roundCount     = isV2 ? 2 : (session.mode === 'rapid' ? 1 : session.mode === 'deep' ? 3 : 2);
  const completedRounds = session.rounds?.filter(r => r.status === 'completed').length ?? 0;
  const isRunning      = session.status === 'running';
  const isCompleted    = session.status === 'completed';

  // Collect all agent IDs that actually responded across all rounds (V1)
  const activeRedIds = new Set(
    session.rounds?.flatMap(r => normalizeRound(r)?.red_responses?.map(x => x.agent_id) ?? []) ?? []
  );
  const activeBlueIds = new Set(
    session.rounds?.flatMap(r => normalizeRound(r)?.blue_responses?.map(x => x.agent_id) ?? []) ?? []
  );

  // Eligible agents for this session
  const eligible     = session.selected_agents?.length
    ? agents.filter(a => session.selected_agents.includes(a.id))
    : agents;
  const eligibleRed  = eligible.filter(a => a.team === 'red');
  const eligibleBlue = eligible.filter(a => a.team === 'blue');

  const noRed  = eligibleRed.length  === 0;
  const noBlue = eligibleBlue.length === 0;

  // Pre-start: no rounds have run yet (V1)
  const hasStarted = activeRedIds.size > 0 || activeBlueIds.size > 0;

  // Excluded: agents that exist but were not in this session's selection
  const excluded = session.selected_agents?.length
    ? agents.filter(a => !session.selected_agents.includes(a.id))
    : [];

  // V2 status pills
  function V2StatusPills({ agentId }) {
    const sa = sessionAgents?.find(s => s.agent_id === agentId);
    if (!sa) return null;
    const r1Done = sa.status === 'r1_done' || sa.status === 'generating_r2' || sa.status === 'complete';
    const r2Done = sa.status === 'complete';
    const r1Active = sa.status === 'generating_r1';
    const r2Active = sa.status === 'generating_r2';
    return (
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium',
          r1Done   ? 'bg-green-team/10 text-green-team' :
          r1Active ? 'bg-amber-500/10 text-amber-600' :
                     'bg-muted text-muted-foreground/50'
        )}>
          R1{r1Done ? ' ✓' : r1Active ? ' …' : ''}
        </span>
        <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium',
          r2Done   ? 'bg-green-team/10 text-green-team' :
          r2Active ? 'bg-amber-500/10 text-amber-600' :
                     'bg-muted text-muted-foreground/50'
        )}>
          R2{r2Done ? ' ✓' : r2Active ? ' …' : ''}
        </span>
      </div>
    );
  }

  return (
    <Card className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Agent Roster</h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="capitalize">{session.mode || 'standard'} mode</span>
          {isV2 && <><span>·</span><span className="text-primary font-medium">V2</span></>}
          <span>·</span>
          <span>{roundCount} round{roundCount !== 1 ? 's' : ''}</span>
          {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-green-team ml-1" />}
          {isRunning   && <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse ml-1" />}
        </div>
      </div>

      <div className="space-y-0">

        {/* ── Participating / Assigned ── */}
        <div className="mb-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            {hasStarted || (isV2 && sessionAgents?.length) ? 'Participating' : 'Assigned'}
          </p>
          {[...eligibleRed, ...eligibleBlue].map(a => (
            <div key={a.id} className="flex items-center">
              <div className="flex-1 min-w-0">
                <AgentRow
                  agent={a}
                  roundsDone={!isV2 && hasStarted ? completedRounds : undefined}
                  roundsTotal={!isV2 && hasStarted ? roundCount : undefined}
                />
              </div>
              {isV2 && <V2StatusPills agentId={a.id} />}
            </div>
          ))}
          {noRed && (
            <div className="flex items-center gap-2 py-1.5">
              <MinusCircle className="w-3.5 h-3.5 text-red-team flex-shrink-0" />
              <span className="text-sm italic text-red-team">No red team agent available — debate cannot run</span>
            </div>
          )}
          {noBlue && (
            <div className="flex items-center gap-2 py-1.5">
              <MinusCircle className="w-3.5 h-3.5 text-blue-team flex-shrink-0" />
              <span className="text-sm italic text-blue-team">No blue team agent available — debate cannot run</span>
            </div>
          )}
        </div>

        {/* ── Excluded ── */}
        {excluded.length > 0 && (
          <div className="border-t border-border pt-2 mt-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Not in session
            </p>
            <p className="text-[11px] text-muted-foreground mb-1.5">
              These agents were not selected when this session was created.
            </p>
            {excluded.map(a => (
              <AgentRow key={a.id} agent={a} note="not selected" />
            ))}
          </div>
        )}

      </div>
    </Card>
  );
}
