import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

type Source = "all" | "whatsapp" | "imessage" | "fathom" | "comet";

const TABS: { key: Source; label: string; color: string }[] = [
  { key: "all", label: "Tout", color: "#E8EAED" },
  { key: "whatsapp", label: "WhatsApp", color: "#25D366" },
  { key: "imessage", label: "iMessage", color: "#5AC8FA" },
  { key: "fathom", label: "Fathom", color: "#8B5CF6" },
  { key: "comet", label: "Comet", color: "#F59E0B" },
];

const MOCK_CONVERSATIONS = [
  {
    id: 1,
    source: "whatsapp",
    title: "Log WhatsApp — 25 fév 2026",
    summary: "Échanges avec Grégoire, Jade et le groupe Projet Alpha.",
    rawPreview: "[14:30] Grégoire → Moi: Hey, t'as vu le message de Thomas ?\n[14:31] Moi → Grégoire: Oui, je regarde ça...",
    date: "25 fév",
  },
  {
    id: 2,
    source: "imessage",
    title: "Log iMessage — 25 fév 2026",
    summary: "Messages de Maman et Sarah. Rappel dîner dimanche.",
    rawPreview: "[10:15] Maman → Moi: Tu viens dimanche ?\n[10:16] Moi → Maman: Oui bien sûr!",
    date: "25 fév",
  },
  {
    id: 3,
    source: "fathom",
    title: "Weekly Sync — Product Team",
    summary: "Revue du sprint, 3 tickets closés. Discussion migration Tauri.",
    rawPreview: "[00:02:15] Thomas: OK so let's go over the sprint review...\n[00:02:30] Sarah: We closed 3 tickets this week...",
    date: "24 fév",
  },
];

function ConversationCard({
  conv,
  index,
}: {
  conv: (typeof MOCK_CONVERSATIONS)[0];
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const color = TABS.find((t) => t.key === conv.source)?.color || "#8892B0";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="rounded-xl border border-white/[0.04] overflow-hidden bg-white/[0.015]"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full" style={{ background: color }} />
            <span className="text-sm font-medium text-star-white">{conv.title}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-dust-dark">{conv.date}</span>
            {expanded ? (
              <ChevronDown size={14} className="text-dust-dark" />
            ) : (
              <ChevronRight size={14} className="text-dust-dark" />
            )}
          </div>
        </div>
        <p className="text-sm text-dust leading-relaxed pl-[18px]">
          {conv.summary}
        </p>
      </button>

      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="border-t border-white/[0.04]"
        >
          <pre className="p-4 text-xs text-dust-dark font-mono leading-relaxed whitespace-pre-wrap">
            {conv.rawPreview}
          </pre>
        </motion.div>
      )}
    </motion.div>
  );
}

export function Journal() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Source>("all");
  const filtered =
    activeTab === "all"
      ? MOCK_CONVERSATIONS
      : MOCK_CONVERSATIONS.filter((c) => c.source === activeTab);

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
          <div className="h-3 w-3 rounded-full" style={{ background: "#FFB800", boxShadow: "0 0 10px rgba(255,184,0,0.4)" }} />
          <h1 className="text-xl font-semibold text-star-white">Journal</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 mb-4">
        <div className="flex gap-1 rounded-xl border border-white/[0.04] bg-white/[0.02] p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-white/[0.08] text-star-white"
                  : "text-dust-dark hover:text-dust"
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                {tab.key !== "all" && (
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: tab.color }} />
                )}
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-2">
        {filtered.map((conv, index) => (
          <ConversationCard key={conv.id} conv={conv} index={index} />
        ))}
      </div>
    </motion.div>
  );
}
