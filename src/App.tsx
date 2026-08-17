import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MediaProvider, useMedia } from './context/MediaContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { MobileNav } from './components/layout/MobileNav';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { MemoriesPage } from './pages/MemoriesPage';
import { AlbumsPage } from './pages/AlbumsPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { UserManagementPage } from './pages/admin/UserManagementPage';
import { MediaModerationPage } from './pages/admin/MediaModerationPage';
import { ActivityLogsPage } from './pages/admin/ActivityLogsPage';
import { UploadModal } from './components/media/UploadModal';
import { ShieldAlert, Loader2 } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, profile, loading, isAdmin, isBlocked } = useAuth();
  const { isUploadOpen, closeUpload } = useMedia();
  const [currentTab, setCurrentTab] = useState<string>('feed');

  // Automatic Role-based Navigation Routing
  useEffect(() => {
    if (profile) {
      if (profile.role === 'admin' && currentTab === 'feed') {
        setCurrentTab('admin-dashboard');
      } else if (profile.role === 'user' && currentTab.startsWith('admin-')) {
        setCurrentTab('feed');
      }
    }
  }, [profile?.role]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-xs font-semibold tracking-wider uppercase">Loading Class Memories...</p>
      </div>
    );
  }

  // Unauthenticated -> Show Login
  if (!user || !profile) {
    return <LoginPage />;
  }

  // Account Blocked Guard
  if (isBlocked) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-14 h-14 rounded-3xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Account Access Blocked</h2>
        <p className="text-xs text-slate-400 max-w-sm">
          Your account has been restricted by the class administrator. You cannot view memories or perform actions until unblocked.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Top Navbar */}
      <Navbar />

      <div className="flex-1 max-w-7xl w-full mx-auto flex">
        {/* Desktop Sidebar */}
        <Sidebar currentTab={currentTab} onTabChange={(t) => setCurrentTab(t)} />

        {/* Main Content View Container with DOM preservation for 0ms tab switching */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-20 lg:pb-8 max-w-full overflow-x-hidden">
          <div className={currentTab === 'feed' ? 'block' : 'hidden'}>
            <DashboardPage />
          </div>

          <div className={currentTab === 'memories' ? 'block' : 'hidden'}>
            <MemoriesPage />
          </div>

          <div className={currentTab === 'albums' ? 'block' : 'hidden'}>
            <AlbumsPage />
          </div>

          <div className={currentTab === 'profile' ? 'block' : 'hidden'}>
            <ProfilePage />
          </div>

          {isAdmin && (
            <>
              <div className={currentTab === 'admin-dashboard' ? 'block' : 'hidden'}>
                <AdminDashboardPage onNavigateTab={(t) => setCurrentTab(t)} />
              </div>

              <div className={currentTab === 'admin-users' ? 'block' : 'hidden'}>
                <UserManagementPage />
              </div>

              <div className={currentTab === 'admin-media' ? 'block' : 'hidden'}>
                <MediaModerationPage />
              </div>

              <div className={currentTab === 'admin-logs' ? 'block' : 'hidden'}>
                <ActivityLogsPage />
              </div>
            </>
          )}
        </main>
      </div>

      {/* Shared Global Upload Modal */}
      <UploadModal isOpen={isUploadOpen} onClose={closeUpload} />

      {/* Mobile Bottom Navigation Bar */}
      <MobileNav currentTab={currentTab} onTabChange={(t) => setCurrentTab(t)} />
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <MediaProvider>
        <AppContent />
      </MediaProvider>
    </AuthProvider>
  );
}

export default App;
