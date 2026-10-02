const embeddings_Google_Gemini_Insert = embedding({ type: '@n8n/n8n-nodes-langchain.embeddingsGoogleGemini', version: 1, config: { name: 'Embeddings Google Gemini (Insert)', parameters: { modelName: 'models/gemini-embedding-001' }, credentials: { googlePalmApi: newCredential('Google Gemini(PaLM) Api account 2', 'J6Ov5red8uJW8y2h') }, position: [880, 512], retryOnFail: true, maxTries: 5 } });
const recursive_Character_Text_Splitter = textSplitter({ type: '@n8n/n8n-nodes-langchain.textSplitterRecursiveCharacterTextSplitter', version: 1, config: { name: 'Recursive Character Text Splitter', parameters: { chunkSize: 2000, options: {} }, position: [1152, 704] } });
const default_Data_Loader = documentLoader({ type: '@n8n/n8n-nodes-langchain.documentDefaultDataLoader', version: 1.1, config: { name: 'Default Data Loader', parameters: { jsonMode: 'expressionData', jsonData: expr('{{ $json.text }}'), textSplittingMode: 'custom', options: { metadata: { metadataValues: [{ name: 'book', value: expr('{{ $json.book }}') }, { name: 'title', value: expr('{{ $json.title }}') }, { name: 'author', value: expr('{{ $json.author }}') }, { name: 'language', value: expr('{{ $json.language }}') }, { name: 'chunk', value: expr('{{ $json.chunk }}') }, { name: 'ingest_id', value: expr('{{ $json.ingest_id }}') }] } } }, position: [1072, 512], subnodes: { textSplitter: recursive_Character_Text_Splitter } } });
const google_Gemini_Chat_Model = languageModel({ type: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini', version: 1.1, config: { name: 'Google Gemini Chat Model', parameters: { modelName: 'models/gemini-flash-lite-latest', options: { temperature: 0 } }, credentials: { googlePalmApi: newCredential('Google Gemini(PaLM) Api account', 'oa5xePEXNnkbvEga') }, position: [400, 1520], retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 } });
const simple_Memory = memory({ type: '@n8n/n8n-nodes-langchain.memoryBufferWindow', version: 1.3, config: { name: 'Simple Memory', parameters: { sessionIdType: 'customKey', sessionKey: expr('{{ $(\'When chat message received\').item.json.sessionId }}'), contextWindowLength: 10 }, position: [560, 1520] } });
const search_book = tool({ type: '@n8n/n8n-nodes-langchain.toolWorkflow', version: 2.2, config: { name: 'search_book', parameters: { description: 'Recherche HYBRIDE dans le livre indexé : combine la recherche par le sens (vecteurs) et la recherche par mots-clés exacts. Peut cibler un livre précis. Renvoie les 5 passages les plus pertinents.', workflowId: { __rl: true, value: 'M5BiKBM35ZtjqoCF', mode: 'list', cachedResultUrl: '/workflow/M5BiKBM35ZtjqoCF', cachedResultName: 'RAG Livres - Recherche hybride' }, workflowInputs: { mappingMode: 'defineBelow', value: { book: expr('{{ /*n8n-auto-generated-fromAI-override*/ $fromAI(\'book\', \'Identifiant exact du livre dans lequel chercher (première colonne de la liste des livres disponibles). Vide = chercher dans tous les livres.\') }}'), query: expr('{{ /*n8n-auto-generated-fromAI-override*/ $fromAI(\'query\', \'La question reformulée en une requête de recherche claire, dans la langue du livre (en anglais si le livre est en anglais).\') }}'), keywords: expr('{{ /*n8n-auto-generated-fromAI-override*/ $fromAI(\'keywords\', \'Liste (tableau JSON) de 2 à 6 mots-clés précis, dans la langue du livre : noms propres, personnages, lieux, termes rares, sans mots vides. Exemple pour un livre en anglais : lamplighter, lamp, planet.\', \'json\') }}') }, matchingColumns: [], schema: [{ id: 'book', displayName: 'book', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string', removed: false }, { id: 'query', displayName: 'query', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string', removed: false }, { id: 'keywords', displayName: 'keywords', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'array', removed: false }], attemptToConvertTypes: false, convertFieldsToString: false } }, position: [720, 1520] } });

const on_form_submission = trigger({
  type: 'n8n-nodes-base.formTrigger',
  version: 2.5,
  config: { name: 'On form submission', parameters: { formTitle: 'Indexer un livre', formDescription: 'Dépose le PDF d\'un livre et indique son titre, son auteur et sa langue. Il est découpé en passages et indexé dans Supabase par paquets de 50 (environ 1 minute par paquet, à cause du quota gratuit de Gemini). Si le livre existe déjà, l\'ancienne version est remplacée.', formFields: { values: [{ fieldLabel: 'PDF', fieldType: 'file', multipleFiles: false, acceptFileTypes: '.pdf', requiredField: true }, { fieldLabel: 'Titre du livre', placeholder: 'ex. The Little Prince', requiredField: true }, { fieldLabel: 'Auteur', placeholder: 'ex. Antoine de Saint-Exupéry' }, { fieldLabel: 'Langue du livre', fieldType: 'dropdown', fieldOptions: { values: [{ option: 'anglais' }, { option: 'français' }, { option: 'espagnol' }, { option: 'autre' }] }, requiredField: true }] }, options: {} }, position: [0, 208], webhookId: '72491d60-b0ec-475a-8ea8-acda7cd6d464' }
});

const extract_PDF_Text = node({
  type: 'n8n-nodes-base.extractFromFile',
  version: 1.1,
  config: { name: 'Extract PDF Text', parameters: { operation: 'pdf', binaryPropertyName: expr('{{ Object.keys($binary)[0] }}'), options: {} }, position: [224, 208] }
});

const split_into_Chunks = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Split into Chunks', parameters: { jsCode: '// Découpe le texte du PDF en passages d\'environ 1500 caractères (200 de chevauchement)\n// et étiquette chaque passage avec l\'identité du livre (titre, auteur, langue).\nconst form = $(\'On form submission\').first().json;\nconst title = String(form[\'Titre du livre\'] || \'\').trim();\nconst author = String(form[\'Auteur\'] || \'\').trim();\nconst language = form[\'Langue du livre\'] || \'autre\';\n// Identifiant stable du livre : "Le Petit Prince" → "le-petit-prince"\nconst book = title\n  .normalize(\'NFD\').replace(/[\\u0300-\\u036f]/g, \'\')\n  .toLowerCase().replace(/[^a-z0-9]+/g, \'-\').replace(/^-+|-+$/g, \'\');\nif (!book) {\n  throw new Error(\'Le titre du livre est obligatoire.\');\n}\n\nconst text = ($input.first().json.text || \'\')\n  .replace(/[ \\t]+/g, \' \')\n  .replace(/\\n{3,}/g, \'\\n\\n\')\n  .trim();\nif (!text) {\n  throw new Error("Aucun texte trouvé dans le PDF (c\'est peut-être un PDF scanné, sans texte sélectionnable).");\n}\n\nconst size = 1500;\nconst overlap = 200;\nconst chunks = [];\nlet start = 0;\nwhile (start < text.length) {\n  let end = Math.min(start + size, text.length);\n  if (end < text.length) {\n    // Coupe de préférence à la fin d\'un paragraphe ou d\'une phrase\n    const cut = Math.max(text.lastIndexOf(\'\\n\', end), text.lastIndexOf(\'. \', end));\n    if (cut > start + size / 2) end = cut + 1;\n  }\n  chunks.push(text.slice(start, end).trim());\n  if (end >= text.length) break;\n  start = end - overlap;\n}\n\n// ingest_id permet de supprimer l\'ancienne version du livre une fois la nouvelle enregistrée\nconst ingestId = String($execution.id);\nconst kept = chunks.filter((t) => t.length > 0);\nreturn kept.map((t, i) => ({\n  json: { text: t, book, title, author, language, chunk: i + 1, total: kept.length, ingest_id: ingestId },\n}));' }, position: [448, 208] }
});

