-- Phase 1 Migration: Storage Buckets & Storage Security Policies

-- Insert Storage Buckets into storage.buckets if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('media', 'media', false, 104857600, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']),
    ('profile-images', 'profile-images', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE 
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage Security Policies for 'media' bucket
CREATE POLICY "Authenticated active users read media bucket"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'media' 
    AND public.is_active_user()
);

CREATE POLICY "Permitted users upload to media bucket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'media' 
    AND public.is_active_user()
    AND (
        public.is_admin() 
        OR EXISTS (
            SELECT 1 FROM public.user_permissions perm
            WHERE perm.user_id = auth.uid()
              AND perm.upload_enabled = true
              AND (perm.upload_block_until IS NULL OR perm.upload_block_until <= timezone('utc'::text, now()))
        )
    )
);

CREATE POLICY "Owner or admin delete from media bucket"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'media'
    AND (
        public.is_admin() 
        OR (auth.uid() = owner AND public.is_active_user())
    )
);

-- Storage Security Policies for 'profile-images' bucket
CREATE POLICY "Authenticated users read profile-images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'profile-images');

CREATE POLICY "Users upload own profile image"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'profile-images' 
    AND public.is_active_user()
);

CREATE POLICY "Users update own profile image"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'profile-images' 
    AND (auth.uid() = owner OR public.is_admin())
);
