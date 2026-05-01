import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import { Loader2, Swords } from 'lucide-react';
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

export default function DebateRound({ round, index }) {
  if (!round) return null;

  const isRunning = round.status === 'running';
  const redThinking = isRunning && !round.red_response;
  const blueThinking = isRunning && !!round.red_response && !round.blue_response;

  const rows = [
    {
      team: 'red',
      label: 'Red Team',
      agentName: round.red_agent_name,
      response: round.red_response,
      isThinking: redThinking,
      waitingLabel: 'Awaiting red team analysis...',
    },
    {
      team: 'blue',
      label: 'Blue Team',
      agentName: round.blue_agent_name,
      response: round.blue_response,
      isThinking: blueThinking,
      waitingLabel: 'Waiting for red team to finish...',
    },
  ];

  return (
    <Card className="overflow-hidden">
      {/* Round header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-muted/40">
        <Swords className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Round {index + 1}
        </span>
        {isRunning && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-1" />}
        {round.timestamp && (
          <span className="ml-auto text-xs text-muted-foreground">
            {new Date(round.timestamp).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Debate table */}
      <table className="w-full border-collapse">
        <colgroup>
          <col style={{ width: '148px' }} />
          <col />
        </colgroup>
        <tbody>
          {rows.map(({ team, label, agentName, response, isThinking, waitingLabel }) => {
            const isRed = team === 'red';
            return (
              <tr key={team} className={cn("border-b border-border last:border-b-0", isRed ? "bg-red-team/[0.02]" : "bg-blue-team/[0.02]")}>
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
                    <span className="text-xs font-semibold text-foreground leading-snug">
                      {agentName || (isRed ? 'Red Agent' : 'Blue Agent')}
                    </span>
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
