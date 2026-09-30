# N8N
Ce repository contient des workflows n8n, au format TypeScript (`@n8n/workflow-sdk`), gérés avec [`@workflows-accelerator/n8n-cli`](https://www.npmjs.com/package/@workflows-accelerator/n8n-cli) 1.2.40.

## Workflows

| Fichier | Rôle |
|---|---|
| `n8n/workflows/chargebacks-main.workflow.ts` | Traitement principal : classe les emails entrants, monte le dossier de chargeback et rédige la réponse |
| `n8n/workflows/chargebacks-watchdog.workflow.ts` | Veille quotidienne : relance ou soumet d'office les dossiers incomplets proches de l'échéance |

## Tester avec des données fictives

Les nœuds externes (Gmail, Google Sheets, IA) utilisent des données fictives épinglées (`n8n/test-data/`) : aucun compte réel n'est nécessaire. La logique (Code, If, Switch, Filter, Set, Merge) s'exécute réellement.

```bash
# Traitement principal : un scénario par chemin
n8ncli test n8n/workflows/chargebacks-main.workflow.ts --pin-data n8n/test-data/chargebacks-main.complet.pin.json
n8ncli test n8n/workflows/chargebacks-main.workflow.ts --pin-data n8n/test-data/chargebacks-main.incomplet.pin.json
n8ncli test n8n/workflows/chargebacks-main.workflow.ts --pin-data n8n/test-data/chargebacks-main.sous-seuil.pin.json
n8ncli test n8n/workflows/chargebacks-main.workflow.ts --pin-data n8n/test-data/chargebacks-main.commande-introuvable.pin.json
n8ncli test n8n/workflows/chargebacks-main.workflow.ts --pin-data n8n/test-data/chargebacks-main.faux-litige.pin.json

# Veille des échéances : 3 dossiers (J-2 envoi forcé, J-10 rappel, expiré ignoré)
n8ncli test n8n/workflows/chargebacks-watchdog.workflow.ts --pin-data n8n/test-data/chargebacks-watchdog.pin.json
```

| Scénario | Chemin attendu |
|---|---|
| `complet` | motif non conforme, toutes les preuves → réponse IA → marqué soumis |
| `incomplet` | preuve de livraison manquante → brouillon IA → marqué incomplet → alerte gérant |
| `sous-seuil` | montant < 30 € → litige accepté et loggué |
| `commande-introuvable` | commande absente → loggué incomplet → alerte gérant |
| `faux-litige` | email d'hameçonnage → loggué → alerte gérant |
