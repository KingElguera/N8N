const nouvel_email = trigger({
  type: 'n8n-nodes-base.gmailTrigger',
  version: 1.3,
  config: {
    name: 'Nouvel email',
    parameters: {
      pollTimes: { item: [{ mode: 'everyMinute' }] },
      simple: false,
      filters: { labelIds: ['INBOX'] },
      options: {}
    },
    position: [-1400, 0]
  }
});

const iA_Classifier_email = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'IA - Classifier email',
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
  max_tokens: 300,
  messages: [{
    role: 'user',
    content: 'Classe cet email. Réponds uniquement en JSON {"categorie": "chargeback" | "faux_litige" | "autre", "confiance": 0-1, "raison": "..."}. "faux_litige" = email qui imite une notification de litige (phishing, faux PSP). Sujet : ' + $json.subject + ' / Expéditeur : ' + $json.from.value[0].address + ' / Corps : ' + $json.text
  }]
}) }}`,
      options: {}
    },
    position: [-1160, 0]
  }
});

const extraire_cat_gorie = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Extraire catégorie',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `const email = $('Nouvel email').first().json;

return $input.all().map(item => {
  let resultat = { categorie: 'autre', confiance: 0, raison: 'réponse IA illisible' };
  try {
    const texte = item.json.content[0].text;
    resultat = JSON.parse(texte.slice(texte.indexOf('{'), texte.lastIndexOf('}') + 1));
  } catch (e) {}
  return {
    json: {
      categorie: String(resultat.categorie || 'autre').toLowerCase(),
      confiance: resultat.confiance,
      raison: resultat.raison,
      email_id: email.id,
      email_sujet: email.subject,
      email_expediteur: email.from.value[0].address,
      email_texte: email.text
    }
  };
});`
    },
    notes: "Lit le JSON renvoyé par l'IA (même entouré de texte) et y rattache l'email d'origine.",
    notesInFlow: true,
    position: [-920, 0]
  }
});

const router_selon_cat_gorie = node({
  type: 'n8n-nodes-base.switch',
  version: 3.4,
  config: {
    name: 'Router selon catégorie',
    parameters: {
      rules: {
        values: [
          {
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
              conditions: [
                {
                  id: 'a1b2c3d4-0001-4000-8000-000000000001',
                  leftValue: '={{ $json.categorie }}',
                  rightValue: 'chargeback',
                  operator: { type: 'string', operation: 'equals' }
                }
              ],
              combinator: 'and'
            },
            renameOutput: true,
            outputKey: 'Chargeback'
          },
          {
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
              conditions: [
                {
                  id: 'a1b2c3d4-0002-4000-8000-000000000002',
                  leftValue: '={{ $json.categorie }}',
                  rightValue: 'faux_litige',
                  operator: { type: 'string', operation: 'equals' }
                }
              ],
              combinator: 'and'
            },
            renameOutput: true,
            outputKey: 'Faux litige'
          }
        ]
      },
      options: {}
    },
    position: [-680, 0]
  }
});

const iA_Extraire_infos_dossier = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'IA - Extraire infos dossier',
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
  max_tokens: 500,
  messages: [{
    role: 'user',
    content: 'Extrais les informations de ce litige. Réponds uniquement en JSON {"reference_litige", "commande_id", "montant", "devise", "motif": "produit_non_recu" | "non_conforme" | "fraude" | "autre", "date_echeance": "AAAA-MM-JJ"}. Email : ' + $json.email_texte
  }]
}) }}`,
      options: {}
    },
    position: [-440, 40]
  }
});

const normaliser_dossier = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Normaliser dossier',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `const email = $('Extraire catégorie').first().json;
const MOTIFS = ['produit_non_recu', 'non_conforme', 'fraude'];

