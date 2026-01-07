/**
 * useKeyboardShortcuts - Director Mode 鍵盤快捷鍵
 */

import { useEffect, useCallback } from 'react';
import { useDirectorStore } from '../../../stores/directorStore';
import { useDirectorHistoryStore } from '../../../stores/directorHistoryStore';
import { MIN_ZOOM, MAX_ZOOM } from '../../../../domain/entities/director/director.types';

// TODO-10: 鍵盤縮放倍率
const KEYBOARD_ZOOM_FACTOR = 1.25;

interface UseKeyboardShortcutsOptions {
  /** 是否啟用快捷鍵 */
  enabled?: boolean;
}

/**
 * Director Mode 鍵盤快捷鍵 Hook
 * 
 * 快捷鍵列表：
 * - Space: 播放/暫停
 * - Delete/Backspace: 刪除選中片段
 * - ←/→: 前後移動 1 幀
 * - Shift + ←/→: 前後移動 10 幀
 * - Home: 跳到開頭
 * - End: 跳到結尾
 * - ESC: 關閉 Director Mode
 * - +/=: 放大時間軸
 * - -: 縮小時間軸
 * - Ctrl+0: 重設縮放為 100%
 * - I: 設定入點（In Point）
 * - O: 設定出點（Out Point）
 * - Alt+X: 清除區間
 * - Ctrl+Z: 上一步（Undo）
 * - Ctrl+Y / Ctrl+Shift+Z: 下一步（Redo）
 */
export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const { enabled = true } = options;
  
  const {
    isDirectorMode,
    timeline,
    ui,
    play,
    pause,
    setCurrentFrame,
    setZoom,
    removeClip,
    exitDirectorMode,
    setInPoint,
    setOutPoint,
    clearLoopRegion,
    undo,
    redo,
  } = useDirectorStore();
  
  const { canUndo, canRedo } = useDirectorHistoryStore();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled || !isDirectorMode) return;
    
    // 忽略來自 input/textarea 的事件
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

    switch (e.key) {
      case ' ': // Space: 播放/暫停
        e.preventDefault();
        if (timeline.isPlaying) {
          pause();
        } else {
          play();
        }
        break;

      case 'Delete':
      case 'Backspace':
        // 刪除選中片段
        if (ui.selectedClipId) {
          e.preventDefault();
          removeClip(ui.selectedClipId);
        }
        break;

      case 'ArrowLeft':
        e.preventDefault();
        {
          const step = e.shiftKey ? 10 : 1;
          const newFrame = Math.max(0, timeline.currentFrame - step);
          setCurrentFrame(newFrame);
        }
        break;

      case 'ArrowRight':
        e.preventDefault();
        {
          const step = e.shiftKey ? 10 : 1;
          const newFrame = Math.min(timeline.totalFrames, timeline.currentFrame + step);
          setCurrentFrame(newFrame);
        }
        break;

      case 'Home':
        e.preventDefault();
        // 有區間且啟用時跳到入點，否則跳到開頭
        if (timeline.loopRegion.enabled && timeline.loopRegion.inPoint !== null) {
          setCurrentFrame(timeline.loopRegion.inPoint);
        } else {
          setCurrentFrame(0);
        }
        break;

      case 'End':
        e.preventDefault();
        // 有區間且啟用時跳到出點，否則跳到結尾
        if (timeline.loopRegion.enabled && timeline.loopRegion.outPoint !== null) {
          setCurrentFrame(timeline.loopRegion.outPoint);
        } else {
          setCurrentFrame(timeline.totalFrames);
        }
        break;

      case 'Escape':
        e.preventDefault();
        exitDirectorMode();
        break;

      // TODO-10: 鍵盤縮放快捷鍵
      case '=':  // 或 '+' (需要 Shift)
      case '+':
        e.preventDefault();
        setZoom(Math.min(MAX_ZOOM, ui.zoom * KEYBOARD_ZOOM_FACTOR));
        break;

      case '-':
        e.preventDefault();
        setZoom(Math.max(MIN_ZOOM, ui.zoom / KEYBOARD_ZOOM_FACTOR));
        break;

      case '0':
        // Ctrl+0 或 Cmd+0: 重設為 100%
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          setZoom(1.0);
        }
        break;

      // 區間播放快捷鍵
      case 'i':
      case 'I':
        e.preventDefault();
        setInPoint(timeline.currentFrame);
        break;

      case 'o':
      case 'O':
        e.preventDefault();
        setOutPoint(timeline.currentFrame);
        break;

      case 'x':
      case 'X':
        // Alt+X: 清除區間
        if (e.altKey) {
          e.preventDefault();
          clearLoopRegion();
        }
        break;

      case 'z':
      case 'Z':
        // Ctrl+Z: Undo, Ctrl+Shift+Z: Redo
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (e.shiftKey) {
            // Ctrl+Shift+Z: Redo
            if (canRedo()) {
              redo();
            }
          } else {
            // Ctrl+Z: Undo
            if (canUndo()) {
              undo();
            }
          }
        }
        break;

      case 'y':
      case 'Y':
        // Ctrl+Y: Redo
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (canRedo()) {
            redo();
          }
        }
        break;

      default:
        break;
    }
  }, [enabled, isDirectorMode, timeline, ui.selectedClipId, ui.zoom, play, pause, setCurrentFrame, setZoom, removeClip, exitDirectorMode, setInPoint, setOutPoint, clearLoopRegion, undo, redo, canUndo, canRedo]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    // 可以返回一些快捷鍵提示資訊
    shortcuts: [
      { key: 'Space', description: '播放/暫停' },
      { key: '滾輪', description: '縮放時間軸' },
      { key: '+/-', description: '放大/縮小時間軸' },
      { key: 'Ctrl + 0', description: '重設縮放' },
      { key: 'Delete', description: '刪除選中片段' },
      { key: '←/→', description: '移動 1 幀' },
      { key: 'Shift + ←/→', description: '移動 10 幀' },
      { key: 'Home', description: '跳到開頭' },
      { key: 'End', description: '跳到結尾' },
      { key: 'I', description: '設定入點' },
      { key: 'O', description: '設定出點' },
      { key: 'Alt + X', description: '清除區間' },
      { key: 'Ctrl + Z', description: '上一步' },
      { key: 'Ctrl + Y', description: '下一步' },
      { key: 'ESC', description: '關閉導演模式' },
    ],
  };
}

export default useKeyboardShortcuts;

