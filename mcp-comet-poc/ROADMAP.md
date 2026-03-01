# Comet MCP — Roadmap

## Vision
Tracker automatiquement l'historique de navigation pour créer des **dossiers de recherche** dans Notion. Si Mathéo passe 2h à chercher des trucs sur Epstein, un dossier "Jeffrey Epstein" se crée avec toutes les URLs, les termes de recherche, et un résumé de ce qu'il a trouvé.

## État actuel

### Ce qui existe déjà
- `server.js` : MCP fonctionnel avec outil `get_recent_searches`
- Pointe vers Comet (Chromium) : `~/Library/Application Support/Comet/Default/History`
- Copie la DB avant lecture (évite le lock)
- Filtre par domaine, âge, search engines only
- `config.json` : whitelist/blacklist domaines, max 24h

### Ce qui manque
- **Pas intégré à l'orchestrateur** (0 référence dans `orchestrator.js`)
- **Pas de clustering par sujet** — retourne juste une liste plate d'URLs
- **Pas de Notion DB "Dossiers"** — nulle part où stocker les résultats
- **Pas de tool `get_browsing_history`** — seul `get_recent_searches` existe (search engines uniquement)
- **Pas de dédup** entre les runs horaires

---

## Phase 1 — MCP complet (server.js)

### 1.1 Nouveau tool : `get_browsing_history`
Retourne TOUT l'historique (pas seulement les recherches), avec :
- `since` (ISO date) pour filtre temporel
- `keyword` pour filtre par titre/URL
- `visit_duration` minimum (éviter les pages survolées < 5 sec)

**Source SQL** : table `urls` + `visits` pour la durée

```sql
SELECT u.url, u.title, u.visit_count,
  datetime((v.visit_time / 1000000) - 11644473600, 'unixepoch', 'localtime') as date,
  v.visit_duration / 1000000 as duration_secs
FROM visits v
JOIN urls u ON u.id = v.url
WHERE v.visit_time > ?
  AND v.visit_duration > ?
ORDER BY v.visit_time DESC LIMIT ?
```

### 1.2 Nouveau tool : `get_search_terms`
Exploite `keyword_search_terms` — la table contient les queries propres sans parser les URLs.

```sql
SELECT kst.term, u.url, u.title,
  datetime((u.last_visit_time / 1000000) - 11644473600, 'unixepoch', 'localtime') as date
FROM keyword_search_terms kst
JOIN urls u ON u.id = kst.url_id
WHERE u.last_visit_time > ?
ORDER BY u.last_visit_time DESC
```

### 1.3 Noise filtering (config.json)
```json
{
  "permissions": {
    "exclude_domains": [
      "mail.google.com", "calendar.google.com",
      "notion.so", "slack.com", "linkedin.com/feed",
      "twitter.com", "x.com", "youtube.com/feed",
      "github.com/notifications", "chatgpt.com",
      "localhost", "chrome-extension://",
      "newtab", "accounts.google.com"
    ],
    "min_visit_duration_secs": 5,
    "max_entries": 500,
    "max_age_hours": 24
  }
}
```

L'idée : exclure le bruit récurrent (mail, feed, outils de travail) pour ne garder que la **navigation intentionnelle**.

### 1.4 Chrome epoch
`(timestamp / 1_000_000) - 11_644_473_600` → Unix seconds (déjà implémenté)

---

## Phase 2 — Orchestrateur : source "comet"

### 2.1 Intégration dans `orchestrator.js`
Même pattern que WhatsApp/iMessage :
1. Spawn MCP via stdio
2. Call `get_browsing_history` avec `since: last_sync.comet`
3. Call `get_search_terms` avec même `since`
4. Passer les 2 résultats à Haiku

### 2.2 Prompt Haiku — clustering par sujet
C'est le cœur de la feature. Haiku reçoit l'historique brut et doit **regrouper par sujet de recherche**.

```
Tu es l'analyste de recherche de Mathéo. Il a navigué sur ces pages et fait ces recherches :

--- HISTORIQUE ---
{browsing_history}

--- RECHERCHES ---
{search_terms}

Regroupe ces activités par SUJET DE RECHERCHE distinct.
Réponds UNIQUEMENT avec un JSON valide :
{
  "dossiers": [
    {
      "topic": "Nom court du sujet (ex: Jeffrey Epstein)",
      "summary": "Ce que Mathéo a cherché/trouvé sur ce sujet. Détaille les sources consultées, les angles de recherche, les informations clés découvertes.",
      "urls": ["url1", "url2"],
      "search_terms": ["terme1", "terme2"],
      "depth": "superficiel|modéré|approfondi"
    }
  ],
  "noise": ["urls qui ne rentrent dans aucun sujet significatif"]
}

Règles :
- Un sujet = au moins 2 pages consultées OU 1 recherche + 1 page
- "depth" = estimation basée sur le nombre d'URLs et la variété des sources
- Si une seule URL isolée sans contexte → "noise"
- Ne crée pas de dossier pour la navigation utilitaire (mail, calendar, etc)
```

