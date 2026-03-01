import { create } from "zustand";

// === Planet & MCP Types ===

export interface PlanetConfig {
  id: string;
  name: string;
  type: "contacts" | "projects" | "tasks" | "journal" | "planning" | "research" | "custom";
  color: string;
  icon: string; // lucide icon name
  enabled: boolean;
}

export interface McpConfig {
  id: string;
  name: string;
  type: "whatsapp" | "imessage" | "fathom" | "comet" | "discord" | "gmail" | "twitter" | "calendar";
  icon: string;
  color: string;
  enabled: boolean;
  feedsPlanets: string[]; // planet IDs this MCP feeds into
}

// === Contact Categories ===

export interface ContactCategory {
  id: string;
  name: string;
  color: string;
  emoji: string;
}

export const DEFAULT_CONTACT_CATEGORIES: ContactCategory[] = [
  { id: "famille", name: "Famille", color: "#FF6B6B", emoji: "👨‍👩‍👧‍👦" },
  { id: "proches", name: "Amis Proches", color: "#8B5CF6", emoji: "💜" },
  { id: "amis", name: "Amis", color: "#00A3FF", emoji: "🤝" },
  { id: "clients", name: "Clients", color: "#00E599", emoji: "💼" },
];

// === Constellation Config ===

export interface ConstellationConfig {
  name: string;
  owner: string;
  planets: PlanetConfig[];
  mcps: McpConfig[];
  contactCategories: ContactCategory[];
  createdAt: string;
}

// === Default configs ===

export const DEFAULT_PLANETS: PlanetConfig[] = [
  { id: "contacts", name: "Contacts", type: "contacts", color: "#00E599", icon: "Users", enabled: true },
  { id: "projects", name: "Projets & Dossiers", type: "projects", color: "#00A3FF", icon: "FolderKanban", enabled: true },
  { id: "tasks", name: "Tâches", type: "tasks", color: "#FF6B6B", icon: "CheckSquare", enabled: true },
  { id: "journal", name: "Journal", type: "journal", color: "#FFB800", icon: "BookOpen", enabled: true },
  { id: "planning", name: "Planning", type: "planning", color: "#8B5CF6", icon: "Calendar", enabled: true },
  { id: "research", name: "Recherches", type: "research", color: "#F59E0B", icon: "Search", enabled: false },
];

export const AVAILABLE_MCPS: McpConfig[] = [
  { id: "whatsapp", name: "WhatsApp", type: "whatsapp", icon: "MessageSquare", color: "#25D366", enabled: true, feedsPlanets: ["contacts", "projects"] },
  { id: "imessage", name: "iMessage", type: "imessage", icon: "MessageCircle", color: "#5AC8FA", enabled: true, feedsPlanets: ["contacts", "projects"] },
  { id: "fathom", name: "Fathom", type: "fathom", icon: "Phone", color: "#8B5CF6", enabled: true, feedsPlanets: ["contacts", "projects"] },
  { id: "comet", name: "Comet Browser", type: "comet", icon: "Globe", color: "#F59E0B", enabled: true, feedsPlanets: ["research"] },
  { id: "discord", name: "Discord", type: "discord", icon: "Hash", color: "#5865F2", enabled: false, feedsPlanets: ["contacts", "projects"] },
  { id: "gmail", name: "Gmail", type: "gmail", icon: "Mail", color: "#EA4335", enabled: false, feedsPlanets: ["contacts", "projects"] },
  { id: "twitter", name: "Twitter / X", type: "twitter", icon: "Twitter", color: "#1DA1F2", enabled: false, feedsPlanets: ["research"] },
  { id: "calendar", name: "Calendar", type: "calendar", icon: "CalendarDays", color: "#34C759", enabled: false, feedsPlanets: ["planning"] },
];

// === Store ===

interface ExoStore {
  // Constellation config
  constellation: ConstellationConfig | null;
  isOnboarded: boolean;
  setConstellation: (config: ConstellationConfig) => void;
  updatePlanet: (id: string, updates: Partial<PlanetConfig>) => void;
  updateMcp: (id: string, updates: Partial<McpConfig>) => void;

