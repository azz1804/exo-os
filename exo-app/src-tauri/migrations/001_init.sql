-- Exo OS v2 — SQLite Schema
-- Replaces Notion databases with local-first storage

-- Contacts (replaces Notion Contacts DB)
CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    source TEXT NOT NULL,
    jid TEXT,
    relationship_type TEXT,
    sentiment TEXT,
    recurring_topics TEXT,
    interaction_count INTEGER DEFAULT 0,
    last_interaction_at DATETIME,
    birthday DATE,
    avatar_seed TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_jid ON contacts(jid) WHERE jid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);

-- Conversations (replaces Notion Inbox)
CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    title TEXT,
    raw_content TEXT NOT NULL,
    ai_summary TEXT,
    synced_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_conversations_source ON conversations(source);
CREATE INDEX IF NOT EXISTS idx_conversations_synced ON conversations(synced_at);

-- Interactions (granular, linked to contacts)
CREATE TABLE IF NOT EXISTS interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER REFERENCES contacts(id),
    conversation_id INTEGER REFERENCES conversations(id),
    source TEXT NOT NULL,
    direction TEXT,
    content_preview TEXT,
    occurred_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_interactions_contact ON interactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_interactions_date ON interactions(occurred_at);

-- Search history (Comet-specific)
CREATE TABLE IF NOT EXISTS search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER REFERENCES conversations(id),
    query TEXT NOT NULL,
    url TEXT,
    title TEXT,
    duration_secs INTEGER,
    searched_at DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_search_history_date ON search_history(searched_at);

-- Sync state (replaces last_sync.json)
CREATE TABLE IF NOT EXISTS sync_state (
    source TEXT PRIMARY KEY,
    last_sync_at DATETIME NOT NULL,
    status TEXT DEFAULT 'ok',
    error_message TEXT
);

-- Projects (future use, schema ready)
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    momentum_score REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Initialize sync state for all sources
INSERT OR IGNORE INTO sync_state (source, last_sync_at, status) VALUES
    ('whatsapp', '1970-01-01T00:00:00Z', 'never'),
    ('imessage', '1970-01-01T00:00:00Z', 'never'),
    ('fathom', '1970-01-01T00:00:00Z', 'never'),
    ('comet', '1970-01-01T00:00:00Z', 'never');
