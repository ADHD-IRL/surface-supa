/**
 * Systemic Critical Risk Score (SCRS) Engine
 *
 * SCRS is a 0–100 composite score representing assessed risk level.
 * It is derived from three factors:
 *
 *   1. Base Score (BS)       — weighted agent severity findings
 *   2. Resilience Modifier   — chain resilience reduces/holds risk
 *   3. Countermeasure Modifier (CCM) — applied countermeasures reduce score
 *
 * Formula:
 *   SCRS = clamp(BS + RM + CCM, 0, 100)
 */

// ── Weights ───────────────────────────────────────────────────────────────────

export const SEV_WEIGHT = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

export const EXPERTISE_MULTIPLIER = {
  'World-Class': 1.0,
  'Principal':   0.9,
  'Senior':      0.8,
  'Mid-Level':   0.7,
  'Junior':      0.6,
};

export const RESILIENCE_MODIFIER = {
  HIGH:   0,    // hard to break — risk persists
  MEDIUM: -5,   // some disruption possible
  LOW:    -10,  // brittle chain — high disruption potential
};

export const MAX_CCM_REDUCTION = 20; // max points from countermeasures

// ── Bands ─────────────────────────────────────────────────────────────────────

export const SCRS_BANDS = [
  { min: 80, max: 100, label: 'CRITICAL', color: '#C0392B', bg: 'rgba(192,57,43,0.1)',  border: 'rgba(192,57,43,0.3)',  description: 'Immediate action required' },
  { min: 60, max: 79,  label: 'HIGH',     color: '#D68910', bg: 'rgba(214,137,16,0.1)', border: 'rgba(214,137,16,0.3)', description: 'Significant exposure — prioritise controls' },
  { min: 40, max: 59,  label: 'MEDIUM',   color: '#2E86AB', bg: 'rgba(46,134,171,0.1)', border: 'rgba(46,134,171,0.3)', description: 'Manageable with planned controls' },
  { min: 0,  max: 39,  label: 'LOW',      color: '#27AE60', bg: 'rgba(39,174,96,0.1)',  border: 'rgba(39,174,96,0.3)',  description: 'Residual risk acceptable' },
];

export function getPosture(scrs) {
  return SCRS_BANDS.find(b => scrs >= b.min && scrs <= b.max) || SCRS_BANDS[3];
}

// ── Core computation ──────────────────────────────────────────────────────────

/**
 * @param {Object} params
 * @param {Array}  params.sessionAgents   — SessionAgent records with round1_severity,
 *                                          round2_revised_severity, and agent object
 * @param {Array}  params.chainAnalyses   — Array of { chain_resilience, steps[] }
 *                                          where steps have leverage field
 * @param {Array}  params.appliedCMs      — Array of applied countermeasure objects
 *                                          { leverage: 'HIGH'|'MEDIUM'|'LOW' }
 * @returns {Object} { scrs, posture, breakdown }
 */
export function computeSCRS({ sessionAgents = [], chainAnalyses = [], appliedCMs = [] }) {
  // ── 1. Base Score ────────────────────────────────────────────────────────────
  let weightedSum = 0;
  let maxPossible = 0;

  for (const sa of sessionAgents) {
    const sev = sa.round2_revised_severity || sa.round1_severity;
    if (!sev) continue;
    const expertiseLevel = sa.agent?.expertise_level || 'Senior';
    const mult = EXPERTISE_MULTIPLIER[expertiseLevel] ?? 0.8;
    weightedSum += (SEV_WEIGHT[sev] || 0) * mult;
    maxPossible += SEV_WEIGHT.CRITICAL * 1.0;
  }

  const baseScore = maxPossible > 0 ? (weightedSum / maxPossible) * 100 : 0;

  // ── 2. Resilience Modifier ───────────────────────────────────────────────────
  let resilienceModifier = 0;
  for (const ca of chainAnalyses) {
    resilienceModifier += RESILIENCE_MODIFIER[ca.chain_resilience] ?? 0;
  }
  resilienceModifier = Math.max(resilienceModifier, -25); // cap at -25

  // ── 3. Countermeasure Coverage Modifier ─────────────────────────────────────
  const allHighSteps = chainAnalyses.flatMap(ca =>
    (ca.steps || []).filter(s => s.leverage === 'HIGH')
  );
  const totalHighSteps = allHighSteps.length;

  const coveredHighSteps = appliedCMs.filter(cm => cm.leverage === 'HIGH').length;
  const coveragePct = totalHighSteps > 0 ? Math.min(coveredHighSteps / totalHighSteps, 1) : 0;
  const countermeasureModifier = -(coveragePct * MAX_CCM_REDUCTION);

  // ── 4. Final SCRS ────────────────────────────────────────────────────────────
  const raw  = baseScore + resilienceModifier + countermeasureModifier;
  const scrs = Math.round(Math.max(0, Math.min(100, raw)));

  return {
    scrs,
    posture: getPosture(scrs),
    breakdown: {
      baseScore:              Math.round(baseScore),
      resilienceModifier:     Math.round(resilienceModifier),
      countermeasureModifier: Math.round(countermeasureModifier),
      coveragePct:            Math.round(coveragePct * 100),
      totalHighSteps,
      coveredHighSteps,
      agentCount:             sessionAgents.length,
    },
  };
}

/**
 * Estimate how much a single countermeasure reduces SCRS.
 * Used to show per-CM delta in the simulator.
 */
export function estimateCMDelta(cm, totalHighSteps) {
  if (totalHighSteps === 0) return 0;
  const levWeight = { HIGH: 3, MEDIUM: 2, LOW: 1 }[cm.leverage] || 1;
  const totalLevWeight = totalHighSteps * 3; // normalise against all HIGH steps at full weight
  return Math.round((levWeight / totalLevWeight) * MAX_CCM_REDUCTION * 10) / 10;
}

/**
 * Project SCRS if a set of countermeasures were applied.
 * Used for "if all applied → projected SCRS: XX" in Decision Brief.
 */
export function projectSCRS(baseParams, additionalCMs) {
  return computeSCRS({
    ...baseParams,
    appliedCMs: [...(baseParams.appliedCMs || []), ...additionalCMs],
  });
}
