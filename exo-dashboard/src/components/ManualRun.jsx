import { useState, useEffect } from 'react';
import { Play, Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function ManualRun() {
  const [status, setStatus] = useState({ running: false, lastRun: null });
  const [polling, setPolling] = useState(false);

  const pollStatus = () => {
    fetch('/api/run/status')
      .then(r => r.json())
      .then(data => {
        setStatus(data);
        if (!data.running) setPolling(false);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(pollStatus, 2000);
    return () => clearInterval(interval);
  }, [polling]);

  const handleRun = async () => {
    try {
      const res = await fetch('/api/run', { method: 'POST' });
      if (res.status === 409) {
        setStatus({ running: true });
        setPolling(true);
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      if (data.started) {
        setStatus({ running: true });
        setPolling(true);
      }
    } catch { }
  };

  const isRunning = status.running;
  const isDone = !isRunning && status.exitCode !== null && status.exitCode !== undefined;
  const isSuccess = isDone && status.exitCode === 0;

  return (
    <div className="bg-white/5 rounded-2xl border border-white/10 p-5 h-full flex flex-col justify-between">
      <div>
        <p className="text-xs text-white/40 mb-3">Exécution manuelle</p>
        {isRunning && (
          <div className="flex items-center gap-2 text-yellow-400 text-xs mb-3">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>En cours...</span>
          </div>
        )}
        {isDone && (
          <div className={`flex items-center gap-2 text-xs mb-3 ${isSuccess ? 'text-green-400' : 'text-red-400'}`}>
            {isSuccess ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
            <span>{isSuccess ? 'Terminé' : `Erreur (code ${status.exitCode})`}</span>
          </div>
        )}
        {!isRunning && !isDone && (
          <p className="text-xs text-white/20 mb-3">Idle</p>
        )}
      </div>
      <button
        onClick={handleRun}
        disabled={isRunning}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all
          ${isRunning
            ? 'bg-white/5 text-white/30 cursor-not-allowed'
            : 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 active:scale-[0.98]'
          }`}
      >
        {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
        {isRunning ? 'En cours...' : 'Run Now'}
      </button>
    </div>
  );
}
