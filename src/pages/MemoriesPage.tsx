import React from 'react';
import { useMedia } from '../context/MediaContext';
import { MediaGrid } from '../components/media/MediaGrid';
import { MediaDetailModal } from '../components/media/MediaDetailModal';

export const MemoriesPage: React.FC = () => {
  const {
    mediaList,
    loading,
    activeFilter,
    searchQuery,
    selectedMedia,
    setActiveFilter,
    setSelectedMedia,
    handleLikeToggle,
    handleDislikeToggle,
    handleDeleteMedia,
  } = useMedia();

  const filteredMedia = mediaList.filter((m) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      m.caption?.toLowerCase().includes(query) ||
      m.uploader?.display_name?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Class Gallery</h2>
          <p className="text-xs text-slate-400">All photos and videos stored for our class</p>
        </div>
      </div>

      <MediaGrid
        mediaList={filteredMedia}
        loading={loading}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        onSelectMedia={(m) => setSelectedMedia(m)}
        onLikeToggle={handleLikeToggle}
        onDislikeToggle={handleDislikeToggle}
      />

      <MediaDetailModal
        media={selectedMedia}
        isOpen={Boolean(selectedMedia)}
        onClose={() => setSelectedMedia(null)}
        onLikeToggle={handleLikeToggle}
        onDislikeToggle={handleDislikeToggle}
        onMediaDeleted={(mediaId) => handleDeleteMedia(mediaId)}
      />
    </div>
  );
};
