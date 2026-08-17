import React, { useState } from 'react';
import { useMedia } from '../context/MediaContext';
import type { Album } from '../types';
import { AlbumCard } from '../components/albums/AlbumCard';
import { CreateAlbumModal } from '../components/albums/CreateAlbumModal';
import { MediaGrid } from '../components/media/MediaGrid';
import { MediaDetailModal } from '../components/media/MediaDetailModal';
import { useAuth } from '../context/AuthContext';
import { FolderHeart, Plus, ArrowLeft } from 'lucide-react';

export const AlbumsPage: React.FC = () => {
  const { profile, permissions, isAdmin } = useAuth();
  const {
    albumsList,
    mediaList,
    selectedMedia,
    setSelectedMedia,
    handleLikeToggle,
    handleDislikeToggle,
    handleDeleteMedia,
    fetchAlbums,
  } = useMedia();

  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const canCreateAlbum = isAdmin || (profile?.status !== 'blocked' && permissions?.can_create_album);

  const albumMedia = selectedAlbum
    ? mediaList.filter((m) => m.album_id === selectedAlbum.id)
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <FolderHeart className="w-5 h-5 text-indigo-400" />
            Class Albums
          </h2>
          <p className="text-xs text-slate-400">Organized collections of class events and trips</p>
        </div>

        {canCreateAlbum && !selectedAlbum && (
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Album</span>
          </button>
        )}
      </div>

      {/* Album Detail View vs Album Grid */}
      {selectedAlbum ? (
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => setSelectedAlbum(null)}
            className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Albums</span>
          </button>

          <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl space-y-2">
            <h3 className="text-lg font-bold text-white">{selectedAlbum.title}</h3>
            {selectedAlbum.description && (
              <p className="text-xs text-slate-300">{selectedAlbum.description}</p>
            )}
            <div className="text-[11px] text-slate-500">
              Created by {selectedAlbum.creator?.display_name || 'Class Admin'} • {albumMedia.length} memories
            </div>
          </div>

          <MediaGrid
            mediaList={albumMedia}
            loading={false}
            activeFilter="all"
            onFilterChange={() => {}}
            onSelectMedia={(m) => setSelectedMedia(m)}
            onLikeToggle={handleLikeToggle}
            onDislikeToggle={handleDislikeToggle}
          />
        </div>
      ) : albumsList.length === 0 ? (
        <div className="py-16 text-center bg-slate-900/30 border border-slate-800 rounded-3xl p-8 space-y-3">
          <FolderHeart className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-300">No Albums Created Yet</h3>
          <p className="text-xs text-slate-500">Create an album to organize photos from class trips or events!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {albumsList.map((album) => (
            <AlbumCard key={album.id} album={album} onSelect={(a) => setSelectedAlbum(a)} />
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      <MediaDetailModal
        media={selectedMedia}
        isOpen={Boolean(selectedMedia)}
        onClose={() => setSelectedMedia(null)}
        onLikeToggle={handleLikeToggle}
        onDislikeToggle={handleDislikeToggle}
        onMediaDeleted={(mediaId) => handleDeleteMedia(mediaId)}
      />

      <CreateAlbumModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onAlbumCreated={fetchAlbums}
      />
    </div>
  );
};
