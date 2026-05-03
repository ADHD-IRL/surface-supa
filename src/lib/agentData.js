// Encode/decode agent structured data via system_prompt JSON fallback.
// The base44 Agent entity only guaranteed: name, team, domain_tags, system_prompt, avatar_color, status.
// All richer fields (persona_description, cognitive_bias, etc.) are stored as JSON in system_prompt
// so they survive regardless of which schema version the backend is running.
// Once the new Agent.jsonc fields are deployed and the backend starts persisting them,
// individual fields will be present and the JSON fallback is bypassed automatically.

const STRUCTURED_FIELDS = [
  'discipline', 'category',
  'persona_description', 'cognitive_bias', 'red_team_focus',
  'expertise_level', 'reasoning_style', 'severity_default',
  'vector_human', 'vector_technical', 'vector_physical', 'vector_futures',
  'domain_tags',
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

// Returns the agent with structured fields resolved from either:
//   (a) the individual schema fields (preferred, available once backend schema is deployed), or
//   (b) a JSON-encoded system_prompt blob written by encodeAgentData()
export function resolveAgent(agent) {
  if (!agent) return agent;
  if (agent.persona_description) return agent; // individual fields exist
  if (agent.system_prompt && agent.system_prompt.startsWith('{')) {
    try {
      const data = JSON.parse(agent.system_prompt);
      if (data._v === 1) return { ...agent, ...data };
    } catch {}
  }
  return agent;
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
      a.red_team_focus ? `\nYour primary focus: ${a.red_team_focus}` : '',
      a.severity_default ? `\nDefault severity lens: ${a.severity_default}.` : '',
    ].filter(Boolean).join('\n');
  }
  return a.system_prompt || '';
}
