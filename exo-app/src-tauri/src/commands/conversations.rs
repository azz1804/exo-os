use crate::db::Database;
use serde::Serialize;
use tauri::State;

#[derive(Serialize)]
pub struct Conversation {
    pub id: i64,
    pub source: String,
    pub title: Option<String>,
    pub raw_content: String,
    pub ai_summary: Option<String>,
    pub synced_at: String,
    pub created_at: String,
}

#[tauri::command]
pub fn get_conversations(
    db: State<Database>,
    source: Option<String>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<Vec<Conversation>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(50);
    let offset = offset.unwrap_or(0);

    let (sql, params): (String, Vec<Box<dyn rusqlite::types::ToSql>>) = if let Some(ref src) =
        source
    {
        (
            format!(
                "SELECT id, source, title, raw_content, ai_summary, synced_at, created_at \
                 FROM conversations WHERE source = ?1 ORDER BY synced_at DESC LIMIT ?2 OFFSET ?3"
            ),
            vec![
                Box::new(src.clone()),
                Box::new(limit),
                Box::new(offset),
            ],
        )
    } else {
        (
            format!(
                "SELECT id, source, title, raw_content, ai_summary, synced_at, created_at \
                 FROM conversations ORDER BY synced_at DESC LIMIT ?1 OFFSET ?2"
            ),
            vec![Box::new(limit), Box::new(offset)],
        )
    };

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let params_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let rows = stmt
        .query_map(params_refs.as_slice(), |row| {
            Ok(Conversation {
                id: row.get(0)?,
                source: row.get(1)?,
                title: row.get(2)?,
                raw_content: row.get(3)?,
                ai_summary: row.get(4)?,
                synced_at: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut conversations = Vec::new();
    for row in rows {
        conversations.push(row.map_err(|e| e.to_string())?);
    }

    Ok(conversations)
}
