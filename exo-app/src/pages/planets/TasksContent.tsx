import { motion } from "framer-motion";
import { CheckSquare, Square, Clock, Link2 } from "lucide-react";
import { useState } from "react";

interface Task {
  id: number;
  text: string;
  done: boolean;
  project?: string;
  source: string;
  dueDate?: string;
  priority: "high" | "medium" | "low";
}

const MOCK_TASKS: Task[] = [
  { id: 1, text: "Finaliser le frontend constellation", done: false, project: "Exo OS v2", source: "whatsapp", priority: "high" },
  { id: 2, text: "Envoyer le deck à Marc", done: false, project: "Pitch Deck Investors", source: "fathom", dueDate: "Demain", priority: "high" },
  { id: 3, text: "Relancer Sophie pour les maquettes", done: false, project: "Site vitrine refonte", source: "imessage", priority: "medium" },
  { id: 4, text: "Migrer orchestrateur vers SQLite", done: false, project: "Exo OS v2", source: "whatsapp", priority: "medium" },
  { id: 5, text: "Préparer le one-pager", done: true, project: "Pitch Deck Investors", source: "fathom", priority: "low" },
  { id: 6, text: "Review les analytics Comet", done: true, source: "comet", priority: "low" },
];

const PRIORITY_COLORS = {
  high: "#FF6B6B",
  medium: "#FFB800",
  low: "#5A6380",
};

const SOURCE_COLORS: Record<string, string> = {
  whatsapp: "#25D366",
  imessage: "#5AC8FA",
  fathom: "#8B5CF6",
  comet: "#F59E0B",
};

function TaskItem({ task, index, onToggle }: { task: Task; index: number; onToggle: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`flex items-start gap-3 rounded-lg border border-white/[0.04] bg-white/[0.015] p-3.5 hover:bg-white/[0.03] transition-all group ${
        task.done ? "opacity-50" : ""
      }`}
    >
      {/* Checkbox */}
      <button onClick={onToggle} className="mt-0.5 shrink-0">
        {task.done ? (
          <CheckSquare size={16} className="text-electric-500" />
        ) : (
          <Square size={16} style={{ color: PRIORITY_COLORS[task.priority] }} />
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <span className={`text-sm ${task.done ? "line-through text-dust-dark" : "text-star-white"}`}>
          {task.text}
        </span>
        <div className="flex items-center gap-3 mt-1">
          {task.project && (
            <span className="flex items-center gap-1 text-[10px] text-dust-dark">
              <Link2 size={9} />
              {task.project}
            </span>
          )}
          {task.dueDate && (
            <span className="flex items-center gap-1 text-[10px] text-orange-400">
              <Clock size={9} />
              {task.dueDate}
            </span>
          )}
        </div>
      </div>

      {/* Source dot */}
      <span
        className="h-2 w-2 rounded-full shrink-0 mt-1.5"
        style={{ background: SOURCE_COLORS[task.source] }}
      />
    </motion.div>
  );
}

export function TasksContent() {
  const [tasks, setTasks] = useState(MOCK_TASKS);
  const toggle = (id: number) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const pending = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <div className="px-6 pb-6 space-y-5">
      {/* Stats */}
      <div className="flex items-center gap-4 text-[11px] text-dust">
        <span>{pending.length} à faire</span>
        <span className="h-3 w-px bg-white/[0.08]" />
        <span>{done.length} terminées</span>
        <span className="h-3 w-px bg-white/[0.08]" />
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: PRIORITY_COLORS.high }} />
          {pending.filter((t) => t.priority === "high").length} urgentes
        </span>
      </div>

      {/* Pending tasks */}
      {pending.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs text-dust-dark uppercase tracking-wider font-medium">À faire</h2>
          {pending.map((task, i) => (
            <TaskItem key={task.id} task={task} index={i} onToggle={() => toggle(task.id)} />
          ))}
        </div>
      )}

      {/* Done tasks */}
      {done.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs text-dust-dark uppercase tracking-wider font-medium">Terminées</h2>
          {done.map((task, i) => (
            <TaskItem key={task.id} task={task} index={i + pending.length} onToggle={() => toggle(task.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
