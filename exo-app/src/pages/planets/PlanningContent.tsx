import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Plus, X, Clock, MapPin,
  FileText, Trash2, Video, Loader2,
  ChevronDown, Calendar as CalendarIcon, RefreshCw, ZoomIn, ZoomOut,
  Repeat, Bell, Users,
} from "lucide-react";
import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef, memo } from "react";
import { api, type CalendarEvent, type CalendarInfo, type UpdateEventParams, GOOGLE_EVENT_COLORS } from "../../lib/tauri";
import { useExoStore } from "../../lib/store";
import { useTrackpadScroll } from "../../hooks/useTrackpadScroll";

// === Constants ===

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const DAYS_FULL_FR = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const MONTHS_SHORT_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

const DEFAULT_COLOR = "#8B5CF6";
const NOW_COLOR = "#EB5757"; // Red now-indicator (Notion Calendar style)

const HOUR_HEIGHT = 56;

const REMINDER_OPTIONS = [
  { value: 0,    label: "Au moment de l'événement" },
  { value: 5,    label: "5 minutes avant" },
  { value: 10,   label: "10 minutes avant" },
  { value: 15,   label: "15 minutes avant" },
  { value: 30,   label: "30 minutes avant" },
  { value: 60,   label: "1 heure avant" },
  { value: 1440, label: "1 jour avant" },
];

const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

// === Date Helpers ===

function isToday(d: Date): boolean {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays(date: Date): Date[] {
  const start = getWeekStart(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function formatHour(h: number): string {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

function formatNowTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

function dateToISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateFr(d: Date): string {
  return `${DAYS_FULL_FR[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS_SHORT_FR[d.getMonth()]}`;
}

function getCalColor(cal: CalendarInfo, customColors?: Record<string, string>): string {
  return customColors?.[cal.id] || cal.color || DEFAULT_COLOR;
}

function getEventColor(ev: CalendarEvent, customColors?: Record<string, string>): string {
  if (ev.event_color) return ev.event_color;
  return customColors?.[ev.calendar_id] || ev.calendar_color || DEFAULT_COLOR;
}

function isVideoLink(u: string): boolean {
  return /meet\.google|zoom\.us|teams\.microsoft|whereby\.com/i.test(u);
}

// === Overlap Layout Algorithm ===

interface OverlapPosition {
  column: number;
  totalColumns: number;
}

function computeOverlapLayout(events: CalendarEvent[]): Map<string, OverlapPosition> {
  const result = new Map<string, OverlapPosition>();
  if (events.length === 0) return result;

  // Parse into sortable items
  const items = events.map((ev) => {
    const sh = parseInt(ev.start_date.slice(11, 13)) || 0;
    const sm = parseInt(ev.start_date.slice(14, 16)) || 0;
    const eh = parseInt(ev.end_date.slice(11, 13)) || 0;
    const em = parseInt(ev.end_date.slice(14, 16)) || 0;
    const startMin = sh * 60 + sm;
    const endMin = Math.max(eh * 60 + em, startMin + 15); // minimum 15min
    return { id: ev.id, startMin, endMin };
  });

  // Sort by start time, then longest first
  items.sort((a, b) => a.startMin - b.startMin || (b.endMin - b.startMin) - (a.endMin - a.startMin));

  // Group into clusters (connected components of overlapping events)
  const clusters: typeof items[] = [];
  let cluster: typeof items = [];
  let clusterEnd = 0;

  for (const item of items) {
    if (cluster.length === 0 || item.startMin < clusterEnd) {
      cluster.push(item);
      clusterEnd = Math.max(clusterEnd, item.endMin);
    } else {
      clusters.push(cluster);
      cluster = [item];
      clusterEnd = item.endMin;
    }
  }
  if (cluster.length > 0) clusters.push(cluster);

  // Assign columns within each cluster
  for (const group of clusters) {
    const columnEnds: number[] = []; // tracks end time of last event in each column

    for (const item of group) {
      let col = -1;
      for (let c = 0; c < columnEnds.length; c++) {
        if (columnEnds[c] <= item.startMin) {
          col = c;
          break;
        }
      }
      if (col === -1) {
        col = columnEnds.length;
        columnEnds.push(0);
      }
      columnEnds[col] = item.endMin;
      result.set(item.id, { column: col, totalColumns: 0 }); // totalColumns set after
    }

    const total = columnEnds.length;
    for (const item of group) {
      const pos = result.get(item.id)!;
      pos.totalColumns = total;
    }
  }

  return result;
}

// === TimePicker ===

function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open && listRef.current) {
      const idx = TIME_OPTIONS.indexOf(value);
      if (idx >= 0) listRef.current.scrollTop = idx * 28 - 56;
    }
  }, [open, value]);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[12px] text-star-white transition-colors min-w-[72px] justify-between">
        <span>{value}</span>
        <ChevronDown size={10} className="text-dust-dark" />
      </button>
      {open && (
        <div ref={listRef}
          className="absolute top-full mt-1 left-0 w-[80px] max-h-[180px] overflow-y-auto bg-space-800 border border-white/[0.1] rounded-lg shadow-2xl z-50 py-0.5">
          {TIME_OPTIONS.map((t) => (
            <button key={t} onClick={() => { onChange(t); setOpen(false); }}
              className={`w-full text-left px-2.5 py-1 text-[11px] transition-colors ${
                t === value ? "bg-electric-500/20 text-electric-400" : "text-dust hover:bg-white/[0.06] hover:text-star-white"
              }`}>
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// === ColorPicker ===

const COLOR_PALETTE = [
  "#00A3FF", "#8B5CF6", "#00E599", "#FF6B6B",
  "#FFB800", "#F59E0B", "#EC4899", "#14B8A6",
  "#6366F1", "#EF4444", "#84CC16", "#06B6D4",
];

function ColorPicker({
  currentColor, onSelect, onReset,
}: {
  currentColor: string;
  onSelect: (color: string) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="h-3 w-3 rounded-full shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:ring-2 ring-white/20"
        style={{ background: currentColor }} />
      {open && (
        <div className="absolute top-full mt-1 left-0 bg-space-800 border border-white/[0.1] rounded-lg shadow-2xl z-50 p-2"
          onClick={(e) => e.stopPropagation()}>
          <div className="grid grid-cols-4 gap-1.5">
            {COLOR_PALETTE.map((c) => (
              <button key={c} onClick={() => { onSelect(c); setOpen(false); }}
                className={`h-5 w-5 rounded-full transition-all hover:scale-110 ${
                  c === currentColor ? "ring-2 ring-white ring-offset-1 ring-offset-space-800" : ""
                }`}
                style={{ background: c }} />
            ))}
          </div>
          <button onClick={() => { onReset(); setOpen(false); }}
            className="mt-1.5 w-full text-[9px] text-dust-dark hover:text-dust text-center py-0.5 transition-colors">
            Réinitialiser
          </button>
        </div>
      )}
    </div>
  );
}

// === DatePicker ===

function DatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const currentDate = new Date(value + "T12:00:00");
  const [viewMonth, setViewMonth] = useState(currentDate.getMonth());
  const [viewYear, setViewYear] = useState(currentDate.getFullYear());

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const first = new Date(viewYear, viewMonth, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = Array.from({ length: offset }, () => null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);
  while (cells.length % 7 !== 0) cells.push(null);

  const navMonth = (dir: number) => {
    let m = viewMonth + dir;
    let y = viewYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setViewMonth(m);
    setViewYear(y);
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[12px] text-star-white transition-colors">
        <CalendarIcon size={11} className="text-dust-dark" />
        <span>{formatDateFr(currentDate)}</span>
        <ChevronDown size={10} className="text-dust-dark" />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 w-[220px] bg-space-800 border border-white/[0.1] rounded-lg shadow-2xl z-50 p-2.5">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => navMonth(-1)} className="p-1 rounded hover:bg-white/[0.06] text-dust-dark hover:text-dust">
              <ChevronLeft size={12} />
            </button>
            <span className="text-[11px] font-medium text-dust">{MONTHS_FR[viewMonth]} {viewYear}</span>
            <button onClick={() => navMonth(1)} className="p-1 rounded hover:bg-white/[0.06] text-dust-dark hover:text-dust">
              <ChevronRight size={12} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {DAYS_FR.map((d) => (
              <div key={d} className="text-[8px] text-dust-dark text-center py-0.5 font-medium">{d[0]}</div>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <div key={`e${i}`} />;
              const d = new Date(viewYear, viewMonth, day);
              const iso = dateToISO(d);
              const selected = iso === value;
              const today = isToday(d);
              return (
                <button key={i} onClick={() => { onChange(iso); setOpen(false); }}
                  className={`text-[10px] h-6 w-6 rounded-full flex items-center justify-center mx-auto transition-colors ${
                    selected ? "bg-electric-500 text-white font-bold"
                    : today ? "ring-1 ring-electric-500/50 text-electric-400"
                    : "text-dust hover:bg-white/[0.06] hover:text-star-white"
                  }`}>
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// === CalendarToolbar ===

function CalendarToolbar({
  view, onViewChange, date, onNavigate, onToday, onRefresh, onZoomIn, onZoomOut,
}: {
  view: "month" | "week" | "day";
  onViewChange: (v: "month" | "week" | "day") => void;
  date: Date;
  onNavigate: (dir: -1 | 1) => void;
  onToday: () => void;
  onRefresh: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
}) {
  // Notion Calendar style: always show "Month Year" as the main title
  const title = `${MONTHS_FR[date.getMonth()]} ${date.getFullYear()}`;

  return (
    <div className="flex items-center justify-between px-5 h-[52px] shrink-0 border-b border-white/[0.06]">
      {/* Left: Month Year title */}
      <h1 className="text-[20px] font-bold text-star-white tracking-tight">{title}</h1>

      {/* Right: View selector + Today + Nav */}
      <div className="flex items-center gap-2">
        {/* Refresh (subtle) */}
        <button onClick={onRefresh}
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/[0.06] text-dust-dark hover:text-dust transition-colors"
          title="Rafraîchir">
          <RefreshCw size={13} />
        </button>

        {/* Zoom controls (week/day only) */}
        {(view === "week" || view === "day") && (
          <div className="flex items-center gap-0.5">
            <button onClick={onZoomOut} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/[0.06] text-dust-dark hover:text-dust transition-colors" title="Ctrl+scroll">
              <ZoomOut size={13} />
            </button>
            <button onClick={onZoomIn} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/[0.06] text-dust-dark hover:text-dust transition-colors" title="Ctrl+scroll">
              <ZoomIn size={13} />
            </button>
          </div>
        )}

        <div className="w-px h-5 bg-white/[0.06] mx-1" />

        {/* View selector (dropdown-style) */}
        <div className="flex rounded-lg border border-white/[0.08] overflow-hidden">
          {(["month", "week", "day"] as const).map((v, i) => (
            <button key={v} onClick={() => onViewChange(v)}
              className={`px-3 py-1.5 text-[12px] font-medium transition-all ${
                i > 0 ? "border-l border-white/[0.08]" : ""
              } ${
                view === v
                  ? "bg-white/[0.08] text-star-white"
                  : "text-dust-dark hover:text-dust hover:bg-white/[0.04]"
              }`}>
              {v === "month" ? "Mois" : v === "week" ? "Semaine" : "Jour"}
            </button>
          ))}
        </div>

        {/* Today button */}
        <button onClick={onToday}
          className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-dust hover:text-star-white border border-white/[0.08] hover:bg-white/[0.06] transition-colors">
          Aujourd'hui
        </button>

        {/* Nav arrows */}
        <div className="flex items-center gap-0.5">
          <button onClick={() => onNavigate(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/[0.06] text-dust hover:text-star-white transition-colors">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => onNavigate(1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/[0.06] text-dust hover:text-star-white transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// === MiniMonth ===

function MiniMonth({ date, onDateSelect }: { date: Date; onDateSelect: (d: Date) => void }) {
  const [viewMonth, setViewMonth] = useState(date.getMonth());
  const [viewYear, setViewYear] = useState(date.getFullYear());

  useEffect(() => {
    setViewMonth(date.getMonth());
    setViewYear(date.getFullYear());
  }, [date]);

  const first = new Date(viewYear, viewMonth, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = Array.from({ length: offset }, () => null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);
  while (cells.length % 7 !== 0) cells.push(null);

  const navMonth = (dir: number) => {
    let m = viewMonth + dir;
    let y = viewYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setViewMonth(m);
    setViewYear(y);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => navMonth(-1)} className="p-0.5 rounded hover:bg-white/[0.06] text-dust-dark hover:text-dust">
          <ChevronLeft size={11} />
        </button>
        <span className="text-[10px] font-semibold text-dust">{MONTHS_FR[viewMonth]} {viewYear}</span>
        <button onClick={() => navMonth(1)} className="p-0.5 rounded hover:bg-white/[0.06] text-dust-dark hover:text-dust">
          <ChevronRight size={11} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-px">
        {DAYS_FR.map((d) => (
          <div key={d} className="text-[8px] text-dust-dark text-center py-0.5">{d[0]}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />;
          const d = new Date(viewYear, viewMonth, day);
          const today = isToday(d);
          const selected = isSameDay(d, date);
          return (
            <button key={i} onClick={() => onDateSelect(d)}
              className={`text-[10px] h-5 w-5 rounded-full flex items-center justify-center mx-auto transition-colors ${
                today ? "text-white font-bold"
                : selected ? "bg-white/[0.1] text-star-white"
                : "text-dust-dark hover:text-dust hover:bg-white/[0.04]"
              }`}
              style={today ? { backgroundColor: NOW_COLOR } : undefined}>
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// === CalendarSidebar ===

function CalendarSidebar({
  calendars, hiddenIds, onToggle, date, onDateSelect,
  calendarColors, onColorChange, onColorReset,
}: {
  calendars: CalendarInfo[];
  hiddenIds: string[];
  onToggle: (id: string) => void;
  date: Date;
  onDateSelect: (d: Date) => void;
  calendarColors: Record<string, string>;
  onColorChange: (id: string, color: string) => void;
  onColorReset: (id: string) => void;
}) {
  return (
    <div className="w-[200px] border-r border-white/[0.04] px-3 py-4 space-y-5 overflow-y-auto shrink-0">
      <MiniMonth date={date} onDateSelect={onDateSelect} />
      <div className="space-y-0.5">
        <h3 className="text-[9px] text-dust-dark uppercase tracking-wider font-semibold mb-2 px-2">Calendriers</h3>
        {calendars.map((cal) => {
          const hidden = hiddenIds.includes(cal.id);
          const color = getCalColor(cal, calendarColors);
          return (
            <div key={cal.id} className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 hover:bg-white/[0.04] transition-colors group cursor-pointer"
              onClick={() => onToggle(cal.id)}>
              {/* Checkbox-style indicator */}
              <span className={`h-3 w-3 rounded-[3px] shrink-0 flex items-center justify-center transition-all ${
                hidden ? "border border-white/[0.1]" : ""
              }`}
                style={hidden ? {} : { background: color }}>
                {!hidden && (
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 4L3.2 5.7L6.5 2.3" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </span>
              <span className={`text-[11px] flex-1 text-left truncate transition-colors ${hidden ? "text-dust-dark" : "text-dust"}`}>
                {cal.title}
              </span>
              <ColorPicker
                currentColor={color}
                onSelect={(c) => onColorChange(cal.id, c)}
                onReset={() => onColorReset(cal.id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// === MonthView ===

const MonthView = memo(function MonthView({
  date, events, onDayClick, onEventClick, calendarColors,
}: {
  date: Date;
  events: CalendarEvent[];
  onDayClick: (d: Date) => void;
  onEventClick: (e: CalendarEvent, me: React.MouseEvent) => void;
  calendarColors: Record<string, string>;
}) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((ev) => {
      const key = ev.start_date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    });
    return map;
  }, [events]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-white/[0.04]">
        {DAYS_FR.map((d) => (
          <div key={d} className="px-2 py-2 text-[9px] text-dust-dark font-semibold text-center uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-6">
        {cells.map((cellDate) => {
          const key = dateToISO(cellDate);
          const dayEvents = eventsByDate.get(key) || [];
          const isCurrentMonth = cellDate.getMonth() === month;
          const today = isToday(cellDate);

          return (
            <div key={key} onClick={() => onDayClick(cellDate)}
              className={`border-b border-r border-white/[0.03] p-1 cursor-pointer transition-colors hover:bg-white/[0.02] overflow-hidden ${
                !isCurrentMonth ? "opacity-30" : ""
              }`}>
              <div className={`text-[11px] font-medium mb-0.5 w-6 h-6 flex items-center justify-center rounded-full mx-auto ${
                today ? "text-white" : "text-dust"
              }`}
                style={today ? { backgroundColor: NOW_COLOR } : undefined}>
                {cellDate.getDate()}
              </div>
              <div className="space-y-px">
                {dayEvents.slice(0, 3).map((ev) => {
                  const evColor = getEventColor(ev, calendarColors);
                  return (
                  <div key={ev.id}
                    onClick={(e) => { e.stopPropagation(); onEventClick(ev, e); }}
                    className="truncate text-[9px] px-1 py-px rounded cursor-pointer hover:brightness-110 transition-all text-white font-medium"
                    style={{
                      background: `${evColor}BF`,
                      borderLeft: `2px solid ${evColor}`,
                    }}>
                    {ev.all_day ? "" : <span className="text-white/60">{ev.start_date.slice(11, 16)} </span>}{ev.summary}
                  </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="text-[8px] text-dust-dark pl-1 font-medium">+{dayEvents.length - 3} autres</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// === TimeGutter (fixed left column, scrolls vertically only) ===

const TimeGutter = memo(function TimeGutter({ scrollRef, hourHeight, headerHeight }: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  hourHeight: number;
  headerHeight: number;
}) {
  // Get timezone offset string (e.g. "UTC+1", "UTC-5")
  const tzOffset = useMemo(() => {
    const offset = -new Date().getTimezoneOffset();
    const sign = offset >= 0 ? "+" : "-";
    const hours = Math.abs(Math.floor(offset / 60));
    const mins = Math.abs(offset % 60);
    return mins > 0 ? `UTC${sign}${hours}:${String(mins).padStart(2, "0")}` : `UTC${sign}${hours}`;
  }, []);

  const now = new Date();
  const showNow = true; // always show time in gutter
  const currentTimeTop = (now.getHours() + now.getMinutes() / 60) * hourHeight;

  return (
    <div className="w-[58px] shrink-0 flex flex-col z-10 bg-space-900 relative border-r border-white/[0.04]">
      {/* Header spacer with timezone */}
      <div className="shrink-0 flex flex-col items-center justify-end pb-1.5" style={{ height: `${headerHeight}px` }}>
        <span className="text-[9px] text-dust-dark font-medium">{tzOffset}</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0" style={{ scrollbarWidth: "none" }}>
        <div className="relative" style={{ height: `${24 * hourHeight}px` }}>
          {HOURS.map((h) => (
            <div key={h} className="absolute w-full text-right pr-2 -mt-[6px] text-[10px] text-dust-dark/60 select-none"
              style={{ top: `${h * hourHeight}px` }}>
              {h > 0 ? formatHour(h) : ""}
            </div>
          ))}

          {/* Now time label in gutter */}
          <div className="absolute w-full text-right pr-1 -mt-[6px] text-[9px] font-semibold select-none z-20 pointer-events-none"
            style={{ top: `${currentTimeTop}px`, color: NOW_COLOR }}>
            {formatNowTime(now)}
          </div>
        </div>
      </div>
    </div>
  );
});

// === HourLines (grid lines behind day columns) ===

const HourLines = memo(function HourLines({ hourHeight }: { hourHeight: number }) {
  return (
    <>
      {HOURS.map((h) => (
        <div key={h} className="absolute w-full" style={{ top: `${h * hourHeight}px` }}>
          <div className="border-t border-white/[0.05]" />
          <div className="absolute w-full" style={{ top: `${hourHeight / 2}px` }}>
            <div className="border-t border-dashed border-white/[0.025]" />
          </div>
        </div>
      ))}
    </>
  );
});

// === DayColumn (single day: events + now-line + click area) ===

const DayColumn = memo(function DayColumn({ date, events, hourHeight, onEventClick, onSlotClick, onEventContextMenu, calendarColors, widthPct }: {
  date: Date;
  events: CalendarEvent[];
  hourHeight: number;
  onEventClick: (e: CalendarEvent, me: React.MouseEvent) => void;
  onSlotClick: (d: Date, hour: number, me: React.MouseEvent) => void;
  onEventContextMenu?: (e: CalendarEvent, me: React.MouseEvent) => void;
  calendarColors: Record<string, string>;
  widthPct: string;
}) {
  const dayEvents = useMemo(
    () => events.filter((e) => !e.all_day && isSameDay(new Date(e.start_date), date)),
    [events, date]
  );
  const layout = useMemo(() => computeOverlapLayout(dayEvents), [dayEvents]);
  const now = new Date();
  const showNow = isToday(date);
  const currentTimeTop = (now.getHours() + now.getMinutes() / 60) * hourHeight;

  function getStyle(ev: CalendarEvent) {
    const sh = parseInt(ev.start_date.slice(11, 13)) || 0;
    const sm = parseInt(ev.start_date.slice(14, 16)) || 0;
    const eh = parseInt(ev.end_date.slice(11, 13)) || 0;
    const em = parseInt(ev.end_date.slice(14, 16)) || 0;
    const top = (sh + sm / 60) * hourHeight;
    const height = Math.max(((eh + em / 60) - (sh + sm / 60)) * hourHeight, 20);
    return { top: `${top}px`, height: `${height}px` };
  }

  // Compute block height in pixels and duration for adaptive content
  const getBlockInfo = (ev: CalendarEvent) => {
    const sh = parseInt(ev.start_date.slice(11, 13)) || 0;
    const sm = parseInt(ev.start_date.slice(14, 16)) || 0;
    const eh = parseInt(ev.end_date.slice(11, 13)) || 0;
    const em = parseInt(ev.end_date.slice(14, 16)) || 0;
    const durationMin = (eh * 60 + em) - (sh * 60 + sm);
    const heightPx = Math.max(((eh + em / 60) - (sh + sm / 60)) * hourHeight, 20);
    return { durationMin, heightPx };
  };

  const buildTooltip = (ev: CalendarEvent) => {
    const parts = [ev.summary, `${ev.start_date.slice(11, 16)} – ${ev.end_date.slice(11, 16)}`];
    if (ev.location) parts.push(ev.location);
    if (ev.conference_url) parts.push("Visio disponible");
    return parts.join("\n");
  };

  return (
    <div
      className="relative border-l border-white/[0.04] h-full"
      style={{ width: widthPct }}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const hour = Math.floor((e.clientY - rect.top) / hourHeight);
        onSlotClick(date, Math.min(Math.max(hour, 0), 23), e);
      }}
    >
      {/* Now line — RED (Notion Calendar style) */}
      {showNow && (
        <div className="absolute left-0 right-0 z-30 pointer-events-none" style={{ top: `${currentTimeTop}px` }}>
          <div className="h-[2px] relative" style={{ backgroundColor: NOW_COLOR }}>
            <div className="absolute -left-[5px] -top-[4px] w-[10px] h-[10px] rounded-full" style={{ backgroundColor: NOW_COLOR }} />
          </div>
        </div>
      )}

      {/* Events */}
      {dayEvents.map((ev) => {
        const s = getStyle(ev);
        const color = getEventColor(ev, calendarColors);
        const pos = layout.get(ev.id) || { column: 0, totalColumns: 1 };
        const widthPctEv = 100 / pos.totalColumns;
        const leftPctEv = pos.column * widthPctEv;
        const { durationMin, heightPx } = getBlockInfo(ev);
        const isSmall = heightPx < 28;
        return (
          <div key={ev.id}
            onClick={(e) => { e.stopPropagation(); onEventClick(ev, e); }}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onEventContextMenu?.(ev, e); }}
            title={buildTooltip(ev)}
            className="absolute rounded-[5px] px-[6px] py-[2px] cursor-pointer hover:brightness-110 transition-all"
            style={{
              ...s,
              left: `calc(${leftPctEv}% + 1px)`,
              width: `calc(${widthPctEv}% - 3px)`,
              background: `${color}BF`,
              borderLeft: `3px solid ${color}`,
              overflow: "hidden",
            }}>
            {isSmall ? (
              /* Small block: single line, title + time, ellipsis */
              <div className="text-[11px] font-medium text-white whitespace-nowrap overflow-hidden text-ellipsis">
                {ev.summary} <span className="text-white/50">{ev.start_date.slice(11, 16)}</span>
              </div>
            ) : (
              /* Normal block: content fills available space, overflow clipped by parent */
              <>
                <div className="text-[11px] font-semibold leading-[1.3] text-white" style={{
                  display: "-webkit-box",
                  WebkitLineClamp: heightPx < 44 ? 1 : heightPx < 70 ? 2 : undefined,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}>
                  {ev.summary}
                </div>
                {heightPx >= 34 && (
                  <div className="text-[10px] text-white/60 mt-px whitespace-nowrap overflow-hidden text-ellipsis">
                    {ev.start_date.slice(11, 16)} – {ev.end_date.slice(11, 16)}
                  </div>
                )}
                {ev.location && heightPx >= 58 && (
                  <div className="text-[10px] text-white/45 mt-px whitespace-nowrap overflow-hidden text-ellipsis flex items-center gap-0.5">
                    <MapPin size={7} className="shrink-0" /> {ev.location}
                  </div>
                )}
                {ev.attendees.length > 0 && heightPx >= 80 && (
                  <div className="text-[9px] text-white/40 mt-px whitespace-nowrap overflow-hidden text-ellipsis">
                    {ev.attendees.filter((a) => !a.is_self).slice(0, 3).map((a) => a.display_name || a.email.split("@")[0]).join(", ")}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
});

// === Recurrence Helpers ===

const DAYS_RRULE = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function presetToRRule(preset: string, startDate: string): string[] | undefined {
  if (preset === "never") return undefined;
  const d = new Date(startDate + "T12:00:00");
  const day = DAYS_RRULE[d.getDay()];
  switch (preset) {
    case "daily": return ["RRULE:FREQ=DAILY"];
    case "weekly": return [`RRULE:FREQ=WEEKLY;BYDAY=${day}`];
    case "biweekly": return [`RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=${day}`];
    case "monthly": return [`RRULE:FREQ=MONTHLY;BYMONTHDAY=${d.getDate()}`];
    case "yearly": return ["RRULE:FREQ=YEARLY"];
    default: return undefined;
  }
}

function getRecurrenceLabel(preset: string, startDateStr: string): string {
  const d = new Date(startDateStr + "T12:00:00");
  const dayName = DAYS_FULL_FR[(d.getDay() + 6) % 7].toLowerCase();
  switch (preset) {
    case "never": return "Jamais";
    case "daily": return "Tous les jours";
    case "weekly": return `Chaque semaine (le ${dayName})`;
    case "biweekly": return "Toutes les 2 semaines";
    case "monthly": return `Chaque mois (le ${d.getDate()})`;
    case "yearly": return "Chaque année";
    default: return "Jamais";
  }
}

// === EventPopover ===

function computePopoverPos(anchor: { x: number; y: number }, w: number, h: number) {
  let left = anchor.x + 12;
  let top = anchor.y - h / 2;
  if (left + w > window.innerWidth - 12) left = anchor.x - w - 12;
  if (left < 12) left = 12;
  top = Math.max(12, Math.min(top, window.innerHeight - h - 12));
  return { top, left };
}

function EventPopover({
  event, calendars, defaultDate, defaultHour, anchor, onClose, onSave, onUpdate, onDelete, calendarColors,
}: {
  event: CalendarEvent | null;
  calendars: CalendarInfo[];
  defaultDate?: Date;
  defaultHour?: number;
  anchor: { x: number; y: number };
  onClose: () => void;
  onSave: (data: { title: string; startDate: string; endDate: string; calendarId: string; allDay: boolean; notes?: string; location?: string; colorId?: string; recurrence?: string[]; attendees?: string[]; reminders?: number[]; addMeet?: boolean; conferenceUrl?: string }) => void;
  onUpdate: (data: UpdateEventParams) => void;
  onDelete?: () => void;
  calendarColors: Record<string, string>;
}) {
  const isCreate = !event;
  const canEdit = isCreate || (() => {
    const cal = calendars.find((c) => c.id === event?.calendar_id);
    return cal?.access_role === "owner" || cal?.access_role === "writer";
  })();

  const defaultStartDate = defaultDate || new Date();
  const defaultStartHour = defaultHour ?? new Date().getHours();

  const [title, setTitle] = useState(event?.summary || "");
  const [startDateStr, setStartDateStr] = useState(event ? event.start_date.slice(0, 10) : dateToISO(defaultStartDate));
  const [startTime, setStartTime] = useState(event ? event.start_date.slice(11, 16) : `${String(defaultStartHour).padStart(2, "0")}:00`);
  const [endDateStr, setEndDateStr] = useState(event ? event.end_date.slice(0, 10) : dateToISO(defaultStartDate));
  const [endTime, setEndTime] = useState(event ? event.end_date.slice(11, 16) : `${String(Math.min(defaultStartHour + 1, 23)).padStart(2, "0")}:00`);
  const [allDay, setAllDay] = useState(event?.all_day || false);
  const [selectedCalendarId, setSelectedCalendarId] = useState(() => {
    if (event?.calendar_id) return event.calendar_id;
    const writable = calendars.filter((c) => c.access_role === "owner" || c.access_role === "writer");
    const primary = writable.find((c) => c.primary);
    return primary?.id || writable[0]?.id || calendars[0]?.id || "";
  });
  const [notes, setNotes] = useState(event?.description || "");
  const [location, setLocation] = useState(event?.location || "");
  const [colorId, setColorId] = useState<string | undefined>(event?.color_id || undefined);
  const [recurrencePreset, setRecurrencePreset] = useState<string>("never");
  const [attendeeEmails, setAttendeeEmails] = useState<string[]>(event?.attendees.filter((a) => !a.is_self).map((a) => a.email) || []);
  const [attendeeInput, setAttendeeInput] = useState("");
  const [reminderMinutes, setReminderMinutes] = useState<number[]>(event?.reminders.map((r) => r.minutes) || []);
  const [conferenceType, setConferenceType] = useState<"none" | "meet" | "zoom" | "custom">(() => {
    const url = event?.conference_url;
    if (!url) return "none";
    if (url.includes("meet.google")) return "meet";
    if (url.includes("zoom.us") || url.includes("zoom.com")) return "zoom";
    return "custom";
  });
  const [conferenceUrl, setConferenceUrl] = useState(event?.conference_url || "");
  const [conferenceOpen, setConferenceOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const writableCalendars = calendars.filter((c) => c.access_role === "owner" || c.access_role === "writer");
  const existingConferenceUrl = event?.conference_url || null;
  const titleRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: -9999, left: -9999 });

  useEffect(() => {
    if (isCreate && titleRef.current) titleRef.current.focus();
  }, [isCreate]);

  // Measure and position after render
  useLayoutEffect(() => {
    if (popoverRef.current) {
      const rect = popoverRef.current.getBoundingClientRect();
      setPos(computePopoverPos(anchor, rect.width, rect.height));
    }
  }, [anchor]);

  const buildDates = () => ({
    startDate: allDay ? `${startDateStr}T00:00:00` : `${startDateStr}T${startTime}:00`,
    endDate: allDay ? `${endDateStr}T23:59:59` : `${endDateStr}T${endTime}:00`,
  });

  const handleSubmit = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const dates = buildDates();
      const recurrence = presetToRRule(recurrencePreset, startDateStr);
      const reminders = reminderMinutes.length > 0 ? reminderMinutes : undefined;
      const attendees = attendeeEmails.length > 0 ? attendeeEmails : undefined;
      const addMeet = conferenceType === "meet" ? true : undefined;
      const confUrl = (conferenceType === "zoom" || conferenceType === "custom") && conferenceUrl.trim()
        ? conferenceUrl.trim() : undefined;
      const common = {
        title: title.trim(),
        ...dates,
        calendarId: selectedCalendarId,
        allDay,
        notes: notes || undefined,
        location: location || undefined,
        colorId,
        recurrence,
        attendees,
        reminders,
        addMeet,
        conferenceUrl: confUrl,
      };
      if (isCreate) {
        await onSave(common);
      } else {
        await onUpdate({ eventId: event!.id, ...common });
      }
    } catch (e: any) {
      const msg = typeof e === "string" ? e : e?.message || JSON.stringify(e);
      console.error("Save event error:", e);
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Popover */}
      <motion.div
        ref={popoverRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="fixed z-50 w-[380px] max-h-[560px] bg-space-900/[0.98] backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{ top: pos.top, left: pos.left, boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04]">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: colorId ? GOOGLE_EVENT_COLORS[colorId]?.hex || DEFAULT_COLOR : (event ? getEventColor(event, calendarColors) : getCalColor(calendars.find((c) => c.id === selectedCalendarId) || calendars[0], calendarColors)) }} />
            <span className="text-[11px] text-dust">{event?.calendar_title || calendars.find((c) => c.id === selectedCalendarId)?.title || ""}</span>
          </div>
          <button onClick={onClose} className="flex h-6 w-6 items-center justify-center rounded-md text-dust-dark hover:text-dust hover:bg-white/[0.06] transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Title */}
          <input ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Ajouter un titre"
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            className="w-full bg-transparent text-[15px] font-semibold text-star-white placeholder-dust-dark/40 outline-none pb-1 focus:border-b focus:border-electric-500/30 transition-colors"
            readOnly={!canEdit} />

          {/* Date & Time */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-dust-dark">
              <Clock size={12} className="shrink-0" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">Date & heure</span>
            </div>
            {canEdit ? (
              <div className="space-y-2 pl-5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-dust-dark w-8">Début</span>
                  <DatePicker value={startDateStr} onChange={setStartDateStr} />
                  {!allDay && <TimePicker value={startTime} onChange={setStartTime} />}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-dust-dark w-8">Fin</span>
                  <DatePicker value={endDateStr} onChange={setEndDateStr} />
                  {!allDay && <TimePicker value={endTime} onChange={setEndTime} />}
                </div>
                <div className="flex items-center gap-2 pl-8">
                  <button onClick={() => setAllDay(!allDay)}
                    className={`w-8 h-[18px] rounded-full relative transition-colors ${allDay ? "bg-electric-500" : "bg-white/[0.08]"}`}>
                    <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all shadow-sm ${allDay ? "left-[14px]" : "left-[2px]"}`} />
                  </button>
                  <span className="text-[11px] text-dust">Toute la journée</span>
                </div>
              </div>
            ) : (
              <div className="pl-5 text-[12px] text-dust space-y-0.5">
                <div>{formatDateFr(new Date(event!.start_date))} {!event!.all_day && `· ${event!.start_date.slice(11, 16)}`}</div>
                <div className="text-dust-dark">→ {formatDateFr(new Date(event!.end_date))} {!event!.all_day && `· ${event!.end_date.slice(11, 16)}`}</div>
              </div>
            )}
          </div>

          {/* Calendar selector (create mode or editable) */}
          {canEdit && writableCalendars.length > 1 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-dust-dark">
                <CalendarIcon size={12} className="shrink-0" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Calendrier</span>
              </div>
              <div className="flex items-center gap-1.5 pl-5 flex-wrap">
                {writableCalendars.map((c) => (
                  <button key={c.id} onClick={() => setSelectedCalendarId(c.id)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] transition-all border ${
                      selectedCalendarId === c.id
                        ? "border-white/[0.12] bg-white/[0.06] text-star-white"
                        : "border-transparent bg-white/[0.02] text-dust-dark hover:text-dust hover:bg-white/[0.04]"
                    }`}>
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: getCalColor(c, calendarColors) }} />
                    {c.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Color picker */}
          {canEdit && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-dust-dark">
                <div className="h-3 w-3 rounded-full border border-white/20 shrink-0" style={{ background: colorId ? GOOGLE_EVENT_COLORS[colorId]?.hex : "transparent" }} />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Couleur</span>
              </div>
              <div className="flex items-center gap-1.5 pl-5 flex-wrap">
                <button onClick={() => setColorId(undefined)}
                  className={`h-6 w-6 rounded-full border-2 transition-all flex items-center justify-center ${
                    !colorId ? "border-electric-500 scale-110" : "border-white/10 hover:border-white/20"
                  }`}
                  style={{ background: event ? getEventColor({ ...event, event_color: null, color_id: null }, calendarColors) : getCalColor(calendars.find((c) => c.id === selectedCalendarId) || calendars[0], calendarColors) }}
                  title="Par défaut"
                />
                {Object.entries(GOOGLE_EVENT_COLORS).map(([id, { hex, name }]) => (
                  <button key={id} onClick={() => setColorId(id)}
                    className={`h-6 w-6 rounded-full border-2 transition-all ${
                      colorId === id ? "border-white scale-110" : "border-transparent hover:border-white/20"
                    }`}
                    style={{ background: hex }}
                    title={name}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Recurrence */}
          {canEdit && isCreate && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-dust-dark">
                <Repeat size={12} className="shrink-0" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Récurrence</span>
              </div>
              <div className="pl-5">
                <select
                  value={recurrencePreset}
                  onChange={(e) => setRecurrencePreset(e.target.value)}
                  className="bg-white/[0.03] border border-white/[0.06] rounded-md px-3 py-1.5 text-[11px] text-star-white outline-none focus:border-electric-500/30 transition-colors appearance-none cursor-pointer w-full"
                >
                  {["never", "daily", "weekly", "biweekly", "monthly", "yearly"].map((p) => (
                    <option key={p} value={p} className="bg-space-900 text-star-white">
                      {getRecurrenceLabel(p, startDateStr)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          {!isCreate && event?.recurrence && event.recurrence.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-dust-dark">
                <Repeat size={12} className="shrink-0" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Récurrence</span>
              </div>
              <span className="pl-5 text-[11px] text-dust">{event.recurrence[0]?.replace("RRULE:", "")}</span>
            </div>
          )}

          {/* Attendees */}
          {canEdit && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-dust-dark">
                <Users size={12} className="shrink-0" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Participants</span>
              </div>
              <div className="pl-5 space-y-1.5">
                {attendeeEmails.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {attendeeEmails.map((email) => (
                      <span key={email} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.06] text-[10px] text-dust">
                        {email}
                        <button onClick={() => setAttendeeEmails((prev) => prev.filter((e) => e !== email))}
                          className="text-dust-dark hover:text-red-400 transition-colors">
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <input
                  value={attendeeInput}
                  onChange={(e) => setAttendeeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === ",") && attendeeInput.includes("@")) {
                      e.preventDefault();
                      const email = attendeeInput.trim().replace(/,$/, "");
                      if (email && !attendeeEmails.includes(email)) {
                        setAttendeeEmails((prev) => [...prev, email]);
                      }
                      setAttendeeInput("");
                    }
                    if (e.key === "Backspace" && !attendeeInput && attendeeEmails.length > 0) {
                      setAttendeeEmails((prev) => prev.slice(0, -1));
                    }
                  }}
                  placeholder="Ajouter un email..."
                  className="w-full bg-white/[0.03] border border-white/[0.06] rounded-md px-3 py-1.5 text-[11px] text-star-white outline-none focus:border-electric-500/30 placeholder-dust-dark/30 transition-colors"
                />
              </div>
            </div>
          )}
          {!canEdit && event && event.attendees.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-dust-dark">
                <Users size={12} className="shrink-0" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Participants</span>
              </div>
              <div className="pl-5 space-y-1">
                {event.attendees.map((a) => (
                  <div key={a.email} className="flex items-center gap-2 text-[11px]">
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      a.response_status === "accepted" ? "bg-green-400" :
                      a.response_status === "declined" ? "bg-red-400" :
                      a.response_status === "tentative" ? "bg-yellow-400" : "bg-dust-dark"
                    }`} />
                    <span className="text-dust">{a.display_name || a.email}</span>
                    {a.is_self && <span className="text-[9px] text-dust-dark">(vous)</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reminders */}
          {canEdit && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-dust-dark">
                <Bell size={12} className="shrink-0" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Rappels</span>
              </div>
              <div className="pl-5 flex flex-wrap gap-1">
                {REMINDER_OPTIONS.map((opt) => {
                  const active = reminderMinutes.includes(opt.value);
                  return (
                    <button key={opt.value}
                      onClick={() => setReminderMinutes((prev) =>
                        active ? prev.filter((m) => m !== opt.value) : [...prev, opt.value]
                      )}
                      className={`px-2 py-1 rounded-md text-[10px] transition-all border ${
                        active
                          ? "border-electric-500/30 bg-electric-500/10 text-electric-400"
                          : "border-white/[0.06] bg-white/[0.02] text-dust-dark hover:text-dust hover:bg-white/[0.04]"
                      }`}>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Conferencing selector */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-dust-dark">
              <Video size={12} className="shrink-0" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">Visioconférence</span>
            </div>
            {/* Existing conference link (read-only display) */}
            {existingConferenceUrl && !isCreate && (
              <a href={existingConferenceUrl} target="_blank" rel="noopener noreferrer"
                className="ml-5 mb-1.5 inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-green-500/10 border border-green-500/20 text-[11px] text-green-400 hover:bg-green-500/15 transition-colors">
                <Video size={11} />
                {isVideoLink(existingConferenceUrl) ? "Rejoindre la visio" : "Ouvrir le lien"}
              </a>
            )}
            {canEdit && (
              <div className="ml-5 relative">
                {/* Dropdown trigger */}
                <button onClick={() => setConferenceOpen(!conferenceOpen)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-[11px] transition-all border ${
                    conferenceType !== "none"
                      ? "bg-white/[0.06] border-white/[0.08] text-star-white"
                      : "bg-white/[0.03] border-white/[0.06] text-dust hover:text-star-white hover:bg-white/[0.06]"
                  }`}>
                  <span className="flex items-center gap-2">
                    {conferenceType === "meet" && <><span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />Google Meet</>}
                    {conferenceType === "zoom" && <><span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />Zoom</>}
                    {conferenceType === "custom" && <><span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />Lien personnalisé</>}
                    {conferenceType === "none" && "Ajouter une visioconférence"}
                  </span>
                  <ChevronDown size={12} className={`transition-transform ${conferenceOpen ? "rotate-180" : ""}`} />
                </button>
                {/* Dropdown menu */}
                {conferenceOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setConferenceOpen(false)} />
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-white/[0.08] bg-[#1a1a2e] shadow-xl overflow-hidden">
                      <button onClick={() => { setConferenceType("meet"); setConferenceOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-[11px] hover:bg-white/[0.06] transition-colors ${conferenceType === "meet" ? "text-green-400" : "text-dust hover:text-star-white"}`}>
                        <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                        <span className="flex-1 text-left">Google Meet</span>
                        {conferenceType === "meet" && <span className="text-[9px] text-green-400/60">actif</span>}
                      </button>
                      <button onClick={() => { setConferenceType("zoom"); setConferenceOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-[11px] hover:bg-white/[0.06] transition-colors ${conferenceType === "zoom" ? "text-blue-400" : "text-dust hover:text-star-white"}`}>
                        <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                        <span className="flex-1 text-left">Zoom</span>
                        {conferenceType === "zoom" && <span className="text-[9px] text-blue-400/60">actif</span>}
                      </button>
                      <button onClick={() => { setConferenceType("custom"); setConferenceOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-[11px] hover:bg-white/[0.06] transition-colors ${conferenceType === "custom" ? "text-purple-400" : "text-dust hover:text-star-white"}`}>
                        <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
                        <span className="flex-1 text-left">Lien personnalisé</span>
                      </button>
                      <div className="border-t border-white/[0.06]" />
                      <button onClick={() => { setConferenceType("none"); setConferenceUrl(""); setConferenceOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-[11px] hover:bg-white/[0.06] transition-colors ${conferenceType === "none" ? "text-star-white" : "text-dust hover:text-star-white"}`}>
                        <span className="w-2 h-2 rounded-full bg-white/20 shrink-0" />
                        <span className="flex-1 text-left">Aucun</span>
                      </button>
                    </div>
                  </>
                )}
                {/* URL input for zoom/custom */}
                {(conferenceType === "zoom" || conferenceType === "custom") && (
                  <input
                    value={conferenceUrl}
                    onChange={(e) => setConferenceUrl(e.target.value)}
                    placeholder={conferenceType === "zoom" ? "Coller le lien Zoom..." : "Coller le lien de visio..."}
                    className="w-full mt-1.5 px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-[11px] text-star-white placeholder-dust-dark focus:outline-none focus:border-electric-500/40"
                  />
                )}
                {/* Meet confirmation */}
                {conferenceType === "meet" && (
                  <div className="mt-1.5 text-[10px] text-green-400/70 flex items-center gap-1.5">
                    <Video size={10} />
                    {isCreate ? "Un lien Meet sera généré automatiquement" : "Google Meet sera ajouté à l'événement"}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-dust-dark">
              <MapPin size={12} className="shrink-0" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">Lieu</span>
            </div>
            {canEdit ? (
              <input value={location} onChange={(e) => setLocation(e.target.value)}
                placeholder="Ajouter un lieu"
                className="ml-5 w-[calc(100%-20px)] bg-white/[0.03] border border-white/[0.06] rounded-md px-3 py-1.5 text-[11px] text-star-white outline-none focus:border-electric-500/30 placeholder-dust-dark/30 transition-colors" />
            ) : (
              event?.location && <span className="ml-5 text-[11px] text-dust">{event.location}</span>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-dust-dark">
              <FileText size={12} className="shrink-0" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">Notes</span>
            </div>
            {canEdit ? (
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Ajouter des notes..."
                rows={2}
                className="ml-5 w-[calc(100%-20px)] bg-white/[0.03] border border-white/[0.06] rounded-md px-3 py-1.5 text-[11px] text-star-white outline-none resize-none focus:border-electric-500/30 placeholder-dust-dark/30 transition-colors" />
            ) : (
              event?.description && <p className="ml-5 text-[11px] text-dust leading-relaxed whitespace-pre-wrap">{event.description}</p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="px-3 py-2 rounded-md bg-red-500/10 border border-red-500/20 text-[11px] text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        {canEdit && (
          <div className="px-4 py-2.5 border-t border-white/[0.04] flex items-center gap-2">
            <button onClick={handleSubmit}
              disabled={!title.trim() || saving}
              className="flex-1 flex items-center justify-center gap-2 rounded-md py-2 text-[12px] font-semibold bg-electric-500 text-white hover:bg-electric-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              {saving ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  {isCreate ? "Création..." : "Mise à jour..."}
                </>
              ) : (
                isCreate ? "Créer" : "Enregistrer"
              )}
            </button>
            {!isCreate && onDelete && event?.id && (
              <button onClick={onDelete}
                className="flex items-center gap-1 rounded-md px-3 py-2 text-[11px] font-medium text-red-400/80 hover:bg-red-400/10 border border-red-400/20 transition-colors">
                <Trash2 size={11} /> Supprimer
              </button>
            )}
          </div>
        )}
      </motion.div>
    </>
  );
}

// === Main Export ===

export function PlanningContent() {
  const { calendarView, setCalendarView, calendarDate, setCalendarDate, hiddenCalendarIds, toggleCalendarVisibility, googleConnected, setGoogleConnected, calendarColors, setCalendarColor, resetCalendarColor } = useExoStore();

  const [calendars, setCalendars] = useState<CalendarInfo[]>([]);
  const [rawEvents, setRawEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [createMode, setCreateMode] = useState<{ date: Date; hour?: number } | null>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<{ x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ event: CalendarEvent; x: number; y: number } | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [hourHeight, setHourHeight] = useState(HOUR_HEIGHT);

  const ZOOM_MIN = 40;
  const ZOOM_MAX = 200;
  const ZOOM_DEFAULT = HOUR_HEIGHT;
  const zoomIn = useCallback(() => setHourHeight((h) => Math.min(ZOOM_MAX, h + 16)), []);
  const zoomOut = useCallback(() => setHourHeight((h) => Math.max(ZOOM_MIN, h - 16)), []);
  const zoomReset = useCallback(() => setHourHeight(ZOOM_DEFAULT), []);

  const currentDate = useMemo(() => new Date(calendarDate + "T12:00:00"), [calendarDate]);

  // 5-panel system: ±2 panels of buffer for seamless scrolling
  const PANEL_COUNT = 5;
  const containerSize = `${PANEL_COUNT * 100}%`;
  const baseTransformPct = `${((PANEL_COUNT - 1) / 2) / PANEL_COUNT * 100}%`;
  const panelSizePct = `${100 / PANEL_COUNT}%`;

  const { rangeStart, rangeEnd } = useMemo(() => {
    const d = currentDate;
    const bufferPanels = Math.floor(PANEL_COUNT / 2) + 1; // 3 panels each side
    if (calendarView === "month") {
      const start = new Date(d.getFullYear(), d.getMonth() - bufferPanels, -7);
      const end = new Date(d.getFullYear(), d.getMonth() + bufferPanels + 1, 7);
      return { rangeStart: dateToISO(start), rangeEnd: dateToISO(end) };
    } else if (calendarView === "week") {
      const ws = getWeekStart(d);
      const start = new Date(ws);
      start.setDate(start.getDate() - bufferPanels * 7);
      const end = new Date(ws);
      end.setDate(end.getDate() + (bufferPanels + 1) * 7);
      return { rangeStart: dateToISO(start), rangeEnd: dateToISO(end) };
    } else {
      const start = new Date(d);
      start.setDate(start.getDate() - bufferPanels);
      const end = new Date(d);
      end.setDate(end.getDate() + bufferPanels + 1);
      return { rangeStart: dateToISO(start), rangeEnd: dateToISO(end) };
    }
  }, [calendarView, currentDate]);

  // Compute panel dates for 5-panel system
  const panelDates = useMemo(() => {
    const half = Math.floor(PANEL_COUNT / 2);
    return Array.from({ length: PANEL_COUNT }, (_, i) => {
      const offset = i - half;
      const d = new Date(currentDate);
      if (calendarView === "month") d.setMonth(d.getMonth() + offset);
      else if (calendarView === "week") d.setDate(d.getDate() + offset * 7);
      else d.setDate(d.getDate() + offset);
      return d;
    });
  }, [calendarView, currentDate]);

  const events = useMemo(
    () => rawEvents.filter((e) => !hiddenCalendarIds.includes(e.calendar_id)),
    [rawEvents, hiddenCalendarIds]
  );

  // Check Google auth status and load calendars
  useEffect(() => {
    api.googleAuthStatus().then((connected) => {
      setGoogleConnected(connected);
      if (connected) {
        api.getCalendars().then(setCalendars).catch((e) => console.error("Calendar load error:", e));
      } else {
        setLoading(false);
      }
    }).catch(() => {
      setGoogleConnected(false);
      setLoading(false);
    });
  }, []);

  const fetchedRangeRef = useRef({ start: "", end: "" });

  const loadEvents = useCallback((force?: boolean) => {
    if (
      !force &&
      fetchedRangeRef.current.start &&
      rangeStart >= fetchedRangeRef.current.start &&
      rangeEnd <= fetchedRangeRef.current.end
    ) {
      return;
    }
    setLoading(true);
    api.getEvents(rangeStart, rangeEnd)
      .then((evts) => {
        setRawEvents(evts);
        fetchedRangeRef.current = { start: rangeStart, end: rangeEnd };
        setLoading(false);
      })
      .catch((e) => {
        console.error("Events load error:", e);
        setLoading(false);
      });
  }, [rangeStart, rangeEnd]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture when typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Cmd/Ctrl + zoom shortcuts
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          zoomIn();
          return;
        }
        if (e.key === "-") {
          e.preventDefault();
          zoomOut();
          return;
        }
        if (e.key === "0") {
          e.preventDefault();
          zoomReset();
          return;
        }
        return;
      }
      if (e.altKey) return;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          navigate(-1);
          break;
        case "ArrowRight":
          e.preventDefault();
          navigate(1);
          break;
        case "t":
        case "T":
          e.preventDefault();
          goToday();
          break;
        case "m":
        case "M":
          e.preventDefault();
          setCalendarView("month");
          break;
        case "s":
        case "S":
          e.preventDefault();
          setCalendarView("week");
          break;
        case "j":
        case "J":
          e.preventDefault();
          setCalendarView("day");
          break;
        case "Escape":
          closePopover();
          setContextMenu(null);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [calendarView, currentDate]);

  const navigate = (dir: -1 | 1) => {
    const d = new Date(currentDate);
    if (calendarView === "month") d.setMonth(d.getMonth() + dir);
    else if (calendarView === "week") d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setCalendarDate(dateToISO(d));
  };

  const goToday = () => setCalendarDate(dateToISO(new Date()));

  // Continuous trackpad scroll (Notion Calendar style)
  const viewContainerRef = useRef<HTMLDivElement>(null);
  const leftFadeRef = useRef<HTMLDivElement>(null);
  const rightFadeRef = useRef<HTMLDivElement>(null);

  const { resetAfterNavigate } = useTrackpadScroll(
    viewContainerRef,
    { start: leftFadeRef, end: rightFadeRef },
    {
      calendarView,
      panelCount: PANEL_COUNT,
      onNavigate: navigate,
      onZoom: (deltaY: number, clientY: number) => {
        if (calendarView === "week" || calendarView === "day") {
          zoomFromPinchRef.current = true;
          // Smooth incremental zoom centered on mouse position
          const step = Math.max(4, Math.min(20, Math.abs(deltaY) * 0.3));
          const direction = deltaY > 0 ? -1 : 1;
          setHourHeight((prevH) => {
            const newH = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, prevH + direction * step));
            // Center zoom on mouse: adjust scrollTop so the time under cursor stays in place
            if (dayScrollRef.current && newH !== prevH) {
              const scrollEl = dayScrollRef.current;
              const rect = scrollEl.getBoundingClientRect();
              const mouseOffset = clientY - rect.top + scrollEl.scrollTop;
              const timeAtCursor = mouseOffset / prevH; // hours from top
              const newScrollTop = timeAtCursor * newH - (clientY - rect.top);
              requestAnimationFrame(() => {
                scrollEl.scrollTop = Math.max(0, newScrollTop);
                if (gutterScrollRef.current) gutterScrollRef.current.scrollTop = Math.max(0, newScrollTop);
              });
            }
            return newH;
          });
        }
      },
      isBlocked: !!(selectedEvent || createMode),
    }
  );

  // Reset transform after React re-renders with new date (seamless 3-panel transition)
  useLayoutEffect(() => {
    resetAfterNavigate();
  }, [currentDate, resetAfterNavigate]);

  // === Flat ribbon layout for week/day views ===
  const headerRibbonRef = useRef<HTMLDivElement>(null);
  const dayScrollRef = useRef<HTMLDivElement>(null);
  const gutterScrollRef = useRef<HTMLDivElement>(null);
  const headerHeightRef = useRef(0);
  const [headerHeight, setHeaderHeight] = useState(60);

  // Compute all visible days for the 5-panel ribbon
  const allDays = useMemo(() => {
    if (calendarView === "week") return panelDates.flatMap((d) => getWeekDays(d));
    if (calendarView === "day") return panelDates;
    return [];
  }, [calendarView, panelDates]);

  const allDayEvents = useMemo(() => events.filter((e) => e.all_day), [events]);
  const totalDays = calendarView === "week" ? 7 * PANEL_COUNT : PANEL_COUNT;
  const dayWidthPct = `${100 / totalDays}%`;

  // Sync header ribbon transform with viewContainerRef (MutationObserver — only fires on change)
  useEffect(() => {
    if (calendarView === "month") return;
    const container = viewContainerRef.current;
    const ribbon = headerRibbonRef.current;
    if (!container || !ribbon) return;
    // Initial sync
    ribbon.style.transform = container.style.transform;
    const observer = new MutationObserver(() => {
      ribbon.style.transform = container.style.transform;
    });
    observer.observe(container, { attributes: true, attributeFilter: ["style"] });
    return () => observer.disconnect();
  }, [calendarView]);

  // Sync gutter vertical scroll with day columns
  useEffect(() => {
    if (calendarView === "month") return;
    const el = dayScrollRef.current;
    const gutter = gutterScrollRef.current;
    if (!el || !gutter) return;
    const handler = () => { gutter.scrollTop = el.scrollTop; };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, [calendarView]);

  // Initial vertical scroll to current hour
  useEffect(() => {
    if (calendarView === "month") return;
    if (dayScrollRef.current) {
      const now = new Date();
      dayScrollRef.current.scrollTop = Math.max(0, (now.getHours() - 2) * hourHeight);
    }
    if (gutterScrollRef.current) {
      const now = new Date();
      gutterScrollRef.current.scrollTop = Math.max(0, (now.getHours() - 2) * hourHeight);
    }
  }, [calendarView]); // eslint-disable-line react-hooks/exhaustive-deps

  // Zoom: proportional scroll adjustment (for keyboard zoom only — pinch zoom handles its own centering)
  const prevHourHeightRef = useRef(hourHeight);
  const zoomFromPinchRef = useRef(false);
  useEffect(() => {
    if (prevHourHeightRef.current !== hourHeight) {
      if (!zoomFromPinchRef.current) {
        // Keyboard zoom: keep center of viewport stable
        const ratio = hourHeight / prevHourHeightRef.current;
        if (dayScrollRef.current) {
          const el = dayScrollRef.current;
          const viewCenter = el.scrollTop + el.clientHeight / 2;
          const newCenter = viewCenter * ratio;
          el.scrollTop = Math.max(0, newCenter - el.clientHeight / 2);
        }
        if (gutterScrollRef.current) {
          gutterScrollRef.current.scrollTop = dayScrollRef.current?.scrollTop || 0;
        }
      }
      zoomFromPinchRef.current = false;
      prevHourHeightRef.current = hourHeight;
    }
  }, [hourHeight]);

  // Measure header height dynamically for gutter spacer
  useEffect(() => {
    if (!headerRibbonRef.current) return;
    const parent = headerRibbonRef.current.parentElement;
    if (!parent) return;
    const h = parent.getBoundingClientRect().height;
    if (h > 0 && h !== headerHeightRef.current) {
      headerHeightRef.current = h;
      setHeaderHeight(h);
    }
  });

  const handleGoogleConnect = async () => {
    setAuthLoading(true);
    try {
      await api.googleAuthStart();
      setGoogleConnected(true);
      // Reload calendars after connecting
      const cals = await api.getCalendars();
      setCalendars(cals);
      loadEvents(true);
    } catch (e) {
      console.error("Google auth error:", e);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDayClick = useCallback((d: Date) => {
    setCalendarDate(dateToISO(d));
    setCalendarView("week");
  }, [setCalendarDate, setCalendarView]);

  const handleDayHeaderClick = useCallback((d: Date) => {
    setCalendarDate(dateToISO(d));
    setCalendarView("day");
  }, [setCalendarDate, setCalendarView]);

  const handleEventContextMenu = useCallback((ev: CalendarEvent, me: React.MouseEvent) => {
    setContextMenu({ event: ev, x: me.clientX, y: me.clientY });
  }, []);

  const handleEventClick = useCallback((ev: CalendarEvent, me: React.MouseEvent) => {
    setCreateMode(null);
    setSelectedEvent(ev);
    setPopoverAnchor({ x: me.clientX, y: me.clientY });
  }, []);

  const handleSlotClick = useCallback((d: Date, hour: number, me: React.MouseEvent) => {
    setSelectedEvent(null);
    setCreateMode({ date: d, hour });
    setPopoverAnchor({ x: me.clientX, y: me.clientY });
  }, []);

  const closePopover = useCallback(() => {
    setSelectedEvent(null);
    setCreateMode(null);
    setPopoverAnchor(null);
  }, []);

  const handleSave = useCallback(async (data: { title: string; startDate: string; endDate: string; calendarId: string; allDay: boolean; notes?: string; location?: string; colorId?: string; recurrence?: string[]; attendees?: string[]; reminders?: number[]; addMeet?: boolean; conferenceUrl?: string }) => {
    await api.createEvent(data);
    closePopover();
    loadEvents(true);
  }, [closePopover, loadEvents]);

  const handleUpdate = useCallback(async (data: UpdateEventParams) => {
    await api.updateEvent(data);
    closePopover();
    loadEvents(true);
  }, [closePopover, loadEvents]);

  const handleColorChange = async (ev: CalendarEvent, newColorId: string | undefined) => {
    try {
      await api.updateEvent({
        eventId: ev.id,
        title: ev.summary,
        startDate: ev.start_date,
        endDate: ev.end_date,
        calendarId: ev.calendar_id,
        allDay: ev.all_day,
        notes: ev.description || undefined,
        location: ev.location || undefined,
        colorId: newColorId,
      });
      setContextMenu(null);
      loadEvents(true);
    } catch (e) {
      console.error("Color change error:", e);
    }
  };

  const handleDelete = async () => {
    if (!selectedEvent?.id) return;
    try {
      await api.deleteEvent(selectedEvent.id, selectedEvent.calendar_id);
      closePopover();
      loadEvents(true);
    } catch (e) {
      console.error("Delete event error:", e);
    }
  };

  // If not connected to Google, show connect banner
  if (!googleConnected) {
    return (
      <div className="relative flex flex-col h-full items-center justify-center">
        <div className="flex flex-col items-center gap-5 max-w-sm text-center">
          <div className="h-16 w-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
            <CalendarIcon size={28} className="text-electric-500" />
          </div>
          <div>
            <h2 className="text-[18px] font-bold text-star-white mb-2">Connecter Google Calendar</h2>
            <p className="text-[13px] text-dust leading-relaxed">
              Connectez votre compte Google pour synchroniser vos calendriers et vos events directement dans Exo OS.
            </p>
          </div>
          <button onClick={handleGoogleConnect} disabled={authLoading}
            className="flex items-center gap-2.5 rounded-lg px-6 py-3 bg-electric-500 text-white font-semibold text-[13px] hover:bg-electric-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ boxShadow: "0 4px 20px rgba(0, 163, 255, 0.25)" }}>
            {authLoading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Connexion en cours...
              </>
            ) : (
              <>
                <CalendarIcon size={15} />
                Se connecter avec Google
              </>
            )}
          </button>
          <p className="text-[10px] text-dust-dark leading-relaxed max-w-[280px]">
            Les credentials OAuth doivent se trouver dans ~/.exo-os/google_credentials.json
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full">
      <CalendarToolbar
        view={calendarView}
        onViewChange={setCalendarView}
        date={currentDate}
        onNavigate={navigate}
        onToday={goToday}
        onRefresh={() => loadEvents(true)}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
      />

      <div className="flex flex-1 overflow-hidden relative min-h-0">
        <CalendarSidebar
          calendars={calendars}
          hiddenIds={hiddenCalendarIds}
          onToggle={toggleCalendarVisibility}
          date={currentDate}
          onDateSelect={(d) => setCalendarDate(dateToISO(d))}
          calendarColors={calendarColors}
          onColorChange={setCalendarColor}
          onColorReset={resetCalendarColor}
        />

        <div className="flex-1 relative overflow-hidden min-h-0">
          {/* Scroll fade overlays */}
          {calendarView === "month" ? (
            <>
              <div ref={leftFadeRef} className="absolute left-0 right-0 top-0 h-10 bg-gradient-to-b from-space-900 to-transparent z-10 pointer-events-none" style={{ opacity: 0 }} />
              <div ref={rightFadeRef} className="absolute left-0 right-0 bottom-0 h-10 bg-gradient-to-t from-space-900 to-transparent z-10 pointer-events-none" style={{ opacity: 0 }} />
            </>
          ) : (
            <>
              <div ref={leftFadeRef} className="absolute left-[58px] top-0 bottom-0 w-10 bg-gradient-to-r from-space-900 to-transparent z-10 pointer-events-none" style={{ opacity: 0 }} />
              <div ref={rightFadeRef} className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-space-900 to-transparent z-10 pointer-events-none" style={{ opacity: 0 }} />
            </>
          )}

          {calendarView === "month" ? (
            /* Month: 5-panel vertical carousel */
            <div
              ref={viewContainerRef}
              className="h-full flex flex-col"
              style={{ willChange: "transform", height: containerSize, transform: `translateY(-${baseTransformPct})` }}
            >
              {loading && events.length === 0 ? (
                <>
                  <div style={{ height: panelSizePct }} />
                  <div style={{ height: panelSizePct }} />
                  <div className="flex items-center justify-center" style={{ height: panelSizePct }}>
                    <Loader2 size={20} className="animate-spin text-dust-dark" />
                  </div>
                  <div style={{ height: panelSizePct }} />
                  <div style={{ height: panelSizePct }} />
                </>
              ) : (
                panelDates.map((panelDate) => (
                  <div key={`month-${dateToISO(panelDate)}`} className="flex flex-col min-h-0" style={{ height: panelSizePct }}>
                    <MonthView date={panelDate} events={events} onDayClick={handleDayClick} onEventClick={handleEventClick} calendarColors={calendarColors} />
                  </div>
                ))
              )}
            </div>
          ) : (
            /* Week/Day: TimeGutter (fixed left) + flat day ribbon */
            <div className="flex h-full">
              <TimeGutter scrollRef={gutterScrollRef} hourHeight={hourHeight} headerHeight={headerHeight} />

              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Day headers ribbon (synced horizontally with day columns) */}
                <div className="shrink-0 overflow-hidden border-b border-white/[0.06]">
                  <div
                    ref={headerRibbonRef}
                    className="flex"
                    style={{ width: containerSize, transform: `translateX(-${baseTransformPct})`, willChange: "transform" }}
                  >
                    {allDays.map((d) => {
                      const today = isToday(d);
                      const dayName = DAYS_FR[(d.getDay() + 6) % 7];
                      const dayAllDay = allDayEvents.filter((e) => isSameDay(new Date(e.start_date), d));
                      return (
                        <div key={dateToISO(d)} className="flex flex-col py-2 cursor-pointer hover:bg-white/[0.02] transition-colors border-l border-white/[0.04]" style={{ width: dayWidthPct }}
                          onClick={() => handleDayHeaderClick(d)}>
                          {/* Day name + number on same line (Notion Calendar style) */}
                          <div className="flex items-center gap-1.5 px-3">
                            <span className={`text-[12px] font-medium ${today ? "text-star-white" : "text-dust-dark"}`}>{dayName}</span>
                            <span className={`text-[12px] font-semibold h-6 min-w-[24px] flex items-center justify-center rounded-full ${
                              today ? "text-white" : "text-dust"
                            }`}
                              style={today ? { backgroundColor: NOW_COLOR } : undefined}
                            >{d.getDate()}</span>
                          </div>
                          {/* All-day events */}
                          {dayAllDay.length > 0 && (
                            <div className="px-1 mt-1 space-y-px">
                              {dayAllDay.map((ev) => {
                                const adColor = getEventColor(ev, calendarColors);
                                return (
                                <div key={ev.id} onClick={(e) => { e.stopPropagation(); handleEventClick(ev, e); }}
                                  className="truncate text-[10px] font-medium px-1.5 py-0.5 rounded cursor-pointer hover:brightness-110 transition-all text-white"
                                  style={{ background: `${adColor}BF` }}>
                                  {ev.summary}
                                </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Scrollable time grid */}
                <div ref={dayScrollRef} className="flex-1 overflow-y-auto min-h-0">
                  <div className="relative" style={{ height: `${24 * hourHeight}px` }}>
                    <HourLines hourHeight={hourHeight} />
                    {loading && events.length === 0 ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 size={20} className="animate-spin text-dust-dark" />
                      </div>
                    ) : (
                      <div
                        ref={viewContainerRef}
                        className="absolute top-0 left-0 bottom-0 flex"
                        style={{ width: containerSize, transform: `translateX(-${baseTransformPct})`, willChange: "transform" }}
                      >
                        {allDays.map((d) => (
                          <DayColumn
                            key={dateToISO(d)}
                            date={d}
                            events={events}
                            hourHeight={hourHeight}
                            onEventClick={handleEventClick}
                            onSlotClick={handleSlotClick}
                            onEventContextMenu={handleEventContextMenu}
                            calendarColors={calendarColors}
                            widthPct={dayWidthPct}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <AnimatePresence>
          {(selectedEvent || createMode) && popoverAnchor && (
            <EventPopover
              event={selectedEvent}
              calendars={calendars}
              defaultDate={createMode?.date}
              defaultHour={createMode?.hour}
              anchor={popoverAnchor}
              onClose={closePopover}
              onSave={handleSave}
              onUpdate={handleUpdate}
              onDelete={selectedEvent ? handleDelete : undefined}
              calendarColors={calendarColors}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Context menu (right-click color) */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 bg-space-900/[0.98] backdrop-blur-xl border border-white/[0.08] rounded-lg shadow-2xl p-2.5"
            style={{
              top: Math.min(contextMenu.y, window.innerHeight - 120),
              left: Math.min(contextMenu.x, window.innerWidth - 200),
              boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
            }}
          >
            <div className="text-[10px] text-dust-dark font-semibold uppercase tracking-wider mb-2 px-1">Couleur</div>
            <div className="flex items-center gap-1.5 flex-wrap max-w-[180px]">
              <button
                onClick={() => handleColorChange(contextMenu.event, undefined)}
                className={`h-6 w-6 rounded-full border-2 transition-all ${!contextMenu.event.color_id ? "border-electric-500 scale-110" : "border-white/10 hover:border-white/20"}`}
                style={{ background: getEventColor({ ...contextMenu.event, event_color: null, color_id: null }, calendarColors) }}
                title="Par défaut"
              />
              {Object.entries(GOOGLE_EVENT_COLORS).map(([id, { hex, name }]) => (
                <button key={id}
                  onClick={() => handleColorChange(contextMenu.event, id)}
                  className={`h-6 w-6 rounded-full border-2 transition-all ${contextMenu.event.color_id === id ? "border-white scale-110" : "border-transparent hover:border-white/20"}`}
                  style={{ background: hex }}
                  title={name}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Create button */}
      {!createMode && !selectedEvent && (
        <button onClick={(e) => { setSelectedEvent(null); setCreateMode({ date: currentDate }); setPopoverAnchor({ x: e.clientX, y: e.clientY }); }}
          className="absolute bottom-5 right-5 flex h-11 w-11 items-center justify-center rounded-full bg-electric-500 text-white hover:bg-electric-600 transition-all z-10"
          style={{ boxShadow: "0 4px 20px rgba(0, 163, 255, 0.3)" }}>
          <Plus size={20} />
        </button>
      )}
    </div>
  );
}
