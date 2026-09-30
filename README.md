# Chargebacks — workflows n8n

Automatisation du traitement des **chargebacks** (litiges bancaires) d'une boutique en ligne : détection des emails de litige, constitution du dossier de preuves, rédaction de la réponse par IA, et veille des échéances.

Les workflows sont écrits en **TypeScript** (`@n8n/workflow-sdk`) et gérés avec [`@workflows-accelerator/n8n-cli`](https://www.npmjs.com/package/@workflows-accelerator/n8n-cli) **1.2.40**.

## Tester en 3 étapes

1. **Prérequis** : une instance n8n **2.18 ou plus récente**, avec une clé API (**Settings → n8n API**) et l'accès MCP activé (**Settings → MCP**, pour l'access token).
2. **Installer le CLI et initialiser le repo** avec votre instance :

   ```bash
   npm install -g @workflows-accelerator/n8n-cli@1.2.40
   n8ncli init --url <URL_N8N> --access-token <ACCESS_TOKEN> --api-key <API_KEY> --no-examples
   n8ncli projects      # noter l'ID de votre projet
   n8ncli init --url <URL_N8N> --access-token <ACCESS_TOKEN> --api-key <API_KEY> --project-id <ID_PROJET> --no-examples
   ```

   La seconde commande `init` est nécessaire : `n8n/config/n8n-cli.json` pointe vers le projet de l'auteur, et sans votre ID le test échoue avec « Project not found ».

3. **Lancer tous les tests** depuis la racine du repo :

   ```bash
   npm test
   ```

   Résultat attendu :

   ```
   OK     chargebacks-main / complet
   OK     chargebacks-main / incomplet
   OK     chargebacks-main / sous-seuil
   OK     chargebacks-main / commande-introuvable
   OK     chargebacks-main / faux-litige
   OK     chargebacks-watchdog

   6/6 scénarios réussis
   ```

> **Données fictives.** Les nœuds externes (Gmail, Google Sheets, IA) sont entièrement paramétrés mais pointent vers des ressources fictives. Leurs résultats sont simulés par des données épinglées (`n8n/test-data/`), donc aucun compte réel n'est nécessaire. Toute la logique (Code, If, Switch, Filter, Set, Merge) s'exécute réellement.
>
> **Workflows « [Temp Test] ».** `n8ncli test` crée un workflow temporaire par test. Sans base PostgreSQL configurée, il les archive au lieu de les supprimer : ils apparaissent dans les workflows archivés de n8n et peuvent être supprimés sans risque.

## Les workflows

### `chargebacks-main.workflow.ts` — Traitement principal (26 nœuds)

```
Nouvel email Gmail → IA : classifier l'email → Router selon catégorie
 ├─ faux litige (hameçonnage)  → logguer + alerter le gérant
 └─ chargeback → IA : extraire les infos → normaliser → chercher la commande
     ├─ commande introuvable    → logguer « incomplet » + alerter le gérant
     └─ commande trouvée → montant < 30 € ?
         ├─ oui → accepter le litige (contester coûte plus cher) + logguer
         └─ non → preuves de base (facture + livraison)
                  + si motif « non conforme » : échanges SAV + fiche produit
                  → vérifier la complétude du dossier
                     ├─ complet   → IA : rédiger la réponse → marquer « soumis »
                     └─ incomplet → IA : brouillon → marquer « incomplet » → alerter le gérant
```

### `chargebacks-watchdog.workflow.ts` — Veille des échéances (9 nœuds)

Chaque jour à 8 h, relit les dossiers « incomplet » et calcule les jours restants avant l'échéance :
- **J-3 ou moins** → réponse IA « best-effort » soumise d'office, puis le gérant est alerté ;
- **plus de 3 jours** → rappel au gérant pour qu'il complète le dossier ;
- **échéance dépassée** → ignoré.

## Scénarios de test

| Fichier (`n8n/test-data/`) | Situation simulée | Chemin attendu |
|---|---|---|
| `chargebacks-main.complet.pin.json` | Casque « non conforme », 189,90 €, toutes les preuves | réponse IA → soumis |
| `chargebacks-main.incomplet.pin.json` | « Produit non reçu », 74,50 €, preuve de livraison manquante | brouillon → incomplet → alerte gérant |
| `chargebacks-main.sous-seuil.pin.json` | Litige de 12,90 € | accepté et loggué |
| `chargebacks-main.commande-introuvable.pin.json` | Commande CMD-99999 inexistante | loggué incomplet → alerte gérant |
| `chargebacks-main.faux-litige.pin.json` | Email d'hameçonnage imitant un PSP | loggué → alerte gérant |
| `chargebacks-watchdog.pin.json` | 3 dossiers : J-2, J-10, expiré | envoi forcé / rappel / ignoré |

Un scénario isolé se lance avec :

```bash
n8ncli test n8n/workflows/chargebacks-main.workflow.ts --pin-data n8n/test-data/chargebacks-main.complet.pin.json
```

## Contenu du repo

```
n8n/
  workflows/     les 2 workflows (TypeScript)
  test-data/     les 6 scénarios de données fictives
  config/        configuration de n8ncli (standards, mise en page, projet)
scripts/
  test-all.mjs   lance les 6 scénarios (npm test) et échoue si l'un d'eux échoue
.claude/skills/  skills Claude Code : interview, hostile-review, doubt-driven-dev
.agents/skills/  skill n8ncli importé automatiquement par le CLI
```
