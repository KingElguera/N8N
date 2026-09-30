const veille_quotidienne = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Veille quotidienne',
    parameters: {
      rule: { interval: [{ field: 'days', daysInterval: 1, triggerAtHour: 8 }] }
    },
    position: [-800, 0]
  }
});

const lire_dossiers_incomplets = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Lire dossiers incomplets',
    parameters: {
      operation: 'read',
      documentId: { __rl: true, mode: 'id', value: 'SHEET_FICTIF_CHARGEBACKS' },
      sheetName: { __rl: true, mode: 'name', value: 'Dossiers' },
      filtersUI: { values: [{ lookupColumn: 'statut', lookupValue: 'incomplet' }] },
      options: {}
    },
    position: [-560, 0]
  }
});

const calculer_jours_restants = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Calculer jours restants',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `// "Aujourd'hui" = date du déclenchement, pour des tests reproductibles
const declenchement = $('Veille quotidienne').first().json.timestamp;
const aujourdhui = Date.parse(String(declenchement).slice(0, 10));

return $input.all().map(item => {
  const echeance = Date.parse(String(item.json.date_echeance).slice(0, 10));
  const jours_restants = Math.round((echeance - aujourdhui) / 86400000);
  return { json: { ...item.json, jours_restants } };
});`
    },
    notes: "Calcule le nombre de jours avant l'échéance de chaque dossier, à partir de la date de déclenchement.",
    notesInFlow: true,
    position: [-320, 0]
  }
});

const filtrer_dossiers_traiter = node({
  type: 'n8n-nodes-base.filter',
  version: 2.3,
  config: {
    name: 'Filtrer dossiers à traiter',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [
          {
            id: 'f1a2b3c4-0001-4000-8000-000000000001',
            leftValue: '={{ $json.jours_restants }}',
            rightValue: 0,
            operator: { type: 'number', operation: 'gte' }
          }
        ],
        combinator: 'and'
      },
      options: {}
    },
    position: [-80, 0]
  }
});

const ch_ance_J_3_ou_moins = node({
  type: 'n8n-nodes-base.if',
  version: 2.3,
  config: {
    name: 'Échéance à J-3 ou moins ?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [
          {
            id: 'f1a2b3c4-0002-4000-8000-000000000002',
            leftValue: '={{ $json.jours_restants }}',
            rightValue: 3,
            operator: { type: 'number', operation: 'lte' }
          }
        ],
        combinator: 'and'
      },
      options: {}
    },
    position: [160, 0]
  }
});

const iA_R_diger_r_ponse_best_effort = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'IA - Rédiger réponse (best-effort)',
    parameters: {
      method: 'POST',
      url: 'https://api.anthropic.com/v1/messages',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'anthropicApi',
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'anthropic-version', value: '2023-06-01' }] },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: `={{ JSON.stringify({
  model: 'claude-sonnet-5',
  max_tokens: 1024,
  messages: [{
    role: 'user',
    content: 'Rédige une réponse de contestation de chargeback, au mieux avec les éléments disponibles (dossier incomplet, échéance proche). Dossier : ' + JSON.stringify($json)
  }]
}) }}`,
      options: {}
    },
    position: [400, -100]
  }
});

const marquer_soumis_forc = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Marquer soumis forcé',
    parameters: {
      operation: 'update',
      documentId: { __rl: true, mode: 'id', value: 'SHEET_FICTIF_CHARGEBACKS' },
      sheetName: { __rl: true, mode: 'name', value: 'Dossiers' },
      columns: {
        mappingMode: 'defineBelow',
        matchingColumns: ['dossier_id'],
        value: {
          dossier_id: "={{ $('Échéance à J-3 ou moins ?').item.json.dossier_id }}",
          statut: 'soumis_force',
          reponse: '={{ $json.content[0].text }}'
        },
        schema: [
          { id: 'dossier_id', displayName: 'dossier_id', type: 'string', canBeUsedToMatch: true },
          { id: 'statut', displayName: 'statut', type: 'string', canBeUsedToMatch: false },
          { id: 'reponse', displayName: 'reponse', type: 'string', canBeUsedToMatch: false }
        ]
      },
      options: {}
    },
    position: [640, -100]
  }
});

const alerter_g_rant_envoi_forc = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Alerter gérant - envoi forcé',
    parameters: {
      sendTo: 'gerant@boutique-fictive.fr',
      subject: "=[Chargeback] Réponse envoyée d'office - dossier {{ $json.dossier_id }}",
      emailType: 'text',
      message: "=Le dossier {{ $json.dossier_id }} était incomplet et l'échéance arrivait à J-3 ou moins.\nUne réponse best-effort a été soumise automatiquement. Merci de vérifier.",
      options: {}
    },
    position: [880, -100]
  }
});

const alerter_g_rant_rappel_validation = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Alerter gérant - rappel validation',
    parameters: {
      sendTo: 'gerant@boutique-fictive.fr',
      subject: '=[Chargeback] Validation requise - dossier {{ $json.dossier_id }}',
      emailType: 'text',
      message: '=Le dossier {{ $json.dossier_id }} est toujours incomplet. Échéance dans {{ $json.jours_restants }} jours ({{ $json.date_echeance }}).',
      options: {}
    },
    position: [400, 100]
  }
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
