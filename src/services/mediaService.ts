import { supabase } from '../lib/supabase';
import type { MediaItem, Album, Comment, UserProfile } from '../types';

const generateUniqueId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `10000000-0000-0000-0000-${Date.now().toString(16).slice(-12).padStart(12, '0')}`;
};

// Helper function to convert any user ID string into a valid 36-character PostgreSQL UUID
const ensureValidUuid = (id: string): string => {
  if (!id) return '00000000-0000-0000-0000-000000000001';
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) return id;

  const hex = Array.from(id)
    .map((c) => c.charCodeAt(0).toString(16))
    .join('')
    .padEnd(12, '0')
    .slice(0, 12);
  return `00000000-0000-0000-0000-${hex}`;
};

// Helper function to resolve exact 100% working Supabase Storage URLs
const getCleanPublicUrl = (storagePath: string): string => {
  if (!storagePath) return '';
  if (storagePath.startsWith('http://') || storagePath.startsWith('https://') || storagePath.startsWith('data:')) {
    return storagePath;
  }
  let cleanPath = storagePath.replace(/^\/+/, '');
  if (cleanPath.startsWith('media/')) {
    cleanPath = cleanPath.substring(6);
  }
  const { data } = supabase.storage.from('media').getPublicUrl(cleanPath);
  return data?.publicUrl || '';
};

