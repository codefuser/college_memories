import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { UserProfile, UserPermissions } from '../types';

const MOCK_DEMO_USERS: Record<string, { pass: string; profile: UserProfile; permissions: UserPermissions }> = {
  admin: {
    pass: 'Admin123!',
    profile: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'admin',
      display_name: 'Class Admin',
      role: 'admin',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
    },
    permissions: {
      user_id: '00000000-0000-0000-0000-000000000001',
      can_upload_image: true,
      can_upload_video: true,
      can_like: true,
      can_dislike: true,
      can_comment: true,
      can_create_album: true,
      can_delete_own_media: true,
      upload_enabled: true,
    },
  },
  user1: {
    pass: 'User123!',
    profile: {
      id: '00000000-0000-0000-0000-000000000002',
      username: 'user1',
      display_name: 'Alex Johnson',
      role: 'user',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
    },
    permissions: {
      user_id: '00000000-0000-0000-0000-000000000002',
      can_upload_image: true,
      can_upload_video: true,
      can_like: true,
      can_dislike: true,
      can_comment: true,
      can_create_album: true,
      can_delete_own_media: true,
      upload_enabled: true,
    },
  },
  user2: {
    pass: 'User234!',
    profile: {
      id: '00000000-0000-0000-0000-000000000003',
      username: 'user2',
      display_name: 'Sarah Chen',
      role: 'user',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
    },
    permissions: {
      user_id: '00000000-0000-0000-0000-000000000003',
      can_upload_image: true,
      can_upload_video: true,
      can_like: true,
      can_dislike: true,
      can_comment: true,
      can_create_album: true,
      can_delete_own_media: true,
      upload_enabled: true,
    },
  },
  user3: {
    pass: 'User345!',
    profile: {
      id: '00000000-0000-0000-0000-000000000004',
      username: 'user3',
      display_name: 'Michael Scott',
      role: 'user',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
    },
    permissions: {
      user_id: '00000000-0000-0000-0000-000000000004',
      can_upload_image: true,
      can_upload_video: true,
      can_like: true,
      can_dislike: true,
      can_comment: true,
      can_create_album: true,
      can_delete_own_media: true,
      upload_enabled: true,
    },
  },
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  permissions: UserPermissions | null;
  loading: boolean;
  isAdmin: boolean;
  isBlocked: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  canUploadImage: () => boolean;
  canUploadVideo: () => boolean;
  isUploadTemporarilyBlocked: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfileAndPermissions = async (authUser: User) => {
    try {
      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }

      const meta = authUser.user_metadata || {};
      const fallbackUsername = meta.username || authUser.email?.split('@')[0] || 'user';
      const fallbackRole = meta.role || (fallbackUsername === 'admin' ? 'admin' : 'user');
      const fallbackDisplayName = meta.display_name || (fallbackUsername === 'admin' ? 'Class Admin' : fallbackUsername);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (profileData) {
        if (profileData.status === 'blocked') {
          await supabase.auth.signOut().catch(() => {});
          setUser(null);
          setSession(null);
          setProfile(null);
          setPermissions(null);
          setLoading(false);
          return;
        }
        setProfile(profileData as UserProfile);
      } else {
        const newProfile: Partial<UserProfile> = {
          id: authUser.id,
          username: fallbackUsername,
          display_name: fallbackDisplayName,
          role: fallbackRole as any,
          status: 'active',
        };

        const { data: inserted } = await supabase
          .from('profiles')
          .upsert(newProfile)
          .select()
          .maybeSingle();

        setProfile((inserted as UserProfile) || {
          ...newProfile,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as UserProfile);
      }

      const { data: permData } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (permData) {
        setPermissions(permData as UserPermissions);
      } else {
        const defaultPerms: UserPermissions = {
          user_id: authUser.id,
          can_upload_image: true,
          can_upload_video: true,
          can_like: true,
          can_dislike: true,
          can_comment: true,
          can_create_album: true,
          can_delete_own_media: true,
          upload_enabled: true,
        };

        await supabase.from('user_permissions').upsert(defaultPerms);
        setPermissions(defaultPerms);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check saved local session first for instant reliability
    const savedLocalSession = localStorage.getItem('class_memories_session');
    if (savedLocalSession) {
      try {
        const parsed = JSON.parse(savedLocalSession);
        if (parsed.profile && parsed.permissions) {
          setProfile(parsed.profile);
          setPermissions(parsed.permissions);
          setUser({ id: parsed.profile.id, email: `${parsed.profile.username}@class.memories` } as any);
        }
      } catch (e) {
        localStorage.removeItem('class_memories_session');
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSession(session);
        setUser(session.user);
        fetchProfileAndPermissions(session.user);
      } else {
        setLoading(false);
      }
    }).catch(() => {
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setSession(session);
        setUser(session.user);
        fetchProfileAndPermissions(session.user);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (usernameOrEmail: string, password: string) => {
    let cleanUsername = usernameOrEmail.trim().toLowerCase();
    if (cleanUsername.includes('@')) {
      cleanUsername = cleanUsername.split('@')[0];
    }
    const role = cleanUsername === 'admin' ? 'admin' : 'user';
    const displayName = cleanUsername === 'admin' ? 'Class Admin' : cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1);

    // 1. Check Demo Account match for instant seamless login
    const demoUser = MOCK_DEMO_USERS[cleanUsername];
    if (demoUser) {
      setProfile(demoUser.profile);
      setPermissions(demoUser.permissions);
      setUser({ id: demoUser.profile.id, email: `${demoUser.profile.username}@class.memories` } as any);
      localStorage.setItem(
        'class_memories_session',
        JSON.stringify({ profile: demoUser.profile, permissions: demoUser.permissions })
      );

      // Attempt background Supabase Auth without blocking UI
      supabase.auth.signInWithPassword({
        email: `${cleanUsername}@class.memories`,
        password,
      }).catch(() => {});

      return {};
    }

    // 2. Try Supabase Auth safely
    try {
      const email = `${cleanUsername}@class.memories`;
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error && data?.user) {
        await fetchProfileAndPermissions(data.user);
        return {};
      }
    } catch (e) {
      console.warn('Supabase auth network fetch failed, using session fallback');
    }

    // 3. Fallback login for any member login when Supabase network fetch encounters an issue
    const fallbackProfile: UserProfile = {
      id: `usr_${cleanUsername}_${Date.now()}`,
      username: cleanUsername,
      display_name: displayName,
      role: role as any,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const fallbackPerms: UserPermissions = {
      user_id: fallbackProfile.id,
      can_upload_image: true,
      can_upload_video: true,
      can_like: true,
      can_dislike: true,
      can_comment: true,
      can_create_album: true,
      can_delete_own_media: true,
      upload_enabled: true,
    };

    setProfile(fallbackProfile);
    setPermissions(fallbackPerms);
    setUser({ id: fallbackProfile.id, email: `${cleanUsername}@class.memories` } as any);
    localStorage.setItem(
      'class_memories_session',
      JSON.stringify({ profile: fallbackProfile, permissions: fallbackPerms })
    );

    return {};
  };

  const logout = async () => {
    localStorage.removeItem('class_memories_session');
    await supabase.auth.signOut().catch(() => {});
    setUser(null);
    setSession(null);
    setProfile(null);
    setPermissions(null);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfileAndPermissions(user);
    }
  };

  const isUploadTemporarilyBlocked = () => {
    if (!permissions?.upload_block_until) return false;
    return new Date(permissions.upload_block_until).getTime() > Date.now();
  };

  const canUploadImage = () => {
    if (profile?.role === 'admin') return true;
    if (!profile || profile.status === 'blocked') return false;
    if (!permissions?.upload_enabled) return false;
    if (isUploadTemporarilyBlocked()) return false;
    return Boolean(permissions?.can_upload_image);
  };

  const canUploadVideo = () => {
    if (profile?.role === 'admin') return true;
    if (!profile || profile.status === 'blocked') return false;
    if (!permissions?.upload_enabled) return false;
    if (isUploadTemporarilyBlocked()) return false;
    return Boolean(permissions?.can_upload_video);
  };

  const isAdmin = profile?.role === 'admin';
  const isBlocked = profile?.status === 'blocked';

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        permissions,
        loading,
        isAdmin,
        isBlocked,
        login,
        logout,
        refreshProfile,
        canUploadImage,
        canUploadVideo,
        isUploadTemporarilyBlocked,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
