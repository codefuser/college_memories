import React from 'react';
import { Home, Image as ImageIcon, FolderHeart, User, Shield, Users, EyeOff, Activity } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onTabChange }) => {
  const { isAdmin } = useAuth();

  const userNav = [
    { id: 'feed', label: 'Feed', icon: Home },
    { id: 'memories', label: 'Memories', icon: ImageIcon },
    { id: 'albums', label: 'Albums', icon: FolderHeart },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  const adminNav = [
    { id: 'admin-dashboard', label: 'Overview', icon: Shield },
    { id: 'admin-users', label: 'Users & Permissions', icon: Users },
    { id: 'admin-media', label: 'Media Moderation', icon: EyeOff },
    { id: 'admin-logs', label: 'Activity Logs', icon: Activity },
  ];

  return (
    <aside className="w-64 hidden lg:flex flex-col border-r border-slate-800/80 bg-slate-900/40 min-h-[calc(100vh-4rem)] p-4 space-y-6">
      {/* General Class Navigation */}
      <div>
        <h2 className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Class Navigation
        </h2>
        <nav className="space-y-1">
          {userNav.map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all ${
                  active
                    ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Admin Dedicated Section */}
      {isAdmin && (
        <div className="pt-4 border-t border-slate-800/60">
          <h2 className="px-3 text-xs font-semibold text-amber-400/90 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-amber-400" /> Admin Controls
          </h2>
          <nav className="space-y-1">
            {adminNav.map((item) => {
              const Icon = item.icon;
              const active = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all ${
                    active
                      ? 'bg-amber-500/20 border border-amber-500/30 text-amber-300 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-amber-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      )}
    </aside>
  );
};
