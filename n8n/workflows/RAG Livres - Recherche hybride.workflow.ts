const search_Request = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { name: 'Search Request', parameters: { workflowInputs: { values: [{ name: 'book' }, { name: 'query' }, { name: 'keywords', type: 'any' }] } }, position: [-160, 0] }
});

const embed_Question_Gemini = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: { name: 'Embed Question (Gemini)', parameters: { method: 'POST', url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent', authentication: 'predefinedCredentialType', nodeCredentialType: 'googlePalmApi', sendBody: true, specifyBody: 'json', jsonBody: expr('{\n  "content": { "parts": [ { "text": {{ ($json.query || [].concat($json.keywords || []).join(\' \') || \'\').toJsonString() }} } ] }\n}'), options: {} }, credentials: { googlePalmApi: newCredential('Google Gemini(PaLM) Api account', 'oa5xePEXNnkbvEga') }, position: [224, 0] }
});

const hybrid_Search_Supabase = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: { name: 'Hybrid Search (Supabase)', parameters: { method: 'POST', url: 'https://stjejvhooixyrftxpjcx.supabase.co/rest/v1/rpc/hybrid_search', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi', sendBody: true, specifyBody: 'json', jsonBody: expr('{\n  "query_text": {{ ([].concat($(\'Search Request\').item.json.keywords || []).join(\' \') || $(\'Search Request\').item.json.query || \'\').toJsonString() }},\n  "query_embedding": {{ JSON.stringify($json.embedding.values) }},\n  "match_count": 5,\n  "filter": {{ JSON.stringify($(\'Search Request\').item.json.book ? { book: $(\'Search Request\').item.json.book } : {}) }}\n}'), options: {} }, credentials: { supabaseApi: newCredential('Supabase account', 'nv8atuU6b9pUrwpB') }, position: [448, 0], alwaysOutputData: true }
});

const format_Passages = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Format Passages', parameters: { jsCode: '// Met en forme les passages trouvés pour l\'agent (texte + d\'où vient chaque résultat)\nconst rows = $input.all().map((item) => item.json).filter((row) => row.content);\n\nif (rows.length === 0) {\n  return [{ json: { response: \'Aucun passage trouvé pour cette recherche.\' } }];\n}\n\nconst rank = (r) => (r === null || r === undefined ? \'—\' : `#${r}`);\nconst response = rows\n  .map((row, i) => `Passage ${i + 1} — ${(row.metadata && row.metadata.title) || \'livre inconnu\'} (mots-clés ${rank(row.keyword_rank)} · sens ${rank(row.semantic_rank)})\\n${row.content}`)\n  .join(\'\\n\\n---\\n\\n\');\n\nreturn [{ json: { response } }];' }, position: [640, 0] }
});

const wf = workflow('M5BiKBM35ZtjqoCF', 'RAG Livres - Recherche hybride', { executionOrder: 'v1', availableInMCP: true, binaryMode: 'separate' });

export default wf
  .add(search_Request)
  .to(embed_Question_Gemini)
  .to(hybrid_Search_Supabase)
  .to(format_Passages)
  .add(sticky('## 🔀 RECHERCHE HYBRIDE (outil `search_book`)\n\nAppelé par l\'**AI Agent** du chatbot, avec 3 paramètres décidés par l\'agent (**routing**) :\n- `book` : l\'identifiant du livre visé (filtre sur `metadata.book`, vide = tous les livres)\n- `query` : la question reformulée, dans la langue du livre\n- `keywords` : 2 à 6 mots-clés précis (noms propres, termes rares)\n\n**Étapes :**\n1. **Embed Question** : la question devient un vecteur de 3072 nombres (Gemini, même modèle que l\'ingestion)\n2. **Hybrid Search** : appelle la fonction SQL `hybrid_search` de Supabase, qui combine\n   - la recherche **par le sens** (vecteurs, `<=>`)\n   - la recherche **par mots-clés** (plein texte, colonne `fts`)\n   - puis fusionne les deux classements (**Reciprocal Rank Fusion**)\n3. **Format Passages** : renvoie les 5 meilleurs passages à l\'agent\n\n🔑 Clés API via les credentials Gemini et Supabase (jamais en clair).', [], { name: 'Note : Recherche hybride', color: 6, width: 560, height: 520, position: [-48, -560] }))