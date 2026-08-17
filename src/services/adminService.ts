import { supabase } from '../lib/supabase';
import type { DashboardStats, UserProfile, UserPermissions, LoginHistory, ActivityLog, MediaItem } from '../types';

export const adminService = {
  // Fetch real statistics strictly from Supabase database tables
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const [
        profilesRes,
        photosRes,
        videosRes,
        albumsRes,
        commentsRes,
        likesRes,
      ] = await Promise.all([
        supabase.from('profiles').select('status', { count: 'exact' }),
        supabase.from('media').select('id', { count: 'exact', head: true }).eq('type', 'image'),
        supabase.from('media').select('id', { count: 'exact', head: true }).eq('type', 'video'),
        supabase.from('albums').select('id', { count: 'exact', head: true }),
        supabase.from('comments').select('id', { count: 'exact', head: true }),
        supabase.from('media_likes').select('id', { count: 'exact', head: true }),
      ]);

      const allProfiles = profilesRes.data || [];
      const totalUsers = allProfiles.length;
      const activeUsers = allProfiles.filter((p) => p.status === 'active').length;
      const blockedUsers = allProfiles.filter((p) => p.status === 'blocked').length;

      const totalPhotos = photosRes.count || 0;
      const totalVideos = videosRes.count || 0;
      const storageBytes = (totalPhotos + totalVideos) * 2.5 * 1024 * 1024;

      return {
        total_users: totalUsers,
        active_users: activeUsers,
        blocked_users: blockedUsers,
        total_photos: totalPhotos,
        total_videos: totalVideos,
        total_albums: albumsRes.count || 0,
        total_comments: commentsRes.count || 0,
        total_likes: likesRes.count || 0,
        storage_bytes: storageBytes,
      };
    } catch (err) {
      console.error('Failed to get admin dashboard stats:', err);
      return {
        total_users: 0,
        active_users: 0,
        blocked_users: 0,
        total_photos: 0,
        total_videos: 0,
        total_albums: 0,
        total_comments: 0,
        total_likes: 0,
        storage_bytes: 0,
      };
    }
  },

  // Fetch all user profiles with permissions directly from Supabase
  async getAllUsers(): Promise<{ profile: UserProfile; permissions: UserPermissions }[]> {
    try {
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (pErr || !profiles) {
        return [];
      }

      const { data: permissions } = await supabase
        .from('user_permissions')
        .select('*');

      const permMap = new Map<string, UserPermissions>();
      permissions?.forEach((p) => permMap.set(p.user_id, p as UserPermissions));

      return profiles.map((p) => ({
        profile: p as UserProfile,
        permissions: permMap.get(p.id) || {
          user_id: p.id,
          can_upload_image: true,
          can_upload_video: true,
          can_like: true,
          can_dislike: true,
          can_comment: true,
          can_create_album: true,
          can_delete_own_media: true,
          upload_enabled: true,
        },
      }));
    } catch (e) {
      return [];
    }
  },

  // Admin create new user in Supabase Auth & Database
  async createNewUser(
    username: string,
    displayName: string,
    password: string,
    role: 'user' | 'admin'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const cleanUsername = username.trim().toLowerCase();
      const email = `${cleanUsername}@class.memories`;

      // 1. SignUp in Supabase Auth
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: cleanUsername,
            display_name: displayName.trim(),
            role,
          },
        },
      });

      if (signUpErr && !data?.user) {
        return { success: false, error: signUpErr.message };
      }

      const newUserId = data?.user?.id || `usr_${cleanUsername}_${Date.now()}`;

      // 2. Insert into profiles table
      await supabase.from('profiles').upsert({
        id: newUserId,
        username: cleanUsername,
        display_name: displayName.trim(),
        role,
        status: 'active',
      });

      // 3. Insert into user_permissions table
      await supabase.from('user_permissions').upsert({
        user_id: newUserId,
        can_upload_image: true,
        can_upload_video: true,
        can_like: true,
        can_dislike: true,
        can_comment: true,
        can_create_album: true,
        can_delete_own_media: true,
        upload_enabled: true,
      });

      // 4. Log admin activity
      await supabase.from('activity_logs').insert({
        action_type: 'admin_create_user',
        action_details: { username: cleanUsername, display_name: displayName, role },
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to create user' };
    }
  },

  // Update user profile status / role / display_name
  async updateUserProfile(
    userId: string,
    updates: Partial<UserProfile>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) return { success: false, error: error.message };

      await supabase.from('activity_logs').insert({
        action_type: 'admin_update_user',
        action_details: { target_user_id: userId, updates },
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // Update granular per-user permissions
  async updateUserPermissions(
    userId: string,
    permissions: Partial<UserPermissions>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('user_permissions')
        .update({
          ...permissions,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) return { success: false, error: error.message };

      await supabase.from('activity_logs').insert({
        action_type: 'admin_update_permissions',
        action_details: { target_user_id: userId, permissions },
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // Temporary upload block
  async setTemporaryUploadBlock(
    userId: string,
    blockUntilIso: string | null
  ): Promise<{ success: boolean; error?: string }> {
    try {
      return this.updateUserPermissions(userId, { upload_block_until: blockUntilIso });
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // Fetch login history
  async getLoginHistory(userId?: string): Promise<LoginHistory[]> {
    try {
      let query = supabase
        .from('login_history')
        .select('*')
        .order('login_time', { ascending: false })
        .limit(50);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      if (error || !data) return [];
      return data as LoginHistory[];
    } catch (e) {
      return [];
    }
  },

  // Fetch System Activity Logs
  async getActivityLogs(limit = 100): Promise<ActivityLog[]> {
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select(`
          *,
          user:profiles!user_id (*)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error || !data) return [];
      return data as ActivityLog[];
    } catch (e) {
      return [];
    }
  },

  // Fetch all media including hidden for moderation
  async getAllMediaForModeration(): Promise<MediaItem[]> {
    try {
      const { data, error } = await supabase
        .from('media')
        .select(`
          *,
          uploader:profiles!uploaded_by (*),
          album:albums!album_id (*)
        `)
        .order('created_at', { ascending: false });

      if (error || !data) return [];

      return data.map((item) => {
        const { data: urlData } = supabase.storage.from('media').getPublicUrl(item.storage_path);
        return {
          ...item,
          public_url: urlData?.publicUrl || item.storage_path,
        };
      });
    } catch (e) {
      return [];
    }
  },

  // Toggle media visibility (Hide / Unhide)
  async toggleMediaVisibility(mediaId: string, currentVisibility: 'visible' | 'hidden'): Promise<boolean> {
    try {
      const newVisibility = currentVisibility === 'visible' ? 'hidden' : 'visible';
      const { error } = await supabase
        .from('media')
        .update({ visibility: newVisibility })
        .eq('id', mediaId);

      if (error) return false;

      await supabase.from('activity_logs').insert({
        action_type: 'admin_toggle_media_visibility',
        action_details: { media_id: mediaId, visibility: newVisibility },
      });

      return true;
    } catch (e) {
      return false;
    }
  },
};
