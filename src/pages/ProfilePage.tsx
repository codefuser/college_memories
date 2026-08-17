import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { mediaService } from '../services/mediaService';
import { adminService } from '../services/adminService';
import type { MediaItem } from '../types';
import { MediaGrid } from '../components/media/MediaGrid';
import { MediaDetailModal } from '../components/media/MediaDetailModal';
import { User, Shield, Calendar, Image, CheckCircle2, XCircle, Edit3 } from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user, profile, permissions, isAdmin, refreshProfile } = useAuth();
  const [userMedia, setUserMedia] = useState<MediaItem[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [photoUrl, setPhotoUrl] = useState(profile?.profile_photo || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUserMedia();
    }
  }, [user]);

  const fetchUserMedia = async () => {
    if (!user) return;
    setLoadingMedia(true);
    const data = await mediaService.getMedia({
      userId: user.id,
      currentUserId: user.id,
    });
    setUserMedia(data);
    setLoadingMedia(false);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);

    await adminService.updateUserProfile(user.id, {
      display_name: displayName,
      profile_photo: photoUrl || null,
    });

    await refreshProfile();
    setIsSaving(false);
    setIsEditing(false);
  };

  const formattedJoinDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : 'Unknown';

  return (
    <div className="space-y-6">
      {/* Profile Header Box */}
      <div className="bg-slate-900/60 border border-slate-800/80 p-6 sm:p-8 rounded-3xl space-y-6 shadow-xl backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-indigo-600/20 border-2 border-indigo-500/30 flex items-center justify-center text-indigo-300 text-2xl font-bold overflow-hidden shadow-lg shadow-indigo-600/20">
              {profile?.profile_photo ? (
                <img src={profile.profile_photo} alt={profile.display_name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">{profile?.display_name}</h2>
                {isAdmin ? (
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Shield className="w-3 h-3" /> ADMIN
                  </span>
                ) : (
                  <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    CLASS MEMBER
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">@{profile?.username}</p>
              <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Joined {formattedJoinDate}
                </span>
                <span className="flex items-center gap-1">
                  <Image className="w-3.5 h-3.5" /> {userMedia.length} Uploads
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all border border-slate-700/60"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{isEditing ? 'Cancel Editing' : 'Edit Profile'}</span>
          </button>
        </div>

        {/* Profile Edit Form */}
        {isEditing && (
          <form onSubmit={handleSaveProfile} className="pt-4 border-t border-slate-800 space-y-4 max-w-lg">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Display Name</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Profile Photo Image URL</label>
              <input
                type="url"
                placeholder="https://..."
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all"
            >
              {isSaving ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </form>
        )}

        {/* Permissions Overview Badge Strip */}
        <div className="pt-4 border-t border-slate-800/60">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Account Privileges & Security Status
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80 flex items-center justify-between">
              <span className="text-xs text-slate-300">Photo Upload</span>
              {permissions?.can_upload_image || isAdmin ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400" />
              )}
            </div>
            <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80 flex items-center justify-between">
              <span className="text-xs text-slate-300">Video Upload</span>
              {permissions?.can_upload_video || isAdmin ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400" />
              )}
            </div>
            <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80 flex items-center justify-between">
              <span className="text-xs text-slate-300">Comments</span>
              {permissions?.can_comment || isAdmin ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400" />
              )}
            </div>
            <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80 flex items-center justify-between">
              <span className="text-xs text-slate-300">Album Creation</span>
              {permissions?.can_create_album || isAdmin ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* User's Uploaded Memories Feed */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-white tracking-tight">My Shared Memories</h3>
        <MediaGrid
          mediaList={userMedia}
          loading={loadingMedia}
          activeFilter="all"
          onFilterChange={() => {}}
          onSelectMedia={(m) => setSelectedMedia(m)}
          onLikeToggle={async (mediaId) => {
            if (user) await mediaService.toggleLike(mediaId, user.id);
            fetchUserMedia();
          }}
          onDislikeToggle={async (mediaId) => {
            if (user) await mediaService.toggleDislike(mediaId, user.id);
            fetchUserMedia();
          }}
        />
      </div>

      <MediaDetailModal
        media={selectedMedia}
        isOpen={Boolean(selectedMedia)}
        onClose={() => setSelectedMedia(null)}
        onLikeToggle={async (mediaId) => {
          if (user) await mediaService.toggleLike(mediaId, user.id);
          fetchUserMedia();
        }}
        onDislikeToggle={async (mediaId) => {
          if (user) await mediaService.toggleDislike(mediaId, user.id);
          fetchUserMedia();
        }}
        onMediaDeleted={() => {
          setSelectedMedia(null);
          fetchUserMedia();
        }}
      />
    </div>
  );
};
