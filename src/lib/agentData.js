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
