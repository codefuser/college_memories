# Private College Class Memories App (Phase 1)

A private, modern, secure digital memory capsule application designed specifically for a college class (supporting 1 Admin + 3 Demo users initially, architected to seamlessly scale to 68+ class members).

Built with **React 18**, **TypeScript**, **Vite**, **Tailwind CSS**, and **Supabase** (Auth, PostgreSQL, Storage, Realtime, and Row Level Security).

---

## 1. Project Overview

This app is **not** a public social media platform. Only authenticated and authorized class members can view memories, photos, videos, albums, and leave comments/reactions.

### Key Features:
- **Authentication & Role System**: Real Supabase Auth enforcing two roles: `admin` and `user`. Automatically redirects admins to the Admin Dashboard and users to the Class Feed.
- **Granular Per-User Security Permissions**: Database-enforced permissions (`can_upload_image`, `can_upload_video`, `can_like`, `can_dislike`, `can_comment`, `can_create_album`, `can_delete_own_media`, `upload_enabled`, `upload_block_until`). Admin can toggle any permission per user.
- **User Blocking & Hiding**: Admin can block users (instantly terminating access and server-side operations) or hide users.
- **Temporary Upload Block**: Set an expiration timestamp after which upload permissions automatically reactivate.
- **Media System**: Image & Video uploads, metadata management, lazy loading, album organization, lightboxes, and realtime stream updates.
- **Likes & Dislikes**: Database-enforced single like/dislike per user with unique constraints.
- **Comments Feed**: Realtime comments on media with author details and moderation options.
- **Admin System & Dashboard**: Live overview statistics (Users, Photos, Videos, Albums, Comments, Likes, Storage usage), User Management Console, Media Moderation console, and System Audit Logs.

---

## 2. Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS (v4), Lucide React icons.
- **Backend & Database**: Supabase (PostgreSQL, Auth, Storage, Realtime, RLS).
- **Hosting**: Prepared for Vercel deployment and PWA/Android wrapping.

---

## 3. Demo Credentials

The system includes pre-configured demo credentials for testing:

| Role | Username | Email Identity | Default Password |
|---|---|---|---|
| **Admin** | `admin` | `admin@class.memories` | `Admin123!` |
| **Demo User 1** | `user1` | `user1@class.memories` | `User123!` |
| **Demo User 2** | `user2` | `user2@class.memories` | `User234!` |
| **Demo User 3** | `user3` | `user3@class.memories` | `User345!` |

*Note: The login UI supports entering either plain username (e.g. `admin`, `user1`) or full email address.*

---

## 4. Local Setup Instructions

### Prerequisites:
- Node.js (v18+)
- npm (v9+)
- A Supabase Project (Free tier at [supabase.com](https://supabase.com))

### 1. Clone & Install Dependencies
```bash
npm install
```

### 2. Environment Variables Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your Supabase Project details:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

---

## 5. Supabase Setup & Database Migrations

### 1. Run Schema Migration
In your Supabase SQL Editor, execute the contents of:
- `supabase/migrations/20260818000000_init_schema.sql`

This creates:
- `profiles`, `user_permissions`, `albums`, `media`, `media_likes`, `media_dislikes`, `comments`, `login_history`, `activity_logs` tables.
- Security validator functions (`is_admin()`, `is_active_user()`, `check_user_can_upload()`, `check_user_can_comment()`, `check_user_can_like()`, `check_user_can_dislike()`).
- Row Level Security (RLS) policies on all tables.
- Automatic profile creation trigger on signup.

### 2. Setup Storage Buckets
Execute the contents of:
- `supabase/migrations/20260818000001_storage_setup.sql`

This initializes private storage buckets:
- `media`: Private photo & video storage bucket.
- `profile-images`: Profile avatar image bucket.

### 3. Seed Demo Data
Execute:
- `supabase/seed.sql`

This populates the default Admin and 3 Demo users with permissions and default class albums.

---

## 6. Running & Building the Application

### Development Mode:
```bash
npm run dev
```

### Type Checking & Build Verification:
```bash
npx tsc --noEmit
npm run build
```

### Preview Production Build:
```bash
npm run preview
```

---

## 7. Vercel Deployment Guide

1. Push this repository to GitHub/GitLab.
2. Import the project into your Vercel Dashboard.
3. Set Environment Variables in Vercel:
   - `VITE_SUPABASE_URL`: Your Supabase URL.
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon Key.
4. Deploy! Vercel will automatically run `npm run build` and output the `dist` folder.

---

## 8. Future Android Packaging (Capacitor / PWA)

To wrap this application into a native Android APK:
1. Install Capacitor CLI: `npm install -D @capacitor/core @capacitor/cli @capacitor/android`
2. Initialize Capacitor: `npx cap init ClassMemories com.class.memories --web-dir dist`
3. Build web asset bundle: `npm run build`
4. Add Android platform: `npx cap add android`
5. Open in Android Studio: `npx cap open android`
