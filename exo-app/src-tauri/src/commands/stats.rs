use crate::db::Database;
use serde::Serialize;
use tauri::State;

#[derive(Serialize)]
pub struct DashboardStats {
    pub total_contacts: i64,
    pub total_conversations: i64,
    pub total_interactions: i64,
    pub sources: Vec<SourceStat>,
}

#[derive(Serialize)]
pub struct SourceStat {
    pub source: String,
    pub conversations: i64,
    pub interactions: i64,
}

#[tauri::command]
pub fn get_stats(db: State<Database>) -> Result<DashboardStats, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let total_contacts: i64 = conn
        .query_row("SELECT COUNT(*) FROM contacts", [], |row| row.get(0))
        .unwrap_or(0);

    let total_conversations: i64 = conn
        .query_row("SELECT COUNT(*) FROM conversations", [], |row| row.get(0))
        .unwrap_or(0);

    let total_interactions: i64 = conn
        .query_row("SELECT COUNT(*) FROM interactions", [], |row| row.get(0))
        .unwrap_or(0);

    // Per-source breakdown
    let mut stmt = conn
        .prepare(
            "SELECT source, \
             (SELECT COUNT(*) FROM conversations WHERE conversations.source = s.source) as convs, \
             (SELECT COUNT(*) FROM interactions WHERE interactions.source = s.source) as ints \
             FROM sync_state s",
        )
        .map_err(|e| e.to_string())?;

    let sources = stmt
        .query_map([], |row| {
            Ok(SourceStat {
                source: row.get(0)?,
                conversations: row.get(1)?,
                interactions: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(DashboardStats {
        total_contacts,
        total_conversations,
        total_interactions,
        sources,
    })
}
