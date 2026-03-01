import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  ArrowLeft,
  MessageSquare,
  MessageCircle,
  Phone,
  Globe,
  Hash,
  Mail,
  Twitter,
  CalendarDays,
  RefreshCw,
  CheckCircle2,
  ChevronDown,
  Terminal,
  Pencil,
  Trash2,
} from "lucide-react";
import { useExoStore } from "../lib/store";

const ICONS: Record<string, typeof MessageSquare> = {
  MessageSquare, MessageCircle, Phone, Globe, Hash, Mail, Twitter, CalendarDays,
};

export function Settings() {
  const navigate = useNavigate();
  const constellation = useExoStore((s) => s.constellation);
  const updateMcp = useExoStore((s) => s.updateMcp);
  const setConstellation = useExoStore((s) => s.setConstellation);
  const [syncing, setSyncing] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(constellation?.name || "");

  const mcps = constellation?.mcps || [];
  const enabledMcps = mcps.filter((m) => m.enabled);

  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => setSyncing(false), 3000);
  };

  const handleNameSave = () => {
    if (constellation && nameValue.trim()) {
      setConstellation({ ...constellation, name: nameValue.trim() });
    }
    setEditingName(false);
  };

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
          <div className="h-3 w-3 rounded-full" style={{ background: "#8B9DC3", boxShadow: "0 0 10px rgba(139,157,195,0.4)" }} />
          <h1 className="text-xl font-semibold text-star-white">Settings</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
        {/* Constellation info */}
        <div className="rounded-xl border border-white/[0.04] bg-white/[0.015] p-5">
          <h2 className="text-sm font-semibold text-star-white mb-4">Constellation</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-dust-dark uppercase tracking-wider">Nom</span>
              {editingName ? (
                <input
                  type="text"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onBlur={handleNameSave}
                  onKeyDown={(e) => e.key === "Enter" && handleNameSave()}
                  autoFocus
                  className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-sm text-star-white outline-none focus:border-electric-500/40"
                />
              ) : (
                <span className="text-sm text-star-white">{constellation?.name}</span>
              )}
            </div>
            {!editingName && (
              <button
                onClick={() => { setNameValue(constellation?.name || ""); setEditingName(true); }}
                className="text-dust-dark hover:text-dust transition-colors"
              >
                <Pencil size={12} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 mt-3">
            <span className="text-[11px] text-dust-dark uppercase tracking-wider">Planètes</span>
            <span className="text-sm text-star-white">{constellation?.planets.length || 0} actives</span>
          </div>
        </div>

        {/* Sync control */}
        <div className="rounded-xl border border-white/[0.04] bg-white/[0.015] p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-star-white">Synchronisation</h2>
            <button
              onClick={handleSync}
              disabled={syncing}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                syncing
                  ? "bg-electric-500/20 text-electric-400 cursor-wait"
                  : "bg-electric-500 text-void hover:bg-electric-400"
              }`}
            >
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Sync..." : "Sync now"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {enabledMcps.map((mcp) => {
              const Icon = ICONS[mcp.icon] || Globe;
              return (
                <div
                  key={mcp.id}
                  className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] p-3"
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ background: `${mcp.color}15` }}
                  >
                    <Icon size={14} style={{ color: mcp.color }} />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-medium text-star-white">{mcp.name}</div>
                    <div className="text-[10px] text-dust-dark">Il y a 2h</div>
                  </div>
                  <CheckCircle2 size={14} className="text-green-400" />
                </div>
              );
            })}
          </div>
        </div>

        {/* MCP toggles — dynamic from store */}
        <div className="rounded-xl border border-white/[0.04] bg-white/[0.015] p-5 space-y-3">
          <h2 className="text-sm font-semibold text-star-white">Sources (MCPs)</h2>
          {mcps.map((mcp) => {
            const Icon = ICONS[mcp.icon] || Globe;
            return (
              <div key={mcp.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full" style={{ background: mcp.color }} />
                  <span className="text-sm text-star-white">{mcp.name}</span>
                  <span className="text-[10px] text-dust-dark">
                    → {mcp.feedsPlanets.join(", ")}
                  </span>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={mcp.enabled}
                    onChange={() => updateMcp(mcp.id, { enabled: !mcp.enabled })}
                    className="peer sr-only"
                  />
                  <div className="h-5 w-9 rounded-full bg-white/10 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-dust after:transition-all peer-checked:bg-electric-500/30 peer-checked:after:translate-x-full peer-checked:after:bg-electric-500" />
                </label>
              </div>
            );
          })}
        </div>

        {/* Logs */}
        <div className="rounded-xl border border-white/[0.04] bg-white/[0.015] overflow-hidden">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Terminal size={14} className="text-dust" />
              <h2 className="text-sm font-semibold text-star-white">Logs</h2>
            </div>
            <ChevronDown
              size={14}
              className={`text-dust transition-transform ${showLogs ? "rotate-180" : ""}`}
            />
          </button>
          {showLogs && (
            <div className="border-t border-white/[0.04] p-4">
              <pre className="text-[11px] text-dust-dark font-mono leading-relaxed max-h-[300px] overflow-y-auto">
{`[20:17:24] INFO  Starting sync cycle...
[20:17:25] INFO  WhatsApp: 23 new messages
[20:17:26] INFO  iMessage: 8 new messages
[20:17:28] INFO  Fathom: 1 new meeting
[20:17:30] INFO  Comet: 45 URLs, 12 searches
[20:17:32] INFO  Sync complete ✓`}
              </pre>
            </div>
          )}
        </div>

        {/* Danger zone */}
        <div className="rounded-xl border border-red-500/10 bg-red-500/[0.02] p-5">
          <h2 className="text-sm font-semibold text-red-400/80 mb-3">Zone danger</h2>
          <button
            onClick={() => {
              if (confirm("Réinitialiser toute la constellation ? Cela supprime ta config locale.")) {
                localStorage.removeItem("exo-constellation");
                window.location.href = "/onboarding";
              }
            }}
            className="flex items-center gap-2 text-sm text-red-400/60 hover:text-red-400 transition-colors"
          >
            <Trash2 size={14} />
            Réinitialiser la constellation
          </button>
        </div>
      </div>
    </motion.div>
  );
}
