import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DebateRound({ round, index }) {
  if (!round) return null;

  const isRunning = round.status === 'running';

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Round {index + 1}
      </h3>

      {/* Red Team */}
      <Card className="p-5 border-l-4 border-l-red-team bg-card">
        <div className="flex items-center gap-2 mb-3">
          <Badge className="bg-red-team/10 text-red-team border-red-team/20 text-xs">
            Red Team
          </Badge>
          <span className="text-sm font-semibold">{round.red_agent_name || 'Red Agent'}</span>
          {isRunning && !round.red_response && (
            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
          )}
        </div>
        {round.red_response ? (
          <div className="prose prose-sm max-w-none text-foreground">
            <ReactMarkdown>{round.red_response}</ReactMarkdown>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-red-team animate-pulse-glow" />
              <div className="w-1.5 h-1.5 rounded-full bg-red-team animate-pulse-glow" style={{ animationDelay: '0.3s' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-red-team animate-pulse-glow" style={{ animationDelay: '0.6s' }} />
            </div>
            Analyzing attack vectors...
          </div>
        )}
      </Card>

      {/* Blue Team */}
      <Card className="p-5 border-l-4 border-l-blue-team bg-card">
        <div className="flex items-center gap-2 mb-3">
          <Badge className="bg-blue-team/10 text-blue-team border-blue-team/20 text-xs">
            Blue Team
          </Badge>
          <span className="text-sm font-semibold">{round.blue_agent_name || 'Blue Agent'}</span>
          {isRunning && round.red_response && !round.blue_response && (
            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
          )}
        </div>
        {round.blue_response ? (
          <div className="prose prose-sm max-w-none text-foreground">
            <ReactMarkdown>{round.blue_response}</ReactMarkdown>
          </div>
        ) : round.red_response ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-team animate-pulse-glow" />
              <div className="w-1.5 h-1.5 rounded-full bg-blue-team animate-pulse-glow" style={{ animationDelay: '0.3s' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-blue-team animate-pulse-glow" style={{ animationDelay: '0.6s' }} />
            </div>
            Formulating defensive response...
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">Waiting for red team analysis...</p>
        )}
      </Card>
    </div>
  );
}