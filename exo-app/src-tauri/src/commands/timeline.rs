use crate::db::Database;
use serde::Serialize;
use tauri::State;

#[derive(Serialize)]
pub struct TimelineEvent {
    pub id: i64,
    pub event_type: String, // "conversation" or "interaction"
    pub source: String,
    pub title: Option<String>,
    pub summary: Option<String>,
    pub occurred_at: String,
    pub contact_name: Option<String>,
}

#[tauri::command]
pub fn get_timeline(db: State<Database>, days: Option<u32>) -> Result<Vec<TimelineEvent>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let days = days.unwrap_or(7);

    let sql = format!(
        "SELECT id, 'conversation' as event_type, source, title, ai_summary, synced_at, NULL as contact_name \
         FROM conversations \
         WHERE synced_at >= datetime('now', '-{} days') \
         UNION ALL \
         SELECT i.id, 'interaction', i.source, NULL, i.content_preview, i.occurred_at, c.name \
         FROM interactions i \
         LEFT JOIN contacts c ON i.contact_id = c.id \
         WHERE i.occurred_at >= datetime('now', '-{} days') \
         ORDER BY 6 DESC \
         LIMIT 100",
        days, days
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(TimelineEvent {
                id: row.get(0)?,
                event_type: row.get(1)?,
                source: row.get(2)?,
                title: row.get(3)?,
                summary: row.get(4)?,
                occurred_at: row.get(5)?,
                contact_name: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut events = Vec::new();
    for row in rows {
        events.push(row.map_err(|e| e.to_string())?);
    }

    Ok(events)
}
