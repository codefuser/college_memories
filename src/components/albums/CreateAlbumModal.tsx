import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { mediaService } from '../../services/mediaService';
import { useAuth } from '../../context/AuthContext';
import { FolderPlus, AlertCircle } from 'lucide-react';

interface CreateAlbumModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAlbumCreated: () => void;
}

export const CreateAlbumModal: React.FC<CreateAlbumModalProps> = ({
  isOpen,
  onClose,
  onAlbumCreated,
}) => {
  const { user, profile, permissions, isAdmin } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreateAlbum = isAdmin || (profile?.status !== 'blocked' && permissions?.can_create_album);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user) return;

    setIsSubmitting(true);
    setError(null);

    const { data, error: err } = await mediaService.createAlbum(title, description, user.id);
    setIsSubmitting(false);

    if (err) {
      setError(err);
    } else if (data) {
      setTitle('');
      setDescription('');
      onAlbumCreated();
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Class Album" maxWidth="md">
      {!canCreateAlbum ? (
        <div className="py-6 text-center space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
            <AlertCircle className="w-5 h-5" />
          </div>
          <p className="text-xs text-slate-300">
            You do not have permission to create new class albums. Contact an admin to request access.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Album Title *</label>
            <input
              type="text"
              required
              placeholder="e.g., Spring Trip 2025, Senior Farewell, Lab Projects"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Description (Optional)</label>
            <textarea
              rows={3}
              placeholder="Brief description of what this album represents..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-all shadow-md shadow-indigo-600/20"
            >
              <FolderPlus className="w-4 h-4" />
              <span>{isSubmitting ? 'Creating...' : 'Create Album'}</span>
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