### 2.3 Notion DB "Dossiers de recherche"
Nouvelle DB Notion (à créer manuellement) :

| Propriété | Type | Description |
|-----------|------|-------------|
| Name | title | Nom du sujet |
| Statut | select | `Nouveau`, `En cours`, `Archivé` |
| Profondeur | select | `superficiel`, `modéré`, `approfondi` |
| Source | select | `comet` |
| Dernière activité | date | Date du dernier ajout |
| Nombre de sources | number | Total URLs |
| Termes de recherche | rich_text | Keywords utilisés |

**Children blocks** (corps de la page) :
```
🔍 2026-02-22 — 15h30

Recherches : "jeffrey epstein", "epstein justice", "epstein kaaba"

Mathéo a fait des recherches sur Jeffrey Epstein, principalement
axées sur les procédures judiciaires (justice.gov) et des angles
plus conspirationnistes (kaaba). 6 pages consultées sur 3 sources
différentes (Google, justice.gov, Wikipedia).

Sources consultées :
- Department of Justice | Epstein Library (justice.gov)
- Jeffrey Epstein — Wikipédia
- ...
```

### 2.4 Dedup / merge intelligent
Si un dossier "Jeffrey Epstein" existe déjà :
1. Chercher dans la DB Notion par titre (même `findContactByName` pattern, fuzzy match)
2. Si trouvé → append un nouveau bloc horodaté (même pattern que les fiches contact)
3. Si pas trouvé → créer une nouvelle page
4. Mettre à jour `Dernière activité` et `Nombre de sources`

### 2.5 `last_sync.json`
Ajouter `"comet": "2026-02-22T..."` au fichier de sync existant.

---

## Phase 3 — Dashboard

### 3.1 Source toggle
Ajouter "Comet" dans `SourceToggles.jsx` — même pattern que WhatsApp/iMessage/Fathom.

### 3.2 Stats
Ajouter dans `StatsPanel.jsx` :
- Nombre de dossiers de recherche
- Dernier scan

### 3.3 (Optionnel) Vue dossiers
Un composant qui affiche les derniers dossiers créés avec leur profondeur. Pas prioritaire — Notion est la vue principale.

---

## Phase 4 — Cortex (Notion AI)

Mettre à jour le prompt Cortex pour qu'il compile aussi les dossiers de recherche en fin de journée :
- Relier les sujets de recherche aux contacts si pertinent (ex: "recherche sur le client X" → lier à la fiche contact)
- Détecter les sujets récurrents sur plusieurs jours
- Proposer des actions si la recherche semble liée à un projet

---

## Ordre de build recommandé

```
Jour 1 matin :
  ├── Créer la DB Notion "Dossiers de recherche" (manuel, 5 min)
  ├── Phase 1.1 — tool get_browsing_history
  ├── Phase 1.2 — tool get_search_terms
  └── Phase 1.3 — mettre à jour config.json (exclude_domains)

Jour 1 après-midi :
  ├── Phase 2.1 — intégrer comet dans orchestrator.js
  ├── Phase 2.2 — prompt Haiku clustering
  ├── Phase 2.3 — création page Notion avec blocs
  ├── Phase 2.4 — dedup/merge par titre
  └── Phase 2.5 — last_sync.comet

Jour 1 soir :
  ├── Phase 3.1 — source toggle dashboard
  ├── Test end-to-end : run orchestrateur → vérifier Notion
  └── Reload launchd
```

Phase 4 (Cortex) se fait dans Notion directement, pas de code.

---

## Risques / décisions ouvertes

1. **Comet vs Chrome** : Le MCP pointe vers Comet (`~/Library/Application Support/Comet/Default/History`). Si tu utilises aussi Chrome, il faudra supporter les 2 ou choisir.

2. **Volume de données** : 24h de navigation peut faire 200+ URLs. Le prompt Haiku doit rester sous les limites de tokens. Solution : filtrer agressivement le bruit AVANT d'envoyer à Haiku (min duration, exclude domains).

3. **Privacy** : L'historique de navigation est très sensible. Le `config.json` est la première ligne de défense (exclude_domains). Pas de stockage des URLs de banking, health, etc.

4. **Clustering accuracy** : Haiku peut mal regrouper. Le `depth` field aide Cortex à prioriser. Les dossiers "superficiel" (1 recherche, 2 URLs) peuvent être ignorés par Cortex.

5. **Merge false positives** : "Apple" le sujet de recherche vs "Apple" le contact exclu. Le fuzzy match doit chercher dans la DB Dossiers, pas Contacts.