const loop_Over_Chunks = node({
  type: 'n8n-nodes-base.splitInBatches',
  version: 3,
  config: { name: 'Loop Over Chunks', parameters: { batchSize: 50, options: {} }, position: [672, 208] }
});

const remove_Previous_Version = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: { name: 'Remove Previous Version', parameters: { method: 'DELETE', url: 'https://stjejvhooixyrftxpjcx.supabase.co/rest/v1/documents', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi', sendQuery: true, queryParameters: { parameters: [{ name: 'metadata->>book', value: expr('eq.{{ $(\'Split into Chunks\').first().json.book }}') }, { name: 'or', value: expr('(metadata->>ingest_id.is.null,metadata->>ingest_id.neq.{{ $(\'Split into Chunks\').first().json.ingest_id }})') }] }, options: {} }, credentials: { supabaseApi: newCredential('Supabase account', 'nv8atuU6b9pUrwpB') }, position: [912, -16], executeOnce: true, alwaysOutputData: true }
});

const supabase_Vector_Store = node({
  type: '@n8n/n8n-nodes-langchain.vectorStoreSupabase',
  version: 1.3,
  config: { name: 'Supabase Vector Store', parameters: { mode: 'insert', tableName: { __rl: true, value: 'documents', mode: 'list', cachedResultName: 'documents' }, options: {} }, credentials: { supabaseApi: newCredential('Supabase account', 'nv8atuU6b9pUrwpB') }, position: [912, 288], subnodes: { embedding: embeddings_Google_Gemini_Insert, documentLoader: default_Data_Loader } }
});

