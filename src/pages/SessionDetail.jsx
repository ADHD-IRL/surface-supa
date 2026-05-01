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
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const PAGE_W = 210;
    const PAGE_H = 297;
    const ML = 18; // margin left
    const MR = 18; // margin right
    const CONTENT_W = PAGE_W - ML - MR;
    const MARGIN_TOP = 18;
    const MARGIN_BOTTOM = 20;
    let y = MARGIN_TOP;

    const checkPage = (needed = 10) => {
      if (y + needed > PAGE_H - MARGIN_BOTTOM) { doc.addPage(); y = MARGIN_TOP; return true; }
      return false;
    };

    const writeLine = (text, x, size, color = [30, 30, 30], style = 'normal') => {
      doc.setFontSize(size);
      doc.setTextColor(...color);
      doc.setFont('helvetica', style);
      doc.text(text, x, y);
    };

    const writeWrapped = (text, x, size, maxW, color = [60, 60, 60], lineH = 5.5) => {
      doc.setFontSize(size);
      doc.setTextColor(...color);
      doc.setFont('helvetica', 'normal');
      const clean = (text || '').replace(/[#*_`>]/g, '').replace(/\n+/g, ' ').trim();
      const lines = doc.splitTextToSize(clean, maxW);
      lines.forEach(line => {
        checkPage(lineH + 1);
        doc.text(line, x, y);
        y += lineH;
      });
    };

    const sectionHeader = (title) => {
      checkPage(14);
      y += 4;
      doc.setFillColor(22, 78, 162);
      doc.roundedRect(ML, y - 5, CONTENT_W, 9, 2, 2, 'F');
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text(title.toUpperCase(), ML + 4, y + 0.5);
      y += 9;
    };

    const subHeader = (title) => {
      checkPage(10);
      y += 3;
      doc.setFontSize(9);
      doc.setTextColor(22, 78, 162);
      doc.setFont('helvetica', 'bold');
      doc.text(title, ML, y);
      y += 1;
      doc.setDrawColor(22, 78, 162);
      doc.setLineWidth(0.3);
      doc.line(ML, y, ML + CONTENT_W, y);
      y += 4;
    };

    const addFooter = () => {
      const total = doc.getNumberOfPages();
      for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.setFont('helvetica', 'normal');
        doc.text('Surface — Confidential Risk Analysis', ML, PAGE_H - 8);
        doc.text(`Page ${p} of ${total}`, PAGE_W - MR - 20, PAGE_H - 8);
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.2);
        doc.line(ML, PAGE_H - 12, PAGE_W - MR, PAGE_H - 12);
      }
    };

    // ── COVER PAGE ──────────────────────────────────────────────
    doc.setFillColor(15, 35, 70);
    doc.rect(0, 0, PAGE_W, 80, 'F');
    doc.setFillColor(22, 78, 162);
    doc.rect(0, 70, PAGE_W, 6, 'F');

    doc.setFontSize(9);
    doc.setTextColor(150, 190, 255);
    doc.setFont('helvetica', 'normal');
    doc.text('SURFACE  ·  ADVERSARIAL RISK INTELLIGENCE', ML, 28);

    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    const titleLines = doc.splitTextToSize(session.title, CONTENT_W);
    titleLines.forEach(line => { doc.text(line, ML, y + 14); y += 9; });

    doc.setFontSize(10);
    doc.setTextColor(180, 210, 255);
    doc.setFont('helvetica', 'normal');
    doc.text('Red / Blue Team Adversarial Analysis Report', ML, 66);

    y = 88;
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'normal');
    const metaItems = [
      ['Date', new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
      ['Mode', (session.mode || 'standard').charAt(0).toUpperCase() + (session.mode || 'standard').slice(1)],
      ['Rounds', String(session.rounds?.length || 0)],
      ['Risks Identified', String(session.risk_registry?.length || 0)],
      ['Domain Focus', (session.domain_focus || []).join(', ') || '—'],
    ];
    metaItems.forEach(([label, val]) => {
      doc.setFont('helvetica', 'bold'); doc.setTextColor(50, 50, 50);
      doc.text(`${label}:`, ML, y);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80);
      doc.text(val, ML + 38, y);
      y += 7;
    });

    y += 6;
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    const scenLines = doc.splitTextToSize(`Scenario: ${session.scenario}`, CONTENT_W);
    scenLines.forEach(line => { doc.text(line, ML, y); y += 5; });

    // ── EXECUTIVE SUMMARY ───────────────────────────────────────
    if (session.executive_summary) {
      doc.addPage(); y = MARGIN_TOP;
      sectionHeader('Executive Summary');
      y += 2;
      writeWrapped(session.executive_summary, ML, 9.5, CONTENT_W, [40, 40, 40], 6);
    }

    // ── DEBATE TRANSCRIPT ───────────────────────────────────────
    if (session.rounds?.length) {
      doc.addPage(); y = MARGIN_TOP;
      sectionHeader('Debate Transcript');
      session.rounds.forEach((rd) => {
        subHeader(`Round ${rd.round_number}`);
        // Red
        checkPage(8);
        doc.setFillColor(220, 38, 38);
        doc.roundedRect(ML, y - 3.5, 2.5, 5, 0.5, 0.5, 'F');
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(180, 20, 20);
        doc.text(`${rd.red_agent_name}  (Red Team)`, ML + 5, y);
        y += 5;
        writeWrapped(rd.red_response, ML + 5, 8.5, CONTENT_W - 5, [60, 60, 60], 5.2);
        y += 3;
        // Blue
        checkPage(8);
        doc.setFillColor(37, 99, 235);
        doc.roundedRect(ML, y - 3.5, 2.5, 5, 0.5, 0.5, 'F');
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 64, 175);
        doc.text(`${rd.blue_agent_name}  (Blue Team)`, ML + 5, y);
        y += 5;
        writeWrapped(rd.blue_response, ML + 5, 8.5, CONTENT_W - 5, [60, 60, 60], 5.2);
        y += 5;
      });
    }

    // ── RISK REGISTRY ───────────────────────────────────────────
    if (session.risk_registry?.length) {
      doc.addPage(); y = MARGIN_TOP;
      sectionHeader('Risk Registry');
      const scoreColor = (l, imp) => {
        const s = l * imp;
        if (s >= 16) return [220, 38, 38];
        if (s >= 10) return [234, 88, 12];
        if (s >= 5)  return [202, 138, 4];
        return [22, 163, 74];
      };
      session.risk_registry.forEach((risk, i) => {
        checkPage(22);
        const col = scoreColor(risk.likelihood, risk.impact);
        doc.setFillColor(...col);
        doc.roundedRect(ML, y - 4, 2, 18, 0.5, 0.5, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 30, 30);
        doc.text(`${i + 1}. ${risk.title}`, ML + 5, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...col);
        doc.text(`L:${risk.likelihood}  I:${risk.impact}  Category: ${risk.category || '—'}  Owner: ${risk.owner || '—'}`, ML + 5, y + 5);
        y += 9;
        writeWrapped(risk.description, ML + 5, 8, CONTENT_W - 5, [70, 70, 70], 5);
        if (risk.mitigation) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(22, 78, 162);
          checkPage(6);
          doc.text('Mitigation:', ML + 5, y);
          y += 4.5;
          writeWrapped(risk.mitigation, ML + 5, 8, CONTENT_W - 5, [60, 90, 160], 5);
        }
        y += 4;
      });
    }

    // ── ATTACK CHAINS ───────────────────────────────────────────
    if (session.attack_chains?.length) {
      doc.addPage(); y = MARGIN_TOP;
      sectionHeader('Attack / Effect Chains');
      session.attack_chains.forEach((chain) => {
        subHeader(chain.name);
        chain.steps?.forEach((step, si) => {
          checkPage(10);
          const stepColors = { initial: [245, 158, 11], exploit: [220, 38, 38], lateral: [234, 88, 12], impact: [185, 28, 28], defense: [37, 99, 235] };
          const sc = stepColors[step.type] || [100, 100, 100];
          doc.setFillColor(...sc);
          doc.circle(ML + 3, y - 1.5, 3, 'F');
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(255, 255, 255);
          doc.text(String(si + 1), ML + 1.8, y - 0.5);
          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(30, 30, 30);
          doc.text(step.label, ML + 9, y);
          y += 5;
          if (step.description) {
            writeWrapped(step.description, ML + 9, 8, CONTENT_W - 9, [90, 90, 90], 5);
          }
          if (si < chain.steps.length - 1) {
            doc.setDrawColor(180, 180, 180);
            doc.setLineWidth(0.3);
            doc.line(ML + 3, y, ML + 3, y + 2);
            y += 3;
          }
          y += 2;
        });
        y += 4;
      });
    }

    // ── MITIGATION PLAYBOOK ─────────────────────────────────────
    if (session.mitigation_playbook) {
      doc.addPage(); y = MARGIN_TOP;
      sectionHeader('Mitigation Playbook');
      if (session.mitigation_playbook.overview) {
        y += 2;
        writeWrapped(session.mitigation_playbook.overview, ML, 9.5, CONTENT_W, [40, 40, 40], 6);
        y += 4;
      }
      const priorityColors = { immediate: [220, 38, 38], 'short-term': [234, 88, 12], 'long-term': [37, 99, 235] };
      session.mitigation_playbook.actions?.forEach((action, i) => {
        checkPage(24);
        const pc = priorityColors[action.priority?.toLowerCase()] || [100, 100, 100];
        doc.setFillColor(...pc);
        doc.roundedRect(ML, y - 4, 2, 5, 0.5, 0.5, 'F');
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 30, 30);
        doc.text(`${i + 1}. ${action.title}`, ML + 5, y);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...pc);
        const meta = [action.priority, action.timeline, action.owner ? `Owner: ${action.owner}` : ''].filter(Boolean).join('  ·  ');
        doc.text(meta, ML + 5, y + 5);
        y += 10;
        writeWrapped(action.description, ML + 5, 8.5, CONTENT_W - 5, [60, 60, 60], 5.2);
        if (action.steps?.length) {
          action.steps.forEach((step, si) => {
            checkPage(7);
            doc.setFillColor(22, 78, 162);
            doc.circle(ML + 7, y - 1.5, 1.2, 'F');
            writeWrapped(`${si + 1}. ${step}`, ML + 10, 8, CONTENT_W - 10, [60, 60, 60], 5);
          });
        }
        y += 5;
      });
    }

    addFooter();
    doc.save(`surface-report-${session.title.replace(/\s+/g, '-').toLowerCase()}.pdf`);
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