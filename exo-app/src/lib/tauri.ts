import { invoke } from "@tauri-apps/api/core";

// Types matching Rust structs
export interface SourceStatus {
  source: string;
  last_sync_at: string;
  status: string;
  healthy: boolean;
  minutes_ago: number;
  error_message: string | null;
}

export interface SyncResult {
  success: boolean;
  message: string;
  output: string;
}

export interface Conversation {
  id: number;
  source: string;
  title: string | null;
  raw_content: string;
  ai_summary: string | null;
  synced_at: string;
  created_at: string;
}

export interface Contact {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  source: string;
  relationship_type: string | null;
  sentiment: string | null;
  recurring_topics: string | null;
  interaction_count: number;
  last_interaction_at: string | null;
  avatar_seed: string | null;
}

export interface Interaction {
  id: number;
  source: string;
  direction: string | null;
  content_preview: string | null;
  occurred_at: string;
}

export interface ContactDetail {
  contact: Contact;
  recent_interactions: Interaction[];
}

export interface TimelineEvent {
  id: number;
  event_type: string;
  source: string;
  title: string | null;
  summary: string | null;
  occurred_at: string;
  contact_name: string | null;
}

export interface DashboardStats {
  total_contacts: number;
  total_conversations: number;
  total_interactions: number;
  sources: { source: string; conversations: number; interactions: number }[];
}

export interface LogOutput {
  lines: string[];
  file: string;
  total_lines: number;
}

// Calendar types (Google Calendar)
export interface CalendarInfo {
  id: string;
  title: string;
  color: string | null;
  access_role: string;
  primary: boolean;
}

export interface AttendeeInfo {
  email: string;
  display_name: string | null;
  response_status: string | null;
  is_self: boolean;
}

export interface ReminderInfo {
  method: string;
  minutes: number;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description: string | null;
  start_date: string;
  end_date: string;
  all_day: boolean;
  calendar_id: string;
  calendar_title: string;
  calendar_color: string | null;
  location: string | null;
  has_recurrences: boolean;
  url: string | null;
  conference_url: string | null;
  html_link: string | null;
  color_id: string | null;
  event_color: string | null;
  attendees: AttendeeInfo[];
  recurrence: string[] | null;
  recurring_event_id: string | null;
  reminders: ReminderInfo[];
}

export const GOOGLE_EVENT_COLORS: Record<string, { name: string; hex: string }> = {
  "1":  { name: "Lavande",    hex: "#7986CB" },
  "2":  { name: "Sauge",      hex: "#33B679" },
  "3":  { name: "Raisin",     hex: "#8E24AA" },
  "4":  { name: "Flamant",    hex: "#E67C73" },
  "5":  { name: "Banane",     hex: "#F6BF26" },
  "6":  { name: "Mandarine",  hex: "#F4511E" },
  "7":  { name: "Paon",       hex: "#039BE5" },
  "8":  { name: "Graphite",   hex: "#616161" },
  "9":  { name: "Myrtille",   hex: "#3F51B5" },
  "10": { name: "Basilic",    hex: "#0B8043" },
  "11": { name: "Tomate",     hex: "#D50000" },
};

export interface CreateEventParams {
  title: string;
  startDate: string;
  endDate: string;
  calendarId: string;
  allDay: boolean;
  notes?: string;
  location?: string;
  colorId?: string;
  recurrence?: string[];
  attendees?: string[];
  reminders?: number[];
  addMeet?: boolean;
  conferenceUrl?: string;
}

export interface UpdateEventParams extends CreateEventParams {
  eventId: string;
}

// API functions
export const api = {
  getSyncStatus: () => invoke<SourceStatus[]>("get_sync_status"),
  triggerSync: () => invoke<SyncResult>("trigger_sync"),
  isSyncRunning: () => invoke<boolean>("is_sync_running"),
  getConversations: (source?: string, limit?: number, offset?: number) =>
    invoke<Conversation[]>("get_conversations", { source, limit, offset }),
  getContacts: (search?: string) => invoke<Contact[]>("get_contacts", { search }),
  getContactDetail: (id: number) => invoke<ContactDetail>("get_contact_detail", { id }),
  getTimeline: (days?: number) => invoke<TimelineEvent[]>("get_timeline", { days }),
  getStats: () => invoke<DashboardStats>("get_stats"),
  getLogs: (logType?: string, lines?: number) =>
    invoke<LogOutput>("get_logs", { logType, lines }),

  // Google Calendar Auth
  googleAuthStatus: () => invoke<boolean>("google_auth_status"),
  googleAuthStart: () => invoke<boolean>("google_auth_start"),
  googleAuthLogout: () => invoke<boolean>("google_auth_logout"),

  // Calendar
  getCalendars: () => invoke<CalendarInfo[]>("get_calendars"),
  getEvents: (start: string, end: string, calendarIds?: string[]) =>
    invoke<CalendarEvent[]>("get_events", { start, end, calendarIds }),
  createEvent: (params: CreateEventParams) =>
    invoke<string>("create_event", { ...params }),
  updateEvent: (params: UpdateEventParams) =>
    invoke<string>("update_event", { ...params }),
  deleteEvent: (eventId: string, calendarId: string) =>
    invoke<boolean>("delete_event", { eventId, calendarId }),
};
