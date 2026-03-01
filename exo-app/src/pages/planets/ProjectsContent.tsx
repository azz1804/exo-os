import { motion, AnimatePresence } from "framer-motion";
import { Clock, TrendingUp, ChevronDown, X, MessageSquare, User, CheckCircle2, Circle } from "lucide-react";
import { useState } from "react";

// === Types ===

interface ProjectTask {
  text: string;
  assignee: string; // "moi" or person's name
  done: boolean;
}

interface ProjectEnrichment {
  source: string;
  contact: string;
  date: string;
  content: string;
}

interface Project {
  id: number;
  name: string;
  emoji: string;
  status: "active" | "paused" | "done";
  momentum: number;
  lastActivity: string;
  description: string;
  latestRecap: string;
  tasks: ProjectTask[];
  enrichments: ProjectEnrichment[];
  sources: string[];
  contributors: string[];
}

// === Mock Data ===

const MOCK_PROJECTS: Project[] = [
  {
    id: 1,
    name: "Prepster",
    emoji: "🚀",
    status: "active",
    momentum: 0.85,
    lastActivity: "Il y a 1h",
    description: "App de préparation aux entretiens — MVP en cours",
    latestRecap: "Frontend quasi fini. Grégoire push le backend auth demain. Flow d'onboarding validé. Bouton d'appui confirmé après review.",
    tasks: [
      { text: "Finaliser le flow d'onboarding", assignee: "moi", done: true },
      { text: "Backend auth (JWT + refresh)", assignee: "Grégoire", done: false },
      { text: "Flow de paiement Stripe", assignee: "Grégoire", done: false },
      { text: "Landing page + SEO", assignee: "moi", done: false },
      { text: "Tests end-to-end", assignee: "moi", done: false },
    ],
    enrichments: [
      { source: "whatsapp", contact: "Grégoire", date: "25 Fév 21h", content: "Le flow d'onboarding est quasi fini, il push le backend auth demain matin. Bouton d'appui validé." },
      { source: "whatsapp", contact: "Grégoire", date: "24 Fév 16h", content: "API d'auth terminée côté Grégoire, reste le flow de paiement Stripe." },
      { source: "fathom", contact: "Marc Lefèvre", date: "24 Fév 14h", content: "Mention de Prepster pendant le weekly sync. Marc trouve le concept intéressant pour sa boîte." },
    ],
    sources: ["whatsapp", "fathom"],
    contributors: ["Grégoire", "moi"],
  },
  {
    id: 2,
    name: "Exo OS",
    emoji: "🪐",
    status: "active",
    momentum: 0.9,
    lastActivity: "Il y a 30min",
    description: "Assistant personnel local-first — Tauri + React + SQLite",
    latestRecap: "Migration Tauri terminée, frontend constellation opérationnel. Planètes dynamiques, onboarding fonctionnel. Backend SQLite wired. Next: connecter l'orchestrateur.",
    tasks: [
      { text: "Frontend constellation + planètes", assignee: "moi", done: true },
      { text: "Onboarding flow", assignee: "moi", done: true },
      { text: "Migrer orchestrateur Notion → SQLite", assignee: "moi", done: false },
      { text: "Connecter les Tauri commands au frontend", assignee: "moi", done: false },
      { text: "System tray + notifications", assignee: "moi", done: false },
    ],
    enrichments: [
      { source: "whatsapp", contact: "Grégoire", date: "25 Fév 21h", content: "Grégoire trouve le concept de constellation cool, suggère d'ajouter un mode focus." },
    ],
    sources: ["whatsapp"],
    contributors: ["moi"],
  },
  {
    id: 3,
    name: "Pitch Deck Investors",
    emoji: "💰",
    status: "active",
    momentum: 0.6,
    lastActivity: "Il y a 6h",
    description: "Deck pour la levée de fonds seed",
    latestRecap: "Call investisseur positif, bons signaux sur le PMF. Next step: envoyer le deck mis à jour avec les nouvelles métriques du pilote.",
    tasks: [
      { text: "Mettre à jour le deck avec KPIs pilote", assignee: "moi", done: false },
      { text: "Envoyer le deck à Marc", assignee: "moi", done: false },
      { text: "Préparer le one-pager", assignee: "moi", done: true },
      { text: "Préparer les réponses aux questions fréquentes", assignee: "Grégoire", done: false },
    ],
    enrichments: [
      { source: "fathom", contact: "Marc Lefèvre", date: "25 Fév 14h", content: "KPIs du pilote au-dessus des attentes (+30% rétention). Go pour phase 2 avec budget élargi." },
      { source: "whatsapp", contact: "Grégoire", date: "25 Fév 21h", content: "Retour sur le call investisseur de cet aprem, bons signaux." },
    ],
    sources: ["fathom", "whatsapp"],
    contributors: ["Grégoire", "moi"],
  },
  {
    id: 4,
    name: "Site vitrine refonte",
    emoji: "🎨",
    status: "paused",
    momentum: 0.2,
    lastActivity: "Il y a 3j",
    description: "Refonte complète du site vitrine",
    latestRecap: "Attente des maquettes V2 de Sophie. Design home et pricing validés.",
    tasks: [
      { text: "Maquettes V2 (home + pricing + about)", assignee: "Sophie", done: false },
      { text: "Intégration front", assignee: "moi", done: false },
      { text: "Contenu et copywriting", assignee: "moi", done: false },
    ],
    enrichments: [
      { source: "imessage", contact: "Sophie Martin", date: "23 Fév", content: "Sophie finalise les maquettes. Design validé pour la home et la page pricing. Reste la page about." },
    ],
    sources: ["imessage"],
    contributors: ["Sophie", "moi"],
  },
];

