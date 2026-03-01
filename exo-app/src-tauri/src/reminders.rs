use std::collections::HashSet;
use std::sync::Mutex;
use chrono::TimeZone;
use tauri::Manager;
use tauri_plugin_notification::NotificationExt;

use crate::commands::google_calendar::CalendarEvent;
use crate::db::Database;
use crate::google::api::GoogleCalendarClient;

/// State for caching events and tracking fired reminders
pub struct ReminderState {
    cached_events: Mutex<Vec<CalendarEvent>>,
    last_fetch: Mutex<Option<std::time::Instant>>,
    fired_memory: Mutex<HashSet<String>>, // "event_id:minutes"
}

impl ReminderState {
    pub fn new() -> Self {
        Self {
            cached_events: Mutex::new(Vec::new()),
            last_fetch: Mutex::new(None),
            fired_memory: Mutex::new(HashSet::new()),
        }
    }
}

/// Spawned once on app startup. Runs every 30 seconds.
pub fn start_reminder_loop(app_handle: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        // Wait a bit before starting (let the app initialize)
        tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;

        loop {
            if let Err(e) = check_upcoming_reminders(&app_handle).await {
                eprintln!("[reminders] Error: {}", e);
            }
            tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
        }
    });
}

async fn check_upcoming_reminders(app_handle: &tauri::AppHandle) -> Result<(), String> {
    let reminder_state = app_handle.state::<ReminderState>();
    let db = app_handle.state::<Database>();

    // Refresh cache every 5 minutes
    let should_refresh = {
        let last = reminder_state.last_fetch.lock().map_err(|e| e.to_string())?;
        last.map(|t| t.elapsed().as_secs() > 300).unwrap_or(true)
    };

    if should_refresh {
        match refresh_event_cache(app_handle).await {
            Ok(_) => {},
            Err(e) => {
                // Not connected to Google yet — silently skip
                if e.contains("Non connecté") {
                    return Ok(());
                }
                return Err(e);
            }
        }
    }

    let events = reminder_state.cached_events.lock().map_err(|e| e.to_string())?;
    let now = chrono::Local::now();

    for event in events.iter() {
        if event.reminders.is_empty() || event.all_day {
            continue;
        }

        // Parse event start time
        let event_start = match chrono::NaiveDateTime::parse_from_str(&event.start_date, "%Y-%m-%dT%H:%M:%S") {
            Ok(dt) => dt,
            Err(_) => continue,
        };

        let event_start_local = chrono::Local.from_local_datetime(&event_start)
            .single()
            .unwrap_or_else(|| now.into());

        for reminder in &event.reminders {
            let trigger_time = event_start_local - chrono::Duration::minutes(reminder.minutes as i64);
            let key = format!("{}:{}", event.id, reminder.minutes);

            // Check if we're past the trigger time but not more than 5 minutes past
            let diff = now.signed_duration_since(trigger_time);
            if diff.num_seconds() >= 0 && diff.num_seconds() < 300 {
                // Check if already fired (memory)
                let already_fired = {
                    let fired = reminder_state.fired_memory.lock().map_err(|e| e.to_string())?;
                    fired.contains(&key)
                };

                if already_fired {
                    continue;
                }

                // Check if already fired (SQLite)
                let db_fired = {
                    let conn = db.conn.lock().map_err(|e| e.to_string())?;
                    conn.query_row(
                        "SELECT COUNT(*) FROM fired_reminders WHERE event_id = ?1 AND minutes = ?2",
                        rusqlite::params![event.id, reminder.minutes],
                        |r| r.get::<_, i64>(0),
                    ).unwrap_or(0) > 0
                };

                if db_fired {
                    // Add to memory cache and skip
                    let mut fired = reminder_state.fired_memory.lock().map_err(|e| e.to_string())?;
                    fired.insert(key);
                    continue;
                }

                // Fire notification
                let title = if reminder.minutes == 0 {
                    format!("Maintenant : {}", event.summary)
                } else if reminder.minutes < 60 {
                    format!("Dans {} min : {}", reminder.minutes, event.summary)
                } else if reminder.minutes == 60 {
                    format!("Dans 1h : {}", event.summary)
                } else if reminder.minutes == 1440 {
                    format!("Demain : {}", event.summary)
                } else {
                    format!("Dans {}h : {}", reminder.minutes / 60, event.summary)
                };

                let time_str = &event.start_date[11..16];
                let body = format!("{} — {}", time_str, event.calendar_title);

                let _ = app_handle.notification()
                    .builder()
                    .title(&title)
                    .body(&body)
                    .show();

                // Mark as fired
                {
                    let mut fired = reminder_state.fired_memory.lock().map_err(|e| e.to_string())?;
                    fired.insert(key);
                }
                {
                    let conn = db.conn.lock().map_err(|e| e.to_string())?;
                    let _ = conn.execute(
                        "INSERT OR IGNORE INTO fired_reminders (event_id, minutes) VALUES (?1, ?2)",
                        rusqlite::params![event.id, reminder.minutes],
                    );
                    // Clean old entries
                    let _ = conn.execute(
                        "DELETE FROM fired_reminders WHERE fired_at < datetime('now', '-7 days')",
                        [],
                    );
                }
            }
        }
    }

    Ok(())
}