  // Active navigation
  activePlanet: string | null;
  setActivePlanet: (id: string | null) => void;

  // Calendar
  calendarView: "month" | "week" | "day";
  setCalendarView: (view: "month" | "week" | "day") => void;
  calendarDate: string;
  setCalendarDate: (date: string) => void;
  hiddenCalendarIds: string[];
  toggleCalendarVisibility: (id: string) => void;
  googleConnected: boolean;
  setGoogleConnected: (connected: boolean) => void;

  // Calendar colors
  calendarColors: Record<string, string>;
  setCalendarColor: (calendarId: string, color: string) => void;
  resetCalendarColor: (calendarId: string) => void;

  // Sync
  syncRunning: boolean;
  setSyncRunning: (running: boolean) => void;
}

export const useExoStore = create<ExoStore>((set, get) => ({
  constellation: loadConstellation(),
  isOnboarded: loadConstellation() !== null,
  setConstellation: (config) => {
    saveConstellation(config);
    set({ constellation: config, isOnboarded: true });
  },
  updatePlanet: (id, updates) => {
    const c = get().constellation;
    if (!c) return;
    const planets = c.planets.map((p) => (p.id === id ? { ...p, ...updates } : p));
    const updated = { ...c, planets };
    saveConstellation(updated);
    set({ constellation: updated });
  },
  updateMcp: (id, updates) => {
    const c = get().constellation;
    if (!c) return;
    const mcps = c.mcps.map((m) => (m.id === id ? { ...m, ...updates } : m));
    const updated = { ...c, mcps };
    saveConstellation(updated);
    set({ constellation: updated });
  },

  activePlanet: null,
  setActivePlanet: (id) => set({ activePlanet: id }),

  calendarView: "week",
  setCalendarView: (view) => set({ calendarView: view }),
  calendarDate: new Date().toISOString().slice(0, 10),
  setCalendarDate: (date) => set({ calendarDate: date }),
  hiddenCalendarIds: [],
  toggleCalendarVisibility: (id) => {
    const current = get().hiddenCalendarIds;
    if (current.includes(id)) {
      set({ hiddenCalendarIds: current.filter((x) => x !== id) });
    } else {
      set({ hiddenCalendarIds: [...current, id] });
    }
  },

  googleConnected: false,
  setGoogleConnected: (connected) => set({ googleConnected: connected }),

  calendarColors: loadCalendarColors(),
  setCalendarColor: (calendarId, color) => {
    const colors = { ...get().calendarColors, [calendarId]: color };
    localStorage.setItem("exo-calendar-colors", JSON.stringify(colors));
    set({ calendarColors: colors });
  },
  resetCalendarColor: (calendarId) => {
    const colors = { ...get().calendarColors };
    delete colors[calendarId];
    localStorage.setItem("exo-calendar-colors", JSON.stringify(colors));
    set({ calendarColors: colors });
  },

  syncRunning: false,
  setSyncRunning: (running) => set({ syncRunning: running }),
}));

// === LocalStorage persistence ===

function loadConstellation(): ConstellationConfig | null {
  try {
    const raw = localStorage.getItem("exo-constellation");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Migrate: add contactCategories if missing
    if (!parsed.contactCategories) {
      parsed.contactCategories = [...DEFAULT_CONTACT_CATEGORIES];
    }
    // Migrate: enable planning planet if it exists but is disabled
    const planningPlanet = parsed.planets?.find((p: PlanetConfig) => p.id === "planning");
    if (planningPlanet && !planningPlanet.enabled) {
      planningPlanet.enabled = true;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveConstellation(config: ConstellationConfig) {
  localStorage.setItem("exo-constellation", JSON.stringify(config));
}

function loadCalendarColors(): Record<string, string> {
  try {
    const raw = localStorage.getItem("exo-calendar-colors");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
