# Exo OS — Architecture "Mega Banger"

## Principe : Le Cortex Actif (Orchestrateur Intelligent)

Nous avons validé l'intégration de l'IA (Claude) directement dans l'orchestrateur Node.js. 
Plutôt que d'attendre l'action de Notion AI qui nécessite un déclenchement manuel, c'est **notre script local sur le Mac qui analyse, classe (Piliers, Intentions) et résume (AI Note Taker)** les données extraites par les MCP, AVANT de les envoyer à Notion.

```
Mac (donnees locales)
  │
  ├─ WhatsApp SQLite ──► whatsapp-mcp
  ├─ Historique Web    ──► comet-mcp
  ├─ Terminal/Code     ──► dev-mcp
  │
  └──── Orchestrateur (Cortex Actif via Anthropic API)
           │ └─ 1. Extrait le texte brut
           │ └─ 2. Analyse IA (Pilier, Intentions, Résumé)
           │
           ├────────────► Inbox Notion (Données classées d'office)
           └────────────► Contacts Exo OS (CRM auto-généré)
```

---

## Stack

| Composant          | Techno                              |
|--------------------|-------------------------------------|
| Runtime            | Node.js                             |
| Protocole          | MCP SDK (`@modelcontextprotocol/sdk`) |
| Push vers Notion   | `@notionhq/client`                  |
| Config             | `dotenv`                            |
| IA Agent           | `@anthropic-ai/sdk` (Claude API)    |
| Automatisation     | launchd / cron (macOS)              |

Dependencies necessaires :
```json
{
  "@modelcontextprotocol/sdk": "^1.26.0",
  "@notionhq/client": "^5.9.0",
  "dotenv": "^17.3.1"
}
```

---

## Structure Notion a creer

### 1. Base de donnees "Inbox Exo OS"

C'est le point d'entree. Le script pousse tout ici, brut.

| Propriete    | Type           | Description                              |
|--------------|----------------|------------------------------------------|
| Name         | Title          | Auto-genere : "WhatsApp — 2026-02-21"   |
| Source       | Select         | whatsapp / comet / dev / mail            |
| Date         | Date           | Date/heure de l'extraction               |
| Statut       | Select         | Nouveau / Traite / Archive               |

Le **contenu** de la page = le dump brut des messages/recherches/etc.

### 2. Les 5 bases de donnees Piliers (existantes)

- Business
- Spiritualite
- Sante
- Famille
- Amis

Notion AI lit l'Inbox et dispatche dans ces bases.

---

## Le .env simplifie

```env
NOTION_API_KEY=secret_xxxxxxxxxxxx
NOTION_DB_INBOX=id_de_la_base_inbox

# Optionnel si tu veux que le script dispatche aussi
# (sinon Notion AI s'en charge)
NOTION_DB_BUSINESS=...
NOTION_DB_SPIRITUALITY=...
NOTION_DB_HEALTH=...
NOTION_DB_FAMILY=...
NOTION_DB_FRIENDS=...
```

---

## L'orchestrateur — Ce qu'il fait

```
1. Se connecte aux serveurs MCP en parallele
2. Recupere les donnees brutes de chaque source
3. Pour chaque source, cree UNE page dans l'Inbox Notion :
   - Titre : "{Source} — {date du jour}"
   - Propriete Source : whatsapp / comet / dev
   - Propriete Date : maintenant
   - Propriete Statut : "Nouveau"
   - Contenu : le texte brut complet
4. Log + exit
```

C'est tout. Pas d'analyse, pas de tri, pas de JSON, pas de prompt.

---

## Notion AI — Ce qu'il fait (dans l'UI Notion)

Une fois les donnees dans l'Inbox, tu utilises Notion AI pour :

### Option A : Manuel (au debut)
Tu ouvres une page Inbox, tu demandes a Notion AI :
> "Analyse ces messages. Extrais les infos importantes.
> Pour chaque info, cree une page dans la base de donnees du Pilier correspondant
> (Business, Spiritualite, Sante, Famille, Amis).
> Marque cette page Inbox comme 'Traite'."

### Option B : Automatise (Notion Agents)
Configurer un Agent Notion qui se declenche quand une page Inbox arrive
avec le statut "Nouveau", applique le prompt ci-dessus, et dispatche.

---

## Serveurs MCP — Specs pour chaque module

### whatsapp-mcp (FAIT)
- **Outil** : `get_latest_whatsapp_messages(limit, contact_id)`
- **Source** : `~/Library/Group Containers/group.net.whatsapp.WhatsApp.shared/ChatStorage.sqlite`
- **Methode** : Lecture SQLite READONLY, table ZWAMESSAGE
- **Hyperconfigurator** : max_messages, max_age_hours, exclude_contacts, include_group_chats, include_media_captions

