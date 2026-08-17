import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/adminService';
import { mediaService } from '../../services/mediaService';
import type { MediaItem } from '../../types';
import { Eye, EyeOff, Trash2, Play } from 'lucide-react';

export const MediaModerationPage: React.FC = () => {
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMedia();
  }, []);

  const fetchMedia = async () => {
    setLoading(true);
    const data = await adminService.getAllMediaForModeration();
    setMediaList(data);
    setLoading(false);
  };

  const handleToggleVisibility = async (mediaItem: MediaItem) => {
    const success = await adminService.toggleMediaVisibility(mediaItem.id, mediaItem.visibility);
    if (success) {
      fetchMedia();
    }
  };

  const handleDeleteMedia = async (mediaItem: MediaItem) => {
    if (!window.confirm('PERMANENTLY DELETE this media item from storage and database?')) return;
    const { success, error } = await mediaService.deleteMedia(mediaItem.id, mediaItem.storage_path);
    if (success) {
      fetchMedia();
    } else {
      alert(`Failed to delete media: ${error}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <EyeOff className="w-5 h-5 text-amber-400" />
            Media Moderation Console
          </h2>
          <p className="text-xs text-slate-400">Review all uploaded photos & videos, hide inappropriate media, or permanently remove items</p>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-slate-500">Loading media moderation grid...</p>
      ) : mediaList.length === 0 ? (
        <p className="text-xs text-slate-500 italic">No media items in class storage.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {mediaList.map((item) => (
            <div
              key={item.id}
              className={`bg-slate-900/60 border rounded-3xl overflow-hidden flex flex-col justify-between transition-all ${
                item.visibility === 'hidden'
                  ? 'border-amber-500/50 bg-amber-950/10'
                  : 'border-slate-800'
              }`}
            >
              {/* Media Preview */}
              <div className="relative aspect-video bg-slate-950 flex items-center justify-center overflow-hidden">
                {item.type === 'video' ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <video src={item.public_url} className="w-full h-full object-cover" />
                    <Play className="w-8 h-8 text-white absolute" />
                  </div>
                ) : (
                  <img src={item.public_url} alt="Moderation preview" className="w-full h-full object-cover" />
                )}
                {item.visibility === 'hidden' && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-[10px] uppercase">
                    HIDDEN
                  </span>
                )}
              </div>

              {/* Moderation Controls */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200 truncate">
                    {item.uploader?.display_name || 'User'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>

                {item.caption && (
                  <p className="text-xs text-slate-400 line-clamp-2">{item.caption}</p>
                )}

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <button
                    onClick={() => handleToggleVisibility(item)}
                    className={`flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      item.visibility === 'hidden'
                        ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                    }`}
                  >
                    {item.visibility === 'hidden' ? (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>Unhide</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Hide</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleDeleteMedia(item)}
                    className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors"
                    title="Delete permanently"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
