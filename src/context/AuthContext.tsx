import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { UserProfile, UserPermissions } from '../types';

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

      // 1. Fetch Profile from Supabase
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (profileData) {
        if (profileData.status === 'blocked') {
          await supabase.auth.signOut();
          setUser(null);
          setSession(null);
          setProfile(null);
          setPermissions(null);
          setLoading(false);
          return;
        }
        setProfile(profileData as UserProfile);
      } else {
        // Create profile if missing
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

      // 2. Fetch Permissions from Supabase
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfileAndPermissions(session.user);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfileAndPermissions(session.user);
      } else {
        setProfile(null);
        setPermissions(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (usernameOrEmail: string, password: string) => {
    try {
      let username = usernameOrEmail.trim();
      let email = username;
      if (!email.includes('@')) {
        email = `${username}@class.memories`;
      } else {
        username = email.split('@')[0];
      }

      // 1. Try standard sign-in
      let { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // 2. Auto-provision account on fresh Supabase project if user does not exist yet
      if (
        error &&
        (error.message.toLowerCase().includes('invalid login credentials') ||
          error.message.toLowerCase().includes('user not found'))
      ) {
        const role = username === 'admin' ? 'admin' : 'user';
        const displayName =
          username === 'admin'
            ? 'Class Admin'
            : username.charAt(0).toUpperCase() + username.slice(1);

        const signUpRes = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username,
              display_name: displayName,
              role,
            },
          },
        });

        if (signUpRes.data.user) {
          const retry = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (!retry.error) {
            data = retry.data;
            error = null;
          } else if (signUpRes.data.session) {
            data = { user: signUpRes.data.user, session: signUpRes.data.session };
            error = null;
          }
        }
      }

      if (error) {
        return { error: error.message };
      }

      if (data?.user) {
        await fetchProfileAndPermissions(data.user);
      }

      return {};
    } catch (err: any) {
      return { error: err.message || 'Login failed' };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
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
