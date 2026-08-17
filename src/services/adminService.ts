import { supabase } from '../lib/supabase';
import type { DashboardStats, UserProfile, UserPermissions, LoginHistory, ActivityLog, MediaItem } from '../types';

export const adminService = {
  // Fetch real statistics from Supabase database tables
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

      // Calculate approximate storage usage from storage objects metadata or count
      const totalMediaCount = (photosRes.count || 0) + (videosRes.count || 0);
      const storageBytes = totalMediaCount * 2.5 * 1024 * 1024; // Estimated avg 2.5MB per media

      return {
        total_users: totalUsers,
        active_users: activeUsers,
        blocked_users: blockedUsers,
        total_photos: photosRes.count || 0,
        total_videos: videosRes.count || 0,
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

  // Fetch all user profiles with permissions
  async getAllUsers(): Promise<{ profile: UserProfile; permissions: UserPermissions }[]> {
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (pErr) {
      console.error('Error fetching users:', pErr);
      return [];
    }

    const { data: permissions, error: permErr } = await supabase
      .from('user_permissions')
      .select('*');

    if (permErr) {
      console.error('Error fetching permissions:', permErr);
    }

    const permMap = new Map<string, UserPermissions>();
    permissions?.forEach((p) => permMap.set(p.user_id, p as UserPermissions));

    return (profiles || []).map((p) => ({
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
  },

  // Update user profile status / role / display_name
  async updateUserProfile(
    userId: string,
    updates: Partial<UserProfile>
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) return { success: false, error: error.message };

    // Log admin action
    await supabase.from('activity_logs').insert({
      action_type: 'admin_update_user',
      action_details: { target_user_id: userId, updates },
    });

    return { success: true };
  },

  // Update granular per-user permissions
  async updateUserPermissions(
    userId: string,
    permissions: Partial<UserPermissions>
  ): Promise<{ success: boolean; error?: string }> {
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
  },

  // Temporary upload block
  async setTemporaryUploadBlock(
    userId: string,
    blockUntilIso: string | null
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from('user_permissions')
      .update({
        upload_block_until: blockUntilIso,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) return { success: false, error: error.message };

    await supabase.from('activity_logs').insert({
      action_type: 'admin_set_upload_block',
      action_details: { target_user_id: userId, upload_block_until: blockUntilIso },
    });

    return { success: true };
  },

  // Fetch login history
  async getLoginHistory(userId?: string): Promise<LoginHistory[]> {
    let query = supabase
      .from('login_history')
      .select('*')
      .order('login_time', { ascending: false })
      .limit(50);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching login history:', error);
      return [];
    }

    return (data || []) as LoginHistory[];
  },

  // Fetch System Activity Logs
  async getActivityLogs(limit = 100): Promise<ActivityLog[]> {
    const { data, error } = await supabase
      .from('activity_logs')
      .select(`
        *,
        user:profiles!user_id (*)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching activity logs:', error);
      return [];
    }

    return (data || []) as ActivityLog[];
  },

  // Fetch all media including hidden for moderation
  async getAllMediaForModeration(): Promise<MediaItem[]> {
    const { data, error } = await supabase
      .from('media')
      .select(`
        *,
        uploader:profiles!uploaded_by (*),
        album:albums!album_id (*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching media for moderation:', error);
      return [];
    }

    return (data || []).map((item) => {
      const { data: urlData } = supabase.storage.from('media').getPublicUrl(item.storage_path);
      return {
        ...item,
        public_url: urlData.publicUrl,
      };
    });
  },

  // Toggle media visibility (Hide / Unhide)
  async toggleMediaVisibility(mediaId: string, currentVisibility: 'visible' | 'hidden'): Promise<boolean> {
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
  },
};
