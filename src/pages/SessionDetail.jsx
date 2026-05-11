import React, { useState, useCallback, useEffect } from 'react';
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
import { ArrowLeft, Play, FileDown, Loader2, BookOpen, GitBranch, Trash2, CheckCircle2, Circle, Swords, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import DebateRound, { DebateRoundV2 } from '@/components/session/DebateRound';
import RiskHeatmap from '@/components/session/RiskHeatmap';
import ChainDiagram from '@/components/session/ChainDiagram';
import MitigationTable from '@/components/session/MitigationTable';
import MitigationPlaybook from '@/components/session/MitigationPlaybook';
import DebateRoster from '@/components/session/DebateRoster';
import SynthesisReport from '@/components/session/SynthesisReport';
import ChainBreaker from '@/components/session/ChainBreaker';
import ReactMarkdown from 'react-markdown';
import { buildR1Prompt, buildR2Prompt, buildSynthesisPrompt, parseSeverityFromText, formatOthersAssessments, resolveAgent, extractSynthesisSections, buildChainBreakPrompt } from '@/lib/agentData';
import { asyncPool } from '@/lib/asyncPool';
import { computeSCRS } from '@/lib/scrsEngine';

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

export default function SessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [runningStep, setRunningStep] = useState('');
  const [runningAgents, setRunningAgents] = useState(null);
  const [debateStartTime, setDebateStartTime] = useState(null);
  const [elapsedSecs, setElapsedSecs] = useState(0);

  useEffect(() => {
    if (!debateStartTime) { setElapsedSecs(0); return; }
    const t = setInterval(() => setElapsedSecs(Math.floor((Date.now() - debateStartTime) / 1000)), 1000);
    return () => clearInterval(t);
  }, [debateStartTime]);
  const [phaseTimings, setPhaseTimings] = useState({ r1: null, r2: null, synthesis: null });
  const [phaseStarts, setPhaseStarts] = useState({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [generatingPlaybook, setGeneratingPlaybook] = useState(false);
  const [generatingChainBreaker, setGeneratingChainBreaker] = useState(false);
  const [appliedSteps, setAppliedSteps] = useState(new Set());

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

  const { data: parentSession } = useQuery({
    queryKey: ['session', session?.parent_session_id],
    queryFn: () => base44.entities.Session.get(session.parent_session_id),
    enabled: !!(session?.parent_session_id),
  });

  // ── V2 detection + data derivation ──────────────────────────────────────────
  // executive_summary holds either:
  //   "v2url:<url>"  — URL to uploaded JSON file (large content)
  //   '{"_v2":true…}' — inline JSON (legacy / small sessions)
  const [v2SynthData, setV2SynthData] = useState(null);

  useEffect(() => {
    const es = session?.executive_summary;
    if (!es) { setV2SynthData(null); return; }
    if (es.startsWith('v2url:')) {
      const url = es.slice(6);
      fetch(url)
        .then(r => r.json())
        .then(d => setV2SynthData(d._v2 ? d : null))
        .catch(() => setV2SynthData(null));
    } else if (es.startsWith('{"_v2"')) {
      try { const d = JSON.parse(es); setV2SynthData(d._v2 ? d : null); }
      catch { setV2SynthData(null); }
    } else {
      setV2SynthData(null);
    }
  }, [session?.executive_summary]);

  const isV2 = !!(session?.debate_format === 'v2' || v2SynthData);

  const sessionAgents = v2SynthData?.agent_results || [];

  const sessionSynthesis = v2SynthData ? {
    ...v2SynthData,
    // Prefer compound_chains from CDN JSON (full data); fall back to entity attack_chains
    compound_chains: (v2SynthData.compound_chains?.length
      ? v2SynthData.compound_chains
      : (session?.attack_chains || []).map(c => ({
          name: c.name,
          steps: (c.steps || []).map((s, i) => ({
            step_number: i + 1,
            step_text: s.description || s.label || '',
          })),
        }))
    ),
  } : null;

  const getAgent = useCallback((agentId) => agents.find(a => a.id === agentId), [agents]);

  // ── Chain Break / SCRS simulator ─────────────────────────────────────────────
  const chainBreakData = v2SynthData?.chain_analyses || null;

  const chainAnalysesForScrs = (chainBreakData || []).map(ca => ({
    chain_resilience: (ca.chain_resilience || 'MEDIUM').toUpperCase(),
    steps: (ca.steps || []).map(s => ({ leverage: (s.leverage || 'MEDIUM').toUpperCase() })),
  }));

  const scrsBaseParams = {
    sessionAgents: sessionAgents.map(r => ({
      ...r,
      agent: agents.find(a => a.id === r.agent_id) || {},
    })),
    chainAnalyses: chainAnalysesForScrs,
    appliedCMs: [],
  };

  const appliedCMsList = [...appliedSteps].map(key => {
    const [ci, si] = key.split('-').map(Number);
    return { leverage: (chainBreakData?.[ci]?.steps?.[si]?.leverage || 'MEDIUM').toUpperCase() };
  });

  const projectedResult = chainBreakData && appliedSteps.size > 0
    ? computeSCRS({ ...scrsBaseParams, appliedCMs: appliedCMsList })
    : null;

  const runDebateMutation = useMutation({
    mutationFn: async () => {
      setDebateStartTime(Date.now());
      setRunningStep('Starting analysis...');

      // ── Phase 0: Setup ──────────────────────────────────────────────────────
      await base44.entities.Session.update(id, { status: 'running', debate_format: 'v2' });
      queryClient.invalidateQueries({ queryKey: ['session', id] });

      const eligible = session.selected_agents?.length
        ? agents.filter(a => session.selected_agents.includes(a.id))
        : agents;

      if (!eligible.length) throw new Error('No agents assigned to this session');

      const resolvedAgents = eligible.map(a => resolveAgent(a));

      const scenarioContext = [
        session.scenario,
        session.reference_urls?.length ? `\nReference materials: ${session.reference_urls.join(', ')}` : '',
      ].filter(Boolean).join('');

      // Local working copies — one per agent
      const agentResults = resolvedAgents.map(a => ({
        agent_id: a.id,
        agent_name: a.name || '',
        team: a.team || 'red',
        discipline: a.discipline || '',
        round1_assessment: '',
        round1_severity: '',
        round2_rebuttal: '',
        round2_revised_severity: '',
        status: 'pending',
      }));

      // Initialise UI
      setRunningAgents({
        format: 'v2', phase: 'r1',
        agents: agentResults.map(r => ({ id: r.agent_id, name: r.agent_name, team: r.team, r1Status: 'pending', r2Status: 'pending' })),
      });

      // ── Phase 1: R1 — sequential (base44 InvokeLLM may not support concurrent calls) ──
      setRunningStep('Round 1 — Independent assessments');
      const r1Start = Date.now();
      setPhaseStarts(p => ({ ...p, r1: r1Start }));
      await asyncPool(1, resolvedAgents, async (agent) => {
        setRunningAgents(prev => prev && ({
          ...prev,
          agents: prev.agents.map(a => a.id === agent.id ? { ...a, r1Status: 'running' } : a),
        }));

        let rawR1;
        try {
          rawR1 = await base44.integrations.Core.InvokeLLM({ prompt: buildR1Prompt(agent, scenarioContext) });
        } catch (e) {
          console.error(`[V2 R1] agent ${agent.name} failed:`, e);
          rawR1 = `Assessment unavailable (LLM error).\nSEVERITY: HIGH`;
        }
        const { assessment, severity } = parseSeverityFromText(typeof rawR1 === 'string' ? rawR1 : String(rawR1));

        const idx = agentResults.findIndex(r => r.agent_id === agent.id);
        if (idx >= 0) {
          agentResults[idx].round1_assessment = assessment;
          agentResults[idx].round1_severity = severity;
          agentResults[idx].status = 'r1_done';
        }
        setRunningAgents(prev => prev && ({
          ...prev,
          agents: prev.agents.map(a => a.id === agent.id ? { ...a, r1Status: 'done' } : a),
        }));
      });

      const fmtDur = (ms) => ms >= 60000 ? `${Math.floor(ms/60000)}m ${Math.round((ms%60000)/1000)}s` : `${Math.round(ms/1000)}s`;
      setPhaseTimings(p => ({ ...p, r1: fmtDur(Date.now() - r1Start) }));

      // ── Phase 2: R2 — all agents in parallel ───────────────────────────────
      setRunningStep('Round 2 — Rebuttals');
      setRunningAgents(prev => prev && ({ ...prev, phase: 'r2' }));

      await asyncPool(1, resolvedAgents, async (agent) => {
        setRunningAgents(prev => prev && ({
          ...prev,
          agents: prev.agents.map(a => a.id === agent.id ? { ...a, r2Status: 'running' } : a),
        }));

        const othersText = formatOthersAssessments(agentResults, agent.id);
        let rawR2;
        try {
          rawR2 = await base44.integrations.Core.InvokeLLM({ prompt: buildR2Prompt(agent, scenarioContext, othersText) });
        } catch (e) {
          console.error(`[V2 R2] agent ${agent.name} failed:`, e);
          rawR2 = `Rebuttal unavailable (LLM error).\nSEVERITY: HIGH`;
        }
        const { assessment, severity } = parseSeverityFromText(typeof rawR2 === 'string' ? rawR2 : String(rawR2));

        const idx = agentResults.findIndex(r => r.agent_id === agent.id);
        if (idx >= 0) {
          agentResults[idx].round2_rebuttal = assessment;
          agentResults[idx].round2_revised_severity = severity;
          agentResults[idx].status = 'complete';
        }
        setRunningAgents(prev => prev && ({
          ...prev,
          agents: prev.agents.map(a => a.id === agent.id ? { ...a, r2Status: 'done' } : a),
        }));
      });

      const r2Start = Date.now();
      setPhaseTimings(p => ({ ...p, r2: fmtDur(r2Start - r1Start) }));

      // ── Phase 3: Synthesis ─────────────────────────────────────────────────
      setRunningStep('Generating synthesis...');
      setRunningAgents(prev => prev && ({ ...prev, phase: 'synthesis' }));

      let synthRaw;
      try {
        synthRaw = await base44.integrations.Core.InvokeLLM({
          prompt: buildSynthesisPrompt(session, agentResults, scenarioContext),
        });
      } catch (e) {
        console.error('[V2 synthesis] LLM call failed:', e);
        synthRaw = '## CONSENSUS FINDINGS\nSynthesis unavailable.\n## CONTESTED FINDINGS\n—\n## COMPOUND CHAINS\n### Chain 1\nStep 1: Analysis pending\n## BLIND SPOTS\n—\n## PRIORITY MITIGATIONS\n1. IMMEDIATE: Review agent assessments manually.\n## SHARPEST INSIGHTS\n—';
      }

      const rawText = typeof synthRaw === 'string' ? synthRaw : String(synthRaw);
      const sections = extractSynthesisSections(rawText);

      // SCRS — wrap each result with .agent for expertise_level lookup
      const scrsAgents = agentResults.map(r => ({
        ...r,
        agent: resolvedAgents.find(a => a.id === r.agent_id) || {},
      }));
      const chainAnalyses = (sections.compound_chains || []).map(() => ({ chain_resilience: 'MEDIUM', steps: [] }));
      const { scrs, breakdown } = computeSCRS({ sessionAgents: scrsAgents, chainAnalyses, appliedCMs: [] });

      // Compound chains → attack_chains (V1 field, V1-compatible shape)
      const attackChains = (sections.compound_chains || []).map((c, i) => ({
        id: `chain-${i + 1}`,
        name: c.name || `Chain ${i + 1}`,
        steps: (c.steps || []).map(s => ({
          label: `Step ${s.step_number}`,
          description: s.step_text || '',
          type: 'attack',
        })),
      }));

      // Upload V2 data as JSON file (executive_summary has a size limit)
      const v2Payload = JSON.stringify({
        _v2: true,
        agent_results: agentResults,
        compound_chains: sections.compound_chains || [],
        consensus_findings: sections.consensus_findings || '',
        contested_findings: sections.contested_findings || '',
        blind_spots: sections.blind_spots || '',
        priority_mitigations:  sections.priority_mitigations  || '',
        sharpest_insights:     sections.sharpest_insights     || '',
        key_uncertainties:     sections.key_uncertainties     || '',
        escalation_indicators: sections.escalation_indicators || '',
        scrs_score: scrs,
        scrs_breakdown: breakdown,
      });
      const jsonFile = new File([v2Payload], `v2-${id}.json`, { type: 'application/json' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file: jsonFile });

      await base44.entities.Session.update(id, {
        status: 'completed',
        executive_summary: `v2url:${file_url}`,
        attack_chains: attackChains,
        scrs_score: scrs,
      });

      queryClient.invalidateQueries({ queryKey: ['session', id] });
      setPhaseTimings(p => ({ ...p, synthesis: fmtDur(Date.now() - r2Start) }));
      setRunningStep('');
      setRunningAgents(null);
      setDebateStartTime(null);
    },
    onError: async (err) => {
      console.error('[V2 debate] session failed:', err);
      await base44.entities.Session.update(id, { status: 'failed' });
      queryClient.invalidateQueries({ queryKey: ['session', id] });
      setRunningStep('');
      setRunningAgents(null);
      setDebateStartTime(null);
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

  const handleGenerateChainBreaker = async () => {
    setGeneratingChainBreaker(true);
    try {
      const chains = sessionSynthesis?.compound_chains || [];
      const { prompt, response_json_schema } = buildChainBreakPrompt(chains, session.scenario || '');
      const result = await base44.integrations.Core.InvokeLLM({ prompt, response_json_schema });

      // Fetch existing V2 JSON, merge chain_analyses in, re-upload
      const currentUrl = session.executive_summary?.startsWith('v2url:')
        ? session.executive_summary.slice(6) : null;
      let existing = {};
      if (currentUrl) {
        try { existing = await fetch(currentUrl).then(r => r.json()); } catch {}
      }
      const updated = { ...existing, chain_analyses: result?.chain_analyses || [] };
      const jsonFile = new File([JSON.stringify(updated)], `v2-${id}.json`, { type: 'application/json' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file: jsonFile });
      await base44.entities.Session.update(id, { executive_summary: `v2url:${file_url}` });
      queryClient.invalidateQueries({ queryKey: ['session', id] });
      setAppliedSteps(new Set());
    } finally {
      setGeneratingChainBreaker(false);
    }
  };

  const handleExportPDFV2 = async () => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const PAGE_W = 210, PAGE_H = 297, ML = 18, MR = 18;
    const CONTENT_W = PAGE_W - ML - MR;
    const MARGIN_TOP = 18, MARGIN_BOTTOM = 22;
    let y = MARGIN_TOP;

    // ── Core helpers ──────────────────────────────────────────────
    const checkPage = (needed = 10) => {
      if (y + needed > PAGE_H - MARGIN_BOTTOM) { doc.addPage(); y = MARGIN_TOP; }
    };
    const cleanMd = (t = '') => t.replace(/[*_#`>]/g, '').replace(/\n{3,}/g, '\n\n').trim();

    const SEV_COLORS = { CRITICAL: [220,38,38], HIGH: [234,88,12], MEDIUM: [202,138,4], LOW: [22,163,74] };
    const sevColor = (s) => SEV_COLORS[s] || [120,120,120];
    const scrsColor = (n) => n >= 80 ? [220,38,38] : n >= 60 ? [234,88,12] : n >= 40 ? [202,138,4] : [22,163,74];
    const scrsLabel = (n) => n >= 80 ? 'CRITICAL' : n >= 60 ? 'HIGH' : n >= 40 ? 'MEDIUM' : 'LOW';

    const sectionHeader = (title) => {
      checkPage(18); y += 5;
      doc.setFillColor(22, 78, 162);
      doc.roundedRect(ML, y - 5.5, CONTENT_W, 10, 2, 2, 'F');
      doc.setFontSize(10); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
      doc.text(title.toUpperCase(), ML + 4, y + 0.5); y += 10;
    };
    const subHeader = (title) => {
      checkPage(12); y += 3;
      doc.setFontSize(9); doc.setTextColor(22, 78, 162); doc.setFont('helvetica', 'bold');
      doc.text(title, ML, y); y += 5;
    };
    const bodyText = (text, indent = 0, maxW = null) => {
      doc.setFontSize(8); doc.setTextColor(50, 50, 50); doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(cleanMd(text), (maxW ?? CONTENT_W) - indent);
      lines.forEach(ln => { checkPage(5); doc.text(ln, ML + indent, y); y += 4.5; });
    };
    const label = (text, x, yy, size = 7, color = [120,120,120], bold = false) => {
      doc.setFontSize(size); doc.setTextColor(...color); doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.text(text, x, yy);
    };

    // ── Table helpers ─────────────────────────────────────────────
    const drawTableHeader = (cols, colWidths, startX = ML) => {
      const rowH = 7;
      doc.setFillColor(22, 78, 162);
      doc.rect(startX, y, colWidths.reduce((a,b)=>a+b,0), rowH, 'F');
      doc.setFontSize(7.5); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold');
      let cx = startX;
      cols.forEach((col, i) => {
        doc.text(col, cx + 2.5, y + 4.8);
        cx += colWidths[i];
      });
      y += rowH;
    };
    const drawTableRow = (cells, colWidths, opts = {}) => {
      const { rowH = 7, altBg = false, cellColors = [] } = opts;
      const startX = ML;
      const totalW = colWidths.reduce((a,b)=>a+b,0);
      if (altBg) { doc.setFillColor(248,250,255); doc.rect(startX, y, totalW, rowH, 'F'); }
      doc.setDrawColor(220,225,230); doc.setLineWidth(0.2);
      doc.rect(startX, y, totalW, rowH, 'S');
      doc.setFontSize(7.5); doc.setFont('helvetica','normal');
      let cx = startX;
      cells.forEach((cell, i) => {
        const cw = colWidths[i];
        if (cellColors[i]) { doc.setTextColor(...cellColors[i]); doc.setFont('helvetica','bold'); }
        else { doc.setTextColor(50,50,50); doc.setFont('helvetica','normal'); }
        const txt = doc.splitTextToSize(String(cell ?? ''), cw - 4);
        doc.text(txt[0] ?? '', cx + 2.5, y + 4.8);
        cx += cw;
      });
      y += rowH;
    };

    // ── Gauge bar ─────────────────────────────────────────────────
    const drawGaugeBar = (score, bx, by, bw, bh = 7) => {
      const bands = [
        { pct: 0.40, color: [22,163,74],  label: 'LOW' },
        { pct: 0.20, color: [202,138,4],  label: 'MED' },
        { pct: 0.20, color: [234,88,12],  label: 'HIGH' },
        { pct: 0.20, color: [220,38,38],  label: 'CRIT' },
      ];
      let bxCur = bx;
      bands.forEach(({ pct, color, label: bl }) => {
        const sw = bw * pct;
        doc.setFillColor(...color); doc.rect(bxCur, by, sw, bh, 'F');
        doc.setFontSize(6); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold');
        if (sw > 12) doc.text(bl, bxCur + sw / 2 - doc.getTextWidth(bl) / 2, by + bh - 1.8);
        bxCur += sw;
      });
      // Marker (downward-pointing triangle) at score position
      const mx = bx + (score / 100) * bw;
      doc.setFillColor(30,30,30);
      doc.lines([[4,0],[-2,3],[-2,-3]], mx - 2, by - 1, [1,1], 'F', true);
      // Score label
      const sc = scrsColor(score);
      doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(...sc);
      const scoreStr = String(score);
      const scoreW = doc.getTextWidth(scoreStr);
      const labelX = Math.min(Math.max(mx - scoreW / 2, bx), bx + bw - scoreW);
      doc.text(scoreStr, labelX, by - 3);
      doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(...sc);
      doc.text(scrsLabel(score), labelX + scoreW + 1.5, by - 3);
    };

    // ── Severity bar ──────────────────────────────────────────────
    const drawSevBar = (counts, bx, by, bw, bh = 5) => {
      const order = ['CRITICAL','HIGH','MEDIUM','LOW'];
      const total = order.reduce((s,k) => s + (counts[k] || 0), 0);
      if (total === 0) return;
      let bxCur = bx;
      order.forEach(k => {
        if (!counts[k]) return;
        const sw = bw * (counts[k] / total);
        doc.setFillColor(...SEV_COLORS[k]); doc.rect(bxCur, by, sw, bh, 'F');
        bxCur += sw;
      });
      // Legend
      let lx = bx;
      doc.setFontSize(6.5); doc.setFont('helvetica','normal');
      order.filter(k => counts[k]).forEach(k => {
        doc.setFillColor(...SEV_COLORS[k]); doc.rect(lx, by + bh + 2, 3, 3, 'F');
        doc.setTextColor(60,60,60);
        doc.text(`${k[0]}${k.slice(1).toLowerCase()} (${counts[k]})`, lx + 4.5, by + bh + 4.5);
        lx += doc.getTextWidth(`${k[0]}${k.slice(1).toLowerCase()} (${counts[k]})`) + 9;
      });
    };

    // ── Chain step diagram ────────────────────────────────────────
    const drawChainSteps = (steps, bx, bw) => {
      const circleR = 3.5, circleX = bx + circleR + 1;
      steps.forEach((step, i) => {
        const isLast = i === steps.length - 1;
        checkPage(14);
        // Circle
        doc.setFillColor(22, 78, 162); doc.circle(circleX, y + circleR, circleR, 'F');
        doc.setFontSize(7); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold');
        const num = String(step.step_number || i + 1);
        doc.text(num, circleX - doc.getTextWidth(num) / 2, y + circleR + 2.2);
        // Step text
        doc.setFontSize(8); doc.setTextColor(50,50,50); doc.setFont('helvetica','normal');
        const textX = bx + circleR * 2 + 5;
        const lines = doc.splitTextToSize(step.step_text || '', bw - circleR * 2 - 6);
        lines.forEach((ln, li) => doc.text(ln, textX, y + circleR + (li === 0 ? 2 : 0) + li * 4.5));
        const stepH = Math.max(circleR * 2 + 2, lines.length * 4.5 + 3);
        // Connector line
        if (!isLast) {
          doc.setDrawColor(180,190,210); doc.setLineWidth(0.5);
          doc.line(circleX, y + circleR * 2 + 1, circleX, y + stepH + 1);
        }
        y += stepH + 2;
      });
    };

    // ── Extract bullet lines from synthesis text ──────────────────
    const extractBullets = (text = '', max = 3) => {
      const lines = cleanMd(text).split('\n').map(l => l.trim()).filter(Boolean);
      const bullets = lines.filter(l => /^[-•\d]/.test(l)).slice(0, max);
      return bullets.length ? bullets : lines.slice(0, max);
    };

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

    const synth = sessionSynthesis;
    const scrs = synth?.scrs_score ?? null;
    const breakdown = v2SynthData?.scrs_breakdown ?? null;

    // ── Page 1: Cover ─────────────────────────────────────────────
    doc.setFillColor(15, 35, 70); doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
    doc.setFillColor(22, 78, 162); doc.rect(0, 90, PAGE_W, 5, 'F');
    // Wordmark
    doc.setFontSize(8); doc.setTextColor(150, 190, 255); doc.setFont('helvetica', 'normal');
    doc.text('SURFACE  ·  ADVERSARIAL RISK INTELLIGENCE', ML, 30);
    // Title
    y = 42;
    doc.setFontSize(22); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
    doc.splitTextToSize(session.title, CONTENT_W).forEach(line => { doc.text(line, ML, y); y += 10; });
    // Subtitle
    doc.setFontSize(10); doc.setTextColor(180, 210, 255); doc.setFont('helvetica', 'normal');
    doc.text('V2 Parallel Debate Report', ML, 88);
    // Metadata row
    const dateStr = session.created_date ? new Date(session.created_date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '';
    const metaItems = [
      dateStr,
      session.mode ? session.mode.charAt(0).toUpperCase() + session.mode.slice(1) + ' mode' : '',
      `${sessionAgents.length} agent${sessionAgents.length !== 1 ? 's' : ''}`,
      `${sessionSynthesis?.compound_chains?.length ?? 0} compound chain${(sessionSynthesis?.compound_chains?.length ?? 0) !== 1 ? 's' : ''}`,
    ].filter(Boolean);
    doc.setFontSize(8); doc.setTextColor(150, 190, 255); doc.setFont('helvetica', 'normal');
    doc.text(metaItems.join('  ·  '), ML, 100);
    // SCRS block
    if (scrs != null) {
      const sc = scrsColor(scrs);
      doc.setFillColor(20, 48, 100); doc.roundedRect(ML, 115, 80, 38, 3, 3, 'F');
      doc.setFontSize(7); doc.setTextColor(150, 190, 255); doc.setFont('helvetica', 'normal');
      doc.text('SYSTEMIC CRITICAL RISK SCORE', ML + 4, 122);
      doc.setFontSize(32); doc.setFont('helvetica', 'bold'); doc.setTextColor(...sc);
      doc.text(String(scrs), ML + 4, 138);
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...sc);
      doc.text(scrsLabel(scrs), ML + 4 + doc.getTextWidth(String(scrs)) + 3, 138);
      // Mini gauge on cover
      drawGaugeBar(scrs, ML + 4, 143, 68, 5);
    }
    doc.addPage(); y = MARGIN_TOP;

    // ── Page 2: Executive Summary ─────────────────────────────────
    sectionHeader('Executive Summary');
    y += 2;

    // SCRS gauge + breakdown (left ~100mm)
    if (scrs != null) {
      const sc = scrsColor(scrs);
      // Gauge bar
      label('RISK POSTURE', ML, y, 7, [100,100,120], true); y += 4;
      drawGaugeBar(scrs, ML, y, 100, 7); y += 15;
      // Band reference chips
      [['LOW','0–39',[22,163,74]],['MEDIUM','40–59',[202,138,4]],['HIGH','60–79',[234,88,12]],['CRITICAL','80–100',[220,38,38]]].forEach(([bl, br, bc], i) => {
        const chipX = ML + i * 27;
        doc.setFillColor(...bc.map(v => Math.min(255, v + 160))); doc.roundedRect(chipX, y, 24, 5, 1, 1, 'F');
        doc.setFontSize(6); doc.setTextColor(...bc); doc.setFont('helvetica','bold');
        doc.text(bl, chipX + 2, y + 3.5);
        doc.setFont('helvetica','normal'); doc.setTextColor(80,80,80);
        doc.text(br, chipX + 2, y + 8);
      });
      y += 14;

      // Breakdown table
      if (breakdown) {
        label('SCORE BREAKDOWN', ML, y, 7, [100,100,120], true); y += 4;
        const bRows = [
          ['Base score (severity × expertise)', String(Math.round(breakdown.baseScore ?? 0))],
          ['Resilience modifier (compound chains)', String(Math.round(breakdown.resilienceModifier ?? 0))],
          ['Countermeasure modifier', String(Math.round(breakdown.countermeasureModifier ?? 0))],
          ['Final SCRS', String(scrs)],
        ];
        drawTableHeader(['Component', 'Points'], [130, 24]);
        bRows.forEach((row, i) => {
          const isFinal = i === bRows.length - 1;
          drawTableRow(row, [130, 24], {
            altBg: i % 2 === 0,
            cellColors: isFinal ? [null, sc] : [],
          });
        });
        y += 3;
      }
    }

    // Severity distribution bar
    {
      const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
      sessionAgents.forEach(r => {
        const s = r.round2_revised_severity || r.round1_severity;
        if (s && counts[s] !== undefined) counts[s]++;
      });
      const total = Object.values(counts).reduce((a,b)=>a+b,0);
      if (total > 0) {
        checkPage(22);
        label('AGENT SEVERITY DISTRIBUTION', ML, y, 7, [100,100,120], true); y += 4;
        drawSevBar(counts, ML, y, CONTENT_W, 6); y += 18;
      }
    }

    // Key findings + priority actions columns (right side of page, back-filled)
    if (synth) {
      const colX = ML + 106, colW = CONTENT_W - 106;
      let savedY = y;
      // We'll write these in a second pass after the left column by tracking page state
      // Instead, write them sequentially after left-column content
      checkPage(20);
      label('KEY FINDINGS', ML, y, 7, [100,100,120], true); y += 4;
      extractBullets(synth.consensus_findings, 3).forEach(b => {
        checkPage(10);
        doc.setFillColor(22, 78, 162); doc.rect(ML, y - 2.5, 2, 3.5, 'F');
        doc.setFontSize(8); doc.setTextColor(40,40,40); doc.setFont('helvetica','normal');
        const lines = doc.splitTextToSize(b.replace(/^[-•\d.]+\s*/, ''), CONTENT_W - 6);
        lines.forEach((ln, li) => { if (li > 0) checkPage(5); doc.text(ln, ML + 5, y + li * 4.5); });
        y += lines.length * 4.5 + 2;
      });
      y += 2;
      label('PRIORITY ACTIONS', ML, y, 7, [100,100,120], true); y += 4;
      extractBullets(synth.priority_mitigations, 3).forEach((b, bi) => {
        checkPage(10);
        doc.setFillColor(...(bi === 0 ? [220,38,38] : bi === 1 ? [234,88,12] : [202,138,4]));
        doc.roundedRect(ML, y - 2.5, 3, 4, 0.5, 0.5, 'F');
        doc.setFontSize(8); doc.setTextColor(40,40,40); doc.setFont('helvetica','normal');
        const lines = doc.splitTextToSize(b.replace(/^[-•\d.]+\s*/, ''), CONTENT_W - 6);
        lines.forEach((ln, li) => { if (li > 0) checkPage(5); doc.text(ln, ML + 6, y + li * 4.5); });
        y += lines.length * 4.5 + 2;
      });
    }
    y += 4;

    // ── Page 3: Agent Roster ──────────────────────────────────────
    checkPage(40);
    sectionHeader('Agent Roster');
    const rosterCols = ['Name', 'Team', 'Discipline', 'R1 Severity', 'R2 Severity'];
    const rosterWidths = [42, 20, 48, 32, 32];
    drawTableHeader(rosterCols, rosterWidths);
    sessionAgents.forEach((sa, i) => {
      const r1c = sevColor(sa.round1_severity);
      const r2sev = sa.round2_revised_severity || sa.round1_severity;
      const r2c = sevColor(r2sev);
      const teamColor = sa.team === 'red' ? [220,38,38] : [37,99,235];
      const shift = sa.round2_revised_severity && sa.round2_revised_severity !== sa.round1_severity
        ? (sa.round2_revised_severity === 'CRITICAL' || sa.round2_revised_severity === 'HIGH' ? ' ↑' : ' ↓') : '';
      drawTableRow(
        [sa.agent_name || sa.agent_id, (sa.team || '').toUpperCase(), sa.discipline || '—', sa.round1_severity || '—', (r2sev || '—') + shift],
        rosterWidths,
        { altBg: i % 2 === 0, cellColors: [null, teamColor, null, r1c, r2c] }
      );
    });
    y += 4;

    // ── Pages 4+: Scenario ────────────────────────────────────────
    sectionHeader('Scenario');
    bodyText(session.scenario);
    y += 3;

    // ── Agent Debate ──────────────────────────────────────────────
    if (sessionAgents.length > 0) {
      sectionHeader('Round 1 — Independent Assessments');
      sessionAgents.forEach(sa => {
        checkPage(28);
        const teamColor = sa.team === 'red' ? [220,38,38] : [37,99,235];
        const sc = sevColor(sa.round1_severity);
        // Left border strip
        const agentStartY = y;
        // Agent name header
        y += 2;
        doc.setFillColor(...teamColor.map(v => Math.min(255, v + 185)));
        doc.roundedRect(ML, y - 2, CONTENT_W, 8, 1, 1, 'F');
        doc.setFontSize(8.5); doc.setFont('helvetica','bold'); doc.setTextColor(...teamColor);
        doc.text(sa.agent_name || sa.agent_id, ML + 3, y + 3.5);
        // Team + severity chips
        const teamLabel = (sa.team || '').toUpperCase();
        const chipX = PAGE_W - MR - 38;
        doc.setFontSize(7); doc.setFont('helvetica','bold');
        doc.setTextColor(...teamColor);
        doc.text(teamLabel, chipX, y + 3.5);
        if (sa.round1_severity) {
          doc.setTextColor(...sc);
          doc.text(sa.round1_severity, chipX + 18, y + 3.5);
        }
        y += 10;
        if (sa.round1_assessment) bodyText(sa.round1_assessment, 3);
        // Left border
        doc.setFillColor(...teamColor); doc.rect(ML, agentStartY + 2, 1.5, y - agentStartY - 2, 'F');
        y += 4;
      });

      sectionHeader('Round 2 — Rebuttals');
      sessionAgents.filter(sa => sa.round2_rebuttal).forEach(sa => {
        checkPage(28);
        const teamColor = sa.team === 'red' ? [220,38,38] : [37,99,235];
        const r2sev = sa.round2_revised_severity || sa.round1_severity;
        const sc = sevColor(r2sev);
        const shift = sa.round2_revised_severity && sa.round2_revised_severity !== sa.round1_severity
          ? ` → ${sa.round2_revised_severity}` : '';
        const agentStartY = y;
        y += 2;
        doc.setFillColor(...teamColor.map(v => Math.min(255, v + 185)));
        doc.roundedRect(ML, y - 2, CONTENT_W, 8, 1, 1, 'F');
        doc.setFontSize(8.5); doc.setFont('helvetica','bold'); doc.setTextColor(...teamColor);
        doc.text(sa.agent_name || sa.agent_id, ML + 3, y + 3.5);
        if (shift) {
          doc.setFontSize(7); doc.setTextColor(...sc);
          doc.text(`Severity revised${shift}`, PAGE_W - MR - 46, y + 3.5);
        }
        y += 10;
        bodyText(sa.round2_rebuttal, 3);
        doc.setFillColor(...teamColor); doc.rect(ML, agentStartY + 2, 1.5, y - agentStartY - 2, 'F');
        y += 4;
      });
    }

    // ── Synthesis Sections ────────────────────────────────────────
    if (synth) {
      if (synth.consensus_findings) { sectionHeader('Consensus Findings'); bodyText(synth.consensus_findings); y += 2; }
      if (synth.contested_findings) { sectionHeader('Contested Findings'); bodyText(synth.contested_findings); y += 2; }
      if (synth.blind_spots) { sectionHeader('Blind Spots'); bodyText(synth.blind_spots); y += 2; }
      if (synth.priority_mitigations) { sectionHeader('Priority Mitigations'); bodyText(synth.priority_mitigations); y += 2; }
      if (synth.sharpest_insights)     { sectionHeader('Sharpest Insights');     bodyText(synth.sharpest_insights);     y += 2; }
      if (synth.key_uncertainties)     { sectionHeader('Key Uncertainties');     bodyText(synth.key_uncertainties);     y += 2; }
      if (synth.escalation_indicators) { sectionHeader('Escalation Indicators'); bodyText(synth.escalation_indicators); y += 2; }

      // Compound chains as step diagrams
      if (synth.compound_chains?.length > 0) {
        sectionHeader('Compound Threat Chains');
        synth.compound_chains.forEach((chain, ci) => {
          checkPage(24);
          subHeader(`Chain ${ci + 1}: ${chain.name || `Unnamed Chain ${ci + 1}`}`);
          if (chain.steps?.length) drawChainSteps(chain.steps, ML + 4, CONTENT_W - 8);
          y += 4;
        });
      }
    }

    // ── Chain Break Analysis ──────────────────────────────────────
    if (chainBreakData?.length > 0) {
      sectionHeader('Chain Break Analysis');
      const RES_COLORS = { HIGH: [220,38,38], MEDIUM: [202,138,4], LOW: [22,163,74] };
      const LEV_COLORS = { HIGH: [220,38,38], MEDIUM: [202,138,4], LOW: [22,163,74] };
      chainBreakData.forEach((ca, ci) => {
        checkPage(30);
        const chainChain = synth?.compound_chains?.[ci];
        const resilience = (ca.chain_resilience || 'MEDIUM').toUpperCase();
        const rc = RES_COLORS[resilience] || [120,120,120];
        // Chain name + resilience badge
        y += 2;
        doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(22, 78, 162);
        doc.text(`${chainChain?.name || ca.chain_name || `Chain ${ci + 1}`}`, ML, y);
        // Resilience badge (right-aligned)
        const badgeLabel = `${resilience} RESILIENCE`;
        const badgeW = doc.getTextWidth(badgeLabel) + 6;
        doc.setFillColor(...rc.map(v => Math.min(255, v + 170))); doc.roundedRect(PAGE_W - MR - badgeW, y - 4, badgeW, 6, 1, 1, 'F');
        doc.setFontSize(7); doc.setTextColor(...rc); doc.setFont('helvetica','bold');
        doc.text(badgeLabel, PAGE_W - MR - badgeW + 3, y - 0.5);
        y += 4;
        if (ca.resilience_rationale) { doc.setFontSize(7.5); doc.setTextColor(90,90,90); doc.setFont('helvetica','normal'); bodyText(ca.resilience_rationale); }
        y += 2;
        // Steps with mitigations
        (ca.steps || []).forEach(caStep => {
          checkPage(22);
          const srcStep = chainChain?.steps?.find(s => s.step_number === caStep.step_number);
          const leverage = (caStep.leverage || 'MEDIUM').toUpperCase();
          const lc = LEV_COLORS[leverage] || [120,120,120];
          // Step number + text
          doc.setFillColor(22, 78, 162); doc.circle(ML + 3.5, y + 3.5, 3.5, 'F');
          doc.setFontSize(7); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold');
          const sn = String(caStep.step_number);
          doc.text(sn, ML + 3.5 - doc.getTextWidth(sn)/2, y + 5.5);
          if (srcStep?.step_text) {
            doc.setFontSize(8); doc.setTextColor(50,50,50); doc.setFont('helvetica','normal');
            const stLines = doc.splitTextToSize(srcStep.step_text, CONTENT_W - 12);
            stLines.forEach((ln, li) => doc.text(ln, ML + 10, y + 3 + li * 4.5));
            y += stLines.length * 4.5 + 4;
          } else { y += 9; }
          // Mitigation card (light background)
          const cardH = 18 + (caStep.mitigation_description ? 8 : 0);
          checkPage(cardH);
          doc.setFillColor(248,250,255); doc.roundedRect(ML + 8, y, CONTENT_W - 10, cardH, 1.5, 1.5, 'F');
          doc.setDrawColor(...lc); doc.setLineWidth(0.4); doc.line(ML + 8, y, ML + 8, y + cardH);
          // Leverage badge
          doc.setFillColor(...lc.map(v => Math.min(255, v + 170))); doc.roundedRect(ML + 11, y + 2, 22, 4.5, 0.8, 0.8, 'F');
          doc.setFontSize(6); doc.setTextColor(...lc); doc.setFont('helvetica','bold');
          doc.text(`${leverage} LEVERAGE`, ML + 13, y + 5.2);
          // Mitigation title
          doc.setFontSize(8); doc.setTextColor(30,30,30); doc.setFont('helvetica','bold');
          doc.text(caStep.mitigation_title || '', ML + 36, y + 5.5);
          if (caStep.mitigation_description) {
            doc.setFontSize(7.5); doc.setTextColor(70,70,70); doc.setFont('helvetica','normal');
            const descLines = doc.splitTextToSize(caStep.mitigation_description, CONTENT_W - 22);
            descLines.slice(0,2).forEach((ln, li) => doc.text(ln, ML + 11, y + 12 + li * 4.5));
          }
          // Owner · timeline footer
          const footer = [caStep.mitigation_owner, caStep.mitigation_timeline].filter(Boolean).join(' · ');
          if (footer) {
            doc.setFontSize(7); doc.setTextColor(120,120,120); doc.setFont('helvetica','normal');
            doc.text(footer, ML + 11, y + cardH - 2);
          }
          y += cardH + 4;
        });
        y += 4;
      });
    }

    addFooter();
    doc.save(`surface-v2-${session.title.replace(/\s+/g, '-').toLowerCase()}.pdf`);
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

  // ── Derived header values ─────────────────────────────────────────────────
  const scrsScore = v2SynthData?.scrs_score ?? null;
  const scrsLabel = scrsScore == null ? '' : scrsScore >= 80 ? 'CRITICAL' : scrsScore >= 60 ? 'HIGH' : scrsScore >= 40 ? 'MEDIUM' : 'LOW';
  const scrsColor = scrsScore == null ? '' : scrsScore >= 80 ? '#dc2626' : scrsScore >= 60 ? '#ea580c' : scrsScore >= 40 ? '#ca8a04' : '#16a34a';
  const sevShiftsUp = sessionAgents.filter(r => {
    const sev = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    return r.round2_revised_severity && r.round1_severity &&
      (sev[r.round2_revised_severity] || 0) > (sev[r.round1_severity] || 0);
  }).length;
  const sevShiftsDown = sessionAgents.filter(r => {
    const sev = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    return r.round2_revised_severity && r.round1_severity &&
      (sev[r.round2_revised_severity] || 0) < (sev[r.round1_severity] || 0);
  }).length;
  const chainCount = sessionSynthesis?.compound_chains?.length ?? session.attack_chains?.length ?? 0;
  const sessionAgentCount = session.selected_agents?.length || agents.length;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header — V2 hierarchy design */}
      <div className="space-y-4">
        {/* Breadcrumb */}
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to dashboard
        </Link>

        {/* Metadata line */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono uppercase tracking-wider">Session</span>
          {session.mode && (
            <><span>·</span><span className="capitalize">{session.mode}</span></>
          )}
          {sessionAgentCount > 0 && (
            <><span>·</span><span>{sessionAgentCount} agent{sessionAgentCount !== 1 ? 's' : ''}</span></>
          )}
          {session.parent_session_id && (
            <>
              <span>·</span>
              <GitBranch className="w-3 h-3" />
              <span>Re-run of</span>
              <Link
                to={`/sessions/${session.parent_session_id}`}
                className="underline underline-offset-2 hover:text-foreground"
              >
                {session.parent_session_title || 'original session'}
              </Link>
            </>
          )}
        </div>

        {/* Title + SCRS card */}
        <div className="flex items-start gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-[26px] font-bold tracking-tight leading-tight">{session.title}</h1>
              <Badge variant="outline" className={cn("text-xs", config.className)}>
                {session.status === 'running' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                {config.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{session.scenario}</p>

            {/* Severity distribution bar */}
            {isV2 && session.status === 'completed' && sessionAgents.length > 0 && (() => {
              const SEV_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
              const SEV_COLORS = { CRITICAL: '#dc2626', HIGH: '#ea580c', MEDIUM: '#ca8a04', LOW: '#16a34a' };
              const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
              sessionAgents.forEach(r => {
                const s = r.round2_revised_severity || r.round1_severity;
                if (s && counts[s] !== undefined) counts[s]++;
              });
              const total = Object.values(counts).reduce((a, b) => a + b, 0);
              if (total === 0) return null;
              return (
                <div className="mt-4 max-w-2xl">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      Severity distribution · {total} agent{total !== 1 ? 's' : ''}
                    </span>
                    {sevShiftsUp > 0 && (
                      <span className="text-[10px] text-red-600 font-semibold">
                        {sevShiftsUp} ↑ &nbsp; {sevShiftsDown} ↓ severity shifts
                      </span>
                    )}
                  </div>
                  <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                    {SEV_ORDER.filter(s => counts[s] > 0).map(s => (
                      <div key={s} style={{ width: `${(counts[s] / total) * 100}%`, background: SEV_COLORS[s] }} title={`${s}: ${counts[s]}`} />
                    ))}
                  </div>
                  <div className="flex items-center gap-4 mt-1.5">
                    {SEV_ORDER.filter(s => counts[s] > 0).map(s => (
                      <div key={s} className="flex items-center gap-1.5 text-[11px]">
                        <span className="w-2 h-2 rounded-sm" style={{ background: SEV_COLORS[s] }} />
                        <span className="text-muted-foreground capitalize">{s.toLowerCase()}</span>
                        <span className="font-semibold tabular-nums">{counts[s]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* SCRS hero card — completed V2 sessions only */}
          {isV2 && session.status === 'completed' && scrsScore != null && (
            <div className="shrink-0 rounded-xl border border-border bg-card px-5 py-4 flex items-center gap-5 shadow-sm">
              {/* Gauge ring */}
              <div className="relative" style={{ width: 72, height: 72 }}>
                <div
                  className="rounded-full"
                  style={{
                    width: 72, height: 72,
                    background: `conic-gradient(${scrsColor} ${scrsScore}%, hsl(var(--muted)) 0)`,
                  }}
                >
                  <div className="absolute inset-1.5 bg-card rounded-full flex flex-col items-center justify-center">
                    <div className="text-base font-bold leading-none tabular-nums" style={{ color: scrsColor }}>{scrsScore}</div>
                    <div className="text-[8px] uppercase tracking-wider text-muted-foreground mt-0.5">scrs</div>
                  </div>
                </div>
              </div>
              <div className="border-l border-border pl-5 space-y-2 leading-tight">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Risk posture</div>
                  <div className="text-sm font-semibold mt-0.5" style={{ color: scrsColor }}>{scrsLabel}</div>
                </div>
                {(sevShiftsUp > 0 || sevShiftsDown > 0) && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Severity shifts</div>
                    <div className="text-sm font-semibold mt-0.5">{sevShiftsUp} ↑ &nbsp; {sevShiftsDown} ↓</div>
                  </div>
                )}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Compound chains</div>
                  <div className="text-sm font-semibold mt-0.5">{chainCount} found</div>
                </div>
              </div>

              {/* Score over re-runs mini bar chart */}
              {parentSession?.scrs_score != null && (
                <div className="w-full mt-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Score over re-runs</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{2} sessions</span>
                  </div>
                  <div className="flex items-end gap-2 h-8">
                    {[
                      { label: session.parent_session_title?.split(' — ')[0] || 'Parent', scrs: parentSession.scrs_score, active: false },
                      { label: 'Current', scrs: scrsScore, active: true },
                    ].map((pt, i) => {
                      const c = pt.scrs >= 80 ? '#dc2626' : pt.scrs >= 60 ? '#ea580c' : pt.scrs >= 40 ? '#ca8a04' : '#16a34a';
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                          <div className="text-[10px] tabular-nums font-semibold" style={{ color: c }}>{pt.scrs}</div>
                          <div className="w-full rounded-t" style={{
                            height: `${pt.scrs * 0.28}px`,
                            background: c,
                            opacity: pt.active ? 1 : 0.4,
                            outline: pt.active ? `2px solid ${c}40` : 'none',
                            minHeight: 4,
                          }} />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-around mt-1">
                    {[session.parent_session_title?.split(' — ')[0] || 'Parent', 'Current'].map((l, i) => (
                      <span key={l} className={cn('text-[10px]', i === 1 ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{l}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions bar */}
        <div className="flex items-center justify-between border-y border-border py-2.5">
          <div className="flex items-center gap-2">
            {session.status === 'draft' && (
              <Button onClick={() => runDebateMutation.mutate()} disabled={runDebateMutation.isPending} className="gap-2">
                {runDebateMutation.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Play className="w-4 h-4" />}
                Run Analysis
              </Button>
            )}
            {session.status === 'completed' && (
              <Button onClick={isV2 ? handleExportPDFV2 : handleExportPDF} className="gap-2">
                <FileDown className="w-4 h-4" /> Export PDF
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
            {/* ··· overflow menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {!isV2 && session.status === 'completed' && !session.mitigation_playbook && (
                  <DropdownMenuItem
                    onClick={handleGeneratePlaybook}
                    disabled={generatingPlaybook}
                    className="gap-2"
                  >
                    <BookOpen className="w-4 h-4" />
                    {generatingPlaybook ? 'Generating playbook…' : 'Generate Playbook'}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={deleteMutation.isPending}
                  className="gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete session
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="text-xs text-muted-foreground font-mono hidden sm:block">
            {session.id?.slice(-8).toUpperCase()}
          </div>
        </div>

        {/* Delete confirmation dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete session?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete <span className="font-medium text-foreground">"{session.title}"</span> and
                all its artifacts. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => { setDeleteDialogOpen(false); deleteMutation.mutate(); }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete session
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Run lineage strip — shown after completion */}
        {session.status === 'completed' && isV2 && (phaseTimings.r1 || phaseTimings.r2 || phaseTimings.synthesis) && (
          <div className="rounded-md border border-border bg-card px-4 py-2.5 flex items-center gap-4 text-xs">
            {[
              ['R1 Assessment', phaseTimings.r1],
              ['R2 Rebuttal',   phaseTimings.r2],
              ['Synthesis',     phaseTimings.synthesis],
            ].map(([label, dur], i, arr) => (
              <React.Fragment key={label}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-team flex-shrink-0" />
                  <span className="font-medium text-foreground">{label}</span>
                  {dur && <span className="text-muted-foreground tabular-nums">{dur}</span>}
                </div>
                {i < arr.length - 1 && <div className="flex-1 h-px bg-green-team/30" />}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Running status */}
      {(runningStep || runningAgents) && (() => {
        const isV2Run    = runningAgents?.format === 'v2';
        const isSynthesis = runningAgents?.phase === 'synthesis' || (!runningAgents && runningStep.startsWith('Generating'));
        const elapsedStr = elapsedSecs >= 60
          ? `${Math.floor(elapsedSecs / 60)}m ${elapsedSecs % 60}s`
          : `${elapsedSecs}s`;

        if (isV2Run) {
          // ── V2 progress UI ─────────────────────────────────────────────────
          const phase     = runningAgents.phase; // 'r1' | 'r2' | 'synthesis'
          const uiAgents  = runningAgents.agents || [];
          const steps = [
            { label: 'R1 Assessment', key: 'r1',       team: 'red'  },
            { label: 'R2 Rebuttal',   key: 'r2',       team: 'blue' },
            { label: 'Synthesis',     key: 'synthesis', team: 'synthesis' },
          ].map(s => ({
            ...s,
            status: phase === s.key ? 'active'
              : (s.key === 'r1' && (phase === 'r2' || phase === 'synthesis')) ? 'done'
              : (s.key === 'r2' && phase === 'synthesis') ? 'done'
              : 'pending',
          }));

          const doneR1 = uiAgents.filter(a => a.r1Status === 'done').length;
          const doneR2 = uiAgents.filter(a => a.r2Status === 'done').length;
          const total  = uiAgents.length || 1;
          const phasePct = phase === 'r1' ? doneR1 / total
            : phase === 'r2' ? doneR2 / total
            : phase === 'synthesis' ? 0.5 : 0;
          const donePhases = steps.filter(s => s.status === 'done').length;
          const pct = Math.min(99, Math.round(((donePhases + phasePct) / steps.length) * 100));

          return (
            <Card className="overflow-hidden border-primary/20">
              <div className="px-5 py-3 bg-primary/5 border-b border-primary/10 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
                  <span className="text-sm font-semibold">{runningStep}</span>
                </div>
                {elapsedSecs > 0 && <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">{elapsedStr}</span>}
              </div>

              {/* Phase pipeline */}
              <div className="px-5 pt-4 pb-1 overflow-x-auto">
                <div className="flex items-center min-w-max">
                  {steps.map((step, i) => {
                    const activeColor = step.team === 'red' ? 'text-red-team' : step.team === 'blue' ? 'text-blue-team' : 'text-primary';
                    const activeBg    = step.team === 'red' ? 'bg-red-team/10 ring-1 ring-red-team/40' : step.team === 'blue' ? 'bg-blue-team/10 ring-1 ring-blue-team/40' : 'bg-primary/10 ring-1 ring-primary/40';
                    return (
                      <React.Fragment key={i}>
                        <div className="flex flex-col items-center gap-1">
                          <div className={cn("w-7 h-7 rounded-full flex items-center justify-center transition-all",
                            step.status === 'done' && "bg-green-team/15",
                            step.status === 'active' && activeBg,
                            step.status === 'pending' && "bg-muted/60",
                          )}>
                            {step.status === 'done'
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-green-team" />
                              : step.status === 'active'
                                ? <Loader2 className={cn("w-3.5 h-3.5 animate-spin", activeColor)} />
                                : <Circle className="w-3.5 h-3.5 text-muted-foreground/25" />
                            }
                          </div>
                          <span className={cn("text-[9px] font-semibold uppercase tracking-wide whitespace-nowrap",
                            step.status === 'done' && "text-green-team/80",
                            step.status === 'active' && activeColor,
                            step.status === 'pending' && "text-muted-foreground/30",
                          )}>{step.label}</span>
                        </div>
                        {i < steps.length - 1 && (
                          <div className={cn("h-px w-8 mx-1 mb-4 flex-shrink-0 transition-colors",
                            steps[i + 1].status !== 'pending' || step.status === 'done' ? "bg-green-team/40" : "bg-muted"
                          )} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Per-agent status (R1 or R2 phase) */}
              {phase !== 'synthesis' && (
                <div className="px-5 py-3 border-t border-border/40 space-y-0.5">
                  {uiAgents.map(agent => {
                    const isRed    = agent.team === 'red';
                    const status   = phase === 'r1' ? agent.r1Status : agent.r2Status;
                    return (
                      <div key={agent.id} className={cn("flex items-center gap-2.5 px-3 py-1.5 rounded-md",
                        status === 'running' && (isRed ? "bg-red-team/5" : "bg-blue-team/5")
                      )}>
                        {status === 'done'
                          ? <CheckCircle2 className={cn("w-3.5 h-3.5 flex-shrink-0", isRed ? "text-red-team" : "text-blue-team")} />
                          : status === 'running'
                            ? <Loader2 className={cn("w-3.5 h-3.5 animate-spin flex-shrink-0", isRed ? "text-red-team" : "text-blue-team")} />
                            : <Circle className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground/25" />
                        }
                        <span className={cn("text-xs font-medium flex-1 min-w-0 truncate",
                          status === 'done'    ? (isRed ? "text-red-team/80" : "text-blue-team/80") :
                          status === 'running' ? "text-foreground" : "text-muted-foreground/35"
                        )}>{agent.name}</span>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 capitalize",
                          isRed ? "text-red-team/60" : "text-blue-team/60"
                        )}>{isRed ? 'Red' : 'Blue'}</span>
                        {status === 'running' && (
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">
                            {phase === 'r1' ? 'assessing…' : 'rebutting…'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {phase === 'synthesis' && (
                <div className="px-5 py-4 border-t border-border/40 flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="flex gap-1 flex-shrink-0">
                    {[0, 150, 300].map(d => (
                      <div key={d} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                  Synthesising all assessments and rebuttals…
                </div>
              )}

              <div className="px-5 pb-4 pt-3 border-t border-border/40">
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
                  <span>{phase === 'synthesis' ? 'Finalising…' : `${phase === 'r1' ? doneR1 : doneR2} of ${total} agents done`}</span>
                  <span className="tabular-nums font-medium">{pct}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </Card>
          );
        }

        // ── V1 progress UI (legacy) ───────────────────────────────────────────
        const roundCount    = session.mode === 'rapid' ? 1 : session.mode === 'deep' ? 3 : 2;
        const completedRounds = session.rounds?.filter(r => r.status === 'completed').length ?? 0;
        const doneAgents    = runningAgents?.agents?.filter(a => a.status === 'done').length ?? 0;
        const totalAgents   = runningAgents?.agents?.length ?? 0;
        const currentRound  = runningAgents?.round ?? 0;
        const currentPhase  = runningAgents?.phase ?? '';

        const steps = [];
        for (let r = 1; r <= roundCount; r++) {
          const roundDone = (session.rounds?.find(rd => rd.round_number === r)?.status === 'completed') || r < currentRound;
          const isThisRound = r === currentRound;
          steps.push({ label: roundCount === 1 ? 'Red' : `R${r} Red`, team: 'red', status: roundDone || (isThisRound && currentPhase === 'blue') ? 'done' : isThisRound && currentPhase === 'red' ? 'active' : 'pending' });
          steps.push({ label: roundCount === 1 ? 'Blue' : `R${r} Blue`, team: 'blue', status: roundDone ? 'done' : isThisRound && currentPhase === 'blue' ? 'active' : 'pending' });
        }
        steps.push({ label: 'Summary', team: 'synthesis', status: isSynthesis ? 'active' : 'pending' });

        const totalUnits = steps.length;
        const doneUnits  = steps.filter(s => s.status === 'done').length;
        const activeUnit = totalAgents > 0 && !isSynthesis ? doneAgents / totalAgents : isSynthesis ? 0.5 : 0;
        const pct        = Math.min(99, Math.round(((doneUnits + activeUnit) / totalUnits) * 100));

        return (
          <Card className="overflow-hidden border-primary/20">
            <div className="px-5 py-3 bg-primary/5 border-b border-primary/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
                <span className="text-sm font-semibold">
                  {isSynthesis ? 'Generating final analysis…'
                    : currentRound ? `Round ${currentRound} of ${roundCount} — ${currentPhase === 'red' ? 'Red team analyzing' : 'Blue team responding'}`
                    : runningStep}
                </span>
              </div>
              {elapsedSecs > 0 && <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">{elapsedStr}</span>}
            </div>
            <div className="px-5 pt-4 pb-1 overflow-x-auto">
              <div className="flex items-center min-w-max">
                {steps.map((step, i) => {
                  const isRed  = step.team === 'red';
                  const isBlue = step.team === 'blue';
                  const activeColor = isRed ? 'text-red-team' : isBlue ? 'text-blue-team' : 'text-primary';
                  const activeBg   = isRed ? 'bg-red-team/10 ring-1 ring-red-team/40' : isBlue ? 'bg-blue-team/10 ring-1 ring-blue-team/40' : 'bg-primary/10 ring-1 ring-primary/40';
                  return (
                    <React.Fragment key={i}>
                      <div className="flex flex-col items-center gap-1">
                        <div className={cn("w-7 h-7 rounded-full flex items-center justify-center transition-all", step.status === 'done' && "bg-green-team/15", step.status === 'active' && activeBg, step.status === 'pending' && "bg-muted/60")}>
                          {step.status === 'done' ? <CheckCircle2 className="w-3.5 h-3.5 text-green-team" /> : step.status === 'active' ? <Loader2 className={cn("w-3.5 h-3.5 animate-spin", activeColor)} /> : <Circle className="w-3.5 h-3.5 text-muted-foreground/25" />}
                        </div>
                        <span className={cn("text-[9px] font-semibold uppercase tracking-wide whitespace-nowrap", step.status === 'done' && "text-green-team/80", step.status === 'active' && activeColor, step.status === 'pending' && "text-muted-foreground/30")}>{step.label}</span>
                      </div>
                      {i < steps.length - 1 && <div className={cn("h-px w-6 mx-1 mb-4 flex-shrink-0 transition-colors", steps[i + 1].status !== 'pending' || step.status === 'done' ? "bg-green-team/40" : "bg-muted")} />}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
            {runningAgents && !isSynthesis && (
              <div className="px-5 py-3 border-t border-border/40 space-y-3">
                {['red', 'blue'].map(team => {
                  const teamAgents = runningAgents.agents.filter(a => a.team === team);
                  if (!teamAgents.length) return null;
                  const isRed = team === 'red';
                  const isActiveTeam = currentPhase === team;
                  return (
                    <div key={team}>
                      <div className={cn("text-[10px] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5", isRed ? "text-red-team/70" : "text-blue-team/70")}>
                        {isRed ? 'Red Team' : 'Blue Team'}
                        {isActiveTeam && <span className={cn("text-[9px] px-1.5 py-px rounded font-normal normal-case tracking-normal", isRed ? "bg-red-team/10 text-red-team" : "bg-blue-team/10 text-blue-team")}>active</span>}
                      </div>
                      <div className="space-y-0.5">
                        {teamAgents.map(agent => (
                          <div key={agent.id} className={cn("flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors", agent.status === 'running' && (isRed ? "bg-red-team/5" : "bg-blue-team/5"))}>
                            {agent.status === 'done' ? <CheckCircle2 className={cn("w-3.5 h-3.5 flex-shrink-0", isRed ? "text-red-team" : "text-blue-team")} /> : agent.status === 'running' ? <Loader2 className={cn("w-3.5 h-3.5 animate-spin flex-shrink-0", isRed ? "text-red-team" : "text-blue-team")} /> : <Circle className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground/25" />}
                            <span className={cn("text-xs font-medium flex-1 min-w-0 truncate", agent.status === 'done' ? (isRed ? "text-red-team/80" : "text-blue-team/80") : agent.status === 'running' ? "text-foreground" : "text-muted-foreground/35")}>{agent.name}</span>
                            {agent.status === 'running' && <span className={cn("text-[10px] flex-shrink-0", isRed ? "text-red-team/60" : "text-blue-team/60")}>{isRed ? 'analyzing threat…' : 'formulating response…'}</span>}
                            {agent.status === 'done' && <span className="text-[10px] text-muted-foreground flex-shrink-0">done</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {isSynthesis && (
              <div className="px-5 py-4 border-t border-border/40 flex items-center gap-3 text-sm text-muted-foreground">
                <div className="flex gap-1 flex-shrink-0">{[0, 150, 300].map(d => <div key={d} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${d}ms` }} />)}</div>
                Generating executive summary, risk registry &amp; attack chains…
              </div>
            )}
            <div className="px-5 pb-4 pt-3 border-t border-border/40">
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
                <span>{isSynthesis ? 'Finalising analysis…' : completedRounds > 0 ? `${completedRounds} of ${roundCount} rounds complete` : 'Starting…'}</span>
                <span className="tabular-nums font-medium">{pct}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </Card>
        );
      })()}

      {/* Content Tabs */}
      <Tabs defaultValue={session.status === 'completed' ? 'report' : 'debate'}>
        <TabsList>
          {session.status === 'completed' && (
            <>
              <TabsTrigger value="report">Report</TabsTrigger>
              <TabsTrigger value="risks">{isV2 ? 'Mitigations' : 'Risks'}</TabsTrigger>
              <TabsTrigger value="chains">Chains</TabsTrigger>
            </>
          )}
          <TabsTrigger value="debate">Debate</TabsTrigger>
          {session.status === 'completed' && !isV2 && session.mitigation_playbook && (
            <TabsTrigger value="playbook">Playbook</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="debate" className="space-y-4 mt-4">
          {/* Roster — always shown */}
          <DebateRoster session={session} agents={agents} sessionAgents={isV2 ? sessionAgents : undefined} />

          {isV2 ? (
            sessionAgents.length > 0
              ? <DebateRoundV2 sessionAgents={sessionAgents} agents={agents} />
              : (
                <Card className="p-12 text-center bg-card">
                  <p className="text-muted-foreground">
                    {session.status === 'draft'
                      ? 'Click "Run Analysis" to start the adversarial debate'
                      : 'Agent assessments will appear here once the analysis begins'}
                  </p>
                </Card>
              )
          ) : (
            session.rounds?.length > 0 ? (() => {
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
            )
          )}
        </TabsContent>

        {session.status === 'completed' && (
          <>
            <TabsContent value="report" className="mt-4">
              {isV2 ? (
                <div className={cn('gap-5', parentSession?.scrs_score != null ? 'grid grid-cols-[1fr_280px]' : 'space-y-6')}>
                  <div className="space-y-6 min-w-0">
                    <SynthesisReport synthesis={sessionSynthesis} sessionAgents={sessionAgents} agents={agents} />
                    {/* Chains callout — if compound chains found */}
                    {sessionSynthesis?.compound_chains?.length > 0 && (
                      <div className="rounded-lg border border-red-200 bg-red-50/40 dark:border-red-900/30 dark:bg-red-950/10 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-semibold text-red-700 dark:text-red-400">
                            {sessionSynthesis.compound_chains.length} compound chain{sessionSynthesis.compound_chains.length !== 1 ? 's' : ''} found
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {sessionSynthesis.compound_chains.slice(0, 2).map((chain, i) => (
                            <div key={i} className="flex items-center gap-1 text-[11px] flex-wrap">
                              {(chain.steps || []).slice(0, 3).map((step, j) => (
                                <React.Fragment key={j}>
                                  <span className="px-1.5 py-0.5 rounded bg-card border border-border text-foreground text-[10px]">
                                    {step.step_text?.slice(0, 40) || `Step ${j + 1}`}
                                  </span>
                                  {j < (chain.steps || []).slice(0, 3).length - 1 && (
                                    <span className="text-red-400">→</span>
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {parentSession?.scrs_score != null && (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-border bg-card p-4">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">
                          vs {session.parent_session_title?.split(' — ')[0] || 'parent'}
                        </div>
                        <div className="space-y-2.5">
                          {[
                            ['SCRS', String(parentSession.scrs_score), String(scrsScore ?? '—'), scrsScore != null && parentSession.scrs_score != null ? (scrsScore > parentSession.scrs_score ? 'red' : 'green') : null],
                            ['Compound chains', String(session.attack_chains?.length || 0), String(chainCount), null],
                            ['Mitigations', '—', String(sessionSynthesis?.priority_mitigations ? '✓' : '—'), null],
                          ].map(([label, before, after, tone]) => {
                            const delta = label === 'SCRS' && scrsScore != null && parentSession.scrs_score != null
                              ? scrsScore - parentSession.scrs_score : null;
                            return (
                              <div key={label} className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">{label}</span>
                                <div className="flex items-center gap-1.5 font-mono">
                                  <span className="text-muted-foreground tabular-nums">{before}</span>
                                  <span className="text-muted-foreground/40">→</span>
                                  <span className="font-semibold tabular-nums">{after}</span>
                                  {delta != null && (
                                    <span className={cn('text-[10px] font-semibold tabular-nums', delta > 0 ? 'text-red-600' : 'text-emerald-600')}>
                                      {delta > 0 ? '+' : ''}{delta}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      {/* Agent contribution */}
                      {sessionAgents.length > 0 && (
                        <div className="rounded-xl border border-border bg-card p-4">
                          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">Agent contribution</div>
                          <div className="space-y-2">
                            {sessionAgents.slice(0, 6).map(r => {
                              const agent = agents.find(a => a.id === r.agent_id) || {};
                              const sev = r.round2_revised_severity || r.round1_severity;
                              const isRed = agent.team === 'red';
                              const w = sev === 'CRITICAL' ? 100 : sev === 'HIGH' ? 75 : sev === 'MEDIUM' ? 50 : 25;
                              const c = isRed ? '#dc2626' : '#2563eb';
                              return (
                                <div key={r.agent_id} className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ background: c }}>
                                    {(agent.name || '?')[0]}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-0.5">
                                      <span className="text-[11px] font-medium truncate">{agent.name || r.agent_id}</span>
                                      {sev && <span className="text-[10px] font-mono text-muted-foreground">{sev}</span>}
                                    </div>
                                    <div className="h-1 rounded-full bg-muted overflow-hidden">
                                      <div className="h-full rounded-full" style={{ width: `${w}%`, background: c }} />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <>
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

                  {session.executive_summary && (
                    <Card className="p-6 border-l-4 border-l-primary">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Executive Summary</h3>
                      <div className="prose prose-sm max-w-none text-foreground">
                        <ReactMarkdown>{session.executive_summary}</ReactMarkdown>
                      </div>
                    </Card>
                  )}

                  <RiskHeatmap risks={session.risk_registry} />

                  {session.risk_registry?.length > 0 && <MitigationTable risks={session.risk_registry} />}

                  {session.rounds?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Debate Transcript</h3>
                      <div className="space-y-4">
                        {session.rounds.map((round, i) => <DebateRound key={i} round={round} index={i} />)}
                      </div>
                    </div>
                  )}

                  {session.attack_chains?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Attack / Effect Chains</h3>
                      <ChainDiagram chains={session.attack_chains} />
                    </div>
                  )}

                  {session.mitigation_playbook && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Mitigation Playbook</h3>
                      <MitigationPlaybook playbook={session.mitigation_playbook} />
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="risks" className="mt-4">
              {isV2 ? (
                sessionSynthesis?.priority_mitigations
                  ? <Card className="p-6"><div className="prose prose-sm max-w-none text-foreground"><ReactMarkdown>{sessionSynthesis.priority_mitigations}</ReactMarkdown></div></Card>
                  : <Card className="p-8 text-center"><p className="text-muted-foreground">Priority mitigations not yet generated</p></Card>
              ) : (
                <MitigationTable risks={session.risk_registry} />
              )}
            </TabsContent>

            <TabsContent value="chains" className="mt-4 space-y-4">
              {isV2 && session.status === 'completed' && !chainBreakData && (
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={handleGenerateChainBreaker}
                    disabled={generatingChainBreaker} className="gap-2 border-primary/40 text-primary hover:bg-primary/5">
                    {generatingChainBreaker ? <Loader2 className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
                    {generatingChainBreaker ? 'Analysing chains…' : 'Generate Chain Break Analysis'}
                  </Button>
                </div>
              )}
              {isV2 ? (
                <ChainBreaker
                  chainBreakData={chainBreakData}
                  chains={sessionSynthesis?.compound_chains || []}
                  appliedSteps={appliedSteps}
                  onToggle={(key) => setAppliedSteps(prev => {
                    const next = new Set(prev);
                    next.has(key) ? next.delete(key) : next.add(key);
                    return next;
                  })}
                  currentScrs={v2SynthData?.scrs_score}
                  projectedScrs={projectedResult?.scrs}
                  scrsBaseParams={scrsBaseParams}
                  chainAnalysesForScrs={chainAnalysesForScrs}
                />
              ) : (
                <ChainDiagram chains={session.attack_chains} />
              )}
            </TabsContent>

            {!isV2 && session.mitigation_playbook && (
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