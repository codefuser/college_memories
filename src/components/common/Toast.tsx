import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastProps {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  onClose: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ id, type, message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [id, onClose]);

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
    error: <AlertCircle className="w-5 h-5 text-rose-400" />,
    info: <Info className="w-5 h-5 text-indigo-400" />,
  };

  const borderColors = {
    success: 'border-emerald-500/30 bg-emerald-950/40 text-emerald-100',
    error: 'border-rose-500/30 bg-rose-950/40 text-rose-100',
    info: 'border-indigo-500/30 bg-indigo-950/40 text-indigo-100',
  };

  return (
    <div className={`flex items-center justify-between p-4 rounded-xl border backdrop-blur-lg shadow-xl min-w-[280px] max-w-md animate-slide-in ${borderColors[type]}`}>
      <div className="flex items-center space-x-3">
        {icons[type]}
        <p className="text-sm font-medium">{message}</p>
      </div>
      <button
        onClick={() => onClose(id)}
        className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors ml-4"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