return $input.all().map(item => {
  const texte = item.json.content[0].text;
  const brut = JSON.parse(texte.slice(texte.indexOf('{'), texte.lastIndexOf('}') + 1));
  const motif = String(brut.motif || '')
    .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase().trim().replace(/[\\s-]+/g, '_');
  return {
    json: {
      dossier_id: 'CB-' + String(brut.reference_litige || email.email_id).replace(/^CB-/i, ''),
      commande_id: String(brut.commande_id || '').toUpperCase().trim(),
      montant: Number(String(brut.montant).replace(',', '.')),
      devise: brut.devise || 'EUR',
      motif: MOTIFS.includes(motif) ? motif : 'autre',
      date_echeance: String(brut.date_echeance || '').slice(0, 10),
      date_reception: new Date().toISOString().slice(0, 10),
      email_id: email.email_id
    }
  };
});`
    },
    notes: 'Met les champs extraits par l’IA dans un format fixe (montant numérique, motif normalisé, dates ISO).',
    notesInFlow: true,
    position: [-200, 40]
  }
});

const chercher_la_commande = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Chercher la commande',
    parameters: {
      operation: 'read',
      documentId: { __rl: true, mode: 'id', value: 'SHEET_FICTIF_CHARGEBACKS' },
      sheetName: { __rl: true, mode: 'name', value: 'Commandes' },
      filtersUI: { values: [{ lookupColumn: 'commande_id', lookupValue: '={{ $json.commande_id }}' }] },
      options: {}
    },
    alwaysOutputData: true,
    position: [40, 40]
  }
});

const commande_trouv_e = node({
  type: 'n8n-nodes-base.if',
  version: 2.3,
  config: {
    name: 'Commande trouvée ?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'a1b2c3d4-0003-4000-8000-000000000003',
            leftValue: '={{ $json.commande_id }}',
            rightValue: '',
            operator: { type: 'string', operation: 'notEmpty', singleValue: true }
          }
        ],
        combinator: 'and'
      },
      options: {}
    },
    position: [280, 40]
  }
});

const montant_sous_le_seuil = node({
  type: 'n8n-nodes-base.if',
  version: 2.3,
  config: {
    name: 'Montant sous le seuil ?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [
          {
            id: 'a1b2c3d4-0004-4000-8000-000000000004',
            leftValue: "={{ $('Normaliser dossier').first().json.montant }}",
            rightValue: 30,
            operator: { type: 'number', operation: 'lt' }
          }
        ],
        combinator: 'and'
      },
      options: {}
    },
    notes: 'Seuil : sous 30 €, contester coûte plus cher que rembourser.',
    position: [520, 40]
  }
});

const logguer_accept_sous_le_seuil = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Logguer accepté (sous le seuil)',
    parameters: {
      operation: 'append',
      documentId: { __rl: true, mode: 'id', value: 'SHEET_FICTIF_CHARGEBACKS' },
      sheetName: { __rl: true, mode: 'name', value: 'Dossiers' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          dossier_id: "={{ $('Normaliser dossier').first().json.dossier_id }}",
          commande_id: "={{ $('Normaliser dossier').first().json.commande_id }}",
          montant: "={{ $('Normaliser dossier').first().json.montant }}",
          motif: "={{ $('Normaliser dossier').first().json.motif }}",
          statut: 'accepte_sous_seuil'
        },
        schema: [
          { id: 'dossier_id', displayName: 'dossier_id', type: 'string' },
          { id: 'commande_id', displayName: 'commande_id', type: 'string' },
          { id: 'montant', displayName: 'montant', type: 'number' },
          { id: 'motif', displayName: 'motif', type: 'string' },
          { id: 'statut', displayName: 'statut', type: 'string' }
        ]
      },
      options: {}
    },
    position: [760, -20]
  }
});

const preuves_de_base_facture_livraison = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Preuves de base (facture+livraison)',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          { id: 'p1', name: 'dossier_id', value: "={{ $('Normaliser dossier').first().json.dossier_id }}", type: 'string' },
          { id: 'p2', name: 'commande_id', value: '={{ $json.commande_id }}', type: 'string' },
          { id: 'p3', name: 'montant', value: "={{ $('Normaliser dossier').first().json.montant }}", type: 'number' },
          { id: 'p4', name: 'motif', value: "={{ $('Normaliser dossier').first().json.motif }}", type: 'string' },
          { id: 'p5', name: 'date_echeance', value: "={{ $('Normaliser dossier').first().json.date_echeance }}", type: 'string' },
          { id: 'p6', name: 'client', value: '={{ $json.client }}', type: 'string' },
          { id: 'p7', name: 'email_client', value: '={{ $json.email_client }}', type: 'string' },
          { id: 'p8', name: 'produit_sku', value: '={{ $json.produit_sku }}', type: 'string' },
          { id: 'p9', name: 'facture_url', value: '={{ $json.facture_url }}', type: 'string' },
          { id: 'p10', name: 'preuve_livraison_url', value: '={{ $json.preuve_livraison_url }}', type: 'string' },
          { id: 'p11', name: 'numero_suivi', value: '={{ $json.numero_suivi }}', type: 'string' }
        ]
      },
      options: {}
    },
    position: [760, 140]
  }
});

const motif_non_conforme = node({
  type: 'n8n-nodes-base.if',
  version: 2.3,
  config: {
    name: 'Motif = non conforme ?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [
          {
            id: 'a1b2c3d4-0005-4000-8000-000000000005',
            leftValue: '={{ $json.motif }}',
            rightValue: 'non_conforme',
            operator: { type: 'string', operation: 'equals' }
          }
        ],
        combinator: 'and'
      },
      options: {}
    },
    position: [1000, 140]
  }
});

const chercher_changes_SAV = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Chercher échanges SAV',
    parameters: {
      operation: 'getAll',
      returnAll: false,
      limit: 10,
      filters: { q: '={{ "from:" + $json.email_client + " OR to:" + $json.email_client }}' },
      options: {}
    },
    alwaysOutputData: true,
    position: [1240, 60]
  }
});

const fusionner_preuves = merge({
  version: 3.2,
  config: {
    name: 'Fusionner preuves',
    parameters: { mode: 'append' },
    position: [1480, 140]
  }
});

const fiche_produit_politique_retour = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Fiche produit + politique retour',
    parameters: {
      operation: 'read',
      documentId: { __rl: true, mode: 'id', value: 'SHEET_FICTIF_CHARGEBACKS' },
      sheetName: { __rl: true, mode: 'name', value: 'Produits' },
      filtersUI: { values: [{ lookupColumn: 'sku', lookupValue: '={{ $json.produit_sku }}' }] },
      options: {}
    },
    alwaysOutputData: true,
    position: [1240, 220]
  }
});

const logguer_incomplet_commande_introuvable = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Logguer incomplet (commande introuvable)',
    parameters: {
      operation: 'append',
      documentId: { __rl: true, mode: 'id', value: 'SHEET_FICTIF_CHARGEBACKS' },
      sheetName: { __rl: true, mode: 'name', value: 'Dossiers' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          dossier_id: "={{ $('Normaliser dossier').first().json.dossier_id }}",
          commande_id: "={{ $('Normaliser dossier').first().json.commande_id }}",
          montant: "={{ $('Normaliser dossier').first().json.montant }}",
          motif: "={{ $('Normaliser dossier').first().json.motif }}",
          date_echeance: "={{ $('Normaliser dossier').first().json.date_echeance }}",
          statut: 'incomplet',
          pieces_manquantes: 'commande introuvable'
        },
        schema: [
          { id: 'dossier_id', displayName: 'dossier_id', type: 'string' },
          { id: 'commande_id', displayName: 'commande_id', type: 'string' },
          { id: 'montant', displayName: 'montant', type: 'number' },
          { id: 'motif', displayName: 'motif', type: 'string' },
          { id: 'date_echeance', displayName: 'date_echeance', type: 'string' },
          { id: 'statut', displayName: 'statut', type: 'string' },
          { id: 'pieces_manquantes', displayName: 'pieces_manquantes', type: 'string' }
        ]
      },
      options: {}
    },
    position: [520, 220]
  }
});

const alerter_g_rant_commande_introuvable = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Alerter gérant - commande introuvable',
    parameters: {
      sendTo: 'gerant@boutique-fictive.fr',
      subject: "=[Chargeback] Commande introuvable - {{ $('Normaliser dossier').first().json.commande_id }}",
      emailType: 'text',
      message: "=Le litige {{ $('Normaliser dossier').first().json.dossier_id }} référence la commande {{ $('Normaliser dossier').first().json.commande_id }}, absente de la feuille Commandes.\nMontant : {{ $('Normaliser dossier').first().json.montant }} € - échéance : {{ $('Normaliser dossier').first().json.date_echeance }}.",
      options: {}
    },
    position: [760, 220]
  }
});

const logguer_faux_litige = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Logguer faux litige',
    parameters: {
      operation: 'append',
      documentId: { __rl: true, mode: 'id', value: 'SHEET_FICTIF_CHARGEBACKS' },
      sheetName: { __rl: true, mode: 'name', value: 'Faux litiges' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          email_id: '={{ $json.email_id }}',
          expediteur: '={{ $json.email_expediteur }}',
          sujet: '={{ $json.email_sujet }}',
          raison: '={{ $json.raison }}'
        },
        schema: [
          { id: 'email_id', displayName: 'email_id', type: 'string' },
          { id: 'expediteur', displayName: 'expediteur', type: 'string' },
          { id: 'sujet', displayName: 'sujet', type: 'string' },
          { id: 'raison', displayName: 'raison', type: 'string' }
        ]
      },
      options: {}
    },
    position: [-440, -220]
  }
});

const alerter_g_rant_faux_litige = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Alerter gérant - faux litige',
    parameters: {
      sendTo: 'gerant@boutique-fictive.fr',
      subject: "=[Alerte] Faux litige détecté - {{ $('Extraire catégorie').first().json.email_sujet }}",
      emailType: 'text',
      message: "=Un email imitant une notification de litige a été reçu de {{ $('Extraire catégorie').first().json.email_expediteur }}.\nRaison : {{ $('Extraire catégorie').first().json.raison }}\nNe cliquez sur aucun lien.",
      options: {}
    },
    position: [-200, -220]
  }
});

const v_rifier_compl_tude_dossier = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Vérifier complétude dossier',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `const dossier = $('Preuves de base (facture+livraison)').first().json;

