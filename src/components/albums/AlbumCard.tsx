import React from 'react';
import { FolderHeart, Image as ImageIcon, Calendar, User as UserIcon } from 'lucide-react';
import type { Album } from '../../types';

interface AlbumCardProps {
  album: Album;
  onSelect: (album: Album) => void;
}

export const AlbumCard: React.FC<AlbumCardProps> = ({ album, onSelect }) => {
  return (
    <div
      onClick={() => onSelect(album)}
      className="group relative bg-slate-900/60 border border-slate-800/80 rounded-3xl overflow-hidden hover:border-indigo-500/50 cursor-pointer transition-all duration-300 shadow-lg hover:shadow-2xl hover:shadow-indigo-500/10 flex flex-col"
    >
      {/* Album Cover */}
      <div className="relative aspect-[4/3] w-full bg-slate-950 overflow-hidden">
        {album.cover_url ? (
          <img
            src={album.cover_url}
            alt={album.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-indigo-950 text-indigo-400 p-4">
            <FolderHeart className="w-12 h-12 mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-xs text-indigo-300 font-medium">Class Album</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-900/80 backdrop-blur-md rounded-lg flex items-center gap-1.5 text-indigo-300">
            <ImageIcon className="w-3.5 h-3.5" />
            {album.media_count || 0} items
          </span>
        </div>
      </div>

      {/* Album Info */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
        <div>
          <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
            {album.title}
          </h3>
          {album.description && (
            <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
              {album.description}
            </p>
          )}
        </div>

        <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <UserIcon className="w-3 h-3 text-slate-400" />
            {album.creator?.display_name || 'Class Admin'}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(album.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
};
