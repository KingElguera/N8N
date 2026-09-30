const veille_quotidienne = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.2,
  config: { name: 'Veille quotidienne', position: [-800, 0] }
});

const lire_dossiers_incomplets = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.5,
  config: { name: 'Lire dossiers incomplets', position: [-560, 0] }
});

const calculer_jours_restants = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Calculer jours restants', position: [-320, 0] }
});

const filtrer_dossiers_traiter = node({
  type: 'n8n-nodes-base.filter',
  version: 2.2,
  config: { name: 'Filtrer dossiers à traiter', position: [-80, 0] }
});

const ch_ance_J_3_ou_moins = node({
  type: 'n8n-nodes-base.if',
  version: 2.2,
  config: { name: 'Échéance à J-3 ou moins ?', position: [160, 0] }
});

const iA_R_diger_r_ponse_best_effort = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: { name: 'IA - Rédiger réponse (best-effort)', position: [400, -100] }
});

const marquer_soumis_forc = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.5,
  config: { name: 'Marquer soumis forcé', position: [640, -100] }
});

const alerter_g_rant_envoi_forc = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.1,
  config: { name: 'Alerter gérant - envoi forcé', position: [880, -100] }
});

const alerter_g_rant_rappel_validation = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.1,
  config: { name: 'Alerter gérant - rappel validation', position: [400, 100] }
});

const wf = workflow('', 'Chargebacks - Veille échéances', { executionOrder: 'v1' });

export default wf
  .add(veille_quotidienne)
  .to(lire_dossiers_incomplets)
  .to(calculer_jours_restants)
  .to(filtrer_dossiers_traiter)
  .to(ch_ance_J_3_ou_moins.onTrue(iA_R_diger_r_ponse_best_effort
    .to(marquer_soumis_forc)
    .to(alerter_g_rant_envoi_forc)).onFalse(alerter_g_rant_rappel_validation))