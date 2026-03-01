import { motion } from "framer-motion";
import { MessageSquare, Phone, Globe, ChevronDown } from "lucide-react";
import { useState } from "react";

interface JournalEntry {
  id: number;
  date: string;
  timeLabel: string;
  source: string;
  title: string;
  summary: string;
  rawPreview: string;
}

const MOCK_ENTRIES: JournalEntry[] = [
  {
    id: 1,
    date: "2026-02-25",
    timeLabel: "20h17",
    source: "whatsapp",
    title: "WhatsApp — Conversations du soir",
    summary: "Discussion avec Alice sur le planning de la semaine prochaine. Lucas a partagé les mockups finaux du dashboard. Camille confirme le dîner de vendredi.",
    rawPreview: "Alice: Hey, tu es dispo lundi pour le call ?\nMoi: Oui 14h ça marche\nAlice: Parfait, j'envoie l'invite...",
  },
  {
    id: 2,
    date: "2026-02-25",
    timeLabel: "18h30",
    source: "fathom",
    title: "Call — Weekly sync avec l'équipe",
    summary: "Revue des objectifs Q1. Marc présente les résultats du pilote. Décision de lancer la phase 2 la semaine prochaine. Action: préparer le brief technique.",
    rawPreview: "Marc: Les métriques du pilote sont au-dessus des attentes...\nSophie: On peut scaler sans modifier l'infra...",
  },
  {
    id: 3,
    date: "2026-02-25",
    timeLabel: "15h00",
    source: "imessage",
    title: "iMessage — Après-midi",
    summary: "Échange rapide avec Sophie sur les maquettes du site. Elle envoie la V2 demain matin. Confirmation RDV dentiste jeudi.",
    rawPreview: "Sophie: J'ai presque fini les maquettes\nMoi: Super, tu peux envoyer demain matin ?...",
  },
  {
    id: 4,
    date: "2026-02-25",
    timeLabel: "12h00",
    source: "comet",
    title: "Recherches — Midi",
    summary: "Recherches sur Tauri v2 migration guide, comparaison SQLite vs DuckDB pour analytics locales, documentation Framer Motion spring animations.",
    rawPreview: "tauri.app/v2/guide/migrate → 15min\nSQLite vs DuckDB benchmarks → 8min\nframer.com/motion/spring → 5min",
  },
];

const SOURCE_CONFIG: Record<string, { color: string; icon: typeof MessageSquare; label: string }> = {
  whatsapp: { color: "#25D366", icon: MessageSquare, label: "WhatsApp" },
  imessage: { color: "#5AC8FA", icon: MessageSquare, label: "iMessage" },
  fathom: { color: "#8B5CF6", icon: Phone, label: "Fathom" },
  comet: { color: "#F59E0B", icon: Globe, label: "Comet" },
};

function EntryCard({ entry, index }: { entry: JournalEntry; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const config = SOURCE_CONFIG[entry.source];
  const Icon = config?.icon || MessageSquare;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="rounded-xl border border-white/[0.04] bg-white/[0.015] overflow-hidden"
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-2.5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5"
            style={{ background: `${config.color}15` }}
          >
            <Icon size={14} style={{ color: config.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-star-white">{entry.title}</span>
            </div>
            <span className="text-[10px] text-dust-dark">{entry.timeLabel}</span>
          </div>
        </div>

        {/* Summary */}
        <p className="text-[12px] text-dust leading-relaxed">{entry.summary}</p>
      </div>

      {/* Expand raw */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 border-t border-white/[0.03] hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-[10px] text-dust-dark">Voir le détail</span>
        <ChevronDown
          size={12}
          className={`text-dust-dark transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="border-t border-white/[0.03] px-4 py-3"
        >
          <pre className="text-[11px] text-dust-dark font-mono leading-relaxed whitespace-pre-wrap">
            {entry.rawPreview}
          </pre>
        </motion.div>
      )}
    </motion.div>
  );
}

export function JournalContent() {
  const [filter, setFilter] = useState<string | null>(null);
  const filtered = filter ? MOCK_ENTRIES.filter((e) => e.source === filter) : MOCK_ENTRIES;

  return (
    <div className="px-6 pb-6 space-y-4">
      {/* Source filter tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter(null)}
          className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all ${
            filter === null
              ? "bg-white/[0.08] text-star-white"
              : "text-dust-dark hover:text-dust hover:bg-white/[0.03]"
          }`}
        >
          Tout
        </button>
        {Object.entries(SOURCE_CONFIG).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setFilter(filter === key ? null : key)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all ${
              filter === key
                ? "bg-white/[0.08] text-star-white"
                : "text-dust-dark hover:text-dust hover:bg-white/[0.03]"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: cfg.color }} />
            {cfg.label}
          </button>
        ))}
      </div>

      {/* Date header */}
      <div className="flex items-center gap-3">
        <h2 className="text-xs text-dust-dark uppercase tracking-wider font-medium">25 Février 2026</h2>
        <div className="flex-1 h-px bg-white/[0.04]" />
        <span className="text-[10px] text-dust-dark">{filtered.length} entrées</span>
      </div>

      {/* Entries */}
      <div className="space-y-3">
        {filtered.map((entry, i) => (
          <EntryCard key={entry.id} entry={entry} index={i} />
        ))}
      </div>
    </div>
  );
}