const wait_1_min_Gemini_quota = node({
  type: 'n8n-nodes-base.wait',
  version: 1.1,
  config: { name: 'Wait 1 min (Gemini quota)', parameters: { amount: 61 }, position: [1184, 288], webhookId: '3209a66f-4e06-4b2e-8607-591721bb5ec9' }
});

const when_chat_message_received = trigger({
  type: '@n8n/n8n-nodes-langchain.chatTrigger',
  version: 1.4,
  config: { name: 'When chat message received', parameters: { options: {} }, position: [0, 1312], webhookId: '0e82b263-04e7-4863-bfb3-d2c8078bf2c7' }
});

const list_Books = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: { name: 'List Books', parameters: { method: 'POST', url: 'https://stjejvhooixyrftxpjcx.supabase.co/rest/v1/rpc/list_books', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi', options: {} }, credentials: { supabaseApi: newCredential('Supabase account', 'nv8atuU6b9pUrwpB') }, position: [224, 1312] }
});

const aI_Agent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: { name: 'AI Agent', parameters: { promptType: 'define', text: expr('{{ $(\'When chat message received\').item.json.chatInput }}'), options: { systemMessage: expr('Tu es un assistant qui répond aux questions sur des livres indexés dans une base de passages.\n\nLIVRES DISPONIBLES (identifiant · titre · auteur · langue · nombre de passages) :\n{{ (($json.books || []).map(b => `- ${b.book} · ${b.title} · ${b.author || \'auteur inconnu\'} · ${b.language} · ${b.passages} passages`).join(\'\\n\')) || \'(aucun livre indexé pour le moment)\' }}\n\nROUTING (avant de chercher) :\n- Si le message ne demande aucune information sur un livre (salutation, remerciement…), réponds directement sans chercher.\n- Identifie le livre concerné : celui que l\'utilisateur nomme, ou celui dont parle la conversation. S\'il n\'y a qu\'un seul livre, c\'est celui-là. Si plusieurs livres sont possibles et que rien ne permet de choisir, demande à l\'utilisateur de quel livre il parle.\n- Appelle ensuite l\'outil search_book avec :\n  • book : l\'identifiant exact du livre (première colonne de la liste) ;\n  • query : la question reformulée clairement, dans la LANGUE DU LIVRE (en anglais pour un livre en anglais, même si la question est en français) ;\n  • keywords : une LISTE de 2 à 6 mots-clés précis dans la LANGUE DU LIVRE (noms propres, personnages, lieux, termes rares), sans mots vides.\n- Si les passages trouvés ne suffisent pas, refais une recherche avec d\'autres mots-clés (2 recherches maximum).\n\nRÉPONSE :\n- Réponds uniquement à partir des passages trouvés, sans rien inventer et sans t\'appuyer sur tes connaissances générales.\n- Indique de quel livre vient ta réponse (titre et auteur de la liste).\n- Réponds toujours en français.\n- Cite entre guillemets la phrase du livre (dans sa langue d\'origine) qui justifie ta réponse.\n- Si les passages ne contiennent pas la réponse, dis clairement que le livre ne le précise pas.') } }, position: [464, 1312], retryOnFail: true, maxTries: 3, waitBetweenTries: 5000, subnodes: { model: google_Gemini_Chat_Model, memory: simple_Memory, tools: [search_book] } }
});

const wf = workflow('tIzqk9irUO2vXI9O', 'RAG Livres - Ingestion & Chat', { executionOrder: 'v1', binaryMode: 'separate', availableInMCP: true });

