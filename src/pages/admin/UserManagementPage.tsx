import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/adminService';
import type { UserProfile, UserPermissions, LoginHistory } from '../../types';
import { Modal } from '../../components/common/Modal';
import {
  Users,
  UserCheck,
  UserX,
  EyeOff,
  Eye,
  Edit3,
  History,
  UserPlus,
  AlertCircle,
} from 'lucide-react';

export const UserManagementPage: React.FC = () => {
  const [usersList, setUsersList] = useState<{ profile: UserProfile; permissions: UserPermissions }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<{ profile: UserProfile; permissions: UserPermissions } | null>(null);

  // Modals state
  const [isPermModalOpen, setIsPermModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // History state
  const [loginHistory, setLoginHistory] = useState<LoginHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Form states for permission tuning & block
  const [tempPermissions, setTempPermissions] = useState<Partial<UserPermissions>>({});
  const [tempBlockDate, setTempBlockDate] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Form states for Create User
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const data = await adminService.getAllUsers();
    setUsersList(data);
    setLoading(false);
  };

  const handleOpenPermissions = (userItem: { profile: UserProfile; permissions: UserPermissions }) => {
    setSelectedUser(userItem);
    setTempPermissions({ ...userItem.permissions });
    setTempBlockDate(
      userItem.permissions.upload_block_until
        ? new Date(userItem.permissions.upload_block_until).toISOString().slice(0, 16)
        : ''
    );
    setIsPermModalOpen(true);
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) return;
    setIsSaving(true);

    const blockIso = tempBlockDate ? new Date(tempBlockDate).toISOString() : null;

    await Promise.all([
      adminService.updateUserPermissions(selectedUser.profile.id, tempPermissions),
      adminService.setTemporaryUploadBlock(selectedUser.profile.id, blockIso),
    ]);

    setIsSaving(false);
    setIsPermModalOpen(false);
    fetchUsers();
  };

  const handleToggleBlock = async (profile: UserProfile) => {
    const newStatus = profile.status === 'blocked' ? 'active' : 'blocked';
    if (!window.confirm(`Are you sure you want to ${newStatus === 'blocked' ? 'BLOCK' : 'UNBLOCK'} ${profile.display_name}?`))
      return;

    await adminService.updateUserProfile(profile.id, { status: newStatus });
    fetchUsers();
  };

  const handleToggleHide = async (profile: UserProfile) => {
    const newStatus = profile.status === 'hidden' ? 'active' : 'hidden';
    await adminService.updateUserProfile(profile.id, { status: newStatus });
    fetchUsers();
  };

  const handleToggleRole = async (profile: UserProfile) => {
    const newRole = profile.role === 'admin' ? 'user' : 'admin';
    if (!window.confirm(`Change role of ${profile.display_name} to ${newRole.toUpperCase()}?`)) return;
    await adminService.updateUserProfile(profile.id, { role: newRole });
    fetchUsers();
  };

  const handleViewLoginHistory = async (userItem: { profile: UserProfile; permissions: UserPermissions }) => {
    setSelectedUser(userItem);
    setIsHistoryModalOpen(true);
    setLoadingHistory(true);
    const history = await adminService.getLoginHistory(userItem.profile.id);
    setLoginHistory(history);
    setLoadingHistory(false);
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newDisplayName.trim() || !newPassword) return;

    setIsCreating(true);
    setCreateError(null);

    const res = await adminService.createNewUser(
      newUsername,
      newDisplayName,
      newPassword,
      newRole
    );

    setIsCreating(false);

    if (res.error) {
      setCreateError(res.error);
    } else {
      setIsCreateModalOpen(false);
      setNewUsername('');
      setNewDisplayName('');
      setNewPassword('');
      setNewRole('user');
      fetchUsers();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            Class Member Management & Security
          </h2>
          <p className="text-xs text-slate-400">
            Control roles, user statuses, and individual security permissions
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-md shadow-indigo-600/20 active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          <span>Create New Member</span>
        </button>
      </div>

      {/* Users Table */}
      {loading ? (
        <p className="text-xs text-slate-500">Loading user database...</p>
      ) : (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Member</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Last Login</th>
                  <th className="py-3.5 px-4">Upload Privileges</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {usersList.map(({ profile, permissions }) => {
                  const isBlocked = profile.status === 'blocked';
                  const isHidden = profile.status === 'hidden';
                  const tempBlocked =
                    permissions.upload_block_until &&
                    new Date(permissions.upload_block_until).getTime() > Date.now();

                  return (
                    <tr key={profile.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* User Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold overflow-hidden">
                            {profile.profile_photo ? (
                              <img src={profile.profile_photo} alt={profile.display_name} className="w-full h-full object-cover" />
                            ) : (
                              profile.display_name[0]
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-white">{profile.display_name}</div>
                            <div className="text-[10px] text-slate-500">@{profile.username}</div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleToggleRole(profile)}
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase border ${
                            profile.role === 'admin'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {profile.role}
                        </button>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-semibold text-[10px] uppercase inline-flex items-center gap-1 border ${
                            isBlocked
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                              : isHidden
                              ? 'bg-slate-700/40 text-slate-400 border-slate-600'
                              : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                          }`}
                        >
                          {isBlocked ? (
                            <>
                              <UserX className="w-3 h-3" /> BLOCKED
                            </>
                          ) : isHidden ? (
                            <>
                              <EyeOff className="w-3 h-3" /> HIDDEN
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3 h-3" /> ACTIVE
                            </>
                          )}
                        </span>
                      </td>

                      {/* Last Login */}
                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {profile.last_login_at
                          ? new Date(profile.last_login_at).toLocaleString()
                          : 'Never'}
                      </td>

                      {/* Permissions Summary */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-1.5 text-[10px]">
                          <span
                            className={`px-1.5 py-0.5 rounded ${
                              permissions.can_upload_image
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            IMG: {permissions.can_upload_image ? 'ON' : 'OFF'}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded ${
                              permissions.can_upload_video
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            VID: {permissions.can_upload_video ? 'ON' : 'OFF'}
                          </span>
                          {tempBlocked && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                              TEMP BLOCK
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleOpenPermissions({ profile, permissions })}
                            className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/40 border border-indigo-500/30"
                            title="Tune Permissions & Upload Block"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleViewLoginHistory({ profile, permissions })}
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                            title="View Login History"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleToggleHide(profile)}
                            className={`p-1.5 rounded-lg border ${
                              isHidden
                                ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                            title={isHidden ? 'Unhide User' : 'Hide User'}
                          >
                            {isHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            onClick={() => handleToggleBlock(profile)}
                            className={`p-1.5 rounded-lg border ${
                              isBlocked
                                ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30'
                                : 'bg-rose-600/20 text-rose-400 border-rose-500/30'
                            }`}
                            title={isBlocked ? 'Unblock User' : 'Block User'}
                          >
                            {isBlocked ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create New User Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Class Member"
        maxWidth="md"
      >
        <form onSubmit={handleCreateUserSubmit} className="space-y-4">
          {createError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{createError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name / Display Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. John Doe"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Username *</label>
            <input
              type="text"
              required
              placeholder="e.g. johndoe or user4"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Password *</label>
            <input
              type="password"
              required
              placeholder="Initial account password (min 6 chars)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Role</label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as 'user' | 'admin')}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="user">Class Member (User)</option>
              <option value="admin">Administrator (Admin)</option>
            </select>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !newUsername.trim() || !newDisplayName.trim() || !newPassword}
              className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md disabled:opacity-50 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>{isCreating ? 'Creating...' : 'Create Account'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Permissions & Block Settings Modal */}
      <Modal
        isOpen={isPermModalOpen}
        onClose={() => setIsPermModalOpen(false)}
        title={`Security Settings: ${selectedUser?.profile.display_name}`}
        maxWidth="lg"
      >
        <div className="space-y-5">
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
            <h4 className="text-xs font-bold text-white">Granular Permission Toggles</h4>
            <p className="text-[11px] text-slate-400">
              Enforced server-side via Supabase Row Level Security (RLS)
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-200">Image Upload Allowed</span>
              <input
                type="checkbox"
                checked={tempPermissions.can_upload_image ?? true}
                onChange={(e) =>
                  setTempPermissions({ ...tempPermissions, can_upload_image: e.target.checked })
                }
                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-600"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-200">Video Upload Allowed</span>
              <input
                type="checkbox"
                checked={tempPermissions.can_upload_video ?? true}
                onChange={(e) =>
                  setTempPermissions({ ...tempPermissions, can_upload_video: e.target.checked })
                }
                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-600"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-200">Commenting Allowed</span>
              <input
                type="checkbox"
                checked={tempPermissions.can_comment ?? true}
                onChange={(e) =>
                  setTempPermissions({ ...tempPermissions, can_comment: e.target.checked })
                }
                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-600"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-200">Liking Allowed</span>
              <input
                type="checkbox"
                checked={tempPermissions.can_like ?? true}
                onChange={(e) =>
                  setTempPermissions({ ...tempPermissions, can_like: e.target.checked })
                }
                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-600"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-200">Album Creation Allowed</span>
              <input
                type="checkbox"
                checked={tempPermissions.can_create_album ?? true}
                onChange={(e) =>
                  setTempPermissions({ ...tempPermissions, can_create_album: e.target.checked })
                }
                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-600"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-200">Delete Own Media</span>
              <input
                type="checkbox"
                checked={tempPermissions.can_delete_own_media ?? true}
                onChange={(e) =>
                  setTempPermissions({ ...tempPermissions, can_delete_own_media: e.target.checked })
                }
                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-600"
              />
            </label>
          </div>

          <div className="pt-3 border-t border-slate-800 space-y-2">
            <label className="block text-xs font-semibold text-amber-300">
              Temporary Upload Block Expiration
            </label>
            <input
              type="datetime-local"
              value={tempBlockDate}
              onChange={(e) => setTempBlockDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            />
            <p className="text-[11px] text-slate-500">
              Uploads will be automatically re-enabled after this date/time. Leave blank for no block.
            </p>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              onClick={() => setIsPermModalOpen(false)}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSavePermissions}
              disabled={isSaving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md"
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Login History Modal */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={`Login History: ${selectedUser?.profile.display_name}`}
        maxWidth="lg"
      >
        <div className="space-y-4 max-h-[380px] overflow-y-auto">
          {loadingHistory ? (
            <p className="text-xs text-slate-500">Loading session history...</p>
          ) : loginHistory.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No recorded login history for this user.</p>
          ) : (
            <div className="space-y-2">
              {loginHistory.map((item) => (
                <div key={item.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs flex justify-between items-center">
                  <div>
                    <div className="text-slate-200 font-medium">{item.device_info || 'Unknown Device'}</div>
                    <div className="text-[10px] text-slate-500 truncate max-w-xs">{item.browser_info}</div>
                  </div>
                  <div className="text-right text-[10px] text-slate-400">
                    <div>{new Date(item.login_time).toLocaleDateString()}</div>
                    <div>{new Date(item.login_time).toLocaleTimeString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
