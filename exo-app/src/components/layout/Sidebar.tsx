import { NavLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Settings } from "lucide-react";
import { useExoStore } from "../../lib/store";

function MiniPlanet({
  color,
  size,
  active,
}: {
  color: string;
  size: number;
  active: boolean;
}) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 32, height: 32 }}>
      <div
        className="rounded-full transition-all duration-300"
        style={{
          width: active ? size + 2 : size,
          height: active ? size + 2 : size,
          background: `radial-gradient(circle at 35% 35%, ${color}, ${color}88)`,
          boxShadow: active ? `0 0 12px ${color}66` : "none",
        }}
      />
    </div>
  );
}

// Map planet type to a relative size
const TYPE_SIZES: Record<string, number> = {
  contacts: 11,
  projects: 12,
  tasks: 10,
  journal: 10,
  planning: 9,
  research: 9,
  custom: 9,
};

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const constellation = useExoStore((s) => s.constellation);
  const planets = constellation?.planets || [];

  return (
    <nav className="flex w-[60px] flex-col items-center justify-between border-r border-white/[0.04] bg-space-900 py-5">
      {/* Logo — back to constellation */}
      <button
        onClick={() => navigate("/")}
        className="group mb-6 flex h-9 w-9 items-center justify-center"
      >
        <motion.div
          className="text-sm font-bold tracking-wider text-electric-500"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          EX
        </motion.div>
      </button>

      {/* Dynamic planet nav */}
      <div className="flex flex-1 flex-col items-center gap-3">
        {planets.map((planet) => {
          const path = `/planet/${planet.id}`;
          const active = location.pathname === path;
          const size = TYPE_SIZES[planet.type] || 9;
          return (
            <NavLink key={planet.id} to={path} className="group relative">
              <motion.div
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                className="cursor-pointer"
              >
                <MiniPlanet color={planet.color} size={size} active={active} />
              </motion.div>
              {/* Active indicator */}
              {active && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute -left-[1px] top-1 bottom-1 w-[2px] rounded-r-full"
                  style={{ background: planet.color }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              {/* Tooltip */}
              <div className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-space-800 px-2.5 py-1 text-[11px] text-star-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100 border border-white/[0.06]">
                {planet.name}
              </div>
            </NavLink>
          );
        })}

        {/* Settings */}
        <NavLink to="/settings" className="group relative mt-2">
          {({ isActive }) => (
            <>
              <motion.div
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                className="flex h-8 w-8 items-center justify-center cursor-pointer"
              >
                <Settings
                  size={14}
                  className={`transition-colors ${isActive ? "text-star-white" : "text-dust-dark group-hover:text-dust"}`}
                />
              </motion.div>
              {isActive && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute -left-[1px] top-1 bottom-1 w-[2px] rounded-r-full bg-dust"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <div className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-space-800 px-2.5 py-1 text-[11px] text-star-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100 border border-white/[0.06]">
                Settings
              </div>
            </>
          )}
        </NavLink>
      </div>

      {/* Sync status */}
      <div className="mt-auto flex flex-col items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
        <span className="text-[9px] text-dust-dark">SYNC</span>
      </div>
    </nav>
  );
}
