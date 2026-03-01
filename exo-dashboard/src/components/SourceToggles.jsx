import { useState, useEffect } from 'react';
import { ToggleLeft, ToggleRight } from 'lucide-react';

const LABELS = { whatsapp: 'WhatsApp', imessage: 'iMessage', fathom: 'Fathom', comet: 'Comet' };

export default function SourceToggles() {
  const [sources, setSources] = useState(null);

  useEffect(() => {
    fetch('/api/sources').then(r => r.json()).then(setSources).catch(() => {});
  }, []);

  const toggle = async (source) => {
    const prev = sources[source].enabled;
    const newVal = !prev;
    setSources(s => ({ ...s, [source]: { enabled: newVal } }));
    try {
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, enabled: newVal })
      });
      if (!res.ok) throw new Error();
    } catch {
      setSources(s => ({ ...s, [source]: { enabled: prev } }));
    }
  };

  if (!sources) return (
    <div className="bg-white/5 rounded-2xl border border-white/10 p-5 animate-pulse">
      <div className="h-3 w-16 bg-white/10 rounded mb-3" />
      <div className="space-y-2.5">
        <div className="h-5 w-full bg-white/10 rounded" />
        <div className="h-5 w-full bg-white/10 rounded" />
        <div className="h-5 w-full bg-white/10 rounded" />
      </div>
    </div>
  );

  return (
    <div className="bg-white/5 rounded-2xl border border-white/10 p-5">
      <p className="text-xs text-white/40 mb-3">Sources</p>
      <div className="space-y-2.5">
        {Object.entries(sources).map(([key, { enabled }]) => (
          <button
            key={key}
            onClick={() => toggle(key)}
            className="w-full flex items-center justify-between py-1.5 group"
          >
            <span className={`text-sm ${enabled ? 'text-white' : 'text-white/30'}`}>
              {LABELS[key]}
            </span>
            {enabled ? (
              <ToggleRight className="w-5 h-5 text-green-400" />
            ) : (
              <ToggleLeft className="w-5 h-5 text-white/20" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
