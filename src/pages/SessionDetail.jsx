import React, { useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Play, FileDown, Loader2, BookOpen, GitBranch, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import DebateRound from '@/components/session/DebateRound';
import RiskHeatmap from '@/components/session/RiskHeatmap';
import ChainDiagram from '@/components/session/ChainDiagram';
import MitigationTable from '@/components/session/MitigationTable';
import MitigationPlaybook from '@/components/session/MitigationPlaybook';
import DebateRoster from '@/components/session/DebateRoster';
import ReactMarkdown from 'react-markdown';
import { buildAgentSystemPrompt } from '@/lib/agentData';

function normalizeRound(round) {
  if (!round) return round;
  if (round.red_responses) return round;
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

export default function SessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [runningStep, setRunningStep] = useState('');
  const [runningAgents, setRunningAgents] = useState(null);
  const [generatingPlaybook, setGeneratingPlaybook] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.Session.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      navigate('/');
    },
  });

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

      if (!redAgents.length || !blueAgents.length) throw new Error('Need at least one red and one blue agent');

      const roundCount = session.mode === 'rapid' ? 1 : session.mode === 'deep' ? 3 : 2;
      const rounds = [];

      for (let r = 0; r < roundCount; r++) {
        const roundData = {
          round_number: r + 1,
          red_responses: [],
          blue_responses: [],
          status: 'running',
          timestamp: new Date().toISOString(),
        };
        rounds.push(roundData);

        setRunningStep(`Round ${r + 1} of ${roundCount}`);
        setRunningAgents({
          round: r + 1, roundCount, phase: 'red',
          agents: [
            ...redAgents.map(a => ({ id: a.id, name: a.name, team: 'red', status: 'waiting' })),
            ...blueAgents.map(a => ({ id: a.id, name: a.name, team: 'blue', status: 'waiting' })),
          ],
        });

        const previousContext = rounds.slice(0, -1).map(rd =>
          `Round ${rd.round_number}:\n` +
          rd.red_responses.map(x => `Red (${x.agent_name}): ${x.response}`).join('\n') + '\n' +
          rd.blue_responses.map(x => `Blue (${x.agent_name}): ${x.response}`).join('\n')
        ).join('\n\n');

        for (const redAgent of redAgents) {
          setRunningAgents(prev => prev && ({ ...prev, agents: prev.agents.map(a => a.id === redAgent.id ? { ...a, status: 'running' } : a) }));
          const redPrompt = `${buildAgentSystemPrompt(redAgent)}\n\nScenario: ${session.scenario}\n${session.reference_urls?.length ? `\nReference URLs: ${session.reference_urls.join(', ')}` : ''}\n${previousContext ? `\nPrevious rounds:\n${previousContext}` : ''}\n\nProvide your Round ${r + 1} attack analysis. Identify specific threats, vulnerabilities, and attack chains. Be detailed and actionable.`;
          const response = await base44.integrations.Core.InvokeLLM({ prompt: redPrompt });
          roundData.red_responses.push({ agent_id: redAgent.id, agent_name: redAgent.name, response });
          setRunningAgents(prev => prev && ({ ...prev, agents: prev.agents.map(a => a.id === redAgent.id ? { ...a, status: 'done' } : a) }));
          await base44.entities.Session.update(id, { rounds: [...rounds] });
          queryClient.invalidateQueries({ queryKey: ['session', id] });
        }

        setRunningAgents(prev => prev && ({ ...prev, phase: 'blue' }));
        const allRedContext = roundData.red_responses.map(x => `${x.agent_name}:\n${x.response}`).join('\n\n---\n\n');

        for (const blueAgent of blueAgents) {
          setRunningAgents(prev => prev && ({ ...prev, agents: prev.agents.map(a => a.id === blueAgent.id ? { ...a, status: 'running' } : a) }));
          const bluePrompt = `${buildAgentSystemPrompt(blueAgent)}\n\nScenario: ${session.scenario}\n\nRed team attack analyses (Round ${r + 1}):\n${allRedContext}\n${previousContext ? `\nPrevious rounds:\n${previousContext}` : ''}\n\nProvide your defensive response. Counter each attack vector with specific mitigations, detection methods, and resilience measures. Be practical and implementable.`;
          const response = await base44.integrations.Core.InvokeLLM({ prompt: bluePrompt });
          roundData.blue_responses.push({ agent_id: blueAgent.id, agent_name: blueAgent.name, response });
          setRunningAgents(prev => prev && ({ ...prev, agents: prev.agents.map(a => a.id === blueAgent.id ? { ...a, status: 'done' } : a) }));
          await base44.entities.Session.update(id, { rounds: [...rounds] });
          queryClient.invalidateQueries({ queryKey: ['session', id] });
        }

        roundData.status = 'completed';
        await base44.entities.Session.update(id, { rounds: [...rounds] });
        queryClient.invalidateQueries({ queryKey: ['session', id] });
      }

      // Generate summary, risks, chains
      setRunningAgents(prev => prev ? { ...prev, phase: 'synthesis' } : null);
      setRunningStep('Generating executive summary & risk registry...');

      const allTranscripts = rounds.map(rd =>
        `Round ${rd.round_number}:\n` +
        rd.red_responses.map(x => `Red (${x.agent_name}): ${x.response}`).join('\n') + '\n' +
        rd.blue_responses.map(x => `Blue (${x.agent_name}): ${x.response}`).join('\n')
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
      setRunningAgents(null);
    },
    onError: async () => {
      await base44.entities.Session.update(id, { status: 'failed' });
      queryClient.invalidateQueries({ queryKey: ['session', id] });
      setRunningStep('');
      setRunningAgents(null);
    },
  });

  const handleGeneratePlaybook = async () => {
    setGeneratingPlaybook(true);
    const allTranscripts = session.rounds.map(rd => {
      const nr = normalizeRound(rd);
      return `Round ${nr.round_number}:\n` +
        nr.red_responses.map(x => `Red (${x.agent_name}): ${x.response}`).join('\n') + '\n' +
        nr.blue_responses.map(x => `Blue (${x.agent_name}): ${x.response}`).join('\n');
    }).join('\n\n---\n\n');

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
    const ML = 18;
    const MR = 18;
    const CONTENT_W = PAGE_W - ML - MR; // 174mm
    const MARGIN_TOP = 18;
    const MARGIN_BOTTOM = 22;
    let y = MARGIN_TOP;

    const checkPage = (needed = 10) => {
      if (y + needed > PAGE_H - MARGIN_BOTTOM) { doc.addPage(); y = MARGIN_TOP; return true; }
      return false;
    };

    const cleanMd = (text) =>
      (text || '').replace(/[#*_`>]/g, '').replace(/\n+/g, ' ').trim();

    const writeWrapped = (text, x, size, maxW, color = [60, 60, 60], lineH = 5.5) => {
      doc.setFontSize(size);
      doc.setTextColor(...color);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(cleanMd(text), maxW);
      lines.forEach(line => { checkPage(lineH + 1); doc.text(line, x, y); y += lineH; });
    };

    const sectionHeader = (title) => {
      checkPage(18);
      y += 5;
      doc.setFillColor(22, 78, 162);
      doc.roundedRect(ML, y - 5.5, CONTENT_W, 10, 2, 2, 'F');
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text(title.toUpperCase(), ML + 4, y + 0.5);
      y += 10;
    };

    // ── Table engine ────────────────────────────────────────────
    // Cell shape: { text, width, bold?, color?, size?, lines? }
    // 'lines' allows pre-computed line arrays (skips splitTextToSize)
    const LINE_H = 4.5;
    const PAD_H  = 2.5;
    const PAD_V  = 3;
    const BORDER = [210, 215, 220];
    const HDR_BG = [22, 78, 162];

    const calcRowH = (cells) => {
      let max = 1;
      cells.forEach(cell => {
        if (!cell.text && !cell.lines) return;
        const lines = cell.lines || (() => {
          doc.setFontSize(cell.size || 8);
          return doc.splitTextToSize(cleanMd(cell.text), cell.width - PAD_H * 2);
        })();
        max = Math.max(max, lines.length);
      });
      return Math.max(max * LINE_H + PAD_V * 2, LINE_H + PAD_V * 2);
    };

    const drawRow = (cells, opts = {}) => {
      const { bg, isHeader = false, topBorder = true } = opts;
      const rowH  = calcRowH(cells);
      const totalW = cells.reduce((s, c) => s + c.width, 0);
      checkPage(rowH + 2);

      if (bg) {
        doc.setFillColor(...bg);
        doc.rect(ML, y, totalW, rowH, 'F');
      }
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.2);
      if (topBorder) doc.line(ML, y, ML + totalW, y);
      doc.line(ML, y + rowH, ML + totalW, y + rowH);
      doc.line(ML, y, ML, y + rowH);
      doc.line(ML + totalW, y, ML + totalW, y + rowH);

      let cx = ML;
      cells.forEach((cell, idx) => {
        if (idx > 0) { doc.setDrawColor(...BORDER); doc.line(cx, y, cx, y + rowH); }
        const textColor = cell.color || (isHeader ? [255, 255, 255] : [40, 40, 40]);
        doc.setFontSize(cell.size || 8);
        doc.setTextColor(...textColor);
        doc.setFont('helvetica', (cell.bold || isHeader) ? 'bold' : 'normal');
        const lines = cell.lines || doc.splitTextToSize(cleanMd(cell.text || ''), cell.width - PAD_H * 2);
        lines.forEach((ln, li) => doc.text(ln, cx + PAD_H, y + PAD_V + LINE_H * 0.75 + li * LINE_H));
        cx += cell.width;
      });
      y += rowH;
    };

    const tableHeader = (cols) => drawRow(cols, { bg: HDR_BG, isHeader: true });

    // ── Shared helpers ──────────────────────────────────────────
    const scoreColor = (l, imp) => {
      const s = (l || 1) * (imp || 1);
      if (s >= 16) return [220, 38, 38];
      if (s >= 10) return [234, 88, 12];
      if (s >= 5)  return [202, 138, 4];
      return [22, 163, 74];
    };
    const severityLabel = (l, imp) => {
      const s = (l || 1) * (imp || 1);
      if (s >= 16) return 'Critical';
      if (s >= 10) return 'High';
      if (s >= 5)  return 'Medium';
      return 'Low';
    };
    const blendWhite = (rgb, alpha) => rgb.map(c => Math.round(c + (255 - c) * (1 - alpha)));

    const addFooter = () => {
      const total = doc.getNumberOfPages();
      for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        doc.setFontSize(7); doc.setTextColor(150, 150, 150); doc.setFont('helvetica', 'normal');
        doc.text('Surface — Confidential Risk Analysis', ML, PAGE_H - 8);
        doc.text(`Page ${p} of ${total}`, PAGE_W - MR - 20, PAGE_H - 8);
        doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.2);
        doc.line(ML, PAGE_H - 12, PAGE_W - MR, PAGE_H - 12);
      }
    };

    // ── 1. COVER PAGE ───────────────────────────────────────────
    doc.setFillColor(15, 35, 70);
    doc.rect(0, 0, PAGE_W, 80, 'F');
    doc.setFillColor(22, 78, 162);
    doc.rect(0, 70, PAGE_W, 6, 'F');
    doc.setFontSize(9); doc.setTextColor(150, 190, 255); doc.setFont('helvetica', 'normal');
    doc.text('SURFACE  ·  ADVERSARIAL RISK INTELLIGENCE', ML, 28);
    y = 32;
    doc.setFontSize(22); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
    doc.splitTextToSize(session.title, CONTENT_W).forEach(line => { doc.text(line, ML, y + 14); y += 9; });
    doc.setFontSize(10); doc.setTextColor(180, 210, 255); doc.setFont('helvetica', 'normal');
    doc.text('Red / Blue Team Adversarial Analysis Report', ML, 66);

    // ── 2. SESSION DETAILS ──────────────────────────────────────
    doc.addPage(); y = MARGIN_TOP;
    sectionHeader('Session Details');
    y += 2;
    const metaRows = [
      ['Date',             new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
      ['Mode',             (session.mode || 'standard').charAt(0).toUpperCase() + (session.mode || 'standard').slice(1)],
      ['Debate Rounds',    String(session.rounds?.length || 0)],
      ['Risks Identified', String(session.risk_registry?.length || 0)],
      ['Attack Chains',    String(session.attack_chains?.length || 0)],
      ['Scenario',         session.scenario || '—'],
    ];
    tableHeader([{ text: 'Field', width: 44 }, { text: 'Value', width: CONTENT_W - 44 }]);
    metaRows.forEach(([label, val], i) => drawRow([
      { text: label, width: 44, bold: true, color: [50, 50, 100] },
      { text: val,   width: CONTENT_W - 44 },
    ], { bg: i % 2 === 0 ? [248, 250, 255] : [255, 255, 255], topBorder: false }));

    // ── 3. EXECUTIVE SUMMARY ────────────────────────────────────
    if (session.executive_summary) {
      sectionHeader('Executive Summary');
      y += 2;
      writeWrapped(session.executive_summary, ML, 9.5, CONTENT_W, [40, 40, 40], 6);
    }

    // ── 4. RISK HEATMAP ─────────────────────────────────────────
    if (session.risk_registry?.length) {
      checkPage(90);
      sectionHeader('Risk Heatmap');
      y += 2;

      const CELL      = 18;
      const LABEL_W   = 26;
      const GRID_X    = ML + LABEL_W + 4;
      const LIK_LBLS  = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost Certain'];
      const IMP_LBLS  = ['Catastrophic', 'Major', 'Moderate', 'Minor', 'Negligible'];

      const grid = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => []));
      session.risk_registry.forEach(r => {
        const l = Math.min(Math.max(Math.round(r.likelihood || 1), 1), 5);
        const imp = Math.min(Math.max(Math.round(r.impact || 1), 1), 5);
        grid[5 - imp][l - 1].push(r);
      });

      // Y-axis rotated label
      doc.setFontSize(8); doc.setTextColor(80, 80, 80); doc.setFont('helvetica', 'bold');
      doc.text('Impact ↑', ML + 4, y + CELL * 2.5, { angle: 90 });

      // Rows: impact labels + cells
      grid.forEach((row, ri) => {
        const rowY = y + ri * CELL;
        doc.setFontSize(6.5); doc.setTextColor(80, 80, 80); doc.setFont('helvetica', 'normal');
        doc.text(IMP_LBLS[ri], ML + LABEL_W + 2, rowY + CELL / 2 + 2, { align: 'right' });

        row.forEach((cell, ci) => {
          const cellX   = GRID_X + ci * CELL;
          const hasData = cell.length > 0;
          const rgb     = scoreColor(ci + 1, 5 - ri);
          doc.setFillColor(...(hasData ? rgb : blendWhite(rgb, 0.2)));
          doc.rect(cellX, rowY, CELL, CELL, 'F');
          doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.6);
          doc.rect(cellX, rowY, CELL, CELL, 'S');
          if (hasData) {
            doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
            doc.text(String(cell.length), cellX + CELL / 2, rowY + CELL / 2 + 2, { align: 'center' });
          }
        });
      });

      // X-axis labels
      const lblY = y + 5 * CELL + 5;
      LIK_LBLS.forEach((lbl, ci) => {
        doc.setFontSize(6.5); doc.setTextColor(80, 80, 80); doc.setFont('helvetica', 'normal');
        doc.text(lbl, GRID_X + ci * CELL + CELL / 2, lblY, { align: 'center' });
      });
      doc.setFontSize(7); doc.setTextColor(80, 80, 80); doc.setFont('helvetica', 'bold');
      doc.text('Likelihood →', GRID_X + (5 * CELL) / 2, lblY + 6, { align: 'center' });

      // Legend
      const legY = lblY + 12;
      [['Low (1–4)', [22, 163, 74]], ['Medium (5–9)', [202, 138, 4]], ['High (10–15)', [234, 88, 12]], ['Critical (16+)', [220, 38, 38]]].forEach(([lbl, rgb], i) => {
        const lx = ML + i * 44;
        doc.setFillColor(...rgb); doc.rect(lx, legY - 3, 4, 4, 'F');
        doc.setFontSize(7); doc.setTextColor(60, 60, 60); doc.setFont('helvetica', 'normal');
        doc.text(lbl, lx + 5.5, legY);
      });
      y = legY + 8;
    }

    // ── 5. RISK REGISTRY ────────────────────────────────────────
    if (session.risk_registry?.length) {
      doc.addPage(); y = MARGIN_TOP;
      sectionHeader('Risk Registry');
      y += 2;

      // Col widths: 7+48+22+18+18+40+21 = 174
      const C = { num: 7, risk: 48, cat: 22, score: 18, sev: 18, mit: 40, owner: 21 };

      tableHeader([
        { text: '#',          width: C.num   },
        { text: 'Risk',       width: C.risk  },
        { text: 'Category',   width: C.cat   },
        { text: 'L × I', width: C.score },
        { text: 'Severity',   width: C.sev   },
        { text: 'Mitigation', width: C.mit   },
        { text: 'Owner',      width: C.owner },
      ]);

      const sorted = [...session.risk_registry].sort((a, b) =>
        (b.likelihood || 1) * (b.impact || 1) - (a.likelihood || 1) * (a.impact || 1)
      );

      sorted.forEach((risk, i) => {
        const sev   = severityLabel(risk.likelihood, risk.impact);
        const sc    = scoreColor(risk.likelihood, risk.impact);
        const score = (risk.likelihood || 1) * (risk.impact || 1);

        // Pre-compute risk cell lines so calcRowH works correctly
        doc.setFontSize(7.5);
        const titleLns = doc.splitTextToSize(cleanMd(risk.title), C.risk - PAD_H * 2);
        const descLns  = risk.description
          ? doc.splitTextToSize(cleanMd(risk.description), C.risk - PAD_H * 2)
          : [];

        drawRow([
          { text: String(i + 1), width: C.num,   color: [120, 120, 120], size: 7.5 },
          { lines: [...titleLns, ...descLns],      width: C.risk,  size: 7.5 },
          { text: risk.category || '—',            width: C.cat,   size: 7.5 },
          { text: `${risk.likelihood ?? '—'} × ${risk.impact ?? '—'} = ${score}`, width: C.score, size: 7, color: [80, 80, 80] },
          { text: sev,                             width: C.sev,   size: 7.5, bold: true, color: sc },
          { text: risk.mitigation || '—',          width: C.mit,   size: 7.5 },
          { text: risk.owner || '—',               width: C.owner, size: 7.5, color: [100, 100, 100] },
        ], { bg: i % 2 === 0 ? [248, 250, 255] : [255, 255, 255], topBorder: false });
      });
    }

    // ── 6. DEBATE TRANSCRIPT ────────────────────────────────────
    if (session.rounds?.length) {
      doc.addPage(); y = MARGIN_TOP;
      sectionHeader('Debate Transcript');

      // Preserve markdown structure: paragraphs, bullets, numbered lists, headings
      const processMdLines = (text, maxW, size) => {
        if (!text) return ['—'];
        doc.setFontSize(size);
        const result = [];
        const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
        paragraphs.forEach((para, pi) => {
          if (pi > 0) result.push('');
          para.split('\n').forEach(line => {
            const t = line.trim();
            if (!t) return;
            if (/^[-*•+]\s/.test(t)) {
              const txt = '• ' + t.replace(/^[-*•+]\s+/, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/[*_`#>]/g, '').trim();
              doc.splitTextToSize(txt, maxW).forEach(l => result.push(l));
            } else if (/^\d+\.\s/.test(t)) {
              const txt = t.replace(/\*\*(.+?)\*\*/g, '$1').replace(/[*_`#>]/g, '').trim();
              doc.splitTextToSize(txt, maxW).forEach(l => result.push(l));
            } else if (/^#+\s/.test(t)) {
              const txt = t.replace(/^#+\s+/, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/[*_`#>]/g, '').trim();
              doc.splitTextToSize(txt, maxW).forEach(l => result.push(l));
            } else {
              const txt = t.replace(/\*\*(.+?)\*\*/g, '$1').replace(/[*_`#>]/g, '').trim();
              if (txt) doc.splitTextToSize(txt, maxW).forEach(l => result.push(l));
            }
          });
        });
        return result.length ? result : ['—'];
      };

      const TW = 34; // team label column, matches ~148px online
      const RW = CONTENT_W - TW;

      const TEAMS = (rd) => {
        const nr = normalizeRound(rd);
        const redRows = nr.red_responses.map(r => ({
          label: 'Red Team', agentName: r.agent_name || 'Red Agent', response: r.response,
          teamColor: [207, 33, 33], badgeBg: [255, 245, 245], badgeBorder: [207, 33, 33],
          rowBg: [255, 249, 249], divColor: [247, 193, 193],
        }));
        const blueRows = nr.blue_responses.map(b => ({
          label: 'Blue Team', agentName: b.agent_name || 'Blue Agent', response: b.response,
          teamColor: [37, 99, 235], badgeBg: [245, 248, 255], badgeBorder: [37, 99, 235],
          rowBg: [249, 251, 255], divColor: [184, 207, 250],
        }));
        return [...redRows, ...blueRows];
      };

      session.rounds.forEach((rd) => {
        y += 4;
        checkPage(22);

        // Round header — muted gray, matches bg-muted/40
        const HDR_H = 9;
        doc.setFillColor(243, 244, 246);
        doc.rect(ML, y, CONTENT_W, HDR_H, 'F');
        doc.setDrawColor(...BORDER); doc.setLineWidth(0.2);
        doc.rect(ML, y, CONTENT_W, HDR_H, 'S');
        // ⚔ swords icon substitute
        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 150);
        doc.text('⚔', ML + 3.5, y + 6.2);
        // "ROUND N" uppercase muted label
        doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(120, 120, 120);
        doc.text(`ROUND ${rd.round_number}`, ML + 9.5, y + 6.2);
        if (rd.timestamp) {
          doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(160, 160, 160);
          doc.text(new Date(rd.timestamp).toLocaleTimeString(), ML + CONTENT_W - 3, y + 6.2, { align: 'right' });
        }
        y += HDR_H;

        TEAMS(rd).forEach(({ label, agentName, response, teamColor, badgeBg, badgeBorder, rowBg, divColor }, ti) => {
          const respLines  = processMdLines(response, RW - PAD_H * 2, 7.5);
          doc.setFontSize(7.5);
          const nameLns    = doc.splitTextToSize(agentName, TW - PAD_H * 2 - 1);
          const BADGE_H_PX = 5;
          const leftH      = PAD_V + BADGE_H_PX + 2.5 + nameLns.length * LINE_H + PAD_V;
          const rightH     = PAD_V + respLines.length * LINE_H + PAD_V;
          const rowH       = Math.max(leftH, rightH, 14);
          checkPage(rowH + 2);

          // Row background
          doc.setFillColor(...rowBg);
          doc.rect(ML, y, CONTENT_W, rowH, 'F');

          // Outer borders
          doc.setDrawColor(...BORDER); doc.setLineWidth(0.2);
          if (ti === 0) doc.line(ML, y, ML + CONTENT_W, y);
          doc.line(ML, y + rowH, ML + CONTENT_W, y + rowH);
          doc.line(ML, y, ML, y + rowH);
          doc.line(ML + CONTENT_W, y, ML + CONTENT_W, y + rowH);

          // Colored column divider matching border-r-{team}/20
          doc.setDrawColor(...divColor); doc.setLineWidth(0.6);
          doc.line(ML + TW, y, ML + TW, y + rowH);

          // ── Team badge (outline style matching Badge variant="outline")
          doc.setFontSize(7);
          const badgeTxtW = doc.getTextWidth(label);
          const BX = ML + PAD_H;
          const BY = y + PAD_V;
          const BW = badgeTxtW + 4;
          doc.setFillColor(...badgeBg);
          doc.roundedRect(BX, BY, BW, BADGE_H_PX, 0.9, 0.9, 'F');
          doc.setDrawColor(...badgeBorder); doc.setLineWidth(0.3);
          doc.roundedRect(BX, BY, BW, BADGE_H_PX, 0.9, 0.9, 'S');
          doc.setTextColor(...teamColor); doc.setFont('helvetica', 'bold');
          doc.text(label, BX + 2, BY + 3.6);

          // ── Agent name below badge (semibold dark)
          doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(40, 40, 40);
          nameLns.forEach((nl, nli) => {
            doc.text(nl, ML + PAD_H, BY + BADGE_H_PX + 3 + nli * LINE_H);
          });

          // ── Response text (right column, full markdown structure)
          doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50);
          const textBaseY = y + PAD_V + LINE_H * 0.75;
          respLines.forEach((line, li) => {
            doc.text(line || '', ML + TW + PAD_H, textBaseY + li * LINE_H);
          });

          y += rowH;
        });

        y += 3;
      });
    }

    // ── 7. ATTACK / EFFECT CHAINS ───────────────────────────────
    if (session.attack_chains?.length) {
      doc.addPage(); y = MARGIN_TOP;
      sectionHeader('Attack / Effect Chains');

      const stepTypeColors = { initial: [245, 158, 11], exploit: [220, 38, 38], lateral: [234, 88, 12], impact: [185, 28, 28], defense: [37, 99, 235] };
      // Col widths: 10+40+24+100 = 174
      const SC = { num: 10, label: 40, type: 24, desc: 100 };

      session.attack_chains.forEach((chain, ci) => {
        y += ci === 0 ? 4 : 8;
        checkPage(16);

        // Chain name bar
        doc.setFillColor(237, 242, 255);
        doc.rect(ML, y - 3.5, CONTENT_W, 8, 'F');
        doc.setDrawColor(...BORDER); doc.setLineWidth(0.2);
        doc.rect(ML, y - 3.5, CONTENT_W, 8, 'S');
        doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(22, 78, 162);
        doc.text(chain.name, ML + 3, y + 0.5);
        y += 6;

        tableHeader([
          { text: '#',           width: SC.num   },
          { text: 'Step',        width: SC.label },
          { text: 'Type',        width: SC.type  },
          { text: 'Description', width: SC.desc  },
        ]);

        chain.steps?.forEach((step, si) => {
          const tc = stepTypeColors[step.type] || [100, 100, 100];
          drawRow([
            { text: String(si + 1),      width: SC.num,   bold: true, color: tc,         size: 8   },
            { text: step.label || '—',   width: SC.label, bold: true,                    size: 7.5 },
            { text: step.type  || '—',   width: SC.type,              color: tc,         size: 7.5 },
            { text: step.description || '—', width: SC.desc,          color: [70,70,70], size: 7.5 },
          ], { bg: si % 2 === 0 ? [248, 250, 255] : [255, 255, 255], topBorder: si === 0 });
        });
      });
    }

    // ── 8. MITIGATION PLAYBOOK ──────────────────────────────────
    if (session.mitigation_playbook) {
      doc.addPage(); y = MARGIN_TOP;
      sectionHeader('Mitigation Playbook');

      if (session.mitigation_playbook.overview) {
        y += 2;
        writeWrapped(session.mitigation_playbook.overview, ML, 9.5, CONTENT_W, [40, 40, 40], 6);
        y += 4;
      }

      const priorityColors = { immediate: [220, 38, 38], 'short-term': [234, 88, 12], 'long-term': [37, 99, 235] };
      // Col widths: 24+52+28+26+44 = 174
      const PC = { pri: 24, title: 52, owner: 28, time: 26, desc: 44 };

      tableHeader([
        { text: 'Priority',    width: PC.pri   },
        { text: 'Action',      width: PC.title },
        { text: 'Owner',       width: PC.owner },
        { text: 'Timeline',    width: PC.time  },
        { text: 'Description', width: PC.desc  },
      ]);

      session.mitigation_playbook.actions?.forEach((action, i) => {
        const pc = priorityColors[action.priority?.toLowerCase()] || [100, 100, 100];
        drawRow([
          { text: action.priority || '—',    width: PC.pri,   bold: true, color: pc,          size: 7.5 },
          { text: action.title || '—',        width: PC.title, bold: true,                     size: 7.5 },
          { text: action.owner || '—',        width: PC.owner,             color: [80,80,80],  size: 7.5 },
          { text: action.timeline || '—',     width: PC.time,              color: [80,80,80],  size: 7.5 },
          { text: action.description || '—',  width: PC.desc,                                  size: 7.5 },
        ], { bg: i % 2 === 0 ? [248, 250, 255] : [255, 255, 255], topBorder: i === 0 });

        // Step sub-rows indented under the action
        if (action.steps?.length) {
          action.steps.forEach((step, si) => {
            drawRow([
              { text: '',                              width: PC.pri },
              { text: `${si + 1}. ${step}`,           width: CONTENT_W - PC.pri, size: 7, color: [70, 70, 70] },
            ], { bg: [252, 253, 255], topBorder: false });
          });
        }
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
          {session.parent_session_id && (
            <div className="flex items-center gap-1.5 mt-1">
              <GitBranch className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Re-run of </span>
              <Link
                to={`/sessions/${session.parent_session_id}`}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                {session.parent_session_title || 'original session'}
              </Link>
            </div>
          )}
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{session.scenario}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
          {session.status === 'draft' && (
            <Button onClick={() => runDebateMutation.mutate()} disabled={runDebateMutation.isPending} className="gap-2">
              <Play className="w-4 h-4" /> Run Analysis
            </Button>
          )}
          {(session.status === 'completed' || session.status === 'failed') && (
            <Button
              variant="outline"
              onClick={() => navigate('/sessions/new', { state: { template: session } })}
              className="gap-2"
            >
              <GitBranch className="w-4 h-4" /> Edit & Re-run
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
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="gap-2 border-red-team/30 text-red-team hover:bg-red-team/5 hover:border-red-team/50"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Trash2 className="w-4 h-4" />}
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete session?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete <span className="font-medium text-foreground">"{session.title}"</span> and
                  all its artifacts — debate rounds, risk registry, attack chains, and any generated playbook.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate()}
                  className="bg-red-team text-white hover:bg-red-team/90"
                >
                  Delete session
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Running status */}
      {(runningStep || runningAgents) && (() => {
        const roundCount = session.mode === 'rapid' ? 1 : session.mode === 'deep' ? 3 : 2;
        const completedRounds = session.rounds?.filter(r => r.status === 'completed').length ?? 0;
        const isSynthesis = runningAgents?.phase === 'synthesis' || (!runningAgents && runningStep.startsWith('Generating'));
        const doneAgents = runningAgents?.agents.filter(a => a.status === 'done').length ?? 0;
        const totalAgents = runningAgents?.agents.length ?? 0;
        const roundPct = Math.round((completedRounds / roundCount) * 100);
        const prevDone = session.rounds?.filter(r => r.status === 'completed') ?? [];
        return (
          <Card className="overflow-hidden border-primary/20">
            {/* Header */}
            <div className="px-5 py-3 bg-primary/5 border-b border-primary/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
                <span className="text-sm font-semibold">
                  {isSynthesis
                    ? 'Synthesizing analysis…'
                    : runningAgents
                      ? `Round ${runningAgents.round} of ${runningAgents.roundCount}`
                      : runningStep}
                </span>
              </div>
              {runningAgents && !isSynthesis && (
                <Badge variant="outline" className={cn(
                  "text-xs",
                  runningAgents.phase === 'red'
                    ? "border-red-team/40 text-red-team bg-red-team/5"
                    : "border-blue-team/40 text-blue-team bg-blue-team/5"
                )}>
                  {runningAgents.phase === 'red' ? 'Red Phase' : 'Blue Phase'}
                </Badge>
              )}
            </div>

            {/* Per-agent rows */}
            {runningAgents && !isSynthesis && (
              <div className="px-5 py-3 space-y-3">
                {['red', 'blue'].map(team => {
                  const teamAgents = runningAgents.agents.filter(a => a.team === team);
                  if (!teamAgents.length) return null;
                  const isRed = team === 'red';
                  const isActiveTeam = runningAgents.phase === team;
                  return (
                    <div key={team}>
                      <div className={cn(
                        "text-[10px] font-semibold uppercase tracking-wider mb-1.5",
                        isRed ? "text-red-team/70" : "text-blue-team/70"
                      )}>
                        {isRed ? 'Red Team' : 'Blue Team'}
                      </div>
                      <div className="space-y-0.5">
                        {teamAgents.map(agent => (
                          <div key={agent.id} className={cn(
                            "flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors",
                            agent.status === 'running' && (isRed ? "bg-red-team/5" : "bg-blue-team/5")
                          )}>
                            {agent.status === 'done'
                              ? <CheckCircle2 className={cn("w-3.5 h-3.5 flex-shrink-0", isRed ? "text-red-team" : "text-blue-team")} />
                              : agent.status === 'running'
                                ? <Loader2 className={cn("w-3.5 h-3.5 animate-spin flex-shrink-0", isRed ? "text-red-team" : "text-blue-team")} />
                                : <Circle className={cn("w-3.5 h-3.5 flex-shrink-0", isActiveTeam ? "text-muted-foreground/50" : "text-muted-foreground/20")} />
                            }
                            <span className={cn(
                              "text-xs font-medium flex-1",
                              agent.status === 'done' ? (isRed ? "text-red-team" : "text-blue-team") :
                              agent.status === 'running' ? "text-foreground" :
                              isActiveTeam ? "text-muted-foreground" : "text-muted-foreground/40"
                            )}>
                              {agent.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground w-20 text-right">
                              {agent.status === 'running' ? (isRed ? 'analyzing…' : 'responding…') :
                               agent.status === 'done' ? 'complete' : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Synthesis state */}
            {isSynthesis && (
              <div className="px-5 py-4 flex items-center gap-3 text-sm text-muted-foreground">
                <div className="flex gap-1 flex-shrink-0">
                  {[0, 150, 300].map((delay) => (
                    <div key={delay} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                  ))}
                </div>
                Generating executive summary, risk registry &amp; attack chains…
              </div>
            )}

            {/* Completed rounds summary */}
            {prevDone.length > 0 && (
              <div className="border-t border-border/50 px-5 py-2 space-y-0.5 bg-muted/20">
                {prevDone.map(rd => {
                  const nr = normalizeRound(rd);
                  const rNames = nr.red_responses.map(x => x.agent_name).filter(Boolean).join(', ');
                  const bNames = nr.blue_responses.map(x => x.agent_name).filter(Boolean).join(', ');
                  return (
                    <div key={rd.round_number} className="flex items-center gap-2 text-xs text-muted-foreground py-0.5">
                      <CheckCircle2 className="w-3 h-3 text-green-team flex-shrink-0" />
                      <span className="text-green-team font-medium">Round {rd.round_number}</span>
                      <span>complete</span>
                      {rNames && bNames && (
                        <span className="ml-1">— <span className="text-red-team">{rNames}</span> <span className="text-muted-foreground/50">·</span> <span className="text-blue-team">{bNames}</span></span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Progress footer */}
            <div className="border-t border-border/50 px-5 py-3">
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
                <span>{completedRounds} of {roundCount} rounds complete</span>
                {!isSynthesis && totalAgents > 0 && (
                  <span>{doneAgents} / {totalAgents} agents done this round</span>
                )}
                {isSynthesis && <span>Finalising…</span>}
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-700"
                  style={{ width: `${isSynthesis ? 90 : roundPct}%` }}
                />
              </div>
            </div>
          </Card>
        );
      })()}

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

        <TabsContent value="debate" className="space-y-4 mt-4">
          {/* Roster — always shown */}
          <DebateRoster session={session} agents={agents} />

          {session.rounds?.length > 0 ? (() => {
            const roundCount = session.mode === 'rapid' ? 1 : session.mode === 'deep' ? 3 : 2;
            return session.rounds.map((round, i) => (
              <DebateRound key={i} round={round} index={i} total={roundCount} />
            ));
          })() : (
            <Card className="p-12 text-center bg-card">
              <p className="text-muted-foreground">
                {session.status === 'draft'
                  ? 'Click "Run Analysis" to start the adversarial debate'
                  : 'Debate rounds will appear here once the analysis begins'}
              </p>
            </Card>
          )}
        </TabsContent>

        {session.status === 'completed' && (
          <>
            <TabsContent value="report" className="space-y-6 mt-4">
              {/* Session metadata */}
              <Card className="overflow-hidden">
                <div className="px-6 py-3 border-b border-border bg-muted/30">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Session Details</h3>
                </div>
                <table className="w-full border-collapse">
                  <tbody>
                    {[
                      ['Date', new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
                      ['Mode', (session.mode || 'standard').charAt(0).toUpperCase() + (session.mode || 'standard').slice(1)],
                      ['Debate Rounds', String(session.rounds?.length || 0)],
                      ['Risks Identified', String(session.risk_registry?.length || 0)],
                      ['Attack Chains', String(session.attack_chains?.length || 0)],
                      ['Scenario', session.scenario],
                    ].map(([label, value], i) => (
                      <tr key={label} className={cn("border-b border-border last:border-b-0", i % 2 === 0 ? "bg-background" : "bg-muted/10")}>
                        <td className="px-6 py-3 w-40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</td>
                        <td className="px-6 py-3 text-sm text-foreground">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              {/* Executive summary */}
              {session.executive_summary && (
                <Card className="p-6 border-l-4 border-l-primary">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Executive Summary</h3>
                  <div className="prose prose-sm max-w-none text-foreground">
                    <ReactMarkdown>{session.executive_summary}</ReactMarkdown>
                  </div>
                </Card>
              )}

              {/* Risk heatmap */}
              <RiskHeatmap risks={session.risk_registry} />

              {/* Risk registry table */}
              {session.risk_registry?.length > 0 && (
                <MitigationTable risks={session.risk_registry} />
              )}

              {/* Debate transcript table */}
              {session.rounds?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Debate Transcript</h3>
                  <div className="space-y-4">
                    {session.rounds.map((round, i) => (
                      <DebateRound key={i} round={round} index={i} />
                    ))}
                  </div>
                </div>
              )}

              {/* Attack chains */}
              {session.attack_chains?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Attack / Effect Chains</h3>
                  <ChainDiagram chains={session.attack_chains} />
                </div>
              )}

              {/* Mitigation playbook */}
              {session.mitigation_playbook && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Mitigation Playbook</h3>
                  <MitigationPlaybook playbook={session.mitigation_playbook} />
                </div>
              )}
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