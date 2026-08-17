-- Phase 1 Migration: Storage Buckets & Storage Security Policies

-- Insert Storage Buckets into storage.buckets if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('media', 'media', true, 104857600, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']),
    ('profile-images', 'profile-images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE 
SET public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage Security Policies for 'media' bucket
DROP POLICY IF EXISTS "Authenticated active users read media bucket" ON storage.objects;
DROP POLICY IF EXISTS "Permitted users upload to media bucket" ON storage.objects;
DROP POLICY IF EXISTS "Owner or admin delete from media bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read media bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow upload to media bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete media bucket" ON storage.objects;

CREATE POLICY "Allow public read media bucket"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'media');

CREATE POLICY "Allow upload to media bucket"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'media');

CREATE POLICY "Allow delete media bucket"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'media');

-- Storage Security Policies for 'profile-images' bucket
DROP POLICY IF EXISTS "Authenticated users read profile-images" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own profile image" ON storage.objects;
DROP POLICY IF EXISTS "Users update own profile image" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read profile-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow upload profile-images" ON storage.objects;

CREATE POLICY "Allow public read profile-images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-images');

CREATE POLICY "Allow upload profile-images"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'profile-images');
