import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import { Loader2, Swords } from 'lucide-react';
import { cn } from '@/lib/utils';

function ThinkingDots({ color }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
      <div className="flex gap-1">
        <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse-glow", color)} />
        <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse-glow", color)} style={{ animationDelay: '0.3s' }} />
        <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse-glow", color)} style={{ animationDelay: '0.6s' }} />
      </div>
    </div>
  );
}

function AgentPanel({ team, agentName, response, isThinking, waitingLabel }) {
  const isRed = team === 'red';

  return (
    <div className={cn(
      "flex flex-col min-h-0 rounded-xl border-t-4 bg-card overflow-hidden",
      isRed ? "border-t-red-team" : "border-t-blue-team"
    )}>
      {/* Panel header */}
      <div className={cn(
        "flex items-center gap-2.5 px-5 py-3.5 border-b border-border",
        isRed ? "bg-red-team/5" : "bg-blue-team/5"
      )}>
        <div className={cn(
          "w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold",
          isRed ? "bg-red-team" : "bg-blue-team"
        )}>
          {agentName?.charAt(0) ?? (isRed ? 'R' : 'B')}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "text-xs px-1.5 py-0",
                isRed
                  ? "border-red-team/30 text-red-team bg-red-team/5"
                  : "border-blue-team/30 text-blue-team bg-blue-team/5"
              )}
            >
              {isRed ? 'Red Team' : 'Blue Team'}
            </Badge>
            <span className="text-sm font-semibold truncate">{agentName || (isRed ? 'Red Agent' : 'Blue Agent')}</span>
          </div>
        </div>
        {isThinking && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground flex-shrink-0" />}
      </div>

      {/* Panel body */}
      <div className="flex-1 p-5 overflow-y-auto">
        {response ? (
          <div className="prose prose-sm max-w-none text-foreground">
            <ReactMarkdown>{response}</ReactMarkdown>
          </div>
        ) : isThinking ? (
          <ThinkingDots color={isRed ? "bg-red-team" : "bg-blue-team"} />
        ) : (
          <p className="text-sm text-muted-foreground italic py-4">{waitingLabel}</p>
        )}
      </div>
    </div>
  );
}

export default function DebateRound({ round, index }) {
  if (!round) return null;

  const isRunning = round.status === 'running';
  const redThinking = isRunning && !round.red_response;
  const blueThinking = isRunning && !!round.red_response && !round.blue_response;

  return (
    <div className="space-y-3">
      {/* Round label */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Swords className="w-3.5 h-3.5 text-muted-foreground" />
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Round {index + 1}
          </h3>
        </div>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Split-screen panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 rounded-xl overflow-hidden border border-border shadow-sm">
        {/* Divider line on desktop */}
        <AgentPanel
          team="red"
          agentName={round.red_agent_name}
          response={round.red_response}
          isThinking={redThinking}
          waitingLabel="Awaiting red team analysis..."
        />

        <div className="hidden lg:block w-px bg-border self-stretch" />

        <AgentPanel
          team="blue"
          agentName={round.blue_agent_name}
          response={round.blue_response}
          isThinking={blueThinking}
          waitingLabel="Waiting for red team to finish..."
        />
      </div>
    </div>
  );
}