import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, AlertCircle, X, ShieldAlert } from 'lucide-react';
import { Modal } from '../common/Modal';
import type { Album } from '../../types';
import { mediaService } from '../../services/mediaService';
import { useAuth } from '../../context/AuthContext';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
}) => {
  const { user, profile, permissions, isAdmin, canUploadImage, canUploadVideo, isUploadTemporarilyBlocked } =
    useAuth();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video'>('image');
  const [caption, setCaption] = useState('');
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('');
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadAlbums();
      resetForm();
    }
  }, [isOpen]);

  const loadAlbums = async () => {
    const albumList = await mediaService.getAlbums();
    setAlbums(albumList);
  };

  const resetForm = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setCaption('');
    setSelectedAlbumId('');
    setUploadProgress(0);
    setIsUploading(false);
    setErrorMessage(null);
  };

  const handleFileSelect = (file: File) => {
    setErrorMessage(null);

    // Determine type
    const isImg = file.type.startsWith('image/');
    const isVid = file.type.startsWith('video/');

    if (!isImg && !isVid) {
      setErrorMessage('Unsupported file format. Please upload an Image or Video.');
      return;
    }

    const type: 'image' | 'video' = isImg ? 'image' : 'video';

    // 1. Permission checks before allowing preview
    if (!isAdmin) {
      if (profile?.status === 'blocked') {
        setErrorMessage('Your account is blocked. You cannot upload media.');
        return;
      }
      if (!permissions?.upload_enabled) {
        setErrorMessage('Upload functionality has been disabled for your account by the admin.');
        return;
      }
      if (isUploadTemporarilyBlocked()) {
        const blockUntil = permissions?.upload_block_until
          ? new Date(permissions.upload_block_until).toLocaleString()
          : 'a later time';
        setErrorMessage(`Uploads are temporarily blocked until ${blockUntil}.`);
        return;
      }
      if (type === 'image' && !canUploadImage()) {
        setErrorMessage('You do not have permission to upload photos.');
        return;
      }
      if (type === 'video' && !canUploadVideo()) {
        setErrorMessage('You do not have permission to upload videos.');
        return;
      }
    }

    // 2. File Size Checks
    const maxImgSize = 10 * 1024 * 1024; // 10MB
    const maxVidSize = 100 * 1024 * 1024; // 100MB
    if (type === 'image' && file.size > maxImgSize) {
      setErrorMessage('Image size exceeds maximum limit of 10MB.');
      return;
    }
    if (type === 'video' && file.size > maxVidSize) {
      setErrorMessage('Video size exceeds maximum limit of 100MB.');
      return;
    }

    setSelectedFile(file);
    setFileType(type);

    // Create object URL for preview
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !user) return;

    setIsUploading(true);
    setErrorMessage(null);

    const result = await mediaService.uploadFile(
      selectedFile,
      fileType,
      caption,
      selectedAlbumId || null,
      user.id,
      (progress) => setUploadProgress(progress)
    );

    setIsUploading(false);

    if (result.error) {
      setErrorMessage(result.error);
    } else {
      onUploadSuccess();
      onClose();
    }
  };

  const isUploadAllowed = canUploadImage() || canUploadVideo() || isAdmin;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Memory to Class Gallery" maxWidth="lg">
      {!isUploadAllowed ? (
        <div className="py-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h4 className="text-base font-semibold text-amber-200">Upload Permission Disabled</h4>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            You do not currently have permission to upload photos or videos. If you believe this is an error, please contact the class administrator.
          </p>
        </div>
      ) : (
        <form onSubmit={handleUploadSubmit} className="space-y-5">
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Dropzone or Preview */}
          {!selectedFile ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950/80'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 mx-auto flex items-center justify-center mb-3">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-200">
                Click or drag & drop photo/video here
              </p>
              <p className="text-xs text-slate-500 mt-1">
                PNG, JPG, MP4, WEBM up to 100MB
              </p>
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 aspect-video flex items-center justify-center">
              {fileType === 'video' ? (
                <video src={previewUrl!} controls className="max-h-56 w-full object-contain" />
              ) : (
                <img src={previewUrl!} alt="Upload preview" className="max-h-56 w-full object-contain" />
              )}
              <button
                type="button"
                onClick={resetForm}
                className="absolute top-2 right-2 p-1.5 bg-slate-900/80 text-slate-300 hover:text-white rounded-full backdrop-blur-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Caption Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Caption</label>
            <textarea
              rows={2}
              placeholder="Add a meaningful caption or story for this memory..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Album Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Add to Album (Optional)</label>
            <select
              value={selectedAlbumId}
              onChange={(e) => setSelectedAlbumId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">No Album (General Feed)</option>
              {albums.map((album) => (
                <option key={album.id} value={album.id}>
                  {album.title}
                </option>
              ))}
            </select>
          </div>

          {/* Progress Bar */}
          {isUploading && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Uploading to Supabase Storage...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-500 h-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
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
              disabled={!selectedFile || isUploading}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-all shadow-md shadow-indigo-600/20"
            >
              {isUploading ? 'Uploading...' : 'Publish Memory'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
