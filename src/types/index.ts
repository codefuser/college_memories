export type UserRole = 'admin' | 'user';
export type UserStatus = 'active' | 'blocked' | 'hidden';
export type MediaType = 'image' | 'video';
export type VisibilityType = 'visible' | 'hidden';

export interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  profile_photo?: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
  last_login_at?: string | null;
}

export interface UserPermissions {
  user_id: string;
  can_upload_image: boolean;
  can_upload_video: boolean;
  can_like: boolean;
  can_dislike: boolean;
  can_comment: boolean;
  can_create_album: boolean;
  can_delete_own_media: boolean;
  upload_enabled: boolean;
  upload_block_until?: string | null;
  updated_at?: string;
}

export interface Album {
  id: string;
  title: string;
  description?: string | null;
  cover_media_id?: string | null;
  created_by?: string | null;
  visibility: VisibilityType;
  created_at: string;
  updated_at: string;
  creator?: UserProfile | null;
  media_count?: number;
  cover_url?: string | null;
}

export interface MediaItem {
  id: string;
  uploaded_by: string;
  type: MediaType;
  storage_path: string;
  thumbnail_path?: string | null;
  caption?: string | null;
  album_id?: string | null;
  visibility: VisibilityType;
  created_at: string;
  updated_at: string;
  
  // Expanded & Calculated fields
  public_url?: string;
  uploader?: UserProfile | null;
  album?: Album | null;
  likes_count?: number;
  dislikes_count?: number;
  comments_count?: number;
  user_has_liked?: boolean;
  user_has_disliked?: boolean;
}

export interface MediaLike {
  id: string;
  media_id: string;
  user_id: string;
  created_at: string;
}

export interface MediaDislike {
  id: string;
  media_id: string;
  user_id: string;
  created_at: string;
}

export interface Comment {
  id: string;
  media_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user?: UserProfile | null;
}

export interface LoginHistory {
  id: string;
  user_id: string;
  login_time: string;
  logout_time?: string | null;
  device_info?: string | null;
  browser_info?: string | null;
  ip_address?: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id?: string | null;
  action_type: string;
  action_details?: Record<string, any> | null;
  created_at: string;
  user?: UserProfile | null;
}

export interface DashboardStats {
  total_users: number;
  active_users: number;
  blocked_users: number;
  total_photos: number;
  total_videos: number;
  total_albums: number;
  total_comments: number;
  total_likes: number;
  storage_bytes: number;
}
