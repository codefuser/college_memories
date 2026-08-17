import React from 'react';
import { Home, Image as ImageIcon, FolderHeart, User, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface MobileNavProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ currentTab, onTabChange }) => {
  const { isAdmin } = useAuth();

  const navItems = [
    { id: 'feed', label: 'Feed', icon: Home },
    { id: 'memories', label: 'Memories', icon: ImageIcon },
    { id: 'albums', label: 'Albums', icon: FolderHeart },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  if (isAdmin) {
    navItems.push({ id: 'admin-dashboard', label: 'Admin', icon: Shield });
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-slate-900/90 backdrop-blur-xl border-t border-slate-800 px-2 py-2">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = currentTab === item.id || (item.id === 'admin-dashboard' && currentTab.startsWith('admin-'));
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
                active
                  ? 'text-indigo-400 font-semibold scale-105'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
