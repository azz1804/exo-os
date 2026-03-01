use serde::{Deserialize, Serialize};

// === OAuth Types ===

#[derive(Debug, Clone, Deserialize)]
pub struct GoogleCredentials {
    pub installed: InstalledCredentials,
}

#[derive(Debug, Clone, Deserialize)]
pub struct InstalledCredentials {
    pub client_id: String,
    pub client_secret: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub token_type: Option<String>,
    pub expires_in: u64,
}

// === Calendar API Types ===

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarListResponse {
    pub items: Option<Vec<GoogleCalendar>>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GoogleCalendar {
    pub id: String,
    pub summary: Option<String>,
    pub description: Option<String>,
    pub background_color: Option<String>,
    pub foreground_color: Option<String>,
    pub access_role: Option<String>,
    pub primary: Option<bool>,
    pub selected: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EventListResponse {
    pub items: Option<Vec<GoogleEvent>>,
    pub next_page_token: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GoogleEvent {
    pub id: Option<String>,
    pub summary: Option<String>,
    pub description: Option<String>,
    pub location: Option<String>,
    pub start: Option<EventDateTime>,
    pub end: Option<EventDateTime>,
    pub status: Option<String>,
    pub html_link: Option<String>,
    pub hangout_link: Option<String>,
    pub conference_data: Option<ConferenceData>,
    pub recurrence: Option<Vec<String>>,
    pub recurring_event_id: Option<String>,
    pub color_id: Option<String>,
    pub attendees: Option<Vec<EventAttendee>>,
    pub reminders: Option<EventReminders>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EventAttendee {
    pub email: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response_status: Option<String>,
    #[serde(rename = "self", skip_serializing_if = "Option::is_none")]
    pub is_self: Option<bool>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EventReminders {
    pub use_default: Option<bool>,
    pub overrides: Option<Vec<ReminderOverride>>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ReminderOverride {
    pub method: String,
    pub minutes: i32,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EventDateTime {
    pub date_time: Option<String>,
    pub date: Option<String>,
    pub time_zone: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConferenceData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entry_points: Option<Vec<EntryPoint>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub create_request: Option<ConferenceCreateRequest>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConferenceCreateRequest {
    pub request_id: String,
    pub conference_solution_key: ConferenceSolutionKey,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConferenceSolutionKey {
    #[serde(rename = "type")]
    pub solution_type: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EntryPoint {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uri: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entry_point_type: Option<String>,
}

// === Upsert Event Request (create + update) ===

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertGoogleEvent {
    pub summary: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub location: Option<String>,
    pub start: EventDateTime,
    pub end: EventDateTime,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recurrence: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attendees: Option<Vec<EventAttendee>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reminders: Option<EventReminders>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conference_data: Option<ConferenceData>,
}