### comet-mcp (FAIT)
- **Outil** : `get_recent_searches(limit, search_engine_only)`
- **Source** : `~/Library/Application Support/Comet/Default/History`
- **Methode** : Copie SQLite locale pour eviter les locks, table urls/visits
- **Hyperconfigurator** : max_entries, max_age_hours, search_engines_only, exclude_domains

### dev-mcp (FAIT)
- **Outil** : `get_current_coding_context(repo_path, limit)`
- **Source** : Repositories Git locaux via `simple-git`
- **Methode** : git branch, git log, git status, git diff, grep TODO/FIXME
- **Hyperconfigurator** : repos (whitelist), max_commits, include_diffs, include_todos

### mail-mcp (FUTUR)
- **Outil** : `read_important_emails(folders, since)`
- **Source** : Gmail API (OAuth) ou Apple Mail SQLite
- **Methode** : OAuth2 pour Gmail, ou SQLite local pour Apple Mail

---

## Fichiers du projet

```
Exo OS/
├── ARCHITECTURE.md              <-- Ce fichier
├── .gitignore
├── install_auto.sh              <-- Script d'installation launchd
├── com.exoos.orchestrator.plist <-- Config launchd (21h00 quotidien)
├── logs/                        <-- Logs de l'orchestrateur
├── mcp-whatsapp-poc/
│   ├── server.js                <-- Serveur MCP WhatsApp (FAIT)
│   ├── config.json              <-- Hyperconfigurator WhatsApp
│   ├── extract.js               <-- Script test
│   └── package.json
├── mcp-comet-poc/               <-- FAIT
│   ├── server.js                <-- Serveur MCP Comet Browser
│   ├── config.json              <-- Hyperconfigurator Comet
│   └── package.json
├── mcp-dev-poc/                 <-- FAIT
│   ├── server.js                <-- Serveur MCP Git/Dev
│   ├── config.json              <-- Hyperconfigurator Dev
│   └── package.json
├── mcp-client-orchestrator/
│   ├── orchestrator.js          <-- Tuyau Bete (MCP Client → Notion)
│   ├── setup_cortex.js          <-- Script creation Cortex V2 Notion
│   ├── .env
│   └── package.json
└── hyperconfigurator/           <-- Dashboard web (Next.js)
    ├── src/app/page.tsx         <-- UI de configuration des MCP
    ├── src/app/api/config/      <-- API lecture/ecriture des config.json
    └── package.json
```

---

## Cortex V2

Le Cortex est le systeme de bases Notion interconnectees cree par `setup_cortex.js` :

- **Contacts Exo OS** — Personnes detectees, relations, sentiment, interactions
- **Evenements Exo OS** — RDV, deadlines, rappels avec relations vers contacts
- **Projets & Dossiers Exo OS** — Projets actifs avec score momentum
- **Journal Exo OS** — Resume quotidien automatique, humeur, apprentissages

Toutes les bases sont cross-liees entre elles et vers l'Inbox.

---

## Hyperconfigurator

Dashboard web Next.js (`hyperconfigurator/`) pour configurer les MCP sans toucher au code.
Chaque MCP lit son `config.json` a chaque appel d'outil, permettant des changements en temps reel.

Lancer : `cd hyperconfigurator && npm run dev`

---

## Roadmap

### Phase 1 — Tuyau WhatsApp → Inbox Notion ✅
- [x] Creer la base "Inbox Exo OS" dans Notion
- [x] Reecrire orchestrator.js : virer Claude API, push brut dans Inbox
- [x] Virer `@anthropic-ai/sdk` du package.json

### Phase 2 — Multi-sources ✅
- [x] Coder comet-mcp (historique navigateur)
- [x] Coder dev-mcp (contexte code)
- [x] Orchestrateur appelle les 3 en parallele
- [x] Hyperconfigurators (config.json) pour chaque MCP

### Phase 3 — Automatisation ✅
- [x] launchd a 21h (com.exoos.orchestrator.plist)
- [x] install_auto.sh pour installer le service

### Phase 4 — Cortex V2 ✅
- [x] setup_cortex.js pour creer les 4 bases Notion + relations
- [x] Hyperconfigurator web (Next.js dashboard)

### Phase 5 — Extensions (A VENIR)
- [ ] mail-mcp (Gmail OAuth ou Apple Mail SQLite)
- [ ] notes-mcp (Apple Notes)
- [ ] calendar-mcp (iCal)
- [ ] screenshots-mcp (OCR sur captures recentes)
- [ ] Deduplication (ne pas re-push ce qui a deja ete envoye)
- [ ] Weekly Digest automatique dans le Journal
- [ ] Notion Agent pour traiter l'Inbox automatiquement
