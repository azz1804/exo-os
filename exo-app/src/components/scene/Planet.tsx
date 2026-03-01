import { motion } from "framer-motion";

interface PlanetProps {
  name: string;
  color: string;
  size: number;
  type?: string;
  description: string;
  count?: number;
  onClick: () => void;
  delay?: number;
}

// Each planet type gets a unique visual signature
const PLANET_STYLES: Record<string, {
  rings?: boolean;
  bands?: boolean;
  craters?: boolean;
}> = {
  contacts: { bands: true },
  projects: { rings: true },
  tasks: { craters: true },
  journal: { bands: true },
  planning: { rings: true },
  research: { craters: true },
};

function PlanetSphere({ color, size, type = "custom" }: { color: string; size: number; type?: string }) {
  const style = PLANET_STYLES[type] || {};
  const uid = `p-${color.replace("#", "")}-${type}`;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Drop shadow */}
      <div
        className="absolute"
        style={{
          width: size * 0.7,
          height: size * 0.1,
          bottom: -size * 0.06,
          left: size * 0.15,
          background: "radial-gradient(ellipse, rgba(0,0,0,0.35), transparent 70%)",
          borderRadius: "50%",
        }}
      />

      {/* Main sphere container */}
      <div className="absolute inset-0 rounded-full overflow-hidden">
        {/* Deep base color */}
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 32% 28%, ${color} 0%, ${color}bb 30%, ${color}77 55%, ${color}33 80%, ${color}11 100%)`,
          }}
        />

        {/* Horizontal bands (gas giant style) */}
        {style.bands && (
          <div className="absolute inset-0" style={{
            background: `
              repeating-linear-gradient(
                2deg,
                transparent 0%,
                rgba(255,255,255,0.05) 6%,
                transparent 10%,
                rgba(0,0,0,0.08) 15%,
                transparent 19%,
                rgba(255,255,255,0.03) 25%,
                transparent 28%
              )
            `,
          }} />
        )}

        {/* Craters (rocky planet) */}
        {style.craters && (
          <>
            <div className="absolute rounded-full" style={{
              width: size * 0.16, height: size * 0.14,
              top: size * 0.32, left: size * 0.52,
              background: `radial-gradient(circle at 40% 40%, ${color}22, rgba(0,0,0,0.15))`,
              boxShadow: `inset 1px 1px 2px rgba(255,255,255,0.1), inset -1px -1px 2px rgba(0,0,0,0.2)`,
            }} />
            <div className="absolute rounded-full" style={{
              width: size * 0.1, height: size * 0.08,
              top: size * 0.58, left: size * 0.28,
              background: `radial-gradient(circle at 40% 40%, ${color}18, rgba(0,0,0,0.12))`,
              boxShadow: `inset 1px 1px 1px rgba(255,255,255,0.08)`,
            }} />
            <div className="absolute rounded-full" style={{
              width: size * 0.07, height: size * 0.07,
              top: size * 0.22, left: size * 0.65,
              background: `radial-gradient(circle, rgba(0,0,0,0.1), transparent)`,
            }} />
          </>
        )}

        {/* Terminator (day/night boundary) */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(115deg, transparent 30%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.65) 80%, rgba(0,0,0,0.8) 100%)",
          }}
        />

        {/* Main specular highlight */}
        <div
          className="absolute"
          style={{
            width: size * 0.45, height: size * 0.38,
            top: size * 0.06, left: size * 0.1,
            background: "radial-gradient(ellipse at 45% 45%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 35%, transparent 70%)",
            borderRadius: "50%",
          }}
        />

        {/* Secondary soft highlight */}
        <div
          className="absolute"
          style={{
            width: size * 0.2, height: size * 0.15,
            top: size * 0.15, left: size * 0.2,
            background: "radial-gradient(ellipse, rgba(255,255,255,0.2), transparent 80%)",
            borderRadius: "50%",
          }}
        />

        {/* Rim light (backlight) */}
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 85% 85%, ${color}40 0%, transparent 45%)`,
          }}
        />
      </div>

      {/* Atmosphere glow (outside the sphere) */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          inset: -3,
          border: `1.5px solid ${color}25`,
          background: `radial-gradient(circle at 25% 25%, ${color}0a, transparent 60%)`,
        }}
      />

      {/* Rings */}
      {style.rings && (
        <div
          className="absolute pointer-events-none"
          style={{
            width: size * 1.7,
            height: size * 0.4,
            top: size * 0.32,
            left: -size * 0.35,
          }}
        >
          <svg viewBox="0 0 170 40" className="w-full h-full">
            <defs>
              <linearGradient id={uid} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={color} stopOpacity="0" />
                <stop offset="15%" stopColor={color} stopOpacity="0.25" />
                <stop offset="35%" stopColor={color} stopOpacity="0.12" />
                <stop offset="50%" stopColor={color} stopOpacity="0.2" />
                <stop offset="65%" stopColor={color} stopOpacity="0.1" />
                <stop offset="85%" stopColor={color} stopOpacity="0.22" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            <ellipse cx="85" cy="20" rx="82" ry="10" fill="none" stroke={`url(#${uid})`} strokeWidth="3.5" />
            <ellipse cx="85" cy="20" rx="72" ry="7.5" fill="none" stroke={`url(#${uid})`} strokeWidth="1.5" opacity="0.5" />
            <ellipse cx="85" cy="20" rx="65" ry="6" fill="none" stroke={`url(#${uid})`} strokeWidth="0.8" opacity="0.3" />
          </svg>
        </div>
      )}
    </div>
  );
}

export function Planet({
  name,
  color,
  size,
  type,
  description,
  count,
  onClick,
  delay = 0,
}: PlanetProps) {
  return (
    <motion.button
      onClick={onClick}
      className="group relative flex flex-col items-center gap-3 outline-none"
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 200,
        damping: 20,
        delay: delay * 0.15,
      }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
    >
      {/* Hover aura */}
      <div
        className="absolute rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          width: size * 2.2,
          height: size * 2.2,
          top: `calc(50% - ${size * 1.1}px - 6px)`,
          left: `calc(50% - ${size * 1.1}px)`,
          background: `radial-gradient(circle, ${color}12, ${color}06 45%, transparent 70%)`,
        }}
      />

      {/* Planet */}
      <PlanetSphere color={color} size={size} type={type} />

      {/* Count badge */}
      {count !== undefined && count > 0 && (
        <div
          className="absolute flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold"
          style={{
            background: color,
            color: "#030014",
            top: 0,
            right: size > 60 ? -4 : -8,
          }}
        >
          {count}
        </div>
      )}

      {/* Label */}
      <div className="flex flex-col items-center gap-0.5 mt-1">
        <span className="text-[13px] font-medium text-star-white/90 group-hover:text-white transition-colors tracking-wide">
          {name}
        </span>
        <span className="text-[10px] text-dust/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          {description}
        </span>
      </div>
    </motion.button>
  );
}
