import React, { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Play, FileDown, Loader2, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import DebateRound from '@/components/session/DebateRound';
import RiskHeatmap from '@/components/session/RiskHeatmap';
import ChainDiagram from '@/components/session/ChainDiagram';
import MitigationTable from '@/components/session/MitigationTable';
import MitigationPlaybook from '@/components/session/MitigationPlaybook';
import ReactMarkdown from 'react-markdown';

export default function SessionDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [runningStep, setRunningStep] = useState('');
  const [generatingPlaybook, setGeneratingPlaybook] = useState(false);

  const { data: session, isLoading } = useQuery({
    queryKey: ['session', id],
    queryFn: async () => {
      const sessions = await base44.entities.Session.filter({ id });
      return sessions[0];
    },
    refetchInterval: (query) => {
      return query.state.data?.status === 'running' ? 3000 : false;
    },
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: () => base44.entities.Agent.list(),
  });

  const getAgent = useCallback((agentId) => agents.find(a => a.id === agentId), [agents]);

  const runDebateMutation = useMutation({
    mutationFn: async () => {
      setRunningStep('Starting debate...');
      await base44.entities.Session.update(id, { status: 'running' });

      const redAgents = agents.filter(a => a.team === 'red' && (session.selected_agents?.length === 0 || session.selected_agents?.includes(a.id)));
      const blueAgents = agents.filter(a => a.team === 'blue' && (session.selected_agents?.length === 0 || session.selected_agents?.includes(a.id)));

      const redAgent = redAgents[0];
      const blueAgent = blueAgents[0];

      if (!redAgent || !blueAgent) throw new Error('Need at least one red and one blue agent');

      const roundCount = session.mode === 'rapid' ? 1 : session.mode === 'deep' ? 3 : 2;
      const rounds = [];

      for (let r = 0; r < roundCount; r++) {
        setRunningStep(`Round ${r + 1}: Red team analyzing...`);

        const previousContext = rounds.map(rd =>
          `Round ${rd.round_number}:\nRed (${rd.red_agent_name}): ${rd.red_response}\nBlue (${rd.blue_agent_name}): ${rd.blue_response}`
        ).join('\n\n');

        const redPrompt = `${redAgent.system_prompt}\n\nScenario: ${session.scenario}\n${session.reference_urls?.length ? `\nReference URLs: ${session.reference_urls.join(', ')}` : ''}\n${previousContext ? `\nPrevious rounds:\n${previousContext}` : ''}\n\nProvide your Round ${r + 1} attack analysis. Identify specific threats, vulnerabilities, and attack chains. Be detailed and actionable.`;

        const redResponse = await base44.integrations.Core.InvokeLLM({ prompt: redPrompt });

        const roundData = {
          round_number: r + 1,
          red_agent_id: redAgent.id,
          red_agent_name: redAgent.name,
          red_response: redResponse,
          blue_agent_id: blueAgent.id,
          blue_agent_name: blueAgent.name,
          blue_response: '',
          status: 'running',
          timestamp: new Date().toISOString(),
        };

        rounds.push(roundData);
        await base44.entities.Session.update(id, { rounds: [...rounds] });
        queryClient.invalidateQueries({ queryKey: ['session', id] });

        setRunningStep(`Round ${r + 1}: Blue team responding...`);

        const bluePrompt = `${blueAgent.system_prompt}\n\nScenario: ${session.scenario}\n\nRed team attack analysis (Round ${r + 1}, by ${redAgent.name}):\n${redResponse}\n${previousContext ? `\nPrevious rounds:\n${previousContext}` : ''}\n\nProvide your defensive response. Counter each attack vector with specific mitigations, detection methods, and resilience measures. Be practical and implementable.`;

        const blueResponse = await base44.integrations.Core.InvokeLLM({ prompt: bluePrompt });

        rounds[r].blue_response = blueResponse;
        rounds[r].status = 'completed';
        await base44.entities.Session.update(id, { rounds: [...rounds] });
        queryClient.invalidateQueries({ queryKey: ['session', id] });
      }

      // Generate summary, risks, chains
      setRunningStep('Generating executive summary & risk registry...');

      const allTranscripts = rounds.map(rd =>
        `Round ${rd.round_number}:\nRed (${rd.red_agent_name}): ${rd.red_response}\nBlue (${rd.blue_agent_name}): ${rd.blue_response}`
      ).join('\n\n---\n\n');

      const analysisResult = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert risk analyst. Based on the following Red/Blue team adversarial debate about: "${session.scenario}"\n\nTranscripts:\n${allTranscripts}\n\nGenerate a comprehensive risk analysis output.`,
        response_json_schema: {
          type: 'object',
          properties: {
            executive_summary: { type: 'string', description: 'A concise 2-3 paragraph executive summary of key findings' },
            risk_registry: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  category: { type: 'string' },
                  likelihood: { type: 'number', description: '1-5 scale' },
                  impact: { type: 'number', description: '1-5 scale' },
                  description: { type: 'string' },
                  mitigation: { type: 'string' },
                  owner: { type: 'string' },
                  status: { type: 'string' }
                }
              }
            },
            attack_chains: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  steps: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        label: { type: 'string' },
                        description: { type: 'string' },
                        type: { type: 'string', description: 'One of: initial, exploit, lateral, impact, defense' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      await base44.entities.Session.update(id, {
        status: 'completed',
        executive_summary: analysisResult.executive_summary,
        risk_registry: analysisResult.risk_registry,
        attack_chains: analysisResult.attack_chains,
      });

      queryClient.invalidateQueries({ queryKey: ['session', id] });
      setRunningStep('');
    },
    onError: async () => {
      await base44.entities.Session.update(id, { status: 'failed' });
      queryClient.invalidateQueries({ queryKey: ['session', id] });
      setRunningStep('');
    },
  });

  const handleGeneratePlaybook = async () => {
    setGeneratingPlaybook(true);
    const allTranscripts = session.rounds.map(rd =>
      `Round ${rd.round_number}:\nRed (${rd.red_agent_name}): ${rd.red_response}\nBlue (${rd.blue_agent_name}): ${rd.blue_response}`
    ).join('\n\n---\n\n');

    const playbook = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a senior risk and security strategist. Based on the following Red/Blue adversarial debate about: "${session.scenario}"\n\nDebate transcripts:\n${allTranscripts}\n\nGenerate a concise, actionable mitigation playbook that a team can execute immediately.`,
      response_json_schema: {
        type: 'object',
        properties: {
          overview: { type: 'string', description: '2-3 sentence summary of the overall mitigation strategy' },
          actions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                priority: { type: 'string', description: 'One of: immediate, short-term, long-term' },
                title: { type: 'string' },
                description: { type: 'string' },
                owner: { type: 'string', description: 'Role or team responsible' },
                timeline: { type: 'string', description: 'e.g. Within 24h, Within 30 days' },
                steps: { type: 'array', items: { type: 'string' }, description: 'Concrete step-by-step actions' }
              }
            }
          }
        }
      }
    });

    await base44.entities.Session.update(id, { mitigation_playbook: playbook });
    queryClient.invalidateQueries({ queryKey: ['session', id] });
    setGeneratingPlaybook(false);
  };

  const handleExportPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('Surface — Risk Analysis Report', 20, 20);
    doc.setFontSize(12);
    doc.text(session.title, 20, 35);
    doc.setFontSize(10);

    let y = 50;
    if (session.executive_summary) {
      doc.text('Executive Summary:', 20, y);
      y += 8;
      const lines = doc.splitTextToSize(session.executive_summary, 170);
      lines.forEach(line => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(line, 20, y);
        y += 5;
      });
    }

    y += 10;
    if (session.risk_registry?.length) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.text('Risk Registry:', 20, y);
      y += 8;
      session.risk_registry.forEach((risk, i) => {
        if (y > 260) { doc.addPage(); y = 20; }
        doc.text(`${i + 1}. ${risk.title} (L:${risk.likelihood} I:${risk.impact})`, 20, y);
        y += 5;
        const mitLines = doc.splitTextToSize(`Mitigation: ${risk.mitigation}`, 160);
        mitLines.forEach(line => {
          if (y > 270) { doc.addPage(); y = 20; }
          doc.text(line, 25, y);
          y += 5;
        });
        y += 3;
      });
    }

    doc.save(`surface-report-${session.title.replace(/\s+/g, '-')}.pdf`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Session not found</p>
        <Link to="/"><Button variant="outline" className="mt-4">Back to Dashboard</Button></Link>
      </div>
    );
  }

  const statusConfig = {
    draft: { label: 'Draft', className: 'bg-muted text-muted-foreground' },
    running: { label: 'Running', className: 'bg-amber-500/10 text-amber-600' },
    completed: { label: 'Completed', className: 'bg-green-team/10 text-green-team' },
    failed: { label: 'Failed', className: 'bg-red-team/10 text-red-team' },
  };

  const config = statusConfig[session.status] || statusConfig.draft;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{session.title}</h1>
            <Badge variant="outline" className={cn("text-xs", config.className)}>
              {session.status === 'running' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              {config.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{session.scenario}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {session.status === 'draft' && (
            <Button onClick={() => runDebateMutation.mutate()} disabled={runDebateMutation.isPending} className="gap-2">
              <Play className="w-4 h-4" /> Run Analysis
            </Button>
          )}
          {session.status === 'completed' && !session.mitigation_playbook && (
            <Button
              variant="outline"
              onClick={handleGeneratePlaybook}
              disabled={generatingPlaybook}
              className="gap-2 border-green-team/40 text-green-team hover:bg-green-team/5"
            >
              {generatingPlaybook
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <BookOpen className="w-4 h-4" />}
              {generatingPlaybook ? 'Generating...' : 'Generate Playbook'}
            </Button>
          )}
          {session.status === 'completed' && (
            <Button variant="outline" onClick={handleExportPDF} className="gap-2">
              <FileDown className="w-4 h-4" /> Export PDF
            </Button>
          )}
        </div>
      </div>

      {/* Running status */}
      {runningStep && (
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm font-medium">{runningStep}</span>
          </div>
        </Card>
      )}

      {/* Content Tabs */}
      <Tabs defaultValue={session.status === 'completed' ? 'report' : 'debate'}>
        <TabsList>
          <TabsTrigger value="debate">Debate</TabsTrigger>
          {session.status === 'completed' && (
            <>
              <TabsTrigger value="report">Report</TabsTrigger>
              <TabsTrigger value="risks">Risks</TabsTrigger>
              <TabsTrigger value="chains">Chains</TabsTrigger>
              {session.mitigation_playbook && (
                <TabsTrigger value="playbook">Playbook</TabsTrigger>
              )}
            </>
          )}
        </TabsList>

        <TabsContent value="debate" className="space-y-6 mt-4">
          {session.rounds?.length > 0 ? (
            session.rounds.map((round, i) => (
              <DebateRound key={i} round={round} index={i} />
            ))
          ) : (
            <Card className="p-12 text-center bg-card">
              <p className="text-muted-foreground">
                {session.status === 'draft'
                  ? 'Click "Run Analysis" to start the adversarial debate'
                  : 'Debate rounds will appear here'}
              </p>
            </Card>
          )}
        </TabsContent>

        {session.status === 'completed' && (
          <>
            <TabsContent value="report" className="space-y-6 mt-4">
              {session.executive_summary && (
                <Card className="p-6">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Executive Summary</h3>
                  <div className="prose prose-sm max-w-none text-foreground">
                    <ReactMarkdown>{session.executive_summary}</ReactMarkdown>
                  </div>
                </Card>
              )}
              <RiskHeatmap risks={session.risk_registry} />
            </TabsContent>

            <TabsContent value="risks" className="mt-4">
              <MitigationTable risks={session.risk_registry} />
            </TabsContent>

            <TabsContent value="chains" className="mt-4">
              <ChainDiagram chains={session.attack_chains} />
            </TabsContent>

            {session.mitigation_playbook && (
              <TabsContent value="playbook" className="mt-4">
                <MitigationPlaybook playbook={session.mitigation_playbook} />
              </TabsContent>
            )}
          </>
        )}
      </Tabs>
    </div>
  );
}