import { useState, useEffect } from 'react';
import { Users, ListTodo, FolderSearch } from 'lucide-react';

export default function StatsPanel() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const load = () => fetch('/api/stats').then(r => r.json()).then(setStats).catch(() => {});
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) return (
    <div className="bg-white/5 rounded-2xl border border-white/10 p-5 animate-pulse">
      <div className="h-3 w-20 bg-white/10 rounded mb-3" />
      <div className="space-y-3">
        <div className="h-5 w-32 bg-white/10 rounded" />
        <div className="h-5 w-32 bg-white/10 rounded" />
      </div>
    </div>
  );

  return (
    <div className="bg-white/5 rounded-2xl border border-white/10 p-5">
      <p className="text-xs text-white/40 mb-3">Stats Notion</p>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Users className="w-4 h-4 text-blue-400" />
          <div>
            <span className="text-lg font-semibold">{stats.contacts?.total ?? '—'}</span>
            <span className="text-xs text-white/40 ml-1.5">Contacts</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ListTodo className="w-4 h-4 text-purple-400" />
          <div>
            <span className="text-lg font-semibold">{stats.tasks?.pending ?? '—'}</span>
            <span className="text-xs text-white/40 ml-1.5">Tâches actives</span>
            <span className="text-xs text-white/20 ml-1">/ {stats.tasks?.total ?? '—'}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <FolderSearch className="w-4 h-4 text-violet-400" />
          <div>
            <span className="text-lg font-semibold">{stats.dossiers?.total ?? '—'}</span>
            <span className="text-xs text-white/40 ml-1.5">Dossiers Comet</span>
          </div>
        </div>
      </div>
    </div>
  );
}
