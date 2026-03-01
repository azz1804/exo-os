import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search } from "lucide-react";
import { useState } from "react";

const MOCK_CONTACTS = [
  { id: 1, name: "Grégoire", source: "whatsapp", lastInteraction: "Il y a 2h", interactions: 142, sentiment: "positif" },
  { id: 2, name: "Jade", source: "whatsapp", lastInteraction: "Il y a 1 jour", interactions: 89, sentiment: "positif" },
  { id: 3, name: "Maman", source: "imessage", lastInteraction: "Il y a 3h", interactions: 256, sentiment: "positif" },
  { id: 4, name: "Thomas", source: "fathom", lastInteraction: "Il y a 2 jours", interactions: 34, sentiment: "neutre" },
  { id: 5, name: "Sarah", source: "imessage", lastInteraction: "Il y a 5 jours", interactions: 67, sentiment: "positif" },
];

const SOURCE_COLORS: Record<string, string> = {
  whatsapp: "#25D366",
  imessage: "#5AC8FA",
  fathom: "#8B5CF6",
  comet: "#F59E0B",
};

function Avatar({ name, id }: { name: string; id: number }) {
  const hue = (id * 137) % 360;
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
      style={{
        background: `linear-gradient(135deg, hsl(${hue}, 50%, 20%), hsl(${hue}, 60%, 12%))`,
        color: `hsl(${hue}, 50%, 70%)`,
        border: `1px solid hsl(${hue}, 40%, 25%)`,
      }}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

export function Contacts() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const filtered = MOCK_CONTACTS.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

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
          <div className="h-3 w-3 rounded-full" style={{ background: "#00E599", boxShadow: "0 0 10px rgba(0,229,153,0.4)" }} />
          <h1 className="text-xl font-semibold text-star-white">Contacts</h1>
        </div>
        <span className="text-sm text-dust">{MOCK_CONTACTS.length} connexions</span>
      </div>

      {/* Search */}
      <div className="px-6 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dust-dark" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] py-2.5 pl-9 pr-4 text-sm text-star-white placeholder-dust-dark outline-none focus:border-electric-500/30 focus:bg-white/[0.04] transition-all"
          />
        </div>
      </div>

      {/* Contact list */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-1">
        {filtered.map((contact, index) => (
          <motion.div
            key={contact.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className="flex items-center gap-3 rounded-xl p-3 hover:bg-white/[0.03] transition-colors cursor-pointer group"
          >
            <Avatar name={contact.name} id={contact.id} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-star-white">{contact.name}</span>
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: SOURCE_COLORS[contact.source] }}
                />
              </div>
              <p className="text-xs text-dust-dark mt-0.5">
                {contact.interactions} interactions · {contact.lastInteraction}
              </p>
            </div>
            <span className="text-[11px] text-dust-dark opacity-0 group-hover:opacity-100 transition-opacity">
              →
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
