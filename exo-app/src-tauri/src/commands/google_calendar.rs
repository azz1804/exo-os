use crate::db::Database;
use crate::google::api::GoogleCalendarClient;
use crate::google::oauth;
use serde::Serialize;
use std::sync::Mutex;

// === Event Cache (avoid redundant Google API calls) ===

pub struct EventCache {
    calendars: Mutex<Option<(std::time::Instant, Vec<crate::google::types::GoogleCalendar>)>>,
    events: Mutex<Option<(std::time::Instant, String, String, Vec<CalendarEvent>)>>, // (time, start, end, events)
}

impl EventCache {
    pub fn new() -> Self {
        Self {
            calendars: Mutex::new(None),
            events: Mutex::new(None),
        }
    }

    fn get_calendars(&self) -> Option<Vec<crate::google::types::GoogleCalendar>> {
        let lock = self.calendars.lock().ok()?;
        let (ts, cals) = lock.as_ref()?;
        if ts.elapsed().as_secs() < 120 { Some(cals.clone()) } else { None }
    }

    fn set_calendars(&self, cals: Vec<crate::google::types::GoogleCalendar>) {
        if let Ok(mut lock) = self.calendars.lock() {
            *lock = Some((std::time::Instant::now(), cals));
        }
    }

    fn get_events(&self, start: &str, end: &str) -> Option<Vec<CalendarEvent>> {
        let lock = self.events.lock().ok()?;
        let (ts, s, e, evts) = lock.as_ref()?;
        if ts.elapsed().as_secs() < 30 && s == start && e == end { Some(evts.clone()) } else { None }
    }

    fn set_events(&self, start: &str, end: &str, evts: Vec<CalendarEvent>) {
        if let Ok(mut lock) = self.events.lock() {
            *lock = Some((std::time::Instant::now(), start.to_string(), end.to_string(), evts));
        }
    }

    pub fn invalidate(&self) {
        if let Ok(mut lock) = self.events.lock() { *lock = None; }
    }
}

// === Types returned to frontend ===

#[derive(Serialize, Clone)]
pub struct CalendarInfo {
    pub id: String,
    pub title: String,
    pub color: Option<String>,
    pub access_role: String,
    pub primary: bool,
}

#[derive(Serialize, Clone)]
pub struct CalendarEvent {
    pub id: String,
    pub summary: String,
    pub description: Option<String>,
    pub start_date: String,
    pub end_date: String,
    pub all_day: bool,
    pub calendar_id: String,
    pub calendar_title: String,
    pub calendar_color: Option<String>,
    pub location: Option<String>,
    pub has_recurrences: bool,
    pub url: Option<String>,
    pub conference_url: Option<String>,
    pub html_link: Option<String>,
    pub color_id: Option<String>,
    pub event_color: Option<String>,
    pub attendees: Vec<AttendeeInfo>,
    pub recurrence: Option<Vec<String>>,
    pub recurring_event_id: Option<String>,
    pub reminders: Vec<ReminderInfo>,
}

#[derive(Serialize, Clone)]
pub struct AttendeeInfo {
    pub email: String,
    pub display_name: Option<String>,
    pub response_status: Option<String>,
    pub is_self: bool,
}

#[derive(Serialize, Clone)]
pub struct ReminderInfo {
    pub method: String,
    pub minutes: i32,
}

fn google_event_color(color_id: &str) -> &str {
    match color_id {
        "1"  => "#7986CB",
        "2"  => "#33B679",
        "3"  => "#8E24AA",
        "4"  => "#E67C73",
        "5"  => "#F6BF26",
        "6"  => "#F4511E",
        "7"  => "#039BE5",
        "8"  => "#616161",
        "9"  => "#3F51B5",
        "10" => "#0B8043",
        "11" => "#D50000",
        _    => "#8B5CF6",
    }
}

// === Token management ===

