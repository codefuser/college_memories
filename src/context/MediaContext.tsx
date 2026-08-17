import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { mediaService } from '../services/mediaService';
import type { MediaItem, Album } from '../types';
import { useAuth } from './AuthContext';

interface MediaContextType {
  mediaList: MediaItem[];
  albumsList: Album[];
  loading: boolean;
  isUploadOpen: boolean;
  selectedMedia: MediaItem | null;
  activeFilter: 'all' | 'image' | 'video';
  searchQuery: string;
  setActiveFilter: (filter: 'all' | 'image' | 'video') => void;
  setSearchQuery: (query: string) => void;
  setSelectedMedia: (media: MediaItem | null) => void;
  openUpload: () => void;
  closeUpload: () => void;
  fetchMedia: (force?: boolean) => Promise<void>;
  fetchAlbums: () => Promise<void>;
  handleLikeToggle: (mediaId: string) => Promise<void>;
  handleDislikeToggle: (mediaId: string) => Promise<void>;
  handleUploadSuccess: (newMedia?: MediaItem) => void;
  handleDeleteMedia: (mediaId: string) => Promise<void>;
  handleToggleVisibility: (mediaId: string) => Promise<void>;
}

const MediaContext = createContext<MediaContextType | undefined>(undefined);

export const MediaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [albumsList, setAlbumsList] = useState<Album[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'image' | 'video'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const hasInitialLoaded = useRef<boolean>(false);
  const pendingReactions = useRef<Set<string>>(new Set());

  // Fetch Albums
  const fetchAlbums = useCallback(async () => {
    const albums = await mediaService.getAlbums();
    setAlbumsList(albums);
  }, []);

  // Fetch Media with caching & background refresh
  const fetchMedia = useCallback(async (force = false) => {
    if (!hasInitialLoaded.current || force) {
      setLoading(true);
    }

    const data = await mediaService.getMedia({
      type: 'all',
      currentUserId: user?.id,
    });

    setMediaList(data);
    hasInitialLoaded.current = true;
    setLoading(false);
  }, [user?.id]);

  // Initial Load on Auth User change
  useEffect(() => {
    if (user) {
      fetchMedia();
      fetchAlbums();
    } else {
      setMediaList([]);
      setAlbumsList([]);
      setLoading(false);
      hasInitialLoaded.current = false;
    }
  }, [user?.id, fetchMedia, fetchAlbums]);

  // Application-level Global Realtime Listener (ONE listener per session)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('app-global-media-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'media' },
        async (payload) => {
          const newRow = payload.new as any;
          if (newRow && newRow.visibility === 'visible') {
            // Fetch uploader info
            const { data: uploader } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', newRow.uploaded_by)
              .maybeSingle();

            const { data: urlData } = supabase.storage.from('media').getPublicUrl(newRow.storage_path);

            const newMediaItem: MediaItem = {
              ...newRow,
              public_url: urlData?.publicUrl || newRow.storage_path,
              uploader: uploader || null,
              likes_count: 0,
              dislikes_count: 0,
              comments_count: 0,
              user_has_liked: false,
              user_has_disliked: false,
            };

            setMediaList((prev) => {
              if (prev.some((m) => m.id === newMediaItem.id)) return prev;
              return [newMediaItem, ...prev];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'media' },
        (payload) => {
          const deletedId = payload.old?.id;
          if (deletedId) {
            setMediaList((prev) => prev.filter((m) => m.id !== deletedId));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'media_likes' },
        () => {
          fetchMedia(false);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'media_dislikes' },
        () => {
          fetchMedia(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchMedia]);

  // Optimistic Like Handler
  const handleLikeToggle = async (mediaId: string) => {
    if (!user || pendingReactions.current.has(mediaId)) return;
    pendingReactions.current.add(mediaId);

    // Optimistic UI state mutation
    setMediaList((prev) =>
      prev.map((item) => {
        if (item.id === mediaId) {
          const currentlyLiked = item.user_has_liked;
          const newLiked = !currentlyLiked;
          const currentlyDisliked = item.user_has_disliked;

          const newLikesCount = newLiked
            ? (item.likes_count || 0) + 1
            : Math.max(0, (item.likes_count || 1) - 1);

          const newDislikesCount = currentlyDisliked
            ? Math.max(0, (item.dislikes_count || 1) - 1)
            : item.dislikes_count || 0;

          return {
            ...item,
            user_has_liked: newLiked,
            user_has_disliked: false,
            likes_count: newLikesCount,
            dislikes_count: newDislikesCount,
          };
        }
        return item;
      })
    );

    // Update selectedMedia lightbox state if open
    if (selectedMedia?.id === mediaId) {
      setSelectedMedia((prev) => {
        if (!prev) return null;
        const currentlyLiked = prev.user_has_liked;
        const newLiked = !currentlyLiked;
        const currentlyDisliked = prev.user_has_disliked;

        return {
          ...prev,
          user_has_liked: newLiked,
          user_has_disliked: false,
          likes_count: newLiked ? (prev.likes_count || 0) + 1 : Math.max(0, (prev.likes_count || 1) - 1),
          dislikes_count: currentlyDisliked ? Math.max(0, (prev.dislikes_count || 1) - 1) : prev.dislikes_count || 0,
        };
      });
    }

    await mediaService.toggleLike(mediaId, user.id);
    pendingReactions.current.delete(mediaId);
  };

  // Optimistic Dislike Handler
  const handleDislikeToggle = async (mediaId: string) => {
    if (!user || pendingReactions.current.has(mediaId)) return;
    pendingReactions.current.add(mediaId);

    // Optimistic UI state mutation
    setMediaList((prev) =>
      prev.map((item) => {
        if (item.id === mediaId) {
          const currentlyDisliked = item.user_has_disliked;
          const newDisliked = !currentlyDisliked;
          const currentlyLiked = item.user_has_liked;

          const newDislikesCount = newDisliked
            ? (item.dislikes_count || 0) + 1
            : Math.max(0, (item.dislikes_count || 1) - 1);

          const newLikesCount = currentlyLiked
            ? Math.max(0, (item.likes_count || 1) - 1)
            : item.likes_count || 0;

          return {
            ...item,
            user_has_disliked: newDisliked,
            user_has_liked: false,
            dislikes_count: newDislikesCount,
            likes_count: newLikesCount,
          };
        }
        return item;
      })
    );

    if (selectedMedia?.id === mediaId) {
      setSelectedMedia((prev) => {
        if (!prev) return null;
        const currentlyDisliked = prev.user_has_disliked;
        const newDisliked = !currentlyDisliked;
        const currentlyLiked = prev.user_has_liked;

        return {
          ...prev,
          user_has_disliked: newDisliked,
          user_has_liked: false,
          dislikes_count: newDisliked ? (prev.dislikes_count || 0) + 1 : Math.max(0, (prev.dislikes_count || 1) - 1),
          likes_count: currentlyLiked ? Math.max(0, (prev.likes_count || 1) - 1) : prev.likes_count || 0,
        };
      });
    }

    await mediaService.toggleDislike(mediaId, user.id);
    pendingReactions.current.delete(mediaId);
  };

  const handleUploadSuccess = (newMedia?: MediaItem) => {
    if (newMedia) {
      setMediaList((prev) => {
        if (prev.some((m) => m.id === newMedia.id)) return prev;
        return [newMedia, ...prev];
      });
    }
    fetchMedia(false);
  };

  const handleDeleteMedia = async (mediaId: string) => {
    setMediaList((prev) => prev.filter((m) => m.id !== mediaId));
    if (selectedMedia?.id === mediaId) {
      setSelectedMedia(null);
    }
  };

  const handleToggleVisibility = async (mediaId: string) => {
    setMediaList((prev) =>
      prev.map((m) => (m.id === mediaId ? { ...m, visibility: m.visibility === 'visible' ? 'hidden' : 'visible' } : m))
    );
  };

  const openUpload = () => setIsUploadOpen(true);
  const closeUpload = () => setIsUploadOpen(false);

  return (
    <MediaContext.Provider
      value={{
        mediaList,
        albumsList,
        loading,
        isUploadOpen,
        selectedMedia,
        activeFilter,
        searchQuery,
        setActiveFilter,
        setSearchQuery,
        setSelectedMedia,
        openUpload,
        closeUpload,
        fetchMedia,
        fetchAlbums,
        handleLikeToggle,
        handleDislikeToggle,
        handleUploadSuccess,
        handleDeleteMedia,
        handleToggleVisibility,
      }}
    >
      {children}
    </MediaContext.Provider>
  );
};

export const useMedia = () => {
  const context = useContext(MediaContext);
  if (!context) {
    throw new Error('useMedia must be used within a MediaProvider');
  }
  return context;
};
