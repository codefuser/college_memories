import { supabase } from '../lib/supabase';
import type { MediaItem, Album, Comment } from '../types';

export const mediaService = {
  // Fetch class media with options
  async getMedia(options?: {
    type?: 'image' | 'video' | 'all';
    albumId?: string;
    userId?: string;
    currentUserId?: string;
  }): Promise<MediaItem[]> {
    let query = supabase
      .from('media')
      .select(`
        *,
        uploader:profiles!uploaded_by (*),
        album:albums!album_id (*)
      `)
      .eq('visibility', 'visible')
      .order('created_at', { ascending: false });

    if (options?.type && options.type !== 'all') {
      query = query.eq('type', options.type);
    }

    if (options?.albumId) {
      query = query.eq('album_id', options.albumId);
    }

    if (options?.userId) {
      query = query.eq('uploaded_by', options.userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching media:', error);
      return [];
    }

    if (!data || data.length === 0) return [];

    const mediaIds = data.map((item) => item.id);

    // Fetch Likes, Dislikes, and Comments counts for all returned media IDs
    const [likesRes, dislikesRes, commentsRes, userLikesRes, userDislikesRes] = await Promise.all([
      supabase.from('media_likes').select('media_id').in('media_id', mediaIds),
      supabase.from('media_dislikes').select('media_id').in('media_id', mediaIds),
      supabase.from('comments').select('media_id').in('media_id', mediaIds),
      options?.currentUserId
        ? supabase.from('media_likes').select('media_id').eq('user_id', options.currentUserId).in('media_id', mediaIds)
        : Promise.resolve({ data: [] }),
      options?.currentUserId
        ? supabase.from('media_dislikes').select('media_id').eq('user_id', options.currentUserId).in('media_id', mediaIds)
        : Promise.resolve({ data: [] }),
    ]);

    // Build lookup maps
    const likesMap: Record<string, number> = {};
    likesRes.data?.forEach((l) => {
      likesMap[l.media_id] = (likesMap[l.media_id] || 0) + 1;
    });

    const dislikesMap: Record<string, number> = {};
    dislikesRes.data?.forEach((d) => {
      dislikesMap[d.media_id] = (dislikesMap[d.media_id] || 0) + 1;
    });

    const commentsMap: Record<string, number> = {};
    commentsRes.data?.forEach((c) => {
      commentsMap[c.media_id] = (commentsMap[c.media_id] || 0) + 1;
    });

    const userLikesSet = new Set(userLikesRes.data?.map((ul) => ul.media_id) || []);
    const userDislikesSet = new Set(userDislikesRes.data?.map((ud) => ud.media_id) || []);

    return data.map((item) => {
      // Get public URL from storage
      const { data: urlData } = supabase.storage.from('media').getPublicUrl(item.storage_path);
      
      return {
        ...item,
        public_url: urlData.publicUrl,
        likes_count: likesMap[item.id] || 0,
        dislikes_count: dislikesMap[item.id] || 0,
        comments_count: commentsMap[item.id] || 0,
        user_has_liked: userLikesSet.has(item.id),
        user_has_disliked: userDislikesSet.has(item.id),
      };
    });
  },

  // Upload file (Image or Video)
  async uploadFile(
    file: File,
    type: 'image' | 'video',
    caption: string,
    albumId: string | null,
    userId: string,
    onProgress?: (progress: number) => void
  ): Promise<{ data?: MediaItem; error?: string }> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      if (onProgress) onProgress(30);

      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        return { error: uploadError.message };
      }

      if (onProgress) onProgress(70);

      // Save metadata in database
      const { data, error: dbError } = await supabase
        .from('media')
        .insert({
          uploaded_by: userId,
          type,
          storage_path: filePath,
          caption: caption.trim() || null,
          album_id: albumId || null,
          visibility: 'visible',
        })
        .select()
        .single();

      if (dbError) {
        // Cleanup storage on metadata insert failure
        await supabase.storage.from('media').remove([filePath]);
        return { error: dbError.message };
      }

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: userId,
        action_type: `upload_${type}`,
        action_details: { media_id: data.id, caption: caption.substring(0, 30) },
      });

      if (onProgress) onProgress(100);

      return { data: data as MediaItem };
    } catch (err: any) {
      return { error: err.message || 'File upload failed' };
    }
  },

  // Toggle Like
  async toggleLike(mediaId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if user already liked
      const { data: existingLike } = await supabase
        .from('media_likes')
        .select('id')
        .eq('media_id', mediaId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existingLike) {
        // Unlike
        await supabase.from('media_likes').delete().eq('id', existingLike.id);
      } else {
        // Remove dislike if any
        await supabase
          .from('media_dislikes')
          .delete()
          .eq('media_id', mediaId)
          .eq('user_id', userId);

        // Add like
        const { error } = await supabase.from('media_likes').insert({
          media_id: mediaId,
          user_id: userId,
        });

        if (error) return { success: false, error: error.message };

        // Activity log
        await supabase.from('activity_logs').insert({
          user_id: userId,
          action_type: 'like_media',
          action_details: { media_id: mediaId },
        });
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // Toggle Dislike
  async toggleDislike(mediaId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if user already disliked
      const { data: existingDislike } = await supabase
        .from('media_dislikes')
        .select('id')
        .eq('media_id', mediaId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existingDislike) {
        // Remove dislike
        await supabase.from('media_dislikes').delete().eq('id', existingDislike.id);
      } else {
        // Remove like if any
        await supabase
          .from('media_likes')
          .delete()
          .eq('media_id', mediaId)
          .eq('user_id', userId);

        // Add dislike
        const { error } = await supabase.from('media_dislikes').insert({
          media_id: mediaId,
          user_id: userId,
        });

        if (error) return { success: false, error: error.message };

        // Activity log
        await supabase.from('activity_logs').insert({
          user_id: userId,
          action_type: 'dislike_media',
          action_details: { media_id: mediaId },
        });
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // Comments CRUD
  async getComments(mediaId: string): Promise<Comment[]> {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        user:profiles!user_id (*)
      `)
      .eq('media_id', mediaId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching comments:', error);
      return [];
    }

    return (data || []) as Comment[];
  },

  async addComment(mediaId: string, userId: string, content: string): Promise<{ data?: Comment; error?: string }> {
    const { data, error } = await supabase
      .from('comments')
      .insert({
        media_id: mediaId,
        user_id: userId,
        content: content.trim(),
      })
      .select(`
        *,
        user:profiles!user_id (*)
      `)
      .single();

    if (error) return { error: error.message };

    // Log Activity
    await supabase.from('activity_logs').insert({
      user_id: userId,
      action_type: 'comment',
      action_details: { media_id: mediaId, comment: content.substring(0, 30) },
    });

    return { data: data as Comment };
  },

  async deleteComment(commentId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  // Delete Media
  async deleteMedia(mediaId: string, storagePath: string): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. Remove storage file
      await supabase.storage.from('media').remove([storagePath]);

      // 2. Delete database row
      const { error } = await supabase.from('media').delete().eq('id', mediaId);

      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // Albums CRUD
  async getAlbums(): Promise<Album[]> {
    const { data, error } = await supabase
      .from('albums')
      .select(`
        *,
        creator:profiles!created_by (*)
      `)
      .eq('visibility', 'visible')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching albums:', error);
      return [];
    }

    if (!data) return [];

    // Get count of media in each album & cover photo URL
    const albumsWithStats = await Promise.all(
      data.map(async (album) => {
        const { count } = await supabase
          .from('media')
          .select('id', { count: 'exact', head: true })
          .eq('album_id', album.id)
          .eq('visibility', 'visible');

        let coverUrl: string | null = null;
        if (album.cover_media_id) {
          const { data: coverMedia } = await supabase
            .from('media')
            .select('storage_path')
            .eq('id', album.cover_media_id)
            .maybeSingle();

          if (coverMedia) {
            const { data: urlData } = supabase.storage.from('media').getPublicUrl(coverMedia.storage_path);
            coverUrl = urlData.publicUrl;
          }
        }

        return {
          ...album,
          media_count: count || 0,
          cover_url: coverUrl,
        } as Album;
      })
    );

    return albumsWithStats;
  },

  async createAlbum(title: string, description: string, userId: string): Promise<{ data?: Album; error?: string }> {
    const { data, error } = await supabase
      .from('albums')
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        created_by: userId,
        visibility: 'visible',
      })
      .select()
      .single();

    if (error) return { error: error.message };

    // Log Activity
    await supabase.from('activity_logs').insert({
      user_id: userId,
      action_type: 'create_album',
      action_details: { album_id: data.id, title },
    });

    return { data: data as Album };
  },

  // Realtime subscription helper
  subscribeToMediaChanges(onUpdate: () => void) {
    const channel = supabase
      .channel('public-media-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'media' },
        () => onUpdate()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'media_likes' },
        () => onUpdate()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'media_dislikes' },
        () => onUpdate()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments' },
        () => onUpdate()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
