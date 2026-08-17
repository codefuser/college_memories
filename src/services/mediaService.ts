import { supabase } from '../lib/supabase';
import type { MediaItem, Album, Comment } from '../types';

export const mediaService = {
  // Fetch class media with options & fail-safe error handling
  async getMedia(options?: {
    type?: 'image' | 'video' | 'all';
    albumId?: string;
    userId?: string;
    currentUserId?: string;
  }): Promise<MediaItem[]> {
    try {
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

      if (error || !data || data.length === 0) {
        return [];
      }

      const mediaIds = data.map((item) => item.id);

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

      const likesMap: Record<string, number> = {};
      (likesRes as any).data?.forEach((l: any) => {
        likesMap[l.media_id] = (likesMap[l.media_id] || 0) + 1;
      });

      const dislikesMap: Record<string, number> = {};
      (dislikesRes as any).data?.forEach((d: any) => {
        dislikesMap[d.media_id] = (dislikesMap[d.media_id] || 0) + 1;
      });

      const commentsMap: Record<string, number> = {};
      (commentsRes as any).data?.forEach((c: any) => {
        commentsMap[c.media_id] = (commentsMap[c.media_id] || 0) + 1;
      });

      const userLikesSet = new Set((userLikesRes as any).data?.map((ul: any) => ul.media_id) || []);
      const userDislikesSet = new Set((userDislikesRes as any).data?.map((ud: any) => ud.media_id) || []);

      return data.map((item) => {
        const { data: urlData } = supabase.storage.from('media').getPublicUrl(item.storage_path);
        
        return {
          ...item,
          public_url: urlData?.publicUrl || item.storage_path,
          likes_count: likesMap[item.id] || 0,
          dislikes_count: dislikesMap[item.id] || 0,
          comments_count: commentsMap[item.id] || 0,
          user_has_liked: userLikesSet.has(item.id),
          user_has_disliked: userDislikesSet.has(item.id),
        };
      });
    } catch (err) {
      console.warn('Media query warning:', err);
      return [];
    }
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
        await supabase.storage.from('media').remove([filePath]).catch(() => {});
        return { error: dbError.message };
      }

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
      const { data: existingLike } = await supabase
        .from('media_likes')
        .select('id')
        .eq('media_id', mediaId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existingLike) {
        await supabase.from('media_likes').delete().eq('id', existingLike.id);
      } else {
        await supabase
          .from('media_dislikes')
          .delete()
          .eq('media_id', mediaId)
          .eq('user_id', userId);

        const { error } = await supabase.from('media_likes').insert({
          media_id: mediaId,
          user_id: userId,
        });

        if (error) return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // Toggle Dislike
  async toggleDislike(mediaId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: existingDislike } = await supabase
        .from('media_dislikes')
        .select('id')
        .eq('media_id', mediaId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existingDislike) {
        await supabase.from('media_dislikes').delete().eq('id', existingDislike.id);
      } else {
        await supabase
          .from('media_likes')
          .delete()
          .eq('media_id', mediaId)
          .eq('user_id', userId);

        const { error } = await supabase.from('media_dislikes').insert({
          media_id: mediaId,
          user_id: userId,
        });

        if (error) return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // Comments CRUD
  async getComments(mediaId: string): Promise<Comment[]> {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          user:profiles!user_id (*)
        `)
        .eq('media_id', mediaId)
        .order('created_at', { ascending: true });

      if (error || !data) return [];
      return data as Comment[];
    } catch (e) {
      return [];
    }
  },

  async addComment(mediaId: string, userId: string, content: string): Promise<{ data?: Comment; error?: string }> {
    try {
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
      return { data: data as Comment };
    } catch (e: any) {
      return { error: e.message };
    }
  },

  async deleteComment(commentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.from('comments').delete().eq('id', commentId);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  // Delete Media
  async deleteMedia(mediaId: string, storagePath: string): Promise<{ success: boolean; error?: string }> {
    try {
      await supabase.storage.from('media').remove([storagePath]).catch(() => {});
      const { error } = await supabase.from('media').delete().eq('id', mediaId);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // Albums CRUD
  async getAlbums(): Promise<Album[]> {
    try {
      const { data, error } = await supabase
        .from('albums')
        .select(`
          *,
          creator:profiles!created_by (*)
        `)
        .eq('visibility', 'visible')
        .order('created_at', { ascending: false });

      if (error || !data) return [];
      return data as Album[];
    } catch (e) {
      return [];
    }
  },

  async createAlbum(title: string, description: string, userId: string): Promise<{ data?: Album; error?: string }> {
    try {
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
      return { data: data as Album };
    } catch (e: any) {
      return { error: e.message };
    }
  },

  // Realtime subscription helper
  subscribeToMediaChanges(onUpdate: () => void) {
    try {
      const channel = supabase
        .channel('public-media-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'media' },
          () => onUpdate()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (e) {
      return () => {};
    }
  },
};
