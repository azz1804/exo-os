import { Activity } from 'lucide-react';

export default function Header() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
          <Activity className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Exo OS</h1>
          <p className="text-xs text-white/40">Dashboard</p>
        </div>
      </div>
      <p className="text-sm text-white/40 capitalize">{dateStr}</p>
    </div>
  );
}
