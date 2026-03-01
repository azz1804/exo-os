use crate::db::Database;
use chrono::{Duration, Utc};
use serde::Serialize;
use tauri::State;

#[derive(Serialize)]
pub struct SourceStatus {
    pub source: String,
    pub last_sync_at: String,
    pub status: String,
    pub healthy: bool,
    pub minutes_ago: i64,
    pub error_message: Option<String>,
}

#[tauri::command]
pub fn get_sync_status(db: State<Database>) -> Result<Vec<SourceStatus>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT source, last_sync_at, status, error_message FROM sync_state")
        .map_err(|e| e.to_string())?;

    let now = Utc::now();
    let two_hours = Duration::hours(2);
    let four_hours = Duration::hours(4);

    let statuses = stmt
        .query_map([], |row| {
            let source: String = row.get(0)?;
            let last_sync_at: String = row.get(1)?;
            let status: String = row.get(2)?;
            let error_message: Option<String> = row.get(3)?;
            Ok((source, last_sync_at, status, error_message))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .map(|(source, last_sync_at, status, error_message)| {
            let threshold = if source == "comet" {
                four_hours
            } else {
                two_hours
            };

            let (healthy, minutes_ago) =
                if let Ok(sync_time) = chrono::DateTime::parse_from_rfc3339(&last_sync_at) {
                    let diff = now.signed_duration_since(sync_time);
                    (diff < threshold, diff.num_minutes())
                } else {
                    (false, -1)
                };

            SourceStatus {
                source,
                last_sync_at,
                status,
                healthy,
                minutes_ago,
                error_message,
            }
        })
        .collect();

    Ok(statuses)
}