const pieces = {
  facture: Boolean(dossier.facture_url),
  preuve_livraison: Boolean(dossier.preuve_livraison_url)
};

let echanges_sav = [];
let fiche_produit = null;
if (dossier.motif === 'non_conforme') {
  if ($('Chercher échanges SAV').isExecuted) {
    echanges_sav = $('Chercher échanges SAV').all().map(i => i.json).filter(m => m.id);
  }
  if ($('Fiche produit + politique retour').isExecuted) {
    fiche_produit = $('Fiche produit + politique retour').all().map(i => i.json).find(p => p.sku) || null;
  }
  pieces.echanges_sav = echanges_sav.length > 0;
  pieces.fiche_produit = fiche_produit !== null;
}

const pieces_manquantes = Object.keys(pieces).filter(k => !pieces[k]);

return [{
  json: {
    ...dossier,
    echanges_sav,
    fiche_produit,
    pieces,
    pieces_manquantes: pieces_manquantes.join(', '),
    complet: pieces_manquantes.length === 0
  }
}];`
    },
    notes: 'Toujours : facture + preuve de livraison. Motif non conforme : en plus échanges SAV + fiche produit.',
    notesInFlow: true,
    position: [1720, 140]
  }
});

const dossier_complet = node({
  type: 'n8n-nodes-base.if',
  version: 2.3,
  config: {
    name: 'Dossier complet ?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [
          {
            id: 'a1b2c3d4-0006-4000-8000-000000000006',
            leftValue: '={{ $json.complet }}',
            rightValue: '',
            operator: { type: 'boolean', operation: 'true', singleValue: true }
          }
        ],
        combinator: 'and'
      },
      options: {}
    },
    position: [1960, 140]
  }
});

const iA_R_diger_r_ponse_complet = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'IA - Rédiger réponse (complet)',
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
    content: 'Rédige la réponse de contestation de ce chargeback à destination de la banque, en citant chaque preuve disponible. Dossier : ' + JSON.stringify($json)
  }]
}) }}`,
      options: {}
    },
    position: [2200, 60]
  }
});

