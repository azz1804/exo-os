-- Google Calendar OAuth tokens (singleton row)
CREATE TABLE IF NOT EXISTS google_auth (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    client_id TEXT NOT NULL,
    client_secret TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cached Google Calendar list
CREATE TABLE IF NOT EXISTS google_calendars (
    id TEXT PRIMARY KEY,
    summary TEXT NOT NULL,
    background_color TEXT,
    foreground_color TEXT,
    access_role TEXT,
    primary_cal INTEGER DEFAULT 0,
    selected INTEGER DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
