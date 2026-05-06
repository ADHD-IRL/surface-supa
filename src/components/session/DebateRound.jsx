import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import { Loader2, Swords, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

function ThinkingDots({ color }) {
  return (
    <div className="flex items-center gap-2 py-3">
      <div className="flex gap-1">
        <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse-glow", color)} />
        <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse-glow", color)} style={{ animationDelay: '0.3s' }} />
        <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse-glow", color)} style={{ animationDelay: '0.6s' }} />
      </div>
      <span className="text-xs text-muted-foreground">Analyzing...</span>
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

export default function DebateRound({ round, index, total }) {
  if (!round) return null;

  const nr = normalizeRound(round);
  const { red_responses, blue_responses } = nr;

  const isRunning    = round.status === 'running';
  const isCompleted  = round.status === 'completed';
  const anyRedDone   = red_responses.length > 0;
  const redThinking  = isRunning && !anyRedDone;
  const blueThinking = isRunning && anyRedDone && blue_responses.length === 0;

  const rows = [
    ...red_responses.map(r => ({
      team: 'red', label: 'Red Team', agentName: r.agent_name, response: r.response,
      isThinking: false, waitingLabel: '',
    })),
    ...(redThinking ? [{ team: 'red', label: 'Red Team', agentName: '', response: null, isThinking: true, waitingLabel: 'Analyzing...' }] : []),
    ...blue_responses.map(b => ({
      team: 'blue', label: 'Blue Team', agentName: b.agent_name, response: b.response,
      isThinking: false, waitingLabel: '',
    })),
    ...(blueThinking ? [{ team: 'blue', label: 'Blue Team', agentName: '', response: null, isThinking: true, waitingLabel: 'Responding...' }] : []),
    ...(red_responses.length === 0 && blue_responses.length === 0 && !isRunning ? [
      { team: 'red',  label: 'Red Team',  agentName: '', response: null, isThinking: false, waitingLabel: 'Awaiting red team analysis...' },
      { team: 'blue', label: 'Blue Team', agentName: '', response: null, isThinking: false, waitingLabel: 'Waiting for red team to finish...' },
    ] : []),
  ];

  const redNames  = red_responses.map(r => r.agent_name).filter(Boolean);
  const blueNames = blue_responses.map(b => b.agent_name).filter(Boolean);
  const redLabel  = redNames.length  ? redNames.join(', ')  : round.red_agent_name  || 'Red Agent';
  const blueLabel = blueNames.length ? blueNames.join(', ') : round.blue_agent_name || 'Blue Agent';

  return (
    <Card className="overflow-hidden">
      {/* Round header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-muted/40">
        <Swords className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Round {index + 1}{total > 1 ? ` of ${total}` : ''}
        </span>

        {/* Agent pills */}
        <div className="flex items-center gap-1.5 ml-1 flex-wrap">
          <span className="text-[11px] text-red-team font-medium">{redLabel}</span>
          <span className="text-[10px] text-muted-foreground">vs</span>
          <span className="text-[11px] text-blue-team font-medium">{blueLabel}</span>
        </div>

        {/* Status */}
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          {isRunning && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600">
              {anyRedDone
                ? <><CheckCircle2 className="w-3 h-3 text-red-team" /><span className="text-red-team">Red</span><span className="text-muted-foreground">→</span><Loader2 className="w-3 h-3 animate-spin text-blue-team" /><span className="text-blue-team">Blue responding…</span></>
                : <><Loader2 className="w-3 h-3 animate-spin text-red-team" /><span className="text-red-team">Red analyzing…</span></>
              }
            </div>
          )}
          {isCompleted && (
            <CheckCircle2 className="w-3.5 h-3.5 text-green-team" />
          )}
          {round.timestamp && (
            <span className="text-xs text-muted-foreground">
              {new Date(round.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Debate table */}
      <table className="w-full border-collapse">
        <colgroup>
          <col style={{ width: '148px' }} />
          <col />
        </colgroup>
        <tbody>
          {rows.map(({ team, label, agentName, response, isThinking, waitingLabel }, rowIdx) => {
            const isRed = team === 'red';
            return (
              <tr key={`${team}-${rowIdx}`} className={cn("border-b border-border last:border-b-0", isRed ? "bg-red-team/[0.02]" : "bg-blue-team/[0.02]")}>
                <td className={cn(
                  "align-top px-4 py-4 border-r",
                  isRed ? "border-r-red-team/20" : "border-r-blue-team/20"
                )}>
                  <div className="flex flex-col gap-1.5 sticky top-4">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs px-1.5 py-0 w-fit",
                        isRed
                          ? "border-red-team/30 text-red-team bg-red-team/5"
                          : "border-blue-team/30 text-blue-team bg-blue-team/5"
                      )}
                    >
                      {label}
                    </Badge>
                    {agentName && (
                      <span className="text-xs font-semibold text-foreground leading-snug">
                        {agentName}
                      </span>
                    )}
                  </div>
                </td>
                <td className="align-top px-5 py-4">
                  {response ? (
                    <div className="prose prose-sm max-w-none text-foreground break-words">
                      <ReactMarkdown>{response}</ReactMarkdown>
                    </div>
                  ) : isThinking ? (
                    <ThinkingDots color={isRed ? "bg-red-team" : "bg-blue-team"} />
                  ) : (
                    <p className="text-sm text-muted-foreground italic">{waitingLabel}</p>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
