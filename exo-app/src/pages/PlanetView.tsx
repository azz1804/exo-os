import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Users, FolderKanban, CheckSquare, BookOpen, Calendar, Search, Settings as SettingsIcon } from "lucide-react";
import { useExoStore } from "../lib/store";

// Planet-specific content components
import { ContactsContent } from "./planets/ContactsContent";
import { ProjectsContent } from "./planets/ProjectsContent";
import { TasksContent } from "./planets/TasksContent";
import { JournalContent } from "./planets/JournalContent";
import { PlanningContent } from "./planets/PlanningContent";
import { ResearchContent } from "./planets/ResearchContent";
import { DefaultContent } from "./planets/DefaultContent";

const CONTENT_MAP: Record<string, React.ComponentType> = {
  contacts: ContactsContent,
  projects: ProjectsContent,
  tasks: TasksContent,
  journal: JournalContent,
  planning: PlanningContent,
  research: ResearchContent,
};

export function PlanetView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const constellation = useExoStore((s) => s.constellation);
  const planet = constellation?.planets.find((p) => p.id === id);

  if (!planet) {
    return (
      <div className="flex h-full items-center justify-center text-dust">
        Planète introuvable
      </div>
    );
  }

  const Content = CONTENT_MAP[planet.type] || DefaultContent;

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
          <div
            className="h-3 w-3 rounded-full"
            style={{ background: planet.color, boxShadow: `0 0 10px ${planet.color}66` }}
          />
          <h1 className="text-xl font-semibold text-star-white">{planet.name}</h1>
        </div>
      </div>

      {/* Planet content */}
      <div className={`flex-1 ${planet.type === "planning" ? "overflow-hidden" : "overflow-y-auto"}`}>
        <Content />
      </div>
    </motion.div>
  );
}
