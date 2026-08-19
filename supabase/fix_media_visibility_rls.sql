-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/mffbdrrwguixmwavvefc/sql/new)

-- 1. Ensure RLS Policy allows reading all visible media for all users
DROP POLICY IF EXISTS "Active users view visible media" ON public.media;
DROP POLICY IF EXISTS "Allow reading media for all" ON public.media;

CREATE POLICY "Allow reading media for all" ON public.media
    FOR SELECT TO public USING (true);

-- 2. Ensure public reading for profiles table
DROP POLICY IF EXISTS "Allow reading profiles" ON public.profiles;
CREATE POLICY "Allow reading profiles" ON public.profiles
    FOR SELECT TO public USING (true);

-- 3. Update any hidden/null visibility rows in media table to 'visible'
UPDATE public.media SET visibility = 'visible' WHERE visibility IS NULL OR visibility = 'hidden';
