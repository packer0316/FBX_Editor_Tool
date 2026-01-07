/**
 * Director History Store
 * 
 * 管理導演模式的 Undo/Redo 歷史狀態
 * 採用快照模式（Snapshot Pattern）追蹤所有編輯操作
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { DirectorTrack, TimelineState, LoopRegion } from '../../domain/entities/director/director.types';

// ============================================================================
// 常數
// ============================================================================

/** 歷史記錄上限 */
export const HISTORY_LIMIT = 50;

// ============================================================================
// 類型定義
// ============================================================================

/**
 * 可編輯的歷史狀態（不包含 UI 狀態）
 */
export interface HistoryState {
  /** 軌道列表（含所有 clips） */
  tracks: DirectorTrack[];
  
  /** 時間軸可編輯設定 */
  timeline: {
    totalFrames: number;
    fps: number;
    loopRegion: LoopRegion;
  };
}

/**
 * 歷史記錄項目（含描述資訊）
 */
interface HistoryEntry {
  /** 狀態快照 */
  state: HistoryState;
  
  /** 操作描述（用於除錯） */
  actionName?: string;
  
  /** 時間戳 */
  timestamp: number;
}

/**
 * 歷史 Store 狀態
 */
interface DirectorHistoryState {
  /** 過去狀態堆疊（LIFO，最新的在最後面） */
  past: HistoryEntry[];
  
  /** 未來狀態堆疊（redo 用，最新的在最後面） */
  future: HistoryEntry[];
  
  /** 是否正在執行 undo/redo（防止遞迴記錄） */
  isUndoRedoing: boolean;
}

/**
 * 歷史 Store Actions
 */
interface DirectorHistoryActions {
  /**
   * 推入新的歷史狀態
   * 在執行編輯操作前調用，記錄操作前的狀態
   */
  pushState: (state: HistoryState, actionName?: string) => void;
  
  /**
   * 撤銷（Undo）
   * @returns 要還原的狀態，或 null（無法撤銷時）
   */
  undo: (currentState: HistoryState) => HistoryState | null;
  
  /**
   * 重做（Redo）
   * @returns 要還原的狀態，或 null（無法重做時）
   */
  redo: (currentState: HistoryState) => HistoryState | null;
  
  /** 是否可以撤銷 */
  canUndo: () => boolean;
  
  /** 是否可以重做 */
  canRedo: () => boolean;
  
  /** 取得撤銷堆疊長度 */
  getUndoCount: () => number;
  
  /** 取得重做堆疊長度 */
  getRedoCount: () => number;
  
  /** 清空所有歷史 */
  clear: () => void;
  
  /** 設定 undo/redo 狀態旗標 */
  setIsUndoRedoing: (value: boolean) => void;
}

type DirectorHistoryStore = DirectorHistoryState & DirectorHistoryActions;

// ============================================================================
// 工具函數
// ============================================================================

/**
 * 深拷貝歷史狀態
 * 確保歷史記錄與當前狀態完全獨立
 */
function cloneHistoryState(state: HistoryState): HistoryState {
  return JSON.parse(JSON.stringify(state));
}

// ============================================================================
// Store 實作
// ============================================================================

const initialState: DirectorHistoryState = {
  past: [],
  future: [],
  isUndoRedoing: false,
};

export const useDirectorHistoryStore = create<DirectorHistoryStore>()(
  devtools(
    (set, get) => ({
      ...initialState,
      
      // ========================================
      // 推入歷史狀態
      // ========================================
      
      pushState: (state: HistoryState, actionName?: string) => {
        const { isUndoRedoing, past } = get();
        
        // 如果正在執行 undo/redo，不記錄
        if (isUndoRedoing) {
          return;
        }
        
        const entry: HistoryEntry = {
          state: cloneHistoryState(state),
          actionName,
          timestamp: Date.now(),
        };
        
        // 新的操作會清空 future（無法 redo 已撤銷後又修改的操作）
        const newPast = [...past, entry];
        
        // 限制歷史記錄數量
        if (newPast.length > HISTORY_LIMIT) {
          newPast.shift();
        }
        
        set(
          { 
            past: newPast,
            future: [], // 清空 redo 堆疊
          },
          undefined,
          `history/push:${actionName || 'unknown'}`
        );
      },
      
      // ========================================
      // 撤銷（Undo）
      // ========================================
      
      undo: (currentState: HistoryState) => {
        const { past, future } = get();
        
        if (past.length === 0) {
          return null;
        }
        
        // 取出最近的歷史狀態
        const newPast = [...past];
        const previousEntry = newPast.pop()!;
        
        // 將當前狀態推入 future（用於 redo）
        const currentEntry: HistoryEntry = {
          state: cloneHistoryState(currentState),
          actionName: 'undo-save',
          timestamp: Date.now(),
        };
        
        set(
          {
            past: newPast,
            future: [...future, currentEntry],
          },
          undefined,
          'history/undo'
        );
        
        return cloneHistoryState(previousEntry.state);
      },
      
      // ========================================
      // 重做（Redo）
      // ========================================
      
      redo: (currentState: HistoryState) => {
        const { past, future } = get();
        
        if (future.length === 0) {
          return null;
        }
        
        // 取出最近的 future 狀態
        const newFuture = [...future];
        const nextEntry = newFuture.pop()!;
        
        // 將當前狀態推入 past
        const currentEntry: HistoryEntry = {
          state: cloneHistoryState(currentState),
          actionName: 'redo-save',
          timestamp: Date.now(),
        };
        
        set(
          {
            past: [...past, currentEntry],
            future: newFuture,
          },
          undefined,
          'history/redo'
        );
        
        return cloneHistoryState(nextEntry.state);
      },
      
      // ========================================
      // 查詢方法
      // ========================================
      
      canUndo: () => {
        return get().past.length > 0;
      },
      
      canRedo: () => {
        return get().future.length > 0;
      },
      
      getUndoCount: () => {
        return get().past.length;
      },
      
      getRedoCount: () => {
        return get().future.length;
      },
      
      // ========================================
      // 清空與控制
      // ========================================
      
      clear: () => {
        set(initialState, undefined, 'history/clear');
      },
      
      setIsUndoRedoing: (value: boolean) => {
        set({ isUndoRedoing: value }, undefined, 'history/setIsUndoRedoing');
      },
    }),
    { name: 'director-history-store' }
  )
);

// ============================================================================
// Selector Hooks
// ============================================================================

export const useCanUndo = () => useDirectorHistoryStore((state) => state.past.length > 0);
export const useCanRedo = () => useDirectorHistoryStore((state) => state.future.length > 0);
export const useUndoCount = () => useDirectorHistoryStore((state) => state.past.length);
export const useRedoCount = () => useDirectorHistoryStore((state) => state.future.length);

