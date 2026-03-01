import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export function DefaultContent() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 pb-20">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4 text-center"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/[0.06]">
          <Sparkles size={24} className="text-dust" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-star-white mb-1">Bientôt disponible</h2>
          <p className="text-sm text-dust max-w-sm">
            Cette planète est en cours de construction. Les données arriveront bientôt ici.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
