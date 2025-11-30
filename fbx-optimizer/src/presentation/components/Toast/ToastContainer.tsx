/**
 * ToastContainer - Toast 通知容器
 * 
 * 在應用最上層顯示 Toast 通知
 */

import React from 'react';
import { X, Info, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { useToastStore, type Toast, type ToastType } from '../../stores/toastStore';

// ============================================================================
// 樣式配置
// ============================================================================

const toastStyles: Record<ToastType, {
  bg: string;
  border: string;
  icon: React.ReactNode;
  titleColor: string;
}> = {
  info: {
    bg: 'bg-blue-900/90',
    border: 'border-blue-500/50',
    icon: <Info size={18} className="text-blue-400" />,
    titleColor: 'text-blue-300',
  },
  success: {
    bg: 'bg-emerald-900/90',
    border: 'border-emerald-500/50',
    icon: <CheckCircle size={18} className="text-emerald-400" />,
    titleColor: 'text-emerald-300',
  },
  warning: {
    bg: 'bg-amber-900/90',
    border: 'border-amber-500/50',
    icon: <AlertTriangle size={18} className="text-amber-400" />,
    titleColor: 'text-amber-300',
  },
  error: {
    bg: 'bg-red-900/90',
    border: 'border-red-500/50',
    icon: <XCircle size={18} className="text-red-400" />,
    titleColor: 'text-red-300',
  },
};

// ============================================================================
// Toast 項目組件
// ============================================================================

const ToastItem: React.FC<{ toast: Toast }> = ({ toast }) => {
  const { dismissToast } = useToastStore();
  const style = toastStyles[toast.type];
  
  return (
    <div
      className={`
        ${style.bg} ${style.border}
        backdrop-blur-lg border rounded-lg shadow-xl
        p-3 pr-10 min-w-[280px] max-w-[400px]
        animate-slide-in-right
        relative
      `}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {style.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium ${style.titleColor}`}>
            {toast.title}
          </div>
          {toast.message && (
            <div className="text-xs text-gray-300 mt-1 leading-relaxed">
              {toast.message}
            </div>
          )}
        </div>
      </div>
      
      {/* 關閉按鈕 */}
      <button
        onClick={() => dismissToast(toast.id)}
        className="absolute top-2 right-2 p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
};

// ============================================================================
// Toast 容器組件
// ============================================================================

export const ToastContainer: React.FC = () => {
  const { toasts } = useToastStore();
  
  if (toasts.length === 0) return null;
  
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
};

export default ToastContainer;

