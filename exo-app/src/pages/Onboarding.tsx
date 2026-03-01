import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, FolderKanban, CheckSquare, BookOpen, Calendar, Search,
  MessageSquare, MessageCircle, Phone, Globe, Hash, Mail, Twitter, CalendarDays,
  ArrowRight, ArrowLeft, Sparkles,
} from "lucide-react";
import {
  useExoStore,
  DEFAULT_PLANETS,
  AVAILABLE_MCPS,
  DEFAULT_CONTACT_CATEGORIES,
  type PlanetConfig,
  type McpConfig,
  type ConstellationConfig,
} from "../lib/store";

const ICONS: Record<string, typeof Users> = {
  Users, FolderKanban, CheckSquare, BookOpen, Calendar, Search,
  MessageSquare, MessageCircle, Phone, Globe, Hash, Mail, Twitter, CalendarDays,
};

// === Step 1: Name ===

function StepName({ name, setName }: { name: string; setName: (n: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center gap-8"
    >
      <div className="text-center">
        <h1 className="text-3xl font-bold text-star-white mb-2">
          Crée ta constellation
        </h1>
        <p className="text-sm text-dust max-w-md">
          Ton espace personnel. Tout ce qui s'y passe reste sur ta machine.
        </p>
      </div>

      <div className="w-full max-w-sm">
        <label className="text-xs text-dust-dark uppercase tracking-wider mb-2 block">
          Nom de ta constellation
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Mb's Constellation"
          autoFocus
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-lg text-star-white placeholder-dust-dark outline-none focus:border-electric-500/40 transition-all text-center"
        />
      </div>
    </motion.div>
  );
}

// === Step 2: Planets ===

function StepPlanets({
  planets,
  togglePlanet,
}: {
  planets: PlanetConfig[];
  togglePlanet: (id: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center gap-8"
    >
      <div className="text-center">
        <h1 className="text-3xl font-bold text-star-white mb-2">
          Choisis tes planètes
        </h1>
        <p className="text-sm text-dust max-w-md">
          Chaque planète est une section de ton espace. Tu pourras en ajouter plus tard.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
        {planets.map((planet) => {
          const Icon = ICONS[planet.icon] || Globe;
          return (
            <motion.button
              key={planet.id}
              onClick={() => togglePlanet(planet.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`flex items-center gap-3 rounded-xl p-4 text-left transition-all border ${
                planet.enabled
                  ? "border-white/[0.12] bg-white/[0.06]"
                  : "border-white/[0.04] bg-white/[0.02] opacity-50"
              }`}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                style={{ background: planet.enabled ? `${planet.color}20` : "rgba(255,255,255,0.03)" }}
              >
                <Icon
                  size={18}
                  style={{ color: planet.enabled ? planet.color : "#5A6380" }}
                />
              </div>
              <div>
                <div className="text-sm font-medium text-star-white">{planet.name}</div>
                <div className="text-[11px] text-dust-dark">
                  {planet.type === "contacts" && "Relations & personnes"}
                  {planet.type === "projects" && "Projets auto-détectés"}
                  {planet.type === "tasks" && "Actions & to-dos"}
                  {planet.type === "journal" && "Récaps journaliers"}
                  {planet.type === "planning" && "Calendrier & RDV"}
                  {planet.type === "research" && "Navigation & recherches"}
                </div>
              </div>
              <div className="ml-auto">
                <div
                  className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all ${
                    planet.enabled
                      ? "border-electric-500 bg-electric-500"
                      : "border-white/20"
                  }`}
                >
                  {planet.enabled && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

// === Step 3: MCPs ===

function StepMcps({
  mcps,
  toggleMcp,
}: {
  mcps: McpConfig[];
  toggleMcp: (id: string) => void;
}) {
  const available = mcps.filter((m) => ["whatsapp", "imessage", "fathom", "comet"].includes(m.id));
  const comingSoon = mcps.filter((m) => !["whatsapp", "imessage", "fathom", "comet"].includes(m.id));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center gap-8"
    >
      <div className="text-center">
        <h1 className="text-3xl font-bold text-star-white mb-2">
          Connecte tes sources
        </h1>
        <p className="text-sm text-dust max-w-md">
          Les MCPs lisent tes données locales. Rien ne quitte ta machine.
        </p>
      </div>

      <div className="w-full max-w-lg space-y-4">
        <div className="text-xs text-dust-dark uppercase tracking-wider">Disponibles</div>
        <div className="grid grid-cols-2 gap-3">
          {available.map((mcp) => {
            const Icon = ICONS[mcp.icon] || Globe;
            return (
              <motion.button
                key={mcp.id}
                onClick={() => toggleMcp(mcp.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`flex items-center gap-3 rounded-xl p-3.5 text-left transition-all border ${
                  mcp.enabled
                    ? "border-white/[0.12] bg-white/[0.06]"
                    : "border-white/[0.04] bg-white/[0.02] opacity-50"
                }`}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: mcp.enabled ? `${mcp.color}20` : "rgba(255,255,255,0.03)" }}
                >
                  <Icon size={16} style={{ color: mcp.enabled ? mcp.color : "#5A6380" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-star-white">{mcp.name}</div>
                  <div className="text-[10px] text-dust-dark">
                    → {mcp.feedsPlanets.join(", ")}
                  </div>
                </div>
                <div
                  className={`h-2 w-2 rounded-full transition-all ${
                    mcp.enabled ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]" : "bg-white/10"
                  }`}
                />
              </motion.button>
            );
          })}
        </div>

        <div className="text-xs text-dust-dark uppercase tracking-wider mt-6">Bientôt</div>
        <div className="grid grid-cols-2 gap-3">
          {comingSoon.map((mcp) => {
            const Icon = ICONS[mcp.icon] || Globe;
            return (
              <div
                key={mcp.id}
                className="flex items-center gap-3 rounded-xl p-3.5 border border-white/[0.03] bg-white/[0.01] opacity-30"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.02]">
                  <Icon size={16} className="text-dust-dark" />
                </div>
                <div>
                  <div className="text-sm text-dust">{mcp.name}</div>
                  <div className="text-[10px] text-dust-dark">Coming soon</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// === Main Onboarding ===

export function Onboarding() {
  const navigate = useNavigate();
  const setConstellation = useExoStore((s) => s.setConstellation);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [planets, setPlanets] = useState<PlanetConfig[]>([...DEFAULT_PLANETS]);
  const [mcps, setMcps] = useState<McpConfig[]>([...AVAILABLE_MCPS]);

  const togglePlanet = (id: string) => {
    setPlanets((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const toggleMcp = (id: string) => {
    setMcps((prev) =>
      prev.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m))
    );
  };

  const finish = () => {
    const config: ConstellationConfig = {
      name: name || "My Constellation",
      owner: "Mathéo",
      planets: planets.filter((p) => p.enabled),
      mcps: mcps.filter((m) => m.enabled),
      contactCategories: [...DEFAULT_CONTACT_CATEGORIES],
      createdAt: new Date().toISOString(),
    };
    setConstellation(config);
    navigate("/");
  };

  const canProceed = step === 0 ? name.length > 0 : true;
  const isLast = step === 2;

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-void">
      <div className="flex w-full max-w-2xl flex-col items-center px-6">
        {/* Progress */}
        <div className="mb-12 flex items-center gap-2">
          {[0, 1, 2].map((s) => (
            <div
              key={s}
              className={`h-1 rounded-full transition-all duration-500 ${
                s <= step ? "bg-electric-500 w-10" : "bg-white/10 w-6"
              }`}
            />
          ))}
        </div>

        {/* Steps */}
        <AnimatePresence mode="wait">
          {step === 0 && <StepName key="name" name={name} setName={setName} />}
          {step === 1 && <StepPlanets key="planets" planets={planets} togglePlanet={togglePlanet} />}
          {step === 2 && <StepMcps key="mcps" mcps={mcps} toggleMcp={toggleMcp} />}
        </AnimatePresence>

        {/* Navigation */}
        <div className="mt-12 flex items-center gap-4">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-2 rounded-xl border border-white/[0.08] px-5 py-2.5 text-sm text-dust hover:text-star-white hover:border-white/[0.15] transition-all"
            >
              <ArrowLeft size={14} />
              Retour
            </button>
          )}
          <button
            onClick={isLast ? finish : () => setStep(step + 1)}
            disabled={!canProceed}
            className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium transition-all ${
              canProceed
                ? "bg-electric-500 text-void hover:bg-electric-400"
                : "bg-white/5 text-dust-dark cursor-not-allowed"
            }`}
          >
            {isLast ? (
              <>
                <Sparkles size={14} />
                Lancer ma constellation
              </>
            ) : (
              <>
                Continuer
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
