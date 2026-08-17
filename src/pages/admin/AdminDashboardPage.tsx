import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/adminService';
import type { DashboardStats, ActivityLog } from '../../types';
import {
  Users,
  UserCheck,
  UserX,
  Image,
  Video,
  FolderHeart,
  MessageSquare,
  Heart,
  HardDrive,
  Shield,
  Activity,
  ArrowRight,
} from 'lucide-react';

interface AdminDashboardPageProps {
  onNavigateTab: (tab: string) => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ onNavigateTab }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    const [sData, aData] = await Promise.all([
      adminService.getDashboardStats(),
      adminService.getActivityLogs(8),
    ]);
    setStats(sData);
    setActivityLogs(aData);
    setLoading(false);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  const statCards = [
    { label: 'Total Users', value: stats?.total_users ?? 0, icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { label: 'Active Users', value: stats?.active_users ?? 0, icon: UserCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Blocked Users', value: stats?.blocked_users ?? 0, icon: UserX, color: 'text-rose-400', bg: 'bg-rose-500/10' },
    { label: 'Total Photos', value: stats?.total_photos ?? 0, icon: Image, color: 'text-sky-400', bg: 'bg-sky-500/10' },
    { label: 'Total Videos', value: stats?.total_videos ?? 0, icon: Video, color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { label: 'Total Albums', value: stats?.total_albums ?? 0, icon: FolderHeart, color: 'text-pink-400', bg: 'bg-pink-500/10' },
    { label: 'Total Comments', value: stats?.total_comments ?? 0, icon: MessageSquare, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Total Likes', value: stats?.total_likes ?? 0, icon: Heart, color: 'text-rose-400', bg: 'bg-rose-500/10' },
    { label: 'Storage Used', value: formatBytes(stats?.storage_bytes ?? 0), icon: HardDrive, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            Admin Overview Dashboard
          </h2>
          <p className="text-xs text-slate-400">Live metrics and security oversight powered by Supabase</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onNavigateTab('admin-users')}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold hover:bg-amber-500/30 transition-all"
          >
            Manage Users
          </button>
        </div>
      </div>

      {/* 9 Live Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-3xl flex items-center justify-between shadow-lg backdrop-blur-xl hover:border-slate-700/80 transition-all"
            >
              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-400">{card.label}</span>
                <div className="text-2xl font-black text-white">{loading ? '...' : card.value}</div>
              </div>
              <div className={`w-12 h-12 rounded-2xl ${card.bg} ${card.color} flex items-center justify-center`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Activity Section */}
      <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            Recent Class Activity Logs
          </h3>
          <button
            onClick={() => onNavigateTab('admin-logs')}
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
          >
            View All Logs <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <p className="text-xs text-slate-500">Loading activity feed...</p>
        ) : activityLogs.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No recent system activity logged yet.</p>
        ) : (
          <div className="space-y-2.5">
            {activityLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-slate-800/50 text-xs"
              >
                <div className="flex items-center space-x-3">
                  <span className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-300 font-mono text-[10px] uppercase font-bold border border-indigo-500/20">
                    {log.action_type}
                  </span>
                  <span className="text-slate-300 font-medium">
                    {log.user?.display_name || 'System / Anonymous'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500">
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
