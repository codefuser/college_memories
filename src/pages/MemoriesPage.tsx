import React, { useEffect, useState } from 'react';
import { mediaService } from '../services/mediaService';
import type { MediaItem } from '../types';
import { MediaGrid } from '../components/media/MediaGrid';
import { MediaDetailModal } from '../components/media/MediaDetailModal';
import { useAuth } from '../context/AuthContext';

interface MemoriesPageProps {
  searchQuery: string;
}

export const MemoriesPage: React.FC<MemoriesPageProps> = ({ searchQuery }) => {
  const { user } = useAuth();
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'image' | 'video'>('all');
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);

  const fetchMedia = async () => {
    setLoading(true);
    const data = await mediaService.getMedia({
      type: activeFilter,
      currentUserId: user?.id,
    });
    setMediaList(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchMedia();
  }, [activeFilter, user?.id]);

  const handleLikeToggle = async (mediaId: string) => {
    if (!user) return;
    await mediaService.toggleLike(mediaId, user.id);
    fetchMedia();
  };

  const handleDislikeToggle = async (mediaId: string) => {
    if (!user) return;
    await mediaService.toggleDislike(mediaId, user.id);
    fetchMedia();
  };

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
        onMediaDeleted={() => {
          setSelectedMedia(null);
          fetchMedia();
        }}
      />
    </div>
  );
};
