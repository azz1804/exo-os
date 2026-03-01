import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Settings } from "lucide-react";
import { Planet } from "../components/scene/Planet";
import { useExoStore } from "../lib/store";

// Layout positions for planets in an orbital pattern
const LAYOUT_POSITIONS = [
  { x: "50%", y: "42%", size: 72 },  // center/main
  { x: "26%", y: "36%", size: 56 },
  { x: "74%", y: "34%", size: 52 },
  { x: "20%", y: "62%", size: 48 },
  { x: "78%", y: "60%", size: 44 },
  { x: "50%", y: "70%", size: 40 },
];

const TYPE_DESCRIPTIONS: Record<string, string> = {
  contacts: "Relations & personnes",
  projects: "Projets auto-détectés",
  tasks: "Actions & to-dos",
  journal: "Récaps journaliers",
  planning: "Calendrier & RDV",
  research: "Navigation & recherches",
  custom: "Section personnalisée",
};

function NebulaBg() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div
        className="absolute"
        style={{
          width: 800,
          height: 600,
          left: "calc(50% - 400px)",
          top: "calc(35% - 300px)",
          background: "radial-gradient(ellipse, rgba(123, 47, 190, 0.06) 0%, rgba(0, 163, 255, 0.03) 40%, transparent 70%)",
        }}
      />
      <div
        className="absolute"
        style={{
          width: 400,
          height: 400,
          left: "10%",
          top: "20%",
          background: "radial-gradient(circle, rgba(0, 163, 255, 0.04), transparent 70%)",
        }}
      />
      <div
        className="absolute"
        style={{
          width: 350,
          height: 350,
          right: "15%",
          top: "50%",
          background: "radial-gradient(circle, rgba(255, 184, 0, 0.03), transparent 70%)",
        }}
      />
    </div>
  );
}

function OrbitRing({ r, delay }: { r: number; delay: number }) {
  return (
    <motion.div
      className="absolute rounded-full border border-white/[0.04] pointer-events-none"
      style={{
        width: r * 2,
        height: r * 2,
        left: `calc(50% - ${r}px)`,
        top: `calc(42% - ${r}px)`,
      }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1.5, delay }}
    />
  );
}

export function Constellation() {
  const navigate = useNavigate();
  const constellation = useExoStore((s) => s.constellation);
  const mcps = constellation?.mcps || [];
  const planets = constellation?.planets || [];

  return (
    <motion.div
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <NebulaBg />

      {/* Orbit rings */}
      <OrbitRing r={120} delay={0.3} />
      <OrbitRing r={220} delay={0.5} />
      <OrbitRing r={340} delay={0.7} />

      {/* Title */}
      <motion.div
        className="absolute top-10 flex flex-col items-center gap-1.5"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
      >
        <h1 className="text-2xl font-bold tracking-wider text-star-white">
          {constellation?.name || "EXO.OS"}
        </h1>
        <p className="text-[11px] tracking-[0.25em] uppercase text-dust">
          {planets.length} planètes · {mcps.length} sources
        </p>
      </motion.div>

      {/* Settings gear — top right */}
      <motion.button
        onClick={() => navigate("/settings")}
        className="absolute top-10 right-6 flex h-9 w-9 items-center justify-center rounded-lg text-dust-dark hover:text-dust hover:bg-white/[0.04] transition-all"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        whileHover={{ rotate: 90 }}
        whileTap={{ scale: 0.9 }}
      >
        <Settings size={16} />
      </motion.button>

      {/* Dynamic planets */}
      <div className="relative w-full h-full" style={{ zIndex: 2 }}>
        {planets.map((planet, i) => {
          const pos = LAYOUT_POSITIONS[i % LAYOUT_POSITIONS.length];
          return (
            <div
              key={planet.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: pos.x, top: pos.y }}
            >
              <Planet
                name={planet.name}
                color={planet.color}
                size={pos.size}
                type={planet.type}
                description={TYPE_DESCRIPTIONS[planet.type] || ""}
                onClick={() => navigate(`/planet/${planet.id}`)}
                delay={i}
              />
            </div>
          );
        })}
      </div>

      {/* MCP status bar */}
      <motion.div
        className="absolute bottom-6 flex items-center gap-5 text-[11px] text-dust"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        {mcps.map((mcp) => (
          <span key={mcp.id} className="flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: mcp.color, boxShadow: `0 0 6px ${mcp.color}66` }}
            />
            {mcp.name}
          </span>
        ))}
      </motion.div>
    </motion.div>
  );
}