const marquer_soumis_automatiquement = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Marquer soumis automatiquement',
    parameters: {
      operation: 'appendOrUpdate',
      documentId: { __rl: true, mode: 'id', value: 'SHEET_FICTIF_CHARGEBACKS' },
      sheetName: { __rl: true, mode: 'name', value: 'Dossiers' },
      columns: {
        mappingMode: 'defineBelow',
        matchingColumns: ['dossier_id'],
        value: {
          dossier_id: "={{ $('Vérifier complétude dossier').first().json.dossier_id }}",
          commande_id: "={{ $('Vérifier complétude dossier').first().json.commande_id }}",
          montant: "={{ $('Vérifier complétude dossier').first().json.montant }}",
          motif: "={{ $('Vérifier complétude dossier').first().json.motif }}",
          date_echeance: "={{ $('Vérifier complétude dossier').first().json.date_echeance }}",
          statut: 'soumis',
          reponse: '={{ $json.content[0].text }}'
        },
        schema: [
          { id: 'dossier_id', displayName: 'dossier_id', type: 'string', canBeUsedToMatch: true },
          { id: 'commande_id', displayName: 'commande_id', type: 'string' },
          { id: 'montant', displayName: 'montant', type: 'number' },
          { id: 'motif', displayName: 'motif', type: 'string' },
          { id: 'date_echeance', displayName: 'date_echeance', type: 'string' },
          { id: 'statut', displayName: 'statut', type: 'string' },
          { id: 'reponse', displayName: 'reponse', type: 'string' }
        ]
      },
      options: {}
    },
    position: [2440, 60]
  }
});

