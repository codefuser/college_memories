import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
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
import { ShieldAlert, Loader2 } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, profile, loading, isAdmin, isBlocked } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('feed');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);

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

  const renderTabContent = () => {
    switch (currentTab) {
      case 'feed':
        return (
          <DashboardPage
            searchQuery={searchQuery}
            isUploadOpen={isUploadOpen}
            onCloseUpload={() => setIsUploadOpen(false)}
            onOpenUpload={() => setIsUploadOpen(true)}
          />
        );
      case 'memories':
        return <MemoriesPage searchQuery={searchQuery} />;
      case 'albums':
        return <AlbumsPage />;
      case 'profile':
        return <ProfilePage />;
      case 'admin-dashboard':
        return isAdmin ? (
          <AdminDashboardPage onNavigateTab={(t) => setCurrentTab(t)} />
        ) : (
          <DashboardPage
            searchQuery={searchQuery}
            isUploadOpen={isUploadOpen}
            onCloseUpload={() => setIsUploadOpen(false)}
            onOpenUpload={() => setIsUploadOpen(true)}
          />
        );
      case 'admin-users':
        return isAdmin ? <UserManagementPage /> : null;
      case 'admin-media':
        return isAdmin ? <MediaModerationPage /> : null;
      case 'admin-logs':
        return isAdmin ? <ActivityLogsPage /> : null;
      default:
        return (
          <DashboardPage
            searchQuery={searchQuery}
            isUploadOpen={isUploadOpen}
            onCloseUpload={() => setIsUploadOpen(false)}
            onOpenUpload={() => setIsUploadOpen(true)}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Top Navbar */}
      <Navbar
        onOpenUpload={() => setIsUploadOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={(q) => setSearchQuery(q)}
      />

      <div className="flex-1 max-w-7xl w-full mx-auto flex">
        {/* Desktop Sidebar */}
        <Sidebar currentTab={currentTab} onTabChange={(t) => setCurrentTab(t)} />

        {/* Main Content View */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-20 lg:pb-8 max-w-full overflow-x-hidden">
          {renderTabContent()}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <MobileNav currentTab={currentTab} onTabChange={(t) => setCurrentTab(t)} />
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
