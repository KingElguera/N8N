import { spawnSync } from 'node:child_process';

// n8ncli test prints the result but always exits 0, so the status is parsed here.
const cli = process.env.N8NCLI || 'n8ncli';

const scenarios = [
  ['chargebacks-main', 'complet'],
  ['chargebacks-main', 'incomplet'],
  ['chargebacks-main', 'sous-seuil'],
  ['chargebacks-main', 'commande-introuvable'],
  ['chargebacks-main', 'faux-litige'],
  ['chargebacks-watchdog', null]
];

let echecs = 0;
for (const [workflow, scenario] of scenarios) {
  const pin = `n8n/test-data/${workflow}${scenario ? '.' + scenario : ''}.pin.json`;
  const run = spawnSync(cli, ['test', `n8n/workflows/${workflow}.workflow.ts`, '--pin-data', pin], { encoding: 'utf-8' });
  const sortie = `${run.stdout || ''}${run.stderr || ''}`;
  const resultat = sortie.match(/\{"executionId".*\}/);
  const ok = resultat !== null && JSON.parse(resultat[0]).status === 'success';
  if (!ok) echecs++;
  console.log(`${ok ? 'OK   ' : 'ECHEC'}  ${workflow}${scenario ? ' / ' + scenario : ''}`);
  if (!ok) console.log(run.error ? `       ${run.error.message}` : sortie.trim().split('\n').slice(-5).map(l => '       ' + l).join('\n'));
}

console.log(`\n${scenarios.length - echecs}/${scenarios.length} scénarios réussis`);
process.exit(echecs ? 1 : 0);
