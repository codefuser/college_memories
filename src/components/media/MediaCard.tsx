import React from 'react';
import { Heart, ThumbsDown, MessageCircle, Play, User as UserIcon, Calendar, Folder } from 'lucide-react';
import type { MediaItem } from '../../types';

interface MediaCardProps {
  media: MediaItem;
  onSelect: (media: MediaItem) => void;
  onLikeToggle: (mediaId: string) => void;
  onDislikeToggle: (mediaId: string) => void;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  media,
  onSelect,
  onLikeToggle,
  onDislikeToggle,
}) => {
  const isVideo = media.type === 'video';

  const formattedDate = new Date(media.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="group relative bg-slate-900/60 border border-slate-800/80 rounded-3xl overflow-hidden hover:border-slate-700/80 transition-all duration-300 shadow-lg hover:shadow-2xl hover:shadow-indigo-500/5 flex flex-col">
      {/* Media Preview Container */}
      <div
        onClick={() => onSelect(media)}
        className="relative aspect-video sm:aspect-square w-full bg-slate-950 overflow-hidden cursor-pointer"
      >
        {isVideo ? (
          <div className="relative w-full h-full flex items-center justify-center bg-slate-950">
            <video
              src={media.public_url}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              muted
              playsInline
            />
            <div className="absolute inset-0 bg-slate-950/40 group-hover:bg-slate-950/20 transition-colors flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-indigo-600/90 text-white flex items-center justify-center shadow-lg shadow-indigo-600/40 group-hover:scale-110 transition-transform">
                <Play className="w-6 h-6 fill-current ml-0.5" />
              </div>
            </div>
            <span className="absolute top-3 right-3 px-2 py-1 bg-slate-900/80 backdrop-blur-md rounded-lg text-[10px] font-bold text-indigo-300 uppercase tracking-wider">
              Video
            </span>
          </div>
        ) : (
          <div className="relative w-full h-full">
            <img
              src={media.public_url}
              alt={media.caption || 'Class Memory'}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
        )}
      </div>

      {/* Info & Interaction Content */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          {/* Uploader Header */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 text-xs font-semibold overflow-hidden flex-shrink-0">
                {media.uploader?.profile_photo ? (
                  <img src={media.uploader.profile_photo} alt={media.uploader.display_name} className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-3.5 h-3.5" />
                )}
              </div>
              <span className="text-xs font-semibold text-slate-200 truncate">
                {media.uploader?.display_name || 'Class Member'}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 flex items-center gap-1 flex-shrink-0">
              <Calendar className="w-3 h-3" /> {formattedDate}
            </span>
          </div>

          {/* Caption */}
          {media.caption && (
            <p className="text-xs text-slate-300 mt-2.5 line-clamp-2 leading-relaxed">
              {media.caption}
            </p>
          )}

          {/* Album Tag */}
          {media.album && (
            <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
              <Folder className="w-3 h-3" />
              <span className="truncate max-w-[140px]">{media.album.title}</span>
            </div>
          )}
        </div>

        {/* Reaction Bar */}
        <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-slate-400">
          <div className="flex items-center space-x-2">
            {/* Like */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onLikeToggle(media.id);
              }}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                media.user_has_liked
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${media.user_has_liked ? 'fill-current' : ''}`} />
              <span>{media.likes_count || 0}</span>
            </button>

            {/* Dislike */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDislikeToggle(media.id);
              }}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                media.user_has_disliked
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <ThumbsDown className={`w-3.5 h-3.5 ${media.user_has_disliked ? 'fill-current' : ''}`} />
              <span>{media.dislikes_count || 0}</span>
            </button>
          </div>

          {/* Comment Count */}
          <button
            onClick={() => onSelect(media)}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-all"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>{media.comments_count || 0}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
