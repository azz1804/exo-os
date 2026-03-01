import { useState, useEffect, useRef } from 'react';
import { Terminal, RefreshCw } from 'lucide-react';

function colorLine(line) {
  if (line.match(/erreur|error|❌|⚠️/i)) return 'text-red-400';
  if (line.match(/✅|terminée|sauvegardé|enrichie/)) return 'text-green-400';
  if (line.match(/⏭️|ℹ️|vide/)) return 'text-white/30';
  return 'text-white/70';
}

export default function LogViewer() {
  const [lines, setLines] = useState([]);
  const [tab, setTab] = useState('orchestrator');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const scrollRef = useRef(null);

  const load = () => {
    fetch(`/api/logs?type=${tab}&lines=150`)
      .then(r => r.json())
      .then(d => setLines(d.lines || []))
      .catch(() => {});
  };

  useEffect(() => {
    load();
    if (!autoRefresh) return;
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [tab, autoRefresh]);

  const isAtBottom = useRef(true);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    isAtBottom.current = scrollHeight - scrollTop - clientHeight < 30;
  };

  useEffect(() => {
    if (scrollRef.current && isAtBottom.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Terminal className="w-4 h-4 text-white/40" />
          <div className="flex gap-1">
            {['orchestrator', 'error'].map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                  tab === t ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
                }`}
              >
                {t === 'orchestrator' ? 'orchestrator.log' : 'error.log'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`text-xs px-2 py-1 rounded-lg ${autoRefresh ? 'bg-green-400/10 text-green-400' : 'text-white/30'}`}
          >
            Auto
          </button>
          <button onClick={load} className="text-white/40 hover:text-white transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="log-viewer h-72 overflow-y-auto p-4 font-mono text-xs leading-relaxed">
        {lines.length === 0 ? (
          <p className="text-white/20">Aucun log disponible.</p>
        ) : (
          lines.map((line, i) => (
            <div key={i} className={colorLine(line)}>{line}</div>
          ))
        )}
      </div>
    </div>
  );
}
