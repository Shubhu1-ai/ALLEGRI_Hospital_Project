import React from 'react';
import { Activity, User } from 'lucide-react';
import { UserProfile } from '../types';

interface HeaderProps {
  user: UserProfile | null;
  onLogout: () => void;
  onProfileClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout, onProfileClick }) => {
  return (
    <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center gap-2 text-emerald-600">
              <Activity className="h-8 w-8" />
              <span className="font-bold text-xl tracking-tight text-slate-800">ALLEGRI</span>
            </div>
          </div>

          {/* User Profile / Logout */}
          {user && (
            <div className="flex items-center gap-4">
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
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
