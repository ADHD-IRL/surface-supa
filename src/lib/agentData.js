// Encode/decode agent structured data via system_prompt JSON fallback.
// The base44 Agent entity only guaranteed: name, team, domain_tags, system_prompt, avatar_color, status.
// All richer fields (persona_description, cognitive_bias, etc.) are stored as JSON in system_prompt
// so they survive regardless of which schema version the backend is running.
// Once the new Agent.jsonc fields are deployed and the backend starts persisting them,
// individual fields will be present and the JSON fallback is bypassed automatically.

const STRUCTURED_FIELDS = [
  'discipline', 'professional_background',
  'persona_description', 'cognitive_bias', 'focus',
  'expertise_level', 'reasoning_style', 'severity_default',
  'vector_human', 'vector_technical', 'vector_physical', 'vector_futures',
  'domain_tags', 'domain_id',
];

export function encodeAgentData(agent) {
  const payload = { _v: 1 };
  STRUCTURED_FIELDS.forEach(k => {
    if (agent[k] != null && agent[k] !== '' && !(Array.isArray(agent[k]) && !agent[k].length)) {
      payload[k] = agent[k];
    }
  });
  return JSON.stringify(payload);
}

// Returns the agent with structured fields resolved.
// system_prompt (written by encodeAgentData on every save/import) is always
// the authoritative source because the backend may silently truncate array
// fields like domain_tags to a single element. Scalar backend fields that are
// non-empty still take precedence over the JSON blob so edits are respected.
export function resolveAgent(agent) {
  if (!agent) return agent;
  if (!agent.system_prompt || !agent.system_prompt.startsWith('{')) return agent;
  try {
    const data = JSON.parse(agent.system_prompt);
    if (data._v !== 1) return agent;
    // Merge: start from system_prompt data, then overlay non-empty backend scalars.
    const merged = { ...data, ...agent };
    // For arrays (domain_tags), prefer the system_prompt version which is always
    // the full list written at save time.
    for (const k of STRUCTURED_FIELDS) {
      if (Array.isArray(data[k]) && data[k].length > (agent[k]?.length ?? 0)) {
        merged[k] = data[k];
      }
    }
    return merged;
  } catch {
    return agent;
  }
}

export function buildAgentSystemPrompt(agent) {
  const a = resolveAgent(agent);
  if (a.persona_description) {
    return [
      `You are ${a.name}${a.discipline ? `, ${a.discipline}` : ''}.`,
      a.persona_description,
      a.expertise_level ? `Expertise level: ${a.expertise_level}.` : '',
      a.reasoning_style ? `Reasoning style: ${a.reasoning_style}.` : '',
      a.cognitive_bias ? `\nYour cognitive bias to be aware of: ${a.cognitive_bias}` : '',
      a.focus ? `\nYour primary focus: ${a.focus}` : '',
      a.severity_default ? `\nDefault severity lens: ${a.severity_default}.` : '',
    ].filter(Boolean).join('\n');
  }
  return a.system_prompt || '';
}

// ── V2 Debate prompt builders ─────────────────────────────────────────────────

function agentHeader(agent) {
  const a = resolveAgent(agent);
  const roleLabel = a.team === 'red'
    ? 'Red Team Analyst — your primary lens is offensive threat identification, attack vectors, and exploitation paths.'
    : 'Blue Team Analyst — your primary lens is defensive exposure, detection gaps, and systemic resilience failures.';
  return [
    `You are ${a.name}${a.discipline ? `, ${a.discipline}` : ''}.`,
    a.persona_description || '',
    a.professional_background ? `Professional background: ${a.professional_background}` : '',
    a.expertise_level ? `Expertise level: ${a.expertise_level}` : '',
    a.reasoning_style ? `Reasoning style: ${a.reasoning_style} — let this shape your argumentation and tone.` : '',
    a.cognitive_bias ? `Your cognitive bias: ${a.cognitive_bias}` : '',
    a.focus ? `Your focus: ${a.focus}` : '',
    `Your role: ${roleLabel}`,
  ].filter(Boolean).join('\n');
}