export default wf
  .add(on_form_submission)
  .to(extract_PDF_Text)
  .to(split_into_Chunks)
  .to(splitInBatches(loop_Over_Chunks)
  .onEachBatch(supabase_Vector_Store
    .to(wait_1_min_Gemini_quota)
    .to(nextBatch(loop_Over_Chunks)))
  .onDone(remove_Previous_Version))
  .add(when_chat_message_received)
  .to(list_Books)
  .to(aI_Agent)
  .add(sticky('## 📥 INGESTION : indexer un livre\n\n**Rôle :** transformer un PDF en passages « cherchables par le sens », stockés dans **Supabase**, pour que le chatbot RAG (en bas) puisse y répondre.\n\n**Quand ?** Une seule fois par livre : **Execute workflow** → formulaire → PDF + **titre, auteur, langue**. Chaque passage est étiqueté avec ces infos (`metadata`) : plusieurs livres cohabitent dans la même table.\n\n**Les étapes (Load → Split → Embed → Store) :**\n1. **Source** : *On form submission* reçoit le PDF\n2. **Extraction** : *Extract PDF Text* convertit le PDF en texte brut\n3. **Chunking** : *Split into Chunks* découpe le texte en passages\n4. **Envoi par paquets** : *Loop Over Chunks* traite 50 passages à la fois\n5. **Vectorisation** : *Embeddings Gemini* transforme chaque passage en vecteur\n6. **Stockage** : *Supabase Vector Store* enregistre dans la table `documents`\n7. **Pause** : *Wait 1 min* respecte le quota gratuit de Gemini (100/min)\n8. **Remplacement** : *Remove Previous Version* supprime l\'ancienne version du même livre, **après** l\'enregistrement de la nouvelle (pas de doublons)\n🔑 Les clés API sont dans les **credentials** n8n, jamais écrites en clair.', [], { name: 'Note : Ingestion', color: 7, width: 540, height: 820, position: [-720, -64] }))
  .add(sticky('### ✂️ CHUNKING (Split into Chunks)\n\nDécoupe le texte du livre en **passages d\'environ 1500 caractères**, avec un **overlap de 200 caractères** (la fin d\'un passage est répétée au début du suivant pour ne pas couper une idée).\n\nLe code coupe de préférence à la **fin d\'un paragraphe ou d\'une phrase**, comme un découpage récursif.\n\n**Pourquoi découper ?**\n- l\'IA ne peut pas lire tout le livre à chaque question\n- 1 chunk = 1 idée, donc une recherche précise\n\n*Le Petit Prince* donne **78 chunks**.\n\nℹ️ Le nœud ✂️ *Recursive Character Text Splitter* ne recoupe rien (seuil de 2000 caractères) : il est seulement exigé par le *Default Data Loader*.', [], { name: 'Note : Chunking', color: 4, width: 400, height: 560, position: [304, -480] }))
  .add(sticky('## 💬 ANSWERING : répondre aux questions\n\n`INPUT → CONTEXT → ROUTING → SEARCH → GENERATION`\n\n1. **Input** : *When chat message received* reçoit la question\n2. **Context** :\n   - *List Books* récupère le **catalogue** des livres (titre, auteur, langue) via la fonction SQL `list_books`\n   - *Simple Memory* garde les 10 derniers messages\n   - les **consignes** de l\'agent (system prompt)\n3. **Routing** : l\'*AI Agent* choisit le **livre**, reformule la question (`query`) et extrait des **mots-clés** (`keywords`) dans la langue du livre\n4. **Search** : l\'outil `search_book` appelle le workflow **RAG Livres - Recherche hybride** : recherche **hybride** (sens + mots-clés), filtrée sur le livre\n5. **Generation** : *Gemini* rédige la réponse en français, avec une citation du livre, sans rien inventer\n\n⏭️ Pas encore fait : **reranking**.', [], { name: 'Note : Answering', color: 3, width: 540, height: 640, position: [-720, 1120] }))
  .add(sticky('### 🧮 EMBEDDING + STOCKAGE\n\n**Embeddings Google Gemini (Insert)** transforme chaque chunk en **vecteur de 3072 nombres** (`gemini-embedding-001`) qui représente son **sens**.\nSens proche = vecteurs proches, donc recherche par le sens (même français ↔ anglais).\n**1 chunk = 1 embedding.**\n\n**Supabase Vector Store** enregistre pour chaque chunk : `content` (texte) + `embedding` (vecteur) + `metadata`, dans la table `documents` (`vector(3072)`).\n\n⚠️ Utiliser le **même modèle** que pour la recherche (*Embeddings … (Query)*), sinon les vecteurs ne sont pas comparables.\n⚠️ Si le quota Gemini est dépassé, on obtient des vecteurs vides et l\'erreur Supabase « vector must have at least 1 dimension ».', [], { name: 'Note : Embedding', color: 5, width: 400, height: 600, position: [1360, 208] }))