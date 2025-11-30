/**
 * Toast 通知 Store
 * 
 * 管理全局 Toast 通知的顯示
 */

import { create } from 'zustand';

// ============================================================================
// 類型定義
// ============================================================================

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;  // 毫秒，0 表示不自動關閉
}

interface ToastState {
  toasts: Toast[];
}

interface ToastActions {
  /** 顯示 Toast */
  showToast: (toast: Omit<Toast, 'id'>) => string;
  
  /** 關閉 Toast */
  dismissToast: (id: string) => void;
  
  /** 清除所有 Toast */
  clearAllToasts: () => void;
  
  // 便捷方法
  info: (title: string, message?: string) => string;
  success: (title: string, message?: string) => string;
  warning: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
}

type ToastStore = ToastState & ToastActions;

// ============================================================================
// 工具函數
// ============================================================================

const generateId = (): string => {
  return `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// ============================================================================
// Store 實作
// ============================================================================

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  
  showToast: (toast) => {
    const id = generateId();
    const duration = toast.duration ?? 4000;  // 預設 4 秒
    
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id, duration }],
    }));
    
    // 自動關閉
    if (duration > 0) {
      setTimeout(() => {
        get().dismissToast(id);
      }, duration);
    }
    
    return id;
  },
  
  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
  
  clearAllToasts: () => {
    set({ toasts: [] });
  },
  
  // 便捷方法
  info: (title, message) => {
    return get().showToast({ type: 'info', title, message });
  },
  
  success: (title, message) => {
    return get().showToast({ type: 'success', title, message });
  },
  
  warning: (title, message) => {
    return get().showToast({ type: 'warning', title, message });
  },
  
  error: (title, message) => {
    return get().showToast({ type: 'error', title, message, duration: 6000 });  // 錯誤顯示久一點
  },
}));

// ============================================================================
// 非 React 環境使用
// ============================================================================

export const toast = {
  info: (title: string, message?: string) => useToastStore.getState().info(title, message),
  success: (title: string, message?: string) => useToastStore.getState().success(title, message),
  warning: (title: string, message?: string) => useToastStore.getState().warning(title, message),
  error: (title: string, message?: string) => useToastStore.getState().error(title, message),
  dismiss: (id: string) => useToastStore.getState().dismissToast(id),
  clearAll: () => useToastStore.getState().clearAllToasts(),
};

export default useToastStore;

