-- Phase 1 Migration: Initial Schema, Security, RLS & Seed Functions for College Memories App

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. TABLES CREATION
-- ==========================================

-- User Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    profile_photo TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'hidden')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_login_at TIMESTAMPTZ
);

-- User Permissions (Per-user granular toggles)
CREATE TABLE IF NOT EXISTS public.user_permissions (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    can_upload_image BOOLEAN NOT NULL DEFAULT true,
    can_upload_video BOOLEAN NOT NULL DEFAULT true,
    can_like BOOLEAN NOT NULL DEFAULT true,
    can_dislike BOOLEAN NOT NULL DEFAULT true,
    can_comment BOOLEAN NOT NULL DEFAULT true,
    can_create_album BOOLEAN NOT NULL DEFAULT true,
    can_delete_own_media BOOLEAN NOT NULL DEFAULT true,
    upload_enabled BOOLEAN NOT NULL DEFAULT true,
    upload_block_until TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Albums
CREATE TABLE IF NOT EXISTS public.albums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    cover_media_id UUID,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    visibility TEXT NOT NULL DEFAULT 'visible' CHECK (visibility IN ('visible', 'hidden')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Media (Photos & Videos Metadata)
CREATE TABLE IF NOT EXISTS public.media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('image', 'video')),
    storage_path TEXT NOT NULL,
    thumbnail_path TEXT,
    caption TEXT,
    album_id UUID REFERENCES public.albums(id) ON DELETE SET NULL,
    visibility TEXT NOT NULL DEFAULT 'visible' CHECK (visibility IN ('visible', 'hidden')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Foreign key for album cover_media_id AFTER media table is defined
ALTER TABLE public.albums 
    ADD CONSTRAINT fk_albums_cover_media 
    FOREIGN KEY (cover_media_id) 
    REFERENCES public.media(id) 
    ON DELETE SET NULL 
    DEFERRABLE INITIALLY DEFERRED;

-- Media Likes
CREATE TABLE IF NOT EXISTS public.media_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_id UUID NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_media_like UNIQUE (media_id, user_id)
);

-- Media Dislikes
CREATE TABLE IF NOT EXISTS public.media_dislikes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_id UUID NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_media_dislike UNIQUE (media_id, user_id)
);

-- Comments
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_id UUID NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Login History
CREATE TABLE IF NOT EXISTS public.login_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    login_time TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    logout_time TIMESTAMPTZ,
    device_info TEXT,
    browser_info TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Activity Logs
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    action_details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==========================================
-- 2. INDEXES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_media_uploaded_by ON public.media(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_media_type ON public.media(type);
CREATE INDEX IF NOT EXISTS idx_media_album_id ON public.media(album_id);
CREATE INDEX IF NOT EXISTS idx_media_visibility ON public.media(visibility);
CREATE INDEX IF NOT EXISTS idx_media_likes_media ON public.media_likes(media_id);
CREATE INDEX IF NOT EXISTS idx_media_dislikes_media ON public.media_dislikes(media_id);
CREATE INDEX IF NOT EXISTS idx_comments_media ON public.comments(media_id);
CREATE INDEX IF NOT EXISTS idx_login_history_user ON public.login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON public.activity_logs(user_id);

-- ==========================================
-- 3. SECURITY & HELPER FUNCTIONS
-- ==========================================

-- Check if current authenticated user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'admin'
          AND status = 'active'
    );
$$;

-- Check if user is active (not blocked)
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND status != 'blocked'
    );
$$;

-- Server-side upload permission validator
CREATE OR REPLACE FUNCTION public.check_user_can_upload(p_user_id UUID, p_media_type TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_status TEXT;
    v_upload_enabled BOOLEAN;
    v_type_permitted BOOLEAN;
    v_block_until TIMESTAMPTZ;
BEGIN
    -- Admins can always upload if active
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND role = 'admin' AND status = 'active') THEN
        RETURN TRUE;
    END IF;

    -- Fetch user profile & permissions
    SELECT p.status, perm.upload_enabled, perm.upload_block_until,
           CASE WHEN p_media_type = 'image' THEN perm.can_upload_image
                WHEN p_media_type = 'video' THEN perm.can_upload_video
                ELSE FALSE END
    INTO v_status, v_upload_enabled, v_block_until, v_type_permitted
    FROM public.profiles p
    JOIN public.user_permissions perm ON perm.user_id = p.id
    WHERE p.id = p_user_id;

    IF v_status = 'blocked' THEN
        RETURN FALSE;
    END IF;

    IF NOT v_upload_enabled THEN
        RETURN FALSE;
    END IF;

    IF NOT v_type_permitted THEN
        RETURN FALSE;
    END IF;

    -- Check temporary block
    IF v_block_until IS NOT NULL AND v_block_until > timezone('utc'::text, now()) THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

-- Check like permission
CREATE OR REPLACE FUNCTION public.check_user_can_like(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.user_permissions perm ON perm.user_id = p.id
        WHERE p.id = p_user_id
          AND p.status != 'blocked'
          AND (p.role = 'admin' OR perm.can_like = true)
    );
$$;

-- Check dislike permission
CREATE OR REPLACE FUNCTION public.check_user_can_dislike(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.user_permissions perm ON perm.user_id = p.id
        WHERE p.id = p_user_id
          AND p.status != 'blocked'
          AND (p.role = 'admin' OR perm.can_dislike = true)
    );
$$;

-- Check comment permission
CREATE OR REPLACE FUNCTION public.check_user_can_comment(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.user_permissions perm ON perm.user_id = p.id
        WHERE p.id = p_user_id
          AND p.status != 'blocked'
          AND (p.role = 'admin' OR perm.can_comment = true)
    );
$$;

