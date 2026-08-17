-- Seed Script for College Class Memories App
-- Note: This creates default Auth users and initial Albums.

-- Enable extensions if needed
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Helper to safely create demo user in auth.users if not present
DO $$
DECLARE
    v_admin_id UUID := '00000000-0000-0000-0000-000000000001';
    v_user1_id UUID := '00000000-0000-0000-0000-000000000002';
    v_user2_id UUID := '00000000-0000-0000-0000-000000000003';
    v_user3_id UUID := '00000000-0000-0000-0000-000000000004';
BEGIN
    -- 1. Create Admin Auth User
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@class.memories') THEN
        INSERT INTO auth.users (
            id, instance_id, email, encrypted_password, email_confirmed_at, 
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
        ) VALUES (
            v_admin_id, '00000000-0000-0000-0000-000000000000', 'admin@class.memories',
            crypt('Admin123!', gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}',
            '{"username":"admin","display_name":"Class Admin","role":"admin"}',
            now(), now(), 'authenticated', 'authenticated'
        );
    END IF;

    -- 2. Create User 1 Auth User
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'user1@class.memories') THEN
        INSERT INTO auth.users (
            id, instance_id, email, encrypted_password, email_confirmed_at, 
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
        ) VALUES (
            v_user1_id, '00000000-0000-0000-0000-000000000000', 'user1@class.memories',
            crypt('User123!', gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}',
            '{"username":"user1","display_name":"Alex Johnson","role":"user"}',
            now(), now(), 'authenticated', 'authenticated'
        );
    END IF;

    -- 3. Create User 2 Auth User
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'user2@class.memories') THEN
        INSERT INTO auth.users (
            id, instance_id, email, encrypted_password, email_confirmed_at, 
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
        ) VALUES (
            v_user2_id, '00000000-0000-0000-0000-000000000000', 'user2@class.memories',
            crypt('User234!', gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}',
            '{"username":"user2","display_name":"Sarah Chen","role":"user"}',
            now(), now(), 'authenticated', 'authenticated'
        );
    END IF;

    -- 4. Create User 3 Auth User
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'user3@class.memories') THEN
        INSERT INTO auth.users (
            id, instance_id, email, encrypted_password, email_confirmed_at, 
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
        ) VALUES (
            v_user3_id, '00000000-0000-0000-0000-000000000000', 'user3@class.memories',
            crypt('User345!', gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}',
            '{"username":"user3","display_name":"Michael Scott","role":"user"}',
            now(), now(), 'authenticated', 'authenticated'
        );
    END IF;

    -- Ensure profiles role & permissions are set correctly
    UPDATE public.profiles SET role = 'admin', display_name = 'Class Admin' WHERE username = 'admin';
    UPDATE public.profiles SET display_name = 'Alex Johnson' WHERE username = 'user1';
    UPDATE public.profiles SET display_name = 'Sarah Chen' WHERE username = 'user2';
    UPDATE public.profiles SET display_name = 'Michael Scott' WHERE username = 'user3';

    -- Seed Default Albums
    INSERT INTO public.albums (id, title, description, created_by, visibility)
    VALUES 
        ('11111111-1111-1111-1111-111111111111', 'Freshman Orientation', 'Memories from our first week together on campus!', v_admin_id, 'visible'),
        ('22222222-2222-2222-2222-222222222222', 'Campus Hackathon 2025', 'Coding late into the night, coffee cups everywhere.', v_user1_id, 'visible'),
        ('33333333-3333-3333-3333-333333333333', 'Class Graduation & Farewell', 'Looking back on our journey together.', v_admin_id, 'visible')
    ON CONFLICT (id) DO NOTHING;

END $$;
