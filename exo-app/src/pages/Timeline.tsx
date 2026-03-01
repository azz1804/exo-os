import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MessageSquare, Phone, Globe, Search } from "lucide-react";

const SOURCE_ICON: Record<string, typeof MessageSquare> = {
  whatsapp: MessageSquare,
  imessage: MessageSquare,
  fathom: Phone,
  comet: Globe,
};

const SOURCE_COLOR: Record<string, string> = {
  whatsapp: "#25D366",
  imessage: "#5AC8FA",
  fathom: "#8B5CF6",
  comet: "#F59E0B",
};

const MOCK_TIMELINE = [
  {
    id: 1,
    source: "whatsapp",
    title: "Conversations WhatsApp",
    summary: "Discussion avec Grégoire sur le projet Exo OS. Jade a envoyé des photos du weekend.",
    time: "14:30",
    date: "Aujourd'hui",
  },
  {
    id: 2,
    source: "imessage",
    title: "Messages iMessage",
    summary: "Rappel de Maman pour le dîner de dimanche. Confirmation de RDV avec le dentiste.",
    time: "13:15",
    date: "Aujourd'hui",
  },
  {
    id: 3,
    source: "fathom",
    title: "Weekly Sync — Product Team",
    summary: "Point d'avancement sur la roadmap Q1. Décision de prioriser le module auth.",
    time: "15:30",
    date: "Hier",
  },
  {
    id: 4,
    source: "comet",
    title: "Recherches web",
    summary: "Tauri v2 documentation, Rust SQLite bindings, framer-motion animation examples.",
    time: "22:15",
    date: "Hier",
  },
];

function TimelineCard({
  item,
  index,
}: {
  item: (typeof MOCK_TIMELINE)[0];
  index: number;
}) {
  const Icon = SOURCE_ICON[item.source] || Globe;
  const color = SOURCE_COLOR[item.source] || "#8892B0";

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.08 * index, duration: 0.4 }}
      className="group relative flex gap-4 py-4"
    >
      {/* Timeline line + dot */}
      <div className="relative flex flex-col items-center">
        <div
          className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
          style={{ background: `${color}15`, border: `1px solid ${color}30` }}
        >
          <Icon size={14} style={{ color }} />
        </div>
        <div className="flex-1 w-px bg-white/[0.06] mt-2" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-star-white">{item.title}</span>
          <span className="text-[11px] text-dust-dark">{item.time}</span>
        </div>
        <p className="text-sm text-dust leading-relaxed group-hover:text-star-white/70 transition-colors">
          {item.summary}
        </p>
      </div>
    </motion.div>
  );
}

export function Timeline() {
  const navigate = useNavigate();
  let lastDate = "";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div data-tauri-drag-region className="flex items-center gap-4 px-6 pt-6 pb-4">
        <button
          onClick={() => navigate("/")}
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/5 transition-colors text-dust hover:text-star-white"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full" style={{ background: "#00A3FF", boxShadow: "0 0 10px rgba(0,163,255,0.4)" }} />
          <h1 className="text-xl font-semibold text-star-white">Timeline</h1>
        </div>
        <div className="flex-1" />
        <button className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs text-dust hover:text-star-white hover:border-white/10 transition-all">
          <Search size={12} />
          Rechercher
        </button>
      </div>

      {/* Timeline feed */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {MOCK_TIMELINE.map((item, index) => {
          const showDate = item.date !== lastDate;
          lastDate = item.date;
          return (
            <div key={item.id}>
              {showDate && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.05 * index }}
                  className="text-[11px] uppercase tracking-widest text-dust-dark mb-3 mt-6 first:mt-0"
                >
                  {item.date}
                </motion.div>
              )}
              <TimelineCard item={item} index={index} />
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