const iA_R_diger_r_ponse_incomplet = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'IA - Rédiger réponse (incomplet)',
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
    content: 'Rédige un brouillon de contestation de ce chargeback. Des pièces manquent (' + $json.pieces_manquantes + ') : signale-les entre crochets pour que le gérant les complète. Dossier : ' + JSON.stringify($json)
  }]
}) }}`,
      options: {}
    },
    position: [2200, 220]
  }
});

const marquer_incomplet_attente_validation = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Marquer incomplet (attente validation)',
    parameters: {
      operation: 'appendOrUpdate',
      documentId: { __rl: true, mode: 'id', value: 'SHEET_FICTIF_CHARGEBACKS' },
      sheetName: { __rl: true, mode: 'name', value: 'Dossiers' },
      columns: {
        mappingMode: 'defineBelow',
        matchingColumns: ['dossier_id'],
        value: {
          dossier_id: "={{ $('Vérifier complétude dossier').first().json.dossier_id }}",
          commande_id: "={{ $('Vérifier complétude dossier').first().json.commande_id }}",
          montant: "={{ $('Vérifier complétude dossier').first().json.montant }}",
          motif: "={{ $('Vérifier complétude dossier').first().json.motif }}",
          date_echeance: "={{ $('Vérifier complétude dossier').first().json.date_echeance }}",
          statut: 'incomplet',
          pieces_manquantes: "={{ $('Vérifier complétude dossier').first().json.pieces_manquantes }}",
          reponse: '={{ $json.content[0].text }}'
        },
        schema: [
          { id: 'dossier_id', displayName: 'dossier_id', type: 'string', canBeUsedToMatch: true },
          { id: 'commande_id', displayName: 'commande_id', type: 'string' },
          { id: 'montant', displayName: 'montant', type: 'number' },
          { id: 'motif', displayName: 'motif', type: 'string' },
          { id: 'date_echeance', displayName: 'date_echeance', type: 'string' },
          { id: 'statut', displayName: 'statut', type: 'string' },
          { id: 'pieces_manquantes', displayName: 'pieces_manquantes', type: 'string' },
          { id: 'reponse', displayName: 'reponse', type: 'string' }
        ]
      },
      options: {}
    },
    position: [2440, 220]
  }
});

const alerter_g_rant_validation_requise = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Alerter gérant - validation requise',
    parameters: {
      sendTo: 'gerant@boutique-fictive.fr',
      subject: "=[Chargeback] Validation requise - dossier {{ $('Vérifier complétude dossier').first().json.dossier_id }}",
      emailType: 'text',
      message: "=Le dossier {{ $('Vérifier complétude dossier').first().json.dossier_id }} est incomplet.\nPièces manquantes : {{ $('Vérifier complétude dossier').first().json.pieces_manquantes }}\nÉchéance : {{ $('Vérifier complétude dossier').first().json.date_echeance }}\nUn brouillon de réponse attend ta validation dans la feuille Dossiers.",
      options: {}
    },
    position: [2680, 220]
  }
});

const wf = workflow('', 'Chargebacks - Traitement principal', { executionOrder: 'v1' });

export default wf
  .add(nouvel_email)
  .to(iA_Classifier_email)
  .to(extraire_cat_gorie)
  .to(router_selon_cat_gorie.onCase(0, iA_Extraire_infos_dossier
    .to(normaliser_dossier)
    .to(chercher_la_commande)
    .to(commande_trouv_e.onTrue(montant_sous_le_seuil.onTrue(logguer_accept_sous_le_seuil).onFalse(preuves_de_base_facture_livraison
        .to(motif_non_conforme.onTrue([chercher_changes_SAV, fiche_produit_politique_retour])))).onFalse(logguer_incomplet_commande_introuvable
      .to(alerter_g_rant_commande_introuvable)))).onCase(1, logguer_faux_litige
    .to(alerter_g_rant_faux_litige)))
  .add(chercher_changes_SAV.to(fusionner_preuves.input(0)))
  .add(fiche_produit_politique_retour.to(fusionner_preuves.input(1)))
  .add(motif_non_conforme.output(1).to(fusionner_preuves.input(0)))
  .add(fusionner_preuves)
  .to(v_rifier_compl_tude_dossier
  .to(dossier_complet.onTrue(iA_R_diger_r_ponse_complet
    .to(marquer_soumis_automatiquement)).onFalse(iA_R_diger_r_ponse_incomplet
    .to(marquer_incomplet_attente_validation)
    .to(alerter_g_rant_validation_requise))))
