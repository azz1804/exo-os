mod commands;
mod db;
mod google;
mod reminders;

use db::Database;
use google::api::GoogleCalendarClient;
use reminders::ReminderState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let database = Database::new().expect("Failed to initialize database");
    let gcal_client = GoogleCalendarClient::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .manage(database)
        .manage(gcal_client)
        .manage(ReminderState::new())
        .manage(commands::google_calendar::EventCache::new())
        .setup(|app| {
            reminders::start_reminder_loop(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::status::get_sync_status,
            commands::sync::trigger_sync,
            commands::sync::is_sync_running,
            commands::conversations::get_conversations,
            commands::contacts::get_contacts,
            commands::contacts::get_contact_detail,
            commands::timeline::get_timeline,
            commands::stats::get_stats,
            commands::logs::get_logs,
            commands::google_calendar::google_auth_status,
            commands::google_calendar::google_auth_start,
            commands::google_calendar::google_auth_logout,
            commands::google_calendar::get_calendars,
            commands::google_calendar::get_events,
            commands::google_calendar::create_event,
            commands::google_calendar::update_event,
            commands::google_calendar::delete_event,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Exo OS");
}