async fn refresh_event_cache(app_handle: &tauri::AppHandle) -> Result<(), String> {
    let reminder_state = app_handle.state::<ReminderState>();
    let db = app_handle.state::<Database>();
    let gcal = app_handle.state::<GoogleCalendarClient>();

    // Get token
    let (token, _, _) = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        let result = conn.query_row(
            "SELECT access_token, client_id, client_secret FROM google_auth WHERE id = 1",
            [],
            |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?)),
        ).map_err(|_| "Non connecté".to_string())?;
        result
    };

    // Fetch events for next 24 hours
    let now = chrono::Local::now();
    let tomorrow = now + chrono::Duration::hours(24);
    let time_min = now.format("%Y-%m-%dT%H:%M:%S%:z").to_string();
    let time_max = tomorrow.format("%Y-%m-%dT%H:%M:%S%:z").to_string();

    // Get all calendar IDs
    let cals = gcal.list_calendars(&token).await.unwrap_or_default();
    let cal_ids: Vec<String> = cals.iter().map(|c| c.id.clone()).collect();

    let cal_map: std::collections::HashMap<String, (String, Option<String>)> = cals
        .into_iter()
        .map(|c| (c.id.clone(), (c.summary.unwrap_or_default(), c.background_color)))
        .collect();

    let mut all_events = Vec::new();
    for cal_id in &cal_ids {
        if let Ok(events) = gcal.list_events(&token, cal_id, &time_min, &time_max).await {
            let (cal_title, cal_color) = cal_map.get(cal_id).cloned().unwrap_or_default();
            for ev in events {
                if ev.status.as_deref() == Some("cancelled") {
                    continue;
                }
                let (start_date, all_day) = crate::commands::google_calendar::parse_event_datetime_pub(&ev.start);
                let (end_date, _) = crate::commands::google_calendar::parse_event_datetime_pub(&ev.end);

                let reminders: Vec<crate::commands::google_calendar::ReminderInfo> = ev.reminders.as_ref()
                    .and_then(|r| r.overrides.as_ref())
                    .map(|list| list.iter().map(|o| crate::commands::google_calendar::ReminderInfo {
                        method: o.method.clone(),
                        minutes: o.minutes,
                    }).collect())
                    .unwrap_or_default();

                all_events.push(CalendarEvent {
                    id: ev.id.unwrap_or_default(),
                    summary: ev.summary.unwrap_or_default(),
                    description: ev.description,
                    start_date,
                    end_date,
                    all_day,
                    calendar_id: cal_id.clone(),
                    calendar_title: cal_title.clone(),
                    calendar_color: cal_color.clone(),
                    location: ev.location,
                    has_recurrences: ev.recurring_event_id.is_some(),
                    url: None,
                    conference_url: None,
                    html_link: None,
                    color_id: ev.color_id,
                    event_color: None,
                    attendees: Vec::new(),
                    recurrence: None,
                    recurring_event_id: ev.recurring_event_id,
                    reminders,
                });
            }
        }
    }

    {
        let mut cached = reminder_state.cached_events.lock().map_err(|e| e.to_string())?;
        *cached = all_events;
    }
    {
        let mut last = reminder_state.last_fetch.lock().map_err(|e| e.to_string())?;
        *last = Some(std::time::Instant::now());
    }

    Ok(())
}