const SOURCE_COLORS: Record<string, string> = {
  whatsapp: "#25D366",
  imessage: "#5AC8FA",
  fathom: "#8B5CF6",
  comet: "#F59E0B",
};

// === Momentum Bar ===

function MomentumBar({ value, size = "normal" }: { value: number; size?: "normal" | "large" }) {
  const color = value > 0.7 ? "#00E599" : value > 0.4 ? "#FFB800" : "#FF6B6B";
  const w = size === "large" ? "w-full" : "w-24";
  const h = size === "large" ? "h-1.5" : "h-1";

  return (
    <div className={`${h} ${w} rounded-full bg-white/[0.06] overflow-hidden`}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${value * 100}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </div>
  );
}

// === Project Detail ===

function ProjectDetail({ project, onClose }: { project: Project; onClose: () => void }) {
  const [showEnrichments, setShowEnrichments] = useState(true);

  const myTasks = project.tasks.filter((t) => t.assignee === "moi");
  const otherTasks = project.tasks.filter((t) => t.assignee !== "moi");
  const assignees = [...new Set(otherTasks.map((t) => t.assignee))];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="absolute inset-0 bg-void/95 z-10 overflow-y-auto"
    >
      <div className="px-6 py-5 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/[0.06] text-2xl">
              {project.emoji}
            </div>
            <div>
              <h2 className="text-xl font-bold text-star-white">{project.name}</h2>
              <p className="text-[12px] text-dust mt-0.5">{project.description}</p>
              <div className="flex items-center gap-3 mt-1.5">
                <span className={`text-[10px] uppercase tracking-wider font-bold ${
                  project.status === "active" ? "text-green-400" : project.status === "paused" ? "text-amber-400" : "text-dust-dark"
                }`}>
                  {project.status === "active" ? "Actif" : project.status === "paused" ? "En pause" : "Terminé"}
                </span>
                <span className="text-[10px] text-dust-dark">{project.lastActivity}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-dust-dark hover:text-dust transition-colors p-1">
            <X size={16} />
          </button>
        </div>

        {/* Momentum */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-dust-dark uppercase tracking-wider font-medium flex items-center gap-1.5">
              <TrendingUp size={11} /> Momentum
            </span>
            <span className="text-[11px] font-mono text-star-white">{Math.round(project.momentum * 100)}%</span>
          </div>
          <MomentumBar value={project.momentum} size="large" />
        </div>

        {/* Latest recap */}
        <div className="rounded-xl border border-electric-500/15 bg-electric-500/[0.03] p-4">
          <div className="text-[10px] text-electric-400 uppercase tracking-wider font-medium mb-2">Dernier récap</div>
          <p className="text-[13px] text-dust leading-relaxed">{project.latestRecap}</p>
        </div>

        {/* Tasks by assignee */}
        <div className="space-y-4">
          <h3 className="text-xs text-dust-dark uppercase tracking-wider font-medium">Tâches</h3>

          {/* My tasks */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[11px] text-electric-400 font-medium">
              <User size={11} /> Mes tâches
            </div>
            {myTasks.map((task, i) => (
              <div key={i} className="flex items-center gap-2.5 rounded-lg bg-white/[0.015] border border-white/[0.04] p-2.5">
                {task.done ? (
                  <CheckCircle2 size={14} className="text-green-400 shrink-0" />
                ) : (
                  <Circle size={14} className="text-dust-dark shrink-0" />
                )}
                <span className={`text-[12px] ${task.done ? "text-dust-dark line-through" : "text-star-white"}`}>
                  {task.text}
                </span>
              </div>
            ))}
          </div>

          {/* Others' tasks */}
          {assignees.map((assignee) => (
            <div key={assignee} className="space-y-1.5">
              <div className="flex items-center gap-2 text-[11px] text-amber-400 font-medium">
                <User size={11} /> {assignee}
              </div>
              {otherTasks
                .filter((t) => t.assignee === assignee)
                .map((task, i) => (
                  <div key={i} className="flex items-center gap-2.5 rounded-lg bg-white/[0.015] border border-white/[0.04] p-2.5">
                    {task.done ? (
                      <CheckCircle2 size={14} className="text-green-400 shrink-0" />
                    ) : (
                      <Circle size={14} className="text-amber-400/50 shrink-0" />
                    )}
                    <span className={`text-[12px] ${task.done ? "text-dust-dark line-through" : "text-star-white"}`}>
                      {task.text}
                    </span>
                  </div>
                ))}
            </div>
          ))}
        </div>

        {/* Cross-source enrichments */}
        <div>
          <button
            onClick={() => setShowEnrichments(!showEnrichments)}
            className="flex items-center gap-2 text-xs text-dust-dark uppercase tracking-wider font-medium mb-3 hover:text-dust transition-colors"
          >
            <MessageSquare size={11} />
            Enrichissements ({project.enrichments.length})
            <ChevronDown size={11} className={`transition-transform ${showEnrichments ? "rotate-180" : ""}`} />
          </button>
          {showEnrichments && (
            <div className="space-y-2">
              {project.enrichments.map((e, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-3"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: SOURCE_COLORS[e.source] }} />
                    <span className="text-[11px] font-medium text-star-white">{e.contact}</span>
                    <span className="text-[10px] text-dust-dark">via {e.source}</span>
                    <span className="text-[10px] text-dust-dark ml-auto">{e.date}</span>
                  </div>
                  <p className="text-[12px] text-dust leading-relaxed">{e.content}</p>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Sources & contributors */}
        <div className="flex items-center gap-4 pt-2 border-t border-white/[0.04]">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-dust-dark">Sources:</span>
            {project.sources.map((s) => (
              <span key={s} className="flex items-center gap-1 text-[10px]" style={{ color: SOURCE_COLORS[s] }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: SOURCE_COLORS[s] }} />
                {s}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[10px] text-dust-dark">Contributeurs:</span>
            {project.contributors.map((c) => (
              <span key={c} className="text-[10px] text-star-white bg-white/[0.04] rounded-md px-1.5 py-0.5">{c}</span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// === Project Card ===

function ProjectCard({ project, onClick, index }: { project: Project; onClick: () => void; index: number }) {
  const doneTasks = project.tasks.filter((t) => t.done).length;
  const totalTasks = project.tasks.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      onClick={onClick}
      className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all cursor-pointer group"
    >
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.06] text-xl shrink-0 group-hover:scale-105 transition-transform">
          {project.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-bold text-star-white group-hover:text-white transition-colors">
            {project.name}
          </h3>
          <p className="text-[11px] text-dust-dark mt-0.5 truncate">{project.description}</p>
          <div className="flex items-center gap-2.5 mt-1.5">
            <span className={`text-[10px] uppercase tracking-wider font-bold ${
              project.status === "active" ? "text-green-400" : "text-amber-400"
            }`}>
              {project.status === "active" ? "Actif" : "En pause"}
            </span>
            <span className="text-[10px] text-dust-dark flex items-center gap-1">
              <Clock size={9} />
              {project.lastActivity}
            </span>
          </div>
        </div>
      </div>

      {/* Recap preview */}
      <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3.5 mb-4">
        <p className="text-[12px] text-dust leading-relaxed line-clamp-2">{project.latestRecap}</p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        {/* Momentum + tasks */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={11} className="text-dust-dark" />
            <MomentumBar value={project.momentum} />
          </div>
          <span className="text-[10px] text-dust-dark">
            {doneTasks}/{totalTasks} tâches
          </span>
        </div>

        {/* Sources & contributors */}
        <div className="flex items-center gap-2">
          {project.sources.map((s) => (
            <span key={s} className="h-2 w-2 rounded-full" style={{ background: SOURCE_COLORS[s] }} />
          ))}
          <span className="text-[10px] text-dust-dark">{project.contributors.length} contrib.</span>
        </div>
      </div>
    </motion.div>
  );
}

// === Main ===

export function ProjectsContent() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const active = MOCK_PROJECTS.filter((p) => p.status === "active");
  const paused = MOCK_PROJECTS.filter((p) => p.status === "paused");

  return (
    <div className="relative h-full">
      <AnimatePresence>
        {selectedProject && (
          <ProjectDetail project={selectedProject} onClose={() => setSelectedProject(null)} />
        )}
      </AnimatePresence>

      <div className="px-6 pb-6 space-y-5">
        {/* Stats */}
        <div className="flex items-center gap-4 text-[11px] text-dust">
          <span>{MOCK_PROJECTS.length} projets</span>
          <span className="h-3 w-px bg-white/[0.08]" />
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            {active.length} actifs
          </span>
          {paused.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              {paused.length} en pause
            </span>
          )}
          <span className="ml-auto text-[10px]">
            {MOCK_PROJECTS.reduce((s, p) => s + p.enrichments.length, 0)} enrichissements cross-source
          </span>
        </div>

        {/* Active projects */}
        {active.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs text-dust-dark uppercase tracking-wider font-medium">Projets actifs</h2>
            <div className="grid grid-cols-1 gap-3">
              {active.map((p, i) => (
                <ProjectCard key={p.id} project={p} onClick={() => setSelectedProject(p)} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* Paused */}
        {paused.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs text-dust-dark uppercase tracking-wider font-medium">En pause</h2>
            <div className="grid grid-cols-1 gap-3">
              {paused.map((p, i) => (
                <ProjectCard key={p.id} project={p} onClick={() => setSelectedProject(p)} index={i + active.length} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
