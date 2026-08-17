import React, { useState, useEffect } from 'react';
import { Heart, ThumbsDown, Send, Trash2, User as UserIcon, Calendar, Folder, ShieldAlert } from 'lucide-react';
import { Modal } from '../common/Modal';
import type { MediaItem, Comment } from '../../types';
import { mediaService } from '../../services/mediaService';
import { useAuth } from '../../context/AuthContext';

interface MediaDetailModalProps {
  media: MediaItem | null;
  isOpen: boolean;
  onClose: () => void;
  onLikeToggle: (mediaId: string) => void;
  onDislikeToggle: (mediaId: string) => void;
  onMediaDeleted?: (mediaId: string) => void;
}

export const MediaDetailModal: React.FC<MediaDetailModalProps> = ({
  media,
  isOpen,
  onClose,
  onLikeToggle,
  onDislikeToggle,
  onMediaDeleted,
}) => {
  const { user, profile, permissions, isAdmin } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isDeletingMedia, setIsDeletingMedia] = useState(false);

  const canComment = isAdmin || (profile?.status !== 'blocked' && permissions?.can_comment);
  const canDeleteMedia =
    isAdmin ||
    (media?.uploaded_by === user?.id &&
      profile?.status !== 'blocked' &&
      permissions?.can_delete_own_media);

  useEffect(() => {
    if (media && isOpen) {
      loadComments(media.id);
    }
  }, [media, isOpen]);

  const loadComments = async (mediaId: string) => {
    const data = await mediaService.getComments(mediaId);
    setComments(data);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!media || !user || !newComment.trim() || !canComment) return;

    setIsSubmittingComment(true);
    const { data, error } = await mediaService.addComment(media.id, user.id, newComment);
    setIsSubmittingComment(false);

    if (error) {
      alert(`Could not add comment: ${error}`);
    } else if (data) {
      setComments((prev) => [...prev, data]);
      setNewComment('');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('Delete this comment?')) return;
    const { success } = await mediaService.deleteComment(commentId);
    if (success) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    }
  };

  const handleDeleteMedia = async () => {
    if (!media) return;
    if (!window.confirm('Are you sure you want to delete this memory? This action cannot be undone.'))
      return;

    setIsDeletingMedia(true);
    const { success, error } = await mediaService.deleteMedia(media.id, media.storage_path);
    setIsDeletingMedia(false);

    if (success) {
      if (onMediaDeleted) onMediaDeleted(media.id);
      onClose();
    } else {
      alert(`Failed to delete media: ${error}`);
    }
  };

  if (!media) return null;

  const isVideo = media.type === 'video';

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="4xl">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[480px]">
        {/* Left Column: Player / Lightbox */}
        <div className="lg:col-span-7 bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-800/80 min-h-[300px]">
          {isVideo ? (
            <video
              src={media.public_url}
              controls
              autoPlay
              className="w-full h-full max-h-[500px] object-contain"
            />
          ) : (
            <img
              src={media.public_url}
              alt={media.caption || 'Memory preview'}
              className="w-full h-full max-h-[500px] object-contain"
            />
          )}
        </div>

        {/* Right Column: Metadata & Comments Feed */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
          <div>
            {/* Header info */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-semibold overflow-hidden">
                  {media.uploader?.profile_photo ? (
                    <img src={media.uploader.profile_photo} alt={media.uploader.display_name} className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">
                    {media.uploader?.display_name || 'Class Member'}
                  </h4>
                  <p className="text-[11px] text-slate-400">@{media.uploader?.username}</p>
                </div>
              </div>

              {canDeleteMedia && (
                <button
                  onClick={handleDeleteMedia}
                  disabled={isDeletingMedia}
                  className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors"
                  title="Delete media"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Caption & Metadata */}
            <div className="py-3 space-y-2">
              {media.caption && (
                <p className="text-sm text-slate-200 leading-relaxed">{media.caption}</p>
              )}
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(media.created_at).toLocaleDateString()}
                </span>
                {media.album && (
                  <span className="flex items-center gap-1 text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                    <Folder className="w-3.5 h-3.5" />
                    {media.album.title}
                  </span>
                )}
              </div>
            </div>

            {/* Reaction Bar */}
            <div className="flex items-center space-x-3 py-2 border-y border-slate-800">
              <button
                onClick={() => onLikeToggle(media.id)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  media.user_has_liked
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Heart className={`w-4 h-4 ${media.user_has_liked ? 'fill-current' : ''}`} />
                <span>{media.likes_count || 0} Likes</span>
              </button>

              <button
                onClick={() => onDislikeToggle(media.id)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  media.user_has_disliked
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <ThumbsDown className={`w-4 h-4 ${media.user_has_disliked ? 'fill-current' : ''}`} />
                <span>{media.dislikes_count || 0} Dislikes</span>
              </button>
            </div>
          </div>

          {/* Comments List */}
          <div className="flex-1 overflow-y-auto max-h-[220px] space-y-3 pr-1">
            <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Comments ({comments.length})
            </h5>
            {comments.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No comments yet. Be the first to leave a memory note!</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex items-start justify-between space-x-2 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/50">
                  <div className="flex items-start space-x-2.5">
                    <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                      {c.user?.display_name?.[0] || 'U'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-200">
                          {c.user?.display_name || 'Member'}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5">{c.content}</p>
                    </div>
                  </div>

                  {(c.user_id === user?.id || isAdmin) && (
                    <button
                      onClick={() => handleDeleteComment(c.id)}
                      className="text-slate-500 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Add Comment Input */}
          {canComment ? (
            <form onSubmit={handleAddComment} className="flex items-center space-x-2 pt-2 border-t border-slate-800">
              <input
                type="text"
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={isSubmittingComment || !newComment.trim()}
                className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium disabled:opacity-50 transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-300 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              Comments are currently disabled for your account.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
