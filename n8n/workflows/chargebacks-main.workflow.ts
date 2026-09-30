const nouvel_email = trigger({
  type: 'n8n-nodes-base.gmailTrigger',
  version: 1.3,
  config: { name: 'Nouvel email', position: [-1400, 0] }
});

const iA_Classifier_email = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: { name: 'IA - Classifier email', position: [-1160, 0] }
});

const extraire_cat_gorie = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Extraire catégorie', position: [-920, 0] }
});

const router_selon_cat_gorie = node({
  type: 'n8n-nodes-base.switch',
  version: 3.4,
  config: { name: 'Router selon catégorie', position: [-680, 0] }
});

const iA_Extraire_infos_dossier = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: { name: 'IA - Extraire infos dossier', position: [-440, 40] }
});

const normaliser_dossier = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Normaliser dossier', position: [-200, 40] }
});

const chercher_la_commande = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: { name: 'Chercher la commande', position: [40, 40] }
});

const commande_trouv_e = node({
  type: 'n8n-nodes-base.if',
  version: 2.3,
  config: { name: 'Commande trouvée ?', position: [280, 40] }
});

const montant_sous_le_seuil = node({
  type: 'n8n-nodes-base.if',
  version: 2.3,
  config: { name: 'Montant sous le seuil ?', position: [520, 40] }
});

const logguer_accept_sous_le_seuil = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: { name: 'Logguer accepté (sous le seuil)', position: [760, -20] }
});

const preuves_de_base_facture_livraison = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: { name: 'Preuves de base (facture+livraison)', position: [760, 140] }
});

const motif_non_conforme = node({
  type: 'n8n-nodes-base.if',
  version: 2.3,
  config: { name: 'Motif = non conforme ?', position: [1000, 140] }
});

const chercher_changes_SAV = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: { name: 'Chercher échanges SAV', position: [1240, 60] }
});

const fusionner_preuves = merge({
  version: 3.2,
  config: { name: 'Fusionner preuves', position: [1480, 140] }
});

const fiche_produit_politique_retour = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: { name: 'Fiche produit + politique retour', position: [1240, 220] }
});

const logguer_incomplet_commande_introuvable = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: { name: 'Logguer incomplet (commande introuvable)', position: [520, 220] }
});

const alerter_g_rant_commande_introuvable = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: { name: 'Alerter gérant - commande introuvable', position: [760, 220] }
});

const logguer_faux_litige = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: { name: 'Logguer faux litige', position: [-440, -220] }
});

const alerter_g_rant_faux_litige = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: { name: 'Alerter gérant - faux litige', position: [-200, -220] }
});

const v_rifier_compl_tude_dossier = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Vérifier complétude dossier', position: [1720, 140] }
});

const dossier_complet = node({
  type: 'n8n-nodes-base.if',
  version: 2.3,
  config: { name: 'Dossier complet ?', position: [1960, 140] }
});

const iA_R_diger_r_ponse_complet = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: { name: 'IA - Rédiger réponse (complet)', position: [2200, 60] }
});

const marquer_soumis_automatiquement = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: { name: 'Marquer soumis automatiquement', position: [2440, 60] }
});

const iA_R_diger_r_ponse_incomplet = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: { name: 'IA - Rédiger réponse (incomplet)', position: [2200, 220] }
});

const marquer_incomplet_attente_validation = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: { name: 'Marquer incomplet (attente validation)', position: [2440, 220] }
});

const alerter_g_rant_validation_requise = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: { name: 'Alerter gérant - validation requise', position: [2680, 220] }
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