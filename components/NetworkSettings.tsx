import React, { useState } from 'react';
import { CheckCircle2, Wifi } from 'lucide-react';

const DEFAULT_PI_IP = '192.168.137.47';
const STORAGE_KEY = 'PI_IP';

const getActiveIp = (): string => {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_PI_IP;
  } catch {
    return DEFAULT_PI_IP;
  }
};

const NetworkSettings: React.FC = () => {
  const activeIp = getActiveIp();
  const [input, setInput] = useState(activeIp);
  const [status, setStatus] = useState<'idle' | 'saved'>('idle');

  const isDirty = input.trim() !== activeIp;

  const handleSave = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    try {
      localStorage.setItem(STORAGE_KEY, trimmed);
    } catch {
      // localStorage unavailable — still reload so piConfig re-evaluates
    }
    setStatus('saved');
    window.setTimeout(() => window.location.reload(), 600);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSave();
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
          <Wifi size={20} />
        </div>
        <div>
          <p className="text-sm font-black tracking-tight text-slate-800">Network Settings</p>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Active IP:&nbsp;
            <span className="font-black text-emerald-600">{activeIp}</span>
          </p>
        </div>
      </div>

      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
        Raspberry Pi IP Address
      </label>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); setStatus('idle'); }}
          onKeyDown={handleKeyDown}
          placeholder={DEFAULT_PI_IP}
          spellCheck={false}
          className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-800 placeholder-slate-300 outline-none ring-0 transition focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={status === 'saved' || !input.trim()}
          className={`inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
            status === 'saved'
              ? 'bg-emerald-500'
              : isDirty
              ? 'bg-violet-600 hover:bg-violet-700'
              : 'bg-slate-700 hover:bg-slate-600'
          }`}
        >
          {status === 'saved' ? (
            <>
              <CheckCircle2 size={15} />
              Saved
            </>
          ) : (
            <>
              <Wifi size={15} />
              Connect
            </>
          )}
        </button>
      </div>

      <p className="mt-2 text-[11px] text-slate-400">
        Enter the IP shown by <code className="font-mono font-bold text-slate-500">hostname -I</code> on the Pi, then click Connect. The page will reload automatically.
      </p>
    </div>
  );
};

export default NetworkSettings;