async fn get_valid_token(db: &Database) -> Result<(String, String, String), String> {
    let (client_id, client_secret, access_token, refresh_token, expires_at) = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT client_id, client_secret, access_token, refresh_token, expires_at FROM google_auth WHERE id = 1",
            [],
            |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, String>(3)?,
                    r.get::<_, i64>(4)?,
                ))
            },
        )
        .map_err(|_| "Non connecté à Google Calendar. Connecte-toi d'abord.".to_string())?
    };

    let now = chrono::Utc::now().timestamp();

    if now < expires_at - 60 {
        return Ok((access_token, client_id, client_secret));
    }

    // Token expired, refresh it
    let new_token = oauth::refresh_access_token(&client_id, &client_secret, &refresh_token).await?;
    let new_expires = chrono::Utc::now().timestamp() + new_token.expires_in as i64;

    {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE google_auth SET access_token = ?1, expires_at = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
            rusqlite::params![new_token.access_token, new_expires],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok((new_token.access_token, client_id, client_secret))
}

// === Date helpers ===

/// Convert ISO date (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS) to RFC3339 for Google API
fn to_rfc3339(iso: &str) -> String {
    if iso.len() <= 10 {
        format!("{}T00:00:00+01:00", iso)
    } else if iso.contains('+') || iso.ends_with('Z') {
        iso.to_string()
    } else {
        format!("{}+01:00", iso)
    }
}

const CONFERENCE_MARKER: &str = "🔗 ";

/// Extract conference URL from Google event
fn extract_conference_url(event: &crate::google::types::GoogleEvent) -> Option<String> {
    // 1. hangout_link (legacy)
    if let Some(ref hangout) = event.hangout_link {
        return Some(hangout.clone());
    }
    // 2. conferenceData entry points
    if let Some(ref conf) = event.conference_data {
        if let Some(ref eps) = conf.entry_points {
            for ep in eps {
                if ep.entry_point_type.as_deref() == Some("video") {
                    if let Some(ref uri) = ep.uri {
                        return Some(uri.clone());
                    }
                }
            }
        }
    }
    // 3. Custom marker in description first line (🔗 https://...)
    if let Some(ref desc) = event.description {
        if let Some(first_line) = desc.lines().next() {
            if let Some(url) = first_line.strip_prefix(CONFERENCE_MARKER) {
                let url = url.trim();
                if url.starts_with("http") {
                    return Some(url.to_string());
                }
            }
        }
    }
    None
}

/// Strip the conference marker line from description for frontend display
fn strip_conference_marker(description: Option<String>) -> Option<String> {
    let desc = description?;
    if desc.starts_with(CONFERENCE_MARKER) {
        // Remove first line (marker) and any leading blank lines after it
        let rest = desc.splitn(2, '\n').nth(1).unwrap_or("").trim_start_matches('\n');
        if rest.is_empty() { None } else { Some(rest.to_string()) }
    } else {
        Some(desc)
    }
}

/// Parse Google event datetime to our ISO format (YYYY-MM-DDTHH:MM:SS)
pub fn parse_event_datetime_pub(dt: &Option<crate::google::types::EventDateTime>) -> (String, bool) {
    parse_event_datetime(dt)
}

fn parse_event_datetime(dt: &Option<crate::google::types::EventDateTime>) -> (String, bool) {
    match dt {
        Some(edt) => {
            if let Some(ref datetime) = edt.date_time {
                // Timed event: "2026-03-01T10:00:00+01:00" -> "2026-03-01T10:00:00"
                let clean = if let Some(pos) = datetime.rfind('+') {
                    &datetime[..pos]
                } else if let Some(pos) = datetime.rfind('Z') {
                    &datetime[..pos]
                } else if datetime.len() > 19 {
                    // Handle negative offset like -05:00
                    if let Some(pos) = datetime[19..].find('-') {
                        &datetime[..19 + pos]
                    } else {
                        datetime.as_str()
                    }
                } else {
                    datetime.as_str()
                };
                (clean.to_string(), false)
            } else if let Some(ref date) = edt.date {
                // All-day event
                (format!("{}T00:00:00", date), true)
            } else {
                ("1970-01-01T00:00:00".to_string(), false)
            }
        }
        None => ("1970-01-01T00:00:00".to_string(), false),
    }
}

// === Tauri Commands ===

#[tauri::command]
pub async fn google_auth_status(db: tauri::State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let exists = conn
        .query_row(
            "SELECT COUNT(*) FROM google_auth WHERE id = 1",
            [],
            |r| r.get::<_, i64>(0),
        )
        .unwrap_or(0);
    Ok(exists > 0)
}

