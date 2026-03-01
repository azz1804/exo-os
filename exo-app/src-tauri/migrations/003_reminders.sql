CREATE TABLE IF NOT EXISTS fired_reminders (
    event_id TEXT NOT NULL,
    minutes INTEGER NOT NULL,
    fired_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (event_id, minutes)
);
