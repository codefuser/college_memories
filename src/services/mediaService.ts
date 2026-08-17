import { supabase } from '../lib/supabase';
import type { MediaItem, Album, Comment } from '../types';

const generateUniqueId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `med_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

export const mediaService = {
  // Fetch REAL class media EXCLUSIVELY from Supabase Database & Storage
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

      // Fetch user's active likes & dislikes from Supabase
      let userLikesSet = new Set<string>();
      let userDislikesSet = new Set<string>();

      if (options?.currentUserId) {
        const [likesRes, dislikesRes] = await Promise.all([
          supabase.from('media_likes').select('media_id').eq('user_id', options.currentUserId),
          supabase.from('media_dislikes').select('media_id').eq('user_id', options.currentUserId),
        ]);

        likesRes.data?.forEach((l) => userLikesSet.add(l.media_id));
        dislikesRes.data?.forEach((d) => userDislikesSet.add(d.media_id));
      }

      // Resolve Supabase Storage URLs & count reactions from Supabase DB
      const resolvedMediaItems = await Promise.all(
        data.map(async (item) => {
          const { data: urlData } = supabase.storage.from('media').getPublicUrl(item.storage_path);
          let publicUrl = urlData?.publicUrl || '';

          if (!publicUrl || publicUrl.includes('placeholder')) {
            const { data: signedData } = await supabase.storage
              .from('media')
              .createSignedUrl(item.storage_path, 3600);
            publicUrl = signedData?.signedUrl || publicUrl;
          }

          const [likesCountRes, dislikesCountRes, commentsCountRes] = await Promise.all([
            supabase.from('media_likes').select('id', { count: 'exact', head: true }).eq('media_id', item.id),
            supabase.from('media_dislikes').select('id', { count: 'exact', head: true }).eq('media_id', item.id),
            supabase.from('comments').select('id', { count: 'exact', head: true }).eq('media_id', item.id),
          ]);

          const normalizedType: 'image' | 'video' =
            item.type === 'video' || item.type?.includes('video') ? 'video' : 'image';

          return {
            ...item,
            type: normalizedType,
            public_url: publicUrl,
            likes_count: likesCountRes.count || 0,
            dislikes_count: dislikesCountRes.count || 0,
            comments_count: commentsCountRes.count || 0,
            user_has_liked: userLikesSet.has(item.id),
            user_has_disliked: userDislikesSet.has(item.id),
          } as MediaItem;
        })
      );

      return resolvedMediaItems;
    } catch (err) {
      console.error('Failed to get media from Supabase:', err);
      return [];
    }
  },

  // Upload file directly to Supabase Storage & insert row into Supabase PostgreSQL media table
  async uploadFile(
    file: File,
    type: 'image' | 'video',
    caption: string,
    albumId: string | null,
    userId: string,
    onProgress?: (progress: number) => void
  ): Promise<{ data?: MediaItem; error?: string }> {
    try {
      if (onProgress) onProgress(10); // Stage 1: Permission Check

      const { data: perm } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (perm) {
        if (!perm.upload_enabled) {
          return { error: 'Upload permission has been disabled for your account.' };
        }
        if (type === 'image' && !perm.can_upload_image) {
          return { error: 'Image upload permission is disabled for your account.' };
        }
        if (type === 'video' && !perm.can_upload_video) {
          return { error: 'Video upload permission is disabled for your account.' };
        }
        if (perm.upload_block_until && new Date(perm.upload_block_until).getTime() > Date.now()) {
          return { error: `Uploads are blocked until ${new Date(perm.upload_block_until).toLocaleString()}.` };
        }
      }

      if (onProgress) onProgress(30); // Stage 2: Storage Upload

      const uniqueMediaId = generateUniqueId();
      const year = new Date().getFullYear();
      const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
      const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${userId}/${year}/${month}/${uniqueMediaId}-${safeFileName}`;

      const normalizedType: 'image' | 'video' =
        file.type.startsWith('video/') || type === 'video' ? 'video' : 'image';

      // 1. Upload actual file to Supabase Storage bucket 'media'
      const { data: storageData, error: storageError } = await supabase.storage
        .from('media')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        });

      if (storageError || !storageData) {
        console.error('Supabase Storage upload error:', storageError);
        return { error: `Upload failed. Your file was not saved to Supabase storage: ${storageError?.message}` };
      }

      if (onProgress) onProgress(70); // Stage 3: DB Insert

      // 2. Insert metadata row into Supabase PostgreSQL 'media' table
      const { data: dbData, error: dbError } = await supabase
        .from('media')
        .insert({
          id: uniqueMediaId,
          uploaded_by: userId,
          type: normalizedType,
          storage_path: storageData.path,
          caption: caption.trim() || null,
          album_id: albumId || null,
          visibility: 'visible',
        })
        .select(`
          *,
          uploader:profiles!uploaded_by (*),
          album:albums!album_id (*)
        `)
        .single();

      if (dbError || !dbData) {
        console.error('Supabase DB insert error:', dbError);
        // Clean up storage object if DB insert fails
        await supabase.storage.from('media').remove([storageData.path]).catch(() => {});
        return { error: `File uploaded to storage, but database metadata could not be saved: ${dbError?.message}` };
      }

      if (onProgress) onProgress(90); // Stage 4: URL Resolution

      const { data: urlData } = supabase.storage.from('media').getPublicUrl(dbData.storage_path);
      let finalUrl = urlData?.publicUrl || '';

      if (!finalUrl || finalUrl.includes('placeholder')) {
        const { data: signedData } = await supabase.storage
          .from('media')
          .createSignedUrl(dbData.storage_path, 3600);
        finalUrl = signedData?.signedUrl || finalUrl;
      }

      if (onProgress) onProgress(100);

      const createdItem: MediaItem = {
        ...dbData,
        type: normalizedType,
        public_url: finalUrl,
        likes_count: 0,
        dislikes_count: 0,
        comments_count: 0,
        user_has_liked: false,
        user_has_disliked: false,
      };

      return { data: createdItem };
    } catch (err: any) {
      console.error('Upload exception:', err);
      return { error: err.message || 'File upload failed' };
    }
  },

  // Toggle Like directly in Supabase table media_likes
  async toggleLike(mediaId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: existing } = await supabase
        .from('media_likes')
        .select('id')
        .eq('media_id', mediaId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        await supabase.from('media_likes').delete().eq('id', existing.id);
      } else {
        await supabase
          .from('media_dislikes')
          .delete()
          .eq('media_id', mediaId)
          .eq('user_id', userId);

        await supabase.from('media_likes').insert({
          media_id: mediaId,
          user_id: userId,
        });
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // Toggle Dislike directly in Supabase table media_dislikes
  async toggleDislike(mediaId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: existing } = await supabase
        .from('media_dislikes')
        .select('id')
        .eq('media_id', mediaId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        await supabase.from('media_dislikes').delete().eq('id', existing.id);
      } else {
        await supabase
          .from('media_likes')
          .delete()
          .eq('media_id', mediaId)
          .eq('user_id', userId);

        await supabase.from('media_dislikes').insert({
          media_id: mediaId,
          user_id: userId,
        });
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // Comments CRUD strictly on Supabase table comments
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

      if (error || !data) return { error: error?.message || 'Failed to add comment' };
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

  // Delete Media directly from Supabase Storage & Database
  async deleteMedia(mediaId: string, storagePath: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error: dbError } = await supabase.from('media').delete().eq('id', mediaId);
      if (dbError) return { success: false, error: dbError.message };

      if (storagePath) {
        await supabase.storage.from('media').remove([storagePath]).catch(() => {});
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // Albums CRUD strictly on Supabase table albums
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

      const albumsWithCount = await Promise.all(
        data.map(async (album) => {
          const { count } = await supabase
            .from('media')
            .select('id', { count: 'exact', head: true })
            .eq('album_id', album.id)
            .eq('visibility', 'visible');

          return {
            ...album,
            media_count: count || 0,
          } as Album;
        })
      );

      return albumsWithCount;
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
        .select(`
          *,
          creator:profiles!created_by (*)
        `)
        .single();

      if (error || !data) return { error: error?.message || 'Failed to create album' };
      return { data: data as Album };
    } catch (e: any) {
      return { error: e.message };
    }
  },

  subscribeToMediaChanges(_onUpdate: () => void) {
    return () => {};
  },
};
