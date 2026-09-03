import React, { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { UserProfile } from '../types';
import allegriLogo from '../src/assets/allegri-logo.jpeg';
import { PI_API_BASE_URL } from '../services/piConfig';

interface HeaderProps {
  user: UserProfile | null;
  onProfileClick: () => void;
}

type HealthStatus = 'checking' | 'online' | 'offline';

// Built from the IP/URL saved in localStorage via Network Settings.
// PI_API_BASE_URL already handles both raw IPs (http://ip:8000) and
// full Serveo/Ngrok URLs (https://abc.serveo.net) correctly.
const HEALTH_ENDPOINT = `${PI_API_BASE_URL}/health`;

const Header: React.FC<HeaderProps> = ({ user, onProfileClick }) => {
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('checking');

  useEffect(() => {
    let isMounted = true;
    let intervalId: number | null = null;

    const pingHealth = async () => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(HEALTH_ENDPOINT, {
          method: 'GET',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Health check failed: ${response.status}`);
        }

        const payload = (await response.json()) as { status?: string };
        if (isMounted) {
          setHealthStatus(payload?.status === 'online' ? 'online' : 'offline');
        }
      } catch {
        if (isMounted) {
          setHealthStatus('offline');
        }
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    void pingHealth();
    intervalId = window.setInterval(() => {
      void pingHealth();
    }, 20000);

    return () => {
      isMounted = false;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  const healthLabel =
    healthStatus === 'online'
      ? 'System Online'
      : healthStatus === 'offline'
        ? 'System Offline'
        : 'Checking System...';

  const healthDotClass =
    healthStatus === 'online'
      ? 'bg-emerald-500'
      : healthStatus === 'offline'
        ? 'bg-rose-500'
        : 'bg-amber-400';

  return (
    <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <img src={allegriLogo} alt="ALLEGRI" className="h-10 w-auto object-contain" />
            </div>
          </div>

          {/* Health dot + user profile */}
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur">
              <span className={`h-2 w-2 rounded-full ${healthDotClass} ${healthStatus === 'checking' ? 'animate-pulse' : ''}`} />
              {healthLabel}
            </div>

            {user && (
              <button
                onClick={onProfileClick}
                className="flex items-center gap-3 hover:bg-slate-50 p-1.5 rounded-xl transition-all group"
                title="View Profile"
              >
                <div className="hidden md:flex flex-col items-end text-right">
                  <span className="text-sm font-medium text-slate-700 group-hover:text-emerald-700 transition-colors">{user.username}</span>
                  <span className="text-xs text-slate-500">{user.department}</span>
                </div>
                <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 ring-2 ring-white shadow-sm group-hover:ring-emerald-100 transition-all">
                  <User size={20} />
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
