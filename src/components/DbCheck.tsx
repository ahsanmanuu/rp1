'use client';

import { useState, useEffect } from 'react';
import { Database, CheckCircle2, XCircle, Loader2, Info } from 'lucide-react';

export default function DbCheck() {
  const [status, setStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    setStatus('checking');
    setError(null);
    try {
      const res = await fetch('/api/platform-stats');
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      setStatus('connected');
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setError(err.message || 'Failed to connect to PocketBase.');
    }
  };

  return (
    <div className="glass p-6 mt-12 max-w-2xl mx-auto flex flex-col gap-6 animate-fade-in">
       <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${status === 'connected' ? 'bg-green-500/10 text-green-400' : status === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-white/5 text-[var(--text-dim)]'}`}>
                <Database size={24} />
             </div>
             <div>
                <h3 className="text-lg font-bold">PocketBase Connection Check</h3>
                <p className="text-xs text-[var(--text-dim)] uppercase tracking-widest font-black">Backend Connection Status</p>
             </div>
          </div>
          
          <div className="flex items-center gap-4">
             {status === 'checking' && <Loader2 className="animate-spin text-[var(--primary)]" size={20} />}
             {status === 'connected' && <CheckCircle2 className="text-green-400" size={20} />}
             {status === 'error' && <XCircle className="text-red-400" size={20} />}
          </div>
       </div>

       {error && (
          <div className="p-4 rounded-xl text-sm flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-400">
             <Info size={18} className="mt-0.5 shrink-0" />
             <div className="flex flex-col gap-2">
                <p>{error}</p>
                <button onClick={checkConnection} className="underline text-xs font-bold uppercase tracking-widest">Retry Connection</button>
             </div>
          </div>
       )}

       {status === 'connected' && (
          <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center gap-3">
             <CheckCircle2 size={18} />
             <span>PocketBase is reachable and operational.</span>
          </div>
       )}
    </div>
  );
}