export function buildR1Prompt(agent, scenarioContext) {
  return `${agentHeader(agent)}

SCENARIO CONTEXT:
${scenarioContext}

Write a Round 1 independent assessment (350-500 words) covering:
1. Opening position — your primary framing from your discipline
2. Top threat — specific mechanism, what analysts are missing, severity rationale
3. Second threat — same structure
4. Invalidating assumption — one assumption that if wrong changes your whole assessment
5. Key finding — one-sentence bottom line
6. Confidence and key unknown — rate your confidence in this assessment (High / Medium / Low) and name the single piece of information that, if you had it, would most change your position

Write in first person as the expert. Be specific and opinionated. Do not hedge.

On the very last line of your response output exactly:
SEVERITY: [CRITICAL|HIGH|MEDIUM|LOW]`;
}

export function buildR2Prompt(agent, scenarioContext, othersAssessments) {
  return `${agentHeader(agent)}

You have just read all Round 1 assessments from the other experts. Here they are:

${othersAssessments}

Write your Round 2 rebuttal (250-400 words) covering:
1. Strongest alliance — which agent's findings amplify yours most, and the compound threat chain that emerges (name them explicitly)
2. Strongest disagreement — first, state the best version of their argument in one sentence (steelman it), then explain precisely why you still disagree (name them, cite their argument)
3. Key unknown — name one critical unknown that, if resolved differently, would change your severity rating
4. Whether you've revised your severity rating and why

Be direct. Name names. Change your position if persuaded.

On the very last line of your response output exactly:
SEVERITY: [CRITICAL|HIGH|MEDIUM|LOW]`;
}

export function buildSynthesisPrompt(session, agentRows, scenarioContext) {
  const agentsText = agentRows.map(row => {
    const r1 = row.round1_assessment ? row.round1_assessment.slice(0, 500) : '(not available)';
    const r2 = row.round2_rebuttal ? row.round2_rebuttal.slice(0, 400) : '(not available)';
    const teamLabel = row.team === 'red' ? 'Red Team' : 'Blue Team';
    return `=== ${row.agent_name} (${row.discipline || teamLabel}) ===\nROUND 1 [${row.round1_severity || '?'}]:\n${r1}\n\nROUND 2 [${row.round2_revised_severity || '?'}]:\n${r2}`;
  }).join('\n\n---\n\n');

  return `You are the synthesis engine for a structured adversarial analysis session.

Session: ${session.title}

Scenario:
${(scenarioContext || '').slice(0, 1500)}

ALL AGENT ASSESSMENTS:
${agentsText}

Generate a comprehensive synthesis report. Use exactly these ## headings in order:

## CONSENSUS FINDINGS
Points that multiple agents agreed on. Sort by severity. Cite agents by name.

## CONTESTED FINDINGS
Points of significant disagreement. Format each as: "Agent A vs Agent B: [the disagreement]"

## COMPOUND CHAINS
Multi-step threat sequences that emerged from agents building on each other. Format each chain exactly as:
### [Chain Name]
Step 1: [description]
Step 2: [description]
Step 3: [description]
List 2-4 chains. Each must have at least 3 steps.

## BLIND SPOTS
Areas or threat vectors that no agent adequately covered.

## PRIORITY MITIGATIONS
Numbered list of recommended immediate actions based on highest-severity consensus findings. Label each: IMMEDIATE, SHORT-TERM, or LONG-TERM.

## SHARPEST INSIGHTS
The 5 most important or surprising specific statements from individual agents. Format each as: "Agent Name — [the insight]"

## KEY UNCERTAINTIES
The 3–5 most critical unknowns or assumptions in this scenario. For each: state the uncertainty clearly, note which agents flagged it (if any), and describe how the risk picture would shift if it resolved differently.

## ESCALATION INDICATORS
Specific observable signals or trigger events that would cause this risk assessment to move up a severity band. Format as a bulleted list. Be concrete — not "if the situation worsens" but "if X is observed / if Y occurs".

Write analytically. Be specific. Cite agents by name throughout.`;
}

