import React, { useEffect, useState } from 'react';
import { mediaService } from '../services/mediaService';
import type { MediaItem } from '../types';
import { MediaGrid } from '../components/media/MediaGrid';
import { MediaDetailModal } from '../components/media/MediaDetailModal';
import { UploadModal } from '../components/media/UploadModal';
import { useAuth } from '../context/AuthContext';
import { Flame } from 'lucide-react';

interface DashboardPageProps {
  searchQuery: string;
  isUploadOpen: boolean;
  onCloseUpload: () => void;
  onOpenUpload?: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  searchQuery,
  isUploadOpen,
  onCloseUpload,
}) => {
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

    // Subscribe to Realtime Updates
    const unsubscribe = mediaService.subscribeToMediaChanges(() => {
      fetchMedia();
    });

    return () => {
      unsubscribe();
    };
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

  // Filter media by search query
  const filteredMedia = mediaList.filter((m) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const captionMatch = m.caption?.toLowerCase().includes(query);
    const uploaderMatch = m.uploader?.display_name?.toLowerCase().includes(query);
    const albumMatch = m.album?.title?.toLowerCase().includes(query);
    return captionMatch || uploaderMatch || albumMatch;
  });

  return (
    <div className="space-y-6">
      {/* Banner Card */}
      <div className="relative rounded-3xl bg-gradient-to-r from-indigo-900/60 via-slate-900 to-slate-900 border border-indigo-500/20 p-6 sm:p-8 overflow-hidden shadow-xl">
        <div className="absolute right-0 top-0 w-96 h-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-3 max-w-2xl">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
            <Flame className="w-3.5 h-3.5 text-indigo-400" />
            <span>Class Memories Stream</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Our Shared Journey & Moments
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Welcome to our class memory capsule. Browse memories, leave comments, and upload photos & videos to preserve our college years forever.
          </p>
        </div>
      </div>

      {/* Grid View */}
      <MediaGrid
        mediaList={filteredMedia}
        loading={loading}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        onSelectMedia={(m) => setSelectedMedia(m)}
        onLikeToggle={handleLikeToggle}
        onDislikeToggle={handleDislikeToggle}
      />

      {/* Modals */}
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

      <UploadModal
        isOpen={isUploadOpen}
        onClose={onCloseUpload}
        onUploadSuccess={fetchMedia}
      />
    </div>
  );
};
