import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, MinusCircle, Users, Circle } from 'lucide-react';
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

export default function DebateRoster({ session, agents }) {
  const roundCount  = session.mode === 'rapid' ? 1 : session.mode === 'deep' ? 3 : 2;
  const completedRounds = session.rounds?.filter(r => r.status === 'completed').length ?? 0;
  const isRunning   = session.status === 'running';
  const isCompleted = session.status === 'completed';

  // Agents that actually debated (from round data)
  const activeRedId  = session.rounds?.[0]?.red_agent_id;
  const activeBlueId = session.rounds?.[0]?.blue_agent_id;
  const activeRed    = agents.find(a => a.id === activeRedId);
  const activeBlue   = agents.find(a => a.id === activeBlueId);

  // Eligible agents for this session
  const eligible     = session.selected_agents?.length
    ? agents.filter(a => session.selected_agents.includes(a.id))
    : agents;
  const eligibleRed  = eligible.filter(a => a.team === 'red');
  const eligibleBlue = eligible.filter(a => a.team === 'blue');

  // Benched: eligible but not the one picked (only first per team debates)
  const benchedRed   = eligibleRed.filter(a => a.id !== activeRedId);
  const benchedBlue  = eligibleBlue.filter(a => a.id !== activeBlueId);
  const benched      = [...benchedRed, ...benchedBlue];

  // Excluded: agents that exist but were not in this session's selection
  const excluded = session.selected_agents?.length
    ? agents.filter(a => !session.selected_agents.includes(a.id))
    : [];

  const noRed  = eligibleRed.length  === 0;
  const noBlue = eligibleBlue.length === 0;

  // Pre-start: show expected participants from selected agents
  const isPreStart   = !activeRed && !activeBlue;
  const preStartRed  = isPreStart ? eligibleRed[0]  : null;
  const preStartBlue = isPreStart ? eligibleBlue[0] : null;

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
          <span>·</span>
          <span>{roundCount} round{roundCount !== 1 ? 's' : ''}</span>
          {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-green-team ml-1" />}
          {isRunning   && <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse ml-1" />}
        </div>
      </div>

      <div className="space-y-0">

        {/* ── Participating ── */}
        {(activeRed || activeBlue || preStartRed || preStartBlue) && (
          <div className="mb-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              {isPreStart ? 'Assigned' : 'Participating'}
            </p>
            {(activeRed || preStartRed) && (
              <AgentRow
                agent={activeRed || preStartRed}
                roundsDone={completedRounds}
                roundsTotal={roundCount}
              />
            )}
            {(activeBlue || preStartBlue) && (
              <AgentRow
                agent={activeBlue || preStartBlue}
                roundsDone={completedRounds}
                roundsTotal={roundCount}
              />
            )}
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
        )}

        {/* ── Benched ── */}
        {benched.length > 0 && (
          <div className="border-t border-border pt-2 mt-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Benched
            </p>
            <p className="text-[11px] text-muted-foreground mb-1.5">
              Selected for this session but only the first agent per team enters the debate.
            </p>
            {benched.map(a => (
              <AgentRow key={a.id} agent={a} note="did not debate" />
            ))}
          </div>
        )}

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
