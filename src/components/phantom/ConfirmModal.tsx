import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, X, HelpCircle, Flame } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger',
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  // Global event listener to support fluent keyboard workflows
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.code === 'Escape') {
        e.preventDefault();
        onCancel();
      }
      if (e.key === 'Enter' || e.code === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onConfirm, onCancel]);

  if (!isOpen) return null;

  // Visual highlights and badges matching the specified transaction type
  const getThemeStyles = () => {
    switch (type) {
      case 'danger':
        return {
          icon: <Trash2 className="h-6 w-6 text-rose-400 font-bold" />,
          accentBg: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
          confirmBtn: 'bg-rose-600 hover:bg-rose-500 focus:ring-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.35)]',
          borderAccent: 'border-rose-500/20'
        };
      case 'warning':
        return {
          icon: <Flame className="h-6 w-6 text-amber-400" />,
          accentBg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
          confirmBtn: 'bg-amber-600 hover:bg-amber-500 focus:ring-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)]',
          borderAccent: 'border-amber-500/20'
        };
      case 'info':
      default:
        return {
          icon: <HelpCircle className="h-6 w-6 text-blue-400" />,
          accentBg: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
          confirmBtn: 'bg-blue-600 hover:bg-blue-500 focus:ring-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.35)]',
          borderAccent: 'border-blue-500/20'
        };
    }
  };

  const theme = getThemeStyles();

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-fade-in"
      onClick={onCancel}
    >
      <div 
        id="confirm-modal-wrapper"
        className={`w-full max-w-md bg-card border ${theme.borderAccent} rounded-xl p-6 shadow-xl scale-100 transition-all duration-200 transform`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start space-x-4">
          <div className={`p-3 rounded-xl border shrink-0 ${theme.accentBg}`}>
            {theme.icon}
          </div>
          
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-sans font-bold text-base text-foreground tracking-tight uppercase">
                {title}
              </h3>
              <button 
                onClick={onCancel}
                className="rounded-lg p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                title="Cancel and dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <p className="text-xs leading-relaxed text-muted-foreground font-sans">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end space-x-3 border-t border-border pt-4 font-sans">
          <button
            type="button"
            onClick={onCancel}
            className="phantom-footer-btn px-4 py-2 text-xs"
          >
            {cancelText}
          </button>
          
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition duration-150 active:scale-95 cursor-pointer flex items-center gap-1.5 ${theme.confirmBtn}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
