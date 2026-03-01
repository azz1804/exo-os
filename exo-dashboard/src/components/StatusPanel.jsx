import { useState, useEffect } from 'react';
import { MessageCircle, Smartphone, Phone, Globe } from 'lucide-react';

const SOURCE_META = {
  whatsapp: { label: 'WhatsApp', icon: MessageCircle, color: 'text-green-400', bg: 'bg-green-400/10' },
  imessage: { label: 'iMessage', icon: Smartphone, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  fathom: { label: 'Fathom', icon: Phone, color: 'text-orange-400', bg: 'bg-orange-400/10' },
  comet: { label: 'Comet', icon: Globe, color: 'text-violet-400', bg: 'bg-violet-400/10' },
};

function formatAgo(minutes) {
  if (minutes === null) return 'Jamais';
  if (minutes < 1) return 'A l\'instant';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}j`;
}

export default function StatusPanel() {
  const [sources, setSources] = useState(null);

  useEffect(() => {
    const load = () => fetch('/api/status').then(r => r.json()).then(d => setSources(d.sources)).catch(() => {});
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!sources) return <div className="bg-white/5 rounded-2xl border border-white/10 p-6 h-28 animate-pulse" />;

  return (
    <div className="grid grid-cols-4 gap-4">
      {Object.entries(sources).map(([key, data]) => {
        const meta = SOURCE_META[key];
        const Icon = meta.icon;
        return (
          <div key={key} className="bg-white/5 rounded-2xl border border-white/10 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-8 h-8 rounded-lg ${meta.bg} flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${meta.color}`} />
              </div>
              <span className="text-sm font-medium">{meta.label}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/40">
                {data.lastSync ? formatAgo(data.minutesAgo) : 'Jamais sync'}
              </span>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${data.healthy ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className={`text-xs ${data.healthy ? 'text-green-400' : 'text-red-400'}`}>
                  {data.healthy ? 'OK' : data.status === 'never' ? 'Jamais' : 'Manqué'}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
