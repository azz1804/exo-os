use crate::db::Database;
use serde::Serialize;
use tauri::State;

#[derive(Serialize)]
pub struct Contact {
    pub id: i64,
    pub name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub source: String,
    pub relationship_type: Option<String>,
    pub sentiment: Option<String>,
    pub recurring_topics: Option<String>,
    pub interaction_count: i64,
    pub last_interaction_at: Option<String>,
    pub avatar_seed: Option<String>,
}

#[derive(Serialize)]
pub struct ContactDetail {
    pub contact: Contact,
    pub recent_interactions: Vec<Interaction>,
}

#[derive(Serialize)]
pub struct Interaction {
    pub id: i64,
    pub source: String,
    pub direction: Option<String>,
    pub content_preview: Option<String>,
    pub occurred_at: String,
}

#[tauri::command]
pub fn get_contacts(db: State<Database>, search: Option<String>) -> Result<Vec<Contact>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let (sql, params): (String, Vec<Box<dyn rusqlite::types::ToSql>>) = if let Some(ref q) =
        search
    {
        let pattern = format!("%{}%", q);
        (
            "SELECT id, name, phone, email, source, relationship_type, sentiment, \
             recurring_topics, interaction_count, last_interaction_at, avatar_seed \
             FROM contacts WHERE name LIKE ?1 OR phone LIKE ?1 OR email LIKE ?1 \
             ORDER BY interaction_count DESC"
                .into(),
            vec![Box::new(pattern)],
        )
    } else {
        (
            "SELECT id, name, phone, email, source, relationship_type, sentiment, \
             recurring_topics, interaction_count, last_interaction_at, avatar_seed \
             FROM contacts ORDER BY interaction_count DESC"
                .into(),
            vec![],
        )
    };

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let params_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let rows = stmt
        .query_map(params_refs.as_slice(), |row| {
            Ok(Contact {
                id: row.get(0)?,
                name: row.get(1)?,
                phone: row.get(2)?,
                email: row.get(3)?,
                source: row.get(4)?,
                relationship_type: row.get(5)?,
                sentiment: row.get(6)?,
                recurring_topics: row.get(7)?,
                interaction_count: row.get(8)?,
                last_interaction_at: row.get(9)?,
                avatar_seed: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut contacts = Vec::new();
    for row in rows {
        contacts.push(row.map_err(|e| e.to_string())?);
    }

    Ok(contacts)
}

#[tauri::command]
pub fn get_contact_detail(db: State<Database>, id: i64) -> Result<ContactDetail, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Get contact
    let contact = conn
        .query_row(
            "SELECT id, name, phone, email, source, relationship_type, sentiment, \
             recurring_topics, interaction_count, last_interaction_at, avatar_seed \
             FROM contacts WHERE id = ?1",
            [id],
            |row| {
                Ok(Contact {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    phone: row.get(2)?,
                    email: row.get(3)?,
                    source: row.get(4)?,
                    relationship_type: row.get(5)?,
                    sentiment: row.get(6)?,
                    recurring_topics: row.get(7)?,
                    interaction_count: row.get(8)?,
                    last_interaction_at: row.get(9)?,
                    avatar_seed: row.get(10)?,
                })
            },
        )
        .map_err(|e| format!("Contact not found: {}", e))?;

    // Get recent interactions
    let mut stmt = conn
        .prepare(
            "SELECT id, source, direction, content_preview, occurred_at \
             FROM interactions WHERE contact_id = ?1 \
             ORDER BY occurred_at DESC LIMIT 20",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([id], |row| {
            Ok(Interaction {
                id: row.get(0)?,
                source: row.get(1)?,
                direction: row.get(2)?,
                content_preview: row.get(3)?,
                occurred_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut interactions = Vec::new();
    for row in rows {
        interactions.push(row.map_err(|e| e.to_string())?);
    }

    Ok(ContactDetail {
        contact,
        recent_interactions: interactions,
    })
}
