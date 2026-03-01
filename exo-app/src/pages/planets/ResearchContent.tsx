import { motion } from "framer-motion";
import { Search, Globe, Clock, ExternalLink } from "lucide-react";

interface SearchCluster {
  id: number;
  topic: string;
  queries: string[];
  urls: { title: string; url: string; duration: string }[];
  timestamp: string;
}

const MOCK_CLUSTERS: SearchCluster[] = [
  {
    id: 1,
    topic: "Migration Tauri v2",
    queries: ["tauri v2 migration guide", "tauri v2 vs electron 2026", "tauri rust commands tutorial"],
    urls: [
      { title: "Tauri v2 Migration Guide", url: "https://v2.tauri.app/start/migrate/", duration: "15min" },
      { title: "Tauri vs Electron in 2026", url: "https://blog.example.com", duration: "8min" },
    ],
    timestamp: "Il y a 3h",
  },
  {
    id: 2,
    topic: "SQLite vs alternatives",
    queries: ["sqlite vs duckdb analytics", "better-sqlite3 performance", "rusqlite WAL mode"],
    urls: [
      { title: "SQLite vs DuckDB Benchmarks", url: "https://benchmark.example.com", duration: "12min" },
      { title: "better-sqlite3 docs", url: "https://github.com/WiseLibs/better-sqlite3", duration: "5min" },
    ],
    timestamp: "Il y a 5h",
  },
  {
    id: 3,
    topic: "Framer Motion animations",
    queries: ["framer motion spring config", "framer motion layout animation", "react animation performance"],
    urls: [
      { title: "Spring Animation Guide", url: "https://www.framer.com/motion/", duration: "10min" },
    ],
    timestamp: "Il y a 8h",
  },
];

function ClusterCard({ cluster, index }: { cluster: SearchCluster; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="rounded-xl border border-white/[0.04] bg-white/[0.015] p-5 space-y-3"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
            <Search size={14} className="text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-star-white">{cluster.topic}</h3>
            <span className="text-[10px] text-dust-dark flex items-center gap-1">
              <Clock size={9} />
              {cluster.timestamp}
            </span>
          </div>
        </div>
        <span className="text-[10px] text-dust-dark bg-white/[0.04] rounded-md px-2 py-0.5">
          {cluster.queries.length} recherches
        </span>
      </div>

      {/* Queries */}
      <div className="flex flex-wrap gap-1.5">
        {cluster.queries.map((q, i) => (
          <span
            key={i}
            className="rounded-md bg-white/[0.04] border border-white/[0.04] px-2 py-1 text-[11px] text-dust"
          >
            {q}
          </span>
        ))}
      </div>

      {/* URLs */}
      <div className="space-y-1.5">
        {cluster.urls.map((u, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-lg bg-white/[0.02] border border-white/[0.03] px-3 py-2 group hover:bg-white/[0.04] transition-colors"
          >
            <Globe size={12} className="text-dust-dark shrink-0" />
            <span className="text-[11px] text-dust group-hover:text-star-white transition-colors truncate flex-1">
              {u.title}
            </span>
            <span className="text-[10px] text-dust-dark shrink-0">{u.duration}</span>
            <ExternalLink size={10} className="text-dust-dark opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export function ResearchContent() {
  return (
    <div className="px-6 pb-6 space-y-4">
      {/* Stats */}
      <div className="flex items-center gap-4 text-[11px] text-dust">
        <span className="flex items-center gap-1.5">
          <Globe size={12} className="text-amber-400" />
          {MOCK_CLUSTERS.length} dossiers de recherche
        </span>
        <span className="h-3 w-px bg-white/[0.08]" />
        <span>{MOCK_CLUSTERS.reduce((sum, c) => sum + c.queries.length, 0)} recherches</span>
        <span className="h-3 w-px bg-white/[0.08]" />
        <span>{MOCK_CLUSTERS.reduce((sum, c) => sum + c.urls.length, 0)} pages visitées</span>
      </div>

      {/* Clusters */}
      <div className="space-y-3">
        {MOCK_CLUSTERS.map((cluster, i) => (
          <ClusterCard key={cluster.id} cluster={cluster} index={i} />
        ))}
      </div>
    </div>
  );
}
