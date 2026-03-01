use super::types::*;
use reqwest::Client;

const BASE_URL: &str = "https://www.googleapis.com/calendar/v3";

pub struct GoogleCalendarClient {
    client: Client,
}

impl GoogleCalendarClient {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }

    /// List all calendars for the authenticated user
    pub async fn list_calendars(&self, access_token: &str) -> Result<Vec<GoogleCalendar>, String> {
        let url = format!("{}/users/me/calendarList", BASE_URL);
        let resp = self
            .client
            .get(&url)
            .bearer_auth(access_token)
            .send()
            .await
            .map_err(|e| format!("Failed to fetch calendars: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("Calendar list failed ({}): {}", status, body));
        }

        let body: CalendarListResponse = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse calendar list: {}", e))?;

        Ok(body.items.unwrap_or_default())
    }

    /// List events in a calendar within a time range
    /// time_min and time_max should be RFC3339 (e.g. "2026-03-01T00:00:00Z")
    pub async fn list_events(
        &self,
        access_token: &str,
        calendar_id: &str,
        time_min: &str,
        time_max: &str,
    ) -> Result<Vec<GoogleEvent>, String> {
        let mut all_events = Vec::new();
        let mut page_token: Option<String> = None;

        loop {
            let mut url = format!(
                "{}/calendars/{}/events?singleEvents=true&orderBy=startTime&timeMin={}&timeMax={}&maxResults=250",
                BASE_URL,
                urlencoding(calendar_id),
                urlencoding(time_min),
                urlencoding(time_max),
            );

            if let Some(ref token) = page_token {
                url.push_str(&format!("&pageToken={}", token));
            }

            let resp = self
                .client
                .get(&url)
                .bearer_auth(access_token)
                .send()
                .await
                .map_err(|e| format!("Failed to fetch events: {}", e))?;

            if !resp.status().is_success() {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                return Err(format!("Events list failed ({}): {}", status, body));
            }

            let body: EventListResponse = resp
                .json()
                .await
                .map_err(|e| format!("Failed to parse events: {}", e))?;

            if let Some(items) = body.items {
                all_events.extend(items);
            }

            match body.next_page_token {
                Some(token) => page_token = Some(token),
                None => break,
            }
        }

        Ok(all_events)
    }

    /// Create a new event in a calendar
    pub async fn create_event(
        &self,
        access_token: &str,
        calendar_id: &str,
        event: &UpsertGoogleEvent,
    ) -> Result<GoogleEvent, String> {
        let url = format!(
            "{}/calendars/{}/events?conferenceDataVersion=1&sendUpdates=all",
            BASE_URL,
            urlencoding(calendar_id),
        );

        let resp = self
            .client
            .post(&url)
            .bearer_auth(access_token)
            .json(event)
            .send()
            .await
            .map_err(|e| format!("Failed to create event: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("Create event failed ({}): {}", status, body));
        }

        resp.json::<GoogleEvent>()
            .await
            .map_err(|e| format!("Failed to parse created event: {}", e))
    }

    /// Update (PATCH) an existing event in a calendar
    pub async fn update_event(
        &self,
        access_token: &str,
        calendar_id: &str,
        event_id: &str,
        event: &UpsertGoogleEvent,
    ) -> Result<GoogleEvent, String> {
        let url = format!(
            "{}/calendars/{}/events/{}?conferenceDataVersion=1&sendUpdates=all",
            BASE_URL,
            urlencoding(calendar_id),
            urlencoding(event_id),
        );

        let resp = self
            .client
            .patch(&url)
            .bearer_auth(access_token)
            .json(event)
            .send()
            .await
            .map_err(|e| format!("Failed to update event: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("Update event failed ({}): {}", status, body));
        }

        resp.json::<GoogleEvent>()
            .await
            .map_err(|e| format!("Failed to parse updated event: {}", e))
    }

    /// Delete an event from a calendar
    pub async fn delete_event(
        &self,
        access_token: &str,
        calendar_id: &str,
        event_id: &str,
    ) -> Result<(), String> {
        let url = format!(
            "{}/calendars/{}/events/{}",
            BASE_URL,
            urlencoding(calendar_id),
            urlencoding(event_id),
        );

        let resp = self
            .client
            .delete(&url)
            .bearer_auth(access_token)
            .send()
            .await
            .map_err(|e| format!("Failed to delete event: {}", e))?;

        if resp.status().is_success() || resp.status().as_u16() == 204 || resp.status().as_u16() == 410 {
            Ok(())
        } else {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            Err(format!("Delete event failed ({}): {}", status, body))
        }
    }
}

fn urlencoding(s: &str) -> String {
    s.replace('%', "%25")
        .replace(' ', "%20")
        .replace('#', "%23")
        .replace('&', "%26")
        .replace('+', "%2B")
        .replace('/', "%2F")
        .replace(':', "%3A")
        .replace('=', "%3D")
        .replace('?', "%3F")
        .replace('@', "%40")
}