export function parseSeverityFromText(text, fallback = 'HIGH') {
  if (!text) return { assessment: '', severity: fallback };
  const lines = text.trimEnd().split('\n');
  const last = lines[lines.length - 1].trim();
  const m = last.match(/^SEVERITY:\s*(CRITICAL|HIGH|MEDIUM|LOW)$/i);
  if (m) {
    return {
      assessment: lines.slice(0, -1).join('\n').trimEnd(),
      severity: m[1].toUpperCase(),
    };
  }
  // Search last 3 lines as fallback
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 3); i--) {
    const m2 = lines[i].match(/SEVERITY:\s*(CRITICAL|HIGH|MEDIUM|LOW)/i);
    if (m2) {
      return { assessment: text, severity: m2[1].toUpperCase() };
    }
  }
  return { assessment: text, severity: fallback };
}

export function formatOthersAssessments(agentRows, excludeAgentId) {
  return agentRows
    .filter(row => row.agent_id !== excludeAgentId && row.round1_assessment)
    .map(row => {
      const teamLabel = row.team === 'red' ? 'Red Team' : 'Blue Team';
      return `=== ${row.agent_name} (${row.discipline || teamLabel}) ===\n${row.round1_assessment}`;
    })
    .join('\n\n');
}

export function extractSynthesisSections(rawText) {
  if (!rawText) return {};
  const sections = {};
  const headingRe = /^##\s+(.+)$/m;
  const parts = rawText.split(/^##\s+/m);

  const sectionNames = {
    'CONSENSUS FINDINGS':    'consensus_findings',
    'CONTESTED FINDINGS':    'contested_findings',
    'COMPOUND CHAINS':       'compound_chains',
    'BLIND SPOTS':           'blind_spots',
    'PRIORITY MITIGATIONS':  'priority_mitigations',
    'SHARPEST INSIGHTS':     'sharpest_insights',
    'KEY UNCERTAINTIES':     'key_uncertainties',
    'ESCALATION INDICATORS': 'escalation_indicators',
  };

  for (const part of parts) {
    const firstLine = part.split('\n')[0].trim().toUpperCase();
    const key = Object.keys(sectionNames).find(k => firstLine.startsWith(k));
    if (key) {
      const body = part.slice(part.indexOf('\n') + 1).trim();
      sections[sectionNames[key]] = body;
    }
  }

  // Parse compound chains into structured array
  if (sections.compound_chains) {
    sections.compound_chains = parseCompoundChains(sections.compound_chains);
  }

  return sections;
}

function parseCompoundChains(text) {
  const chains = [];
  const chainBlocks = text.split(/^###\s+/m).filter(Boolean);
  for (const block of chainBlocks) {
    const lines = block.trim().split('\n');
    const name = lines[0].trim();
    const steps = [];
    let stepNum = 0;
    for (let i = 1; i < lines.length; i++) {
      const m = lines[i].match(/^Step\s+(\d+):\s*(.+)$/i);
      if (m) {
        stepNum++;
        steps.push({ step_number: stepNum, step_text: m[2].trim() });
      }
    }
    if (name && steps.length) chains.push({ name, description: '', steps });
  }
  return chains;
}

export function buildChainBreakPrompt(chains, scenarioContext) {
  const chainsText = chains.map((c, i) =>
    `Chain ${i + 1}: ${c.name}\n${(c.steps || []).map(s => `  Step ${s.step_number}: ${s.step_text}`).join('\n')}`
  ).join('\n\n');

  return {
    prompt: `You are a defensive security strategist. Analyse the following compound threat chains identified in an adversarial risk session.

Scenario: ${(scenarioContext || '').slice(0, 800)}

COMPOUND CHAINS:
${chainsText}

For each chain, assess its overall resilience (how hard it is to disrupt) and for each step recommend the single most effective mitigation that would break or significantly impede the chain at that point. Be specific — name the control, the owner, and the timeline.`,
    response_json_schema: {
      type: 'object',
      properties: {
        chain_analyses: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              chain_name:           { type: 'string' },
              chain_resilience:     { type: 'string', description: 'HIGH, MEDIUM, or LOW — how hard it is to disrupt this chain' },
              resilience_rationale: { type: 'string', description: '1-2 sentences explaining the resilience rating' },
              steps: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    step_number:            { type: 'number' },
                    leverage:               { type: 'string', description: 'HIGH, MEDIUM, or LOW — how critical breaking at this step is' },
                    mitigation_title:       { type: 'string' },
                    mitigation_description: { type: 'string' },
                    mitigation_owner:       { type: 'string' },
                    mitigation_timeline:    { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}
