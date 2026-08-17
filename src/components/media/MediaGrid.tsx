import React from 'react';
import { MediaCard } from './MediaCard';
import type { MediaItem } from '../../types';
import { Image, Video, Sparkles } from 'lucide-react';

interface MediaGridProps {
  mediaList: MediaItem[];
  loading: boolean;
  activeFilter: 'all' | 'image' | 'video';
  onFilterChange: (filter: 'all' | 'image' | 'video') => void;
  onSelectMedia: (media: MediaItem) => void;
  onLikeToggle: (mediaId: string) => void;
  onDislikeToggle: (mediaId: string) => void;
}

export const MediaGrid: React.FC<MediaGridProps> = ({
  mediaList,
  loading,
  activeFilter,
  onFilterChange,
  onSelectMedia,
  onLikeToggle,
  onDislikeToggle,
}) => {
  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 bg-slate-900/60 p-1 rounded-2xl border border-slate-800">
          <button
            onClick={() => onFilterChange('all')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>All Memories</span>
          </button>
          <button
            onClick={() => onFilterChange('image')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeFilter === 'image'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Image className="w-3.5 h-3.5" />
            <span>Photos</span>
          </button>
          <button
            onClick={() => onFilterChange('video')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeFilter === 'video'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Videos</span>
          </button>
        </div>

        <div className="text-xs text-slate-400 font-medium">
          {mediaList.length} {mediaList.length === 1 ? 'memory' : 'memories'}
        </div>
      </div>

      {/* Loading Skeletons */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-slate-900/40 border border-slate-800 rounded-3xl p-4 space-y-4 animate-pulse">
              <div className="w-full aspect-square bg-slate-800/60 rounded-2xl" />
              <div className="h-4 bg-slate-800/60 rounded w-3/4" />
              <div className="h-3 bg-slate-800/40 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : mediaList.length === 0 ? (
        /* Empty State */
        <div className="py-16 text-center bg-slate-900/30 border border-slate-800/60 rounded-3xl p-8 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 text-indigo-400 mx-auto flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-200">No Memories Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            There are no photos or videos in this filter yet. Be the first class member to upload one!
          </p>
        </div>
      ) : (
        /* Grid Display */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {mediaList.map((item) => (
            <MediaCard
              key={item.id}
              media={item}
              onSelect={onSelectMedia}
              onLikeToggle={onLikeToggle}
              onDislikeToggle={onDislikeToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
};