-- Check album creation permission
CREATE OR REPLACE FUNCTION public.check_user_can_create_album(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.user_permissions perm ON perm.user_id = p.id
        WHERE p.id = p_user_id
          AND p.status != 'blocked'
          AND (p.role = 'admin' OR perm.can_create_album = true)
    );
$$;

-- Automatic trigger for user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_username TEXT;
    v_display_name TEXT;
    v_role TEXT;
BEGIN
    v_username := COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
    v_display_name := COALESCE(new.raw_user_meta_data->>'display_name', v_username);
    v_role := COALESCE(new.raw_user_meta_data->>'role', 'user');

    INSERT INTO public.profiles (id, username, display_name, role, status)
    VALUES (new.id, v_username, v_display_name, v_role, 'active')
    ON CONFLICT (id) DO UPDATE
    SET username = EXCLUDED.username,
        display_name = EXCLUDED.display_name;

    INSERT INTO public.user_permissions (user_id)
    VALUES (new.id)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Automatic updated_at timestamp refresher
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_modtime BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_permissions_modtime BEFORE UPDATE ON public.user_permissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_albums_modtime BEFORE UPDATE ON public.albums FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_media_modtime BEFORE UPDATE ON public.media FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==========================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_dislikes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- --- PROFILES POLICIES ---
CREATE POLICY "Active users can view profiles" ON public.profiles
    FOR SELECT USING (public.is_active_user());

CREATE POLICY "Users can update own display_name & photo" ON public.profiles
    FOR UPDATE USING (auth.uid() = id AND public.is_active_user())
    WITH CHECK (auth.uid() = id AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admin full access on profiles" ON public.profiles
    FOR ALL USING (public.is_admin());

-- --- PERMISSIONS POLICIES ---
CREATE POLICY "Users can view own permissions" ON public.user_permissions
    FOR SELECT USING (auth.uid() = user_id AND public.is_active_user());

CREATE POLICY "Admin full access on permissions" ON public.user_permissions
    FOR ALL USING (public.is_admin());

-- --- ALBUMS POLICIES ---
CREATE POLICY "Active users view visible albums" ON public.albums
    FOR SELECT USING (public.is_active_user() AND (visibility = 'visible' OR public.is_admin()));

CREATE POLICY "Permitted users create albums" ON public.albums
    FOR INSERT WITH CHECK (auth.uid() = created_by AND public.check_user_can_create_album(auth.uid()));

CREATE POLICY "Creators update own albums" ON public.albums
    FOR UPDATE USING (auth.uid() = created_by AND public.is_active_user());

CREATE POLICY "Admin full access on albums" ON public.albums
    FOR ALL USING (public.is_admin());

-- --- MEDIA POLICIES ---
CREATE POLICY "Active users view visible media" ON public.media
    FOR SELECT USING (public.is_active_user() AND (visibility = 'visible' OR public.is_admin() OR uploaded_by = auth.uid()));

CREATE POLICY "Permitted users upload media" ON public.media
    FOR INSERT WITH CHECK (
        auth.uid() = uploaded_by AND public.check_user_can_upload(auth.uid(), type)
    );

CREATE POLICY "Owners update own media caption/album" ON public.media
    FOR UPDATE USING (auth.uid() = uploaded_by AND public.is_active_user());

CREATE POLICY "Owners delete own media if permitted" ON public.media
    FOR DELETE USING (
        auth.uid() = uploaded_by 
        AND public.is_active_user() 
        AND EXISTS (
            SELECT 1 FROM public.user_permissions 
            WHERE user_id = auth.uid() AND can_delete_own_media = true
        )
    );

CREATE POLICY "Admin full access on media" ON public.media
    FOR ALL USING (public.is_admin());

-- --- MEDIA LIKES POLICIES ---
CREATE POLICY "Active users view likes" ON public.media_likes
    FOR SELECT USING (public.is_active_user());

CREATE POLICY "Permitted users add like" ON public.media_likes
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND public.check_user_can_like(auth.uid())
    );

CREATE POLICY "Users delete own like" ON public.media_likes
    FOR DELETE USING (auth.uid() = user_id OR public.is_admin());

-- --- MEDIA DISLIKES POLICIES ---
CREATE POLICY "Active users view dislikes" ON public.media_dislikes
    FOR SELECT USING (public.is_active_user());

CREATE POLICY "Permitted users add dislike" ON public.media_dislikes
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND public.check_user_can_dislike(auth.uid())
    );

CREATE POLICY "Users delete own dislike" ON public.media_dislikes
    FOR DELETE USING (auth.uid() = user_id OR public.is_admin());

-- --- COMMENTS POLICIES ---
CREATE POLICY "Active users view comments" ON public.comments
    FOR SELECT USING (public.is_active_user());

CREATE POLICY "Permitted users add comment" ON public.comments
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND public.check_user_can_comment(auth.uid())
    );

CREATE POLICY "Users delete own comment" ON public.comments
    FOR DELETE USING (auth.uid() = user_id OR public.is_admin());

-- --- LOGIN HISTORY POLICIES ---
CREATE POLICY "Users view own login history" ON public.login_history
    FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users insert own login record" ON public.login_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin full access on login history" ON public.login_history
    FOR ALL USING (public.is_admin());

-- --- ACTIVITY LOGS POLICIES ---
CREATE POLICY "Users view own activity logs" ON public.activity_logs
    FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users insert activity log" ON public.activity_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Admin full access on activity logs" ON public.activity_logs
    FOR ALL USING (public.is_admin());

-- ==========================================
-- 5. REALTIME PUBLICATION
-- ==========================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.media;
ALTER PUBLICATION supabase_realtime ADD TABLE public.media_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.media_dislikes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
