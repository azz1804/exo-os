use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new() -> Result<Self, String> {
        let db_path = get_db_path()?;

        // Ensure parent directory exists
        if let Some(parent) = db_path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create data dir: {}", e))?;
        }

        let conn =
            Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

        // Enable WAL mode for better concurrent read/write
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
            .map_err(|e| format!("Failed to set pragmas: {}", e))?;

        // Run migrations
        run_migrations(&conn)?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }
}

fn get_db_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    Ok(home.join(".exo-os").join("exo.db"))
}

fn run_migrations(conn: &Connection) -> Result<(), String> {
    // Create schema_version table if it doesn't exist
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);"
    ).map_err(|e| format!("Failed to create schema_version: {}", e))?;

    let current: i64 = conn
        .query_row("SELECT COALESCE(MAX(version), 0) FROM schema_version", [], |r| r.get(0))
        .unwrap_or(0);

    let migrations: &[(i64, &str)] = &[
        (1, include_str!("../migrations/001_init.sql")),
        (2, include_str!("../migrations/002_google_calendar.sql")),
        (3, include_str!("../migrations/003_reminders.sql")),
    ];

    for (version, sql) in migrations {
        if *version > current {
            conn.execute_batch(sql)
                .map_err(|e| format!("Migration {} failed: {}", version, e))?;
            conn.execute("INSERT INTO schema_version (version) VALUES (?1)", [version])
                .map_err(|e| format!("Failed to record migration {}: {}", version, e))?;
        }
    }

    Ok(())
}
