import React from 'react';
import { Camera, Upload, LogOut, ShieldAlert, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useMedia } from '../../context/MediaContext';

export const Navbar: React.FC = () => {
  const { profile, isAdmin, logout, canUploadImage, canUploadVideo } = useAuth();
  const { openUpload, searchQuery, setSearchQuery } = useMedia();
  const showUploadBtn = canUploadImage() || canUploadVideo();

  return (
    <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-tight">
              ClassMemories
            </h1>
            <p className="text-[10px] uppercase font-semibold tracking-wider text-indigo-400">
              Private Class Gallery
            </p>
          </div>
        </div>

        {/* Search Input */}
        <div className="flex-1 max-w-md hidden sm:block">
          <input
            type="text"
            placeholder="Search memories, captions, or members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/60 border border-slate-800 rounded-full px-4 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60 transition-all"
          />
        </div>

        {/* Actions & Profile */}
        <div className="flex items-center space-x-3">
          {showUploadBtn && (
            <button
              type="button"
              onClick={openUpload}
              className="flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs sm:text-sm shadow-md shadow-indigo-600/20 transition-all active:scale-95"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Upload</span>
            </button>
          )}

          {/* Profile Pill */}
          <div className="flex items-center space-x-2 bg-slate-800/60 border border-slate-700/50 rounded-full px-3 py-1">
            <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 font-semibold text-xs overflow-hidden">
              {profile?.profile_photo ? (
                <img src={profile.profile_photo} alt={profile.display_name} className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-4 h-4" />
              )}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                {profile?.display_name || 'Member'}
                {isAdmin && (
                  <span className="bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] px-1.5 py-0.2 rounded-full font-bold flex items-center gap-0.5">
                    <ShieldAlert className="w-2.5 h-2.5" /> ADMIN
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-400">@{profile?.username}</div>
            </div>
          </div>

          {/* Logout */}
          <button
            type="button"
            onClick={() => logout()}
            title="Log out"
            className="p-2 rounded-full text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