#[tauri::command]
pub async fn google_auth_start(db: tauri::State<'_, Database>) -> Result<bool, String> {
    // 1. Load credentials
    let creds = oauth::load_credentials()?;
    let client_id = &creds.installed.client_id;
    let client_secret = &creds.installed.client_secret;

    // 2. Build auth URL
    let auth_url = oauth::build_auth_url(client_id);

    // 3. Start listener BEFORE opening browser (to avoid race)
    let listener_handle = tokio::spawn(oauth::wait_for_auth_code());

    // 4. Open browser
    std::process::Command::new("open")
        .arg(&auth_url)
        .spawn()
        .map_err(|e| format!("Failed to open browser: {}", e))?;

    // 5. Wait for auth code
    let code = listener_handle
        .await
        .map_err(|e| format!("Auth listener task failed: {}", e))?
        .map_err(|e| format!("Auth failed: {}", e))?;

    // 6. Exchange code for tokens
    let token = oauth::exchange_code(client_id, client_secret, &code).await?;

    let refresh_token = token
        .refresh_token
        .ok_or("No refresh token received. Try revoking app access in Google settings and retry.")?;

    let expires_at = chrono::Utc::now().timestamp() + token.expires_in as i64;

    // 7. Store in DB
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO google_auth (id, client_id, client_secret, access_token, refresh_token, expires_at, updated_at)
         VALUES (1, ?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP)",
        rusqlite::params![client_id, client_secret, token.access_token, refresh_token, expires_at],
    )
    .map_err(|e| format!("Failed to store tokens: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub async fn google_auth_logout(db: tauri::State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute_batch(
        "DELETE FROM google_auth; DELETE FROM google_calendars;"
    )
    .map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub async fn get_calendars(
    db: tauri::State<'_, Database>,
    gcal: tauri::State<'_, GoogleCalendarClient>,
) -> Result<Vec<CalendarInfo>, String> {
    let (token, _, _) = get_valid_token(&db).await?;
    let google_cals = gcal.list_calendars(&token).await?;

    let calendars: Vec<CalendarInfo> = google_cals
        .into_iter()
        .filter(|c| {
            // Filter out "other" and hidden calendars
            let role = c.access_role.as_deref().unwrap_or("reader");
            role != "freeBusyReader"
        })
        .map(|c| CalendarInfo {
            id: c.id,
            title: c.summary.unwrap_or_default(),
            color: c.background_color,
            access_role: c.access_role.unwrap_or_else(|| "reader".to_string()),
            primary: c.primary.unwrap_or(false),
        })
        .collect();

    Ok(calendars)
}

#[tauri::command]
pub async fn get_events(
    db: tauri::State<'_, Database>,
    gcal: tauri::State<'_, GoogleCalendarClient>,
    cache: tauri::State<'_, EventCache>,
    start: String,
    end: String,
    calendar_ids: Option<Vec<String>>,
) -> Result<Vec<CalendarEvent>, String> {
    // Check event cache first (same date range within 30s → instant return)
    if let Some(cached) = cache.get_events(&start, &end) {
        return Ok(cached);
    }

    let (token, _, _) = get_valid_token(&db).await?;

    // Use cached calendars (2min TTL) or fetch once
    let cal_list = match cache.get_calendars() {
        Some(cals) => cals,
        None => {
            let cals = gcal.list_calendars(&token).await?;
            cache.set_calendars(cals.clone());
            cals
        }
    };

    // If no calendar_ids specified, use all calendars
    let cal_ids: Vec<String> = match calendar_ids {
        Some(ids) if !ids.is_empty() => ids,
        _ => cal_list.iter().map(|c| c.id.clone()).collect(),
    };

    let time_min = to_rfc3339(&start);
    let time_max = to_rfc3339(&end);

    let mut all_events = Vec::new();

    // Build calendar info map from cached list (no extra API call)
    let cal_map: std::collections::HashMap<String, (String, Option<String>)> = cal_list
        .into_iter()
        .map(|c| {
            let id = c.id.clone();
            let title = c.summary.unwrap_or_default();
            let color = c.background_color;
            (id, (title, color))
        })
        .collect();

    for cal_id in &cal_ids {
        let events = gcal
            .list_events(&token, cal_id, &time_min, &time_max)
            .await;

        match events {
            Ok(evts) => {
                let (cal_title, cal_color) = cal_map
                    .get(cal_id)
                    .cloned()
                    .unwrap_or_else(|| (cal_id.clone(), None));

                for ev in evts {
                    if ev.status.as_deref() == Some("cancelled") {
                        continue;
                    }

                    let (start_date, all_day_start) = parse_event_datetime(&ev.start);
                    let (mut end_date, _) = parse_event_datetime(&ev.end);
                    let all_day = all_day_start;

                    // Google all-day end date is exclusive, adjust back by 1 day for display
                    if all_day {
                        if let Ok(d) = chrono::NaiveDate::parse_from_str(&end_date[..10], "%Y-%m-%d") {
                            let adjusted = d - chrono::Duration::days(1);
                            end_date = format!("{}T23:59:59", adjusted.format("%Y-%m-%d"));
                        }
                    }

                    let conference_url = extract_conference_url(&ev);

                    let event_color = ev.color_id.as_deref().map(|cid| google_event_color(cid).to_string());

                    let attendees: Vec<AttendeeInfo> = ev.attendees.as_ref()
                        .map(|list| list.iter().map(|a| AttendeeInfo {
                            email: a.email.clone(),
                            display_name: a.display_name.clone(),
                            response_status: a.response_status.clone(),
                            is_self: a.is_self.unwrap_or(false),
                        }).collect())
                        .unwrap_or_default();

                    let reminders: Vec<ReminderInfo> = ev.reminders.as_ref()
                        .and_then(|r| r.overrides.as_ref())
                        .map(|list| list.iter().map(|o| ReminderInfo {
                            method: o.method.clone(),
                            minutes: o.minutes,
                        }).collect())
                        .unwrap_or_default();

                    all_events.push(CalendarEvent {
                        id: ev.id.unwrap_or_default(),
                        summary: ev.summary.unwrap_or_default(),
                        description: strip_conference_marker(ev.description),
                        start_date,
                        end_date,
                        all_day,
                        calendar_id: cal_id.clone(),
                        calendar_title: cal_title.clone(),
                        calendar_color: cal_color.clone(),
                        location: ev.location,
                        has_recurrences: ev.recurring_event_id.is_some(),
                        url: ev.html_link.clone(),
                        conference_url,
                        html_link: ev.html_link,
                        color_id: ev.color_id,
                        event_color,
                        attendees,
                        recurrence: ev.recurrence,
                        recurring_event_id: ev.recurring_event_id,
                        reminders,
                    });
                }
            }
            Err(e) => {
                eprintln!("Error fetching events for {}: {}", cal_id, e);
            }
        }
    }

    // Sort by start_date
    all_events.sort_by(|a, b| a.start_date.cmp(&b.start_date));

    // Cache for fast re-fetch on same date range
    cache.set_events(&start, &end, all_events.clone());

    Ok(all_events)
}

/// Build EventDateTime for start or end (shared by create + update)
fn build_event_datetime(date_str: &str, all_day: bool, is_start: bool) -> crate::google::types::EventDateTime {
    if all_day {
        let date_part = &date_str[..10];
        let date_val = if !is_start {
            // Google all-day end date is exclusive: add 1 day
            if let Ok(d) = chrono::NaiveDate::parse_from_str(date_part, "%Y-%m-%d") {
                (d + chrono::Duration::days(1)).format("%Y-%m-%d").to_string()
            } else {
                date_part.to_string()
            }
        } else {
            date_part.to_string()
        };
        crate::google::types::EventDateTime {
            date: Some(date_val),
            date_time: None,
            time_zone: None,
        }
    } else {
        crate::google::types::EventDateTime {
            date: None,
            date_time: Some(to_rfc3339(date_str)),
            time_zone: None,
        }
    }
}

/// Build attendees list from email strings
fn build_attendees(emails: Option<Vec<String>>) -> Option<Vec<crate::google::types::EventAttendee>> {
    emails.map(|list| {
        list.into_iter().map(|email| crate::google::types::EventAttendee {
            email,
            display_name: None,
            response_status: None,
            is_self: None,
        }).collect()
    })
}

/// Build reminders from minutes list
fn build_reminders(minutes: Option<Vec<i32>>) -> Option<crate::google::types::EventReminders> {
    minutes.map(|list| crate::google::types::EventReminders {
        use_default: Some(false),
        overrides: Some(list.into_iter().map(|m| crate::google::types::ReminderOverride {
            method: "popup".to_string(),
            minutes: m,
        }).collect()),
    })
}

fn build_conference_data(add_meet: bool) -> Option<crate::google::types::ConferenceData> {
    if !add_meet {
        return None;
    }
    let request_id = format!("exo-meet-{}", chrono::Utc::now().timestamp_millis());
    Some(crate::google::types::ConferenceData {
        entry_points: None,
        create_request: Some(crate::google::types::ConferenceCreateRequest {
            request_id,
            conference_solution_key: crate::google::types::ConferenceSolutionKey {
                solution_type: "hangoutsMeet".to_string(),
            },
        }),
    })
}

/// Merge custom conference URL into description (prefix with marker)
fn merge_conference_into_description(notes: Option<String>, conference_url: Option<String>) -> Option<String> {
    match conference_url {
        Some(ref url) if !url.is_empty() => {
            let marker_line = format!("{}{}", CONFERENCE_MARKER, url);
            match notes {
                Some(ref n) if !n.is_empty() => Some(format!("{}\n\n{}", marker_line, n)),
                _ => Some(marker_line),
            }
        }
        _ => notes,
    }
}

#[tauri::command]
pub async fn create_event(
    db: tauri::State<'_, Database>,
    gcal: tauri::State<'_, GoogleCalendarClient>,
    cache: tauri::State<'_, EventCache>,
    title: String,
    start_date: String,
    end_date: String,
    calendar_id: String,
    all_day: bool,
    notes: Option<String>,
    location: Option<String>,
    color_id: Option<String>,
    recurrence: Option<Vec<String>>,
    attendees: Option<Vec<String>>,
    reminders: Option<Vec<i32>>,
    add_meet: Option<bool>,
    conference_url: Option<String>,
) -> Result<String, String> {
    let (token, _, _) = get_valid_token(&db).await?;
    let use_meet = add_meet.unwrap_or(false);
    let description = if use_meet { notes } else { merge_conference_into_description(notes, conference_url) };

    let event = crate::google::types::UpsertGoogleEvent {
        summary: title,
        description,
        location,
        start: build_event_datetime(&start_date, all_day, true),
        end: build_event_datetime(&end_date, all_day, false),
        color_id,
        recurrence,
        attendees: build_attendees(attendees),
        reminders: build_reminders(reminders),
        conference_data: build_conference_data(use_meet),
    };

    let created = gcal.create_event(&token, &calendar_id, &event).await?;
    cache.invalidate();
    Ok(created.id.unwrap_or_default())
}

#[tauri::command]
pub async fn update_event(
    db: tauri::State<'_, Database>,
    gcal: tauri::State<'_, GoogleCalendarClient>,
    cache: tauri::State<'_, EventCache>,
    event_id: String,
    calendar_id: String,
    title: String,
    start_date: String,
    end_date: String,
    all_day: bool,
    notes: Option<String>,
    location: Option<String>,
    color_id: Option<String>,
    recurrence: Option<Vec<String>>,
    attendees: Option<Vec<String>>,
    reminders: Option<Vec<i32>>,
    add_meet: Option<bool>,
    conference_url: Option<String>,
) -> Result<String, String> {
    let (token, _, _) = get_valid_token(&db).await?;
    let use_meet = add_meet.unwrap_or(false);
    let description = if use_meet { notes } else { merge_conference_into_description(notes, conference_url) };

    let event = crate::google::types::UpsertGoogleEvent {
        summary: title,
        description,
        location,
        start: build_event_datetime(&start_date, all_day, true),
        end: build_event_datetime(&end_date, all_day, false),
        color_id,
        recurrence,
        attendees: build_attendees(attendees),
        reminders: build_reminders(reminders),
        conference_data: build_conference_data(use_meet),
    };

    let updated = gcal.update_event(&token, &calendar_id, &event_id, &event).await?;
    cache.invalidate();
    Ok(updated.id.unwrap_or_default())
}

#[tauri::command]
pub async fn delete_event(
    db: tauri::State<'_, Database>,
    gcal: tauri::State<'_, GoogleCalendarClient>,
    cache: tauri::State<'_, EventCache>,
    event_id: String,
    calendar_id: String,
) -> Result<bool, String> {
    let (token, _, _) = get_valid_token(&db).await?;
    gcal.delete_event(&token, &calendar_id, &event_id).await?;
    cache.invalidate();
    Ok(true)
}