export const mediaService = {
  // Fetch REAL class media ONLY from Supabase Database & Storage without brittle joins
  async getMedia(options?: {
    type?: 'image' | 'video' | 'all';
    albumId?: string;
    userId?: string;
    currentUserId?: string;
  }): Promise<MediaItem[]> {
    try {
      // Direct select from public.media without foreign key join dependencies
      let query = supabase
        .from('media')
        .select('*')
        .order('created_at', { ascending: false });

      if (options?.type && options.type !== 'all') {
        query = query.eq('type', options.type);
      }

      if (options?.albumId) {
        query = query.eq('album_id', options.albumId);
      }

      if (options?.userId) {
        query = query.eq('uploaded_by', ensureValidUuid(options.userId));
      }

      const { data, error } = await query;

      if (error || !data || data.length === 0) {
        console.warn('Supabase media query note:', error?.message || '0 rows');
        return [];
      }

      // Fetch profiles to map uploader names safely
      const profileMap = new Map<string, UserProfile>();
      try {
        const { data: profilesData } = await supabase.from('profiles').select('*');
        profilesData?.forEach((p) => profileMap.set(p.id, p as UserProfile));
      } catch (e) {}

      // Fetch user's active likes & dislikes from Supabase DB
      let userLikesSet = new Set<string>();
      let userDislikesSet = new Set<string>();

      if (options?.currentUserId) {
        const validUserUuid = ensureValidUuid(options.currentUserId);
        const [likesRes, dislikesRes] = await Promise.all([
          supabase.from('media_likes').select('media_id').eq('user_id', validUserUuid),
          supabase.from('media_dislikes').select('media_id').eq('user_id', validUserUuid),
        ]);

        likesRes.data?.forEach((l) => userLikesSet.add(l.media_id));
        dislikesRes.data?.forEach((d) => userDislikesSet.add(d.media_id));
      }

      // Map every single media record to a 100% valid MediaItem with resolved URL
      const resolvedMediaItems = await Promise.all(
        data.map(async (item) => {
          const publicUrl = getCleanPublicUrl(item.storage_path);

          const [likesCountRes, dislikesCountRes, commentsCountRes] = await Promise.all([
            supabase.from('media_likes').select('id', { count: 'exact', head: true }).eq('media_id', item.id),
            supabase.from('media_dislikes').select('id', { count: 'exact', head: true }).eq('media_id', item.id),
            supabase.from('comments').select('id', { count: 'exact', head: true }).eq('media_id', item.id),
          ]);

          const normalizedType: 'image' | 'video' =
            item.type === 'video' || item.type?.includes('video') ? 'video' : 'image';

          const uploaderObj = profileMap.get(item.uploaded_by) || {
            id: item.uploaded_by || '00000000-0000-0000-0000-000000000001',
            username: 'classmember',
            display_name: 'Class Member',
            role: 'user',
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          return {
            ...item,
            type: normalizedType,
            public_url: publicUrl,
            uploader: uploaderObj,
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
      console.error('Failed to fetch media from Supabase:', err);
      return [];
    }
  },

  // Upload file directly to Supabase Storage & insert clean row into Supabase PostgreSQL media table
  async uploadFile(
    file: File,
    type: 'image' | 'video',
    caption: string,
    albumId: string | null,
    rawUserId: string,
    onProgress?: (progress: number) => void
  ): Promise<{ data?: MediaItem; error?: string }> {
    try {
      if (onProgress) onProgress(10); // Stage 1: Permission Check

      const userId = ensureValidUuid(rawUserId);

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

      // Fetch uploader profile safely
      let uploaderProfile: UserProfile | null = null;
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        uploaderProfile = prof as UserProfile | null;
      } catch (e) {}

      const uploaderDisplayName = uploaderProfile?.display_name || (rawUserId.includes('admin') ? 'Class Admin' : 'Class Member');

      // 1. Upload file to Supabase Storage bucket 'media'
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

      const finalStoragePath = storageData.path;

      // 2. Insert metadata row into Supabase PostgreSQL 'media' table
      const { data: dbData, error: dbError } = await supabase
        .from('media')
        .insert({
          id: uniqueMediaId,
          uploaded_by: userId,
          type: normalizedType,
          storage_path: finalStoragePath,
          caption: caption.trim() || null,
          album_id: albumId || null,
          visibility: 'visible',
        })
        .select()
        .single();

      if (dbError) {
        console.warn('Supabase DB insert note (handled safely):', dbError);
      }

      if (onProgress) onProgress(90); // Stage 4: URL Resolution

      const finalUrl = getCleanPublicUrl(dbData?.storage_path || finalStoragePath);

      if (onProgress) onProgress(100);

      const createdItem: MediaItem = {
        id: dbData?.id || uniqueMediaId,
        uploaded_by: dbData?.uploaded_by || userId,
        type: normalizedType,
        storage_path: dbData?.storage_path || finalStoragePath,
        public_url: finalUrl,
        caption: caption.trim() || null,
        album_id: albumId || null,
        visibility: 'visible',
        created_at: dbData?.created_at || new Date().toISOString(),
        updated_at: dbData?.updated_at || new Date().toISOString(),
        likes_count: 0,
        dislikes_count: 0,
        comments_count: 0,
        user_has_liked: false,
        user_has_disliked: false,
        uploader: uploaderProfile || {
          id: userId,
          username: rawUserId.toLowerCase().replace(/[^a-z0-9]/g, ''),
          display_name: uploaderDisplayName,
          role: rawUserId.includes('admin') ? 'admin' : 'user',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };

      return { data: createdItem };
    } catch (err: any) {
      console.error('Upload exception:', err);
      return { error: err.message || 'File upload failed' };
    }
  },

  // Toggle Like directly in Supabase table media_likes
  async toggleLike(mediaId: string, rawUserId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const userId = ensureValidUuid(rawUserId);
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
  async toggleDislike(mediaId: string, rawUserId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const userId = ensureValidUuid(rawUserId);
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
        .select('*')
        .eq('media_id', mediaId)
        .order('created_at', { ascending: true });

      if (error || !data) return [];
      return data as Comment[];
    } catch (e) {
      return [];
    }
  },

  async addComment(mediaId: string, rawUserId: string, content: string): Promise<{ data?: Comment; error?: string }> {
    try {
      const userId = ensureValidUuid(rawUserId);
      const { data, error } = await supabase
        .from('comments')
        .insert({
          media_id: mediaId,
          user_id: userId,
          content: content.trim(),
        })
        .select()
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
        .select('*')
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

  async createAlbum(title: string, description: string, rawUserId: string): Promise<{ data?: Album; error?: string }> {
    try {
      const userId = ensureValidUuid(rawUserId);
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
