/**
 * One-time migration: rename red_team_focus → focus in agent system_prompt JSON.
 *
 * Run from the browser console on the Surface app (after logging in):
 *
 *   const { base44 } = await import('/src/api/base44Client.js');
 *   await import('/scripts/migrate-focus.js');
 *
 * Or paste the body of migrateFocus() directly into the console.
 */

import { base44 } from '../src/api/base44Client.js';

async function migrateFocus() {
  const agents = await base44.entities.Agent.filter({});
  console.log(`Found ${agents.length} agents.`);

  let migrated = 0;
  let skipped = 0;

  for (const agent of agents) {
    if (!agent.system_prompt || !agent.system_prompt.startsWith('{')) {
      skipped++;
      continue;
    }

    let data;
    try {
      data = JSON.parse(agent.system_prompt);
    } catch {
      console.warn(`Skipping ${agent.name}: invalid system_prompt JSON`);
      skipped++;
      continue;
    }

    if (data._v !== 1 || !data.red_team_focus) {
      skipped++;
      continue;
    }

    const { red_team_focus, ...rest } = data;
    rest.focus = red_team_focus;

    await base44.entities.Agent.update(agent.id, {
      system_prompt: JSON.stringify(rest),
      red_team_focus: '',
    });

    console.log(`Migrated: ${agent.name} — focus: "${red_team_focus.slice(0, 60)}"`);
    migrated++;
  }

  console.log(`Done. Migrated: ${migrated}, skipped: ${skipped}.`);
}

migrateFocus().catch(console.error);
