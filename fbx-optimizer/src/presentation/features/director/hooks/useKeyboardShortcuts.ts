/**
 * useKeyboardShortcuts - Director Mode 鍵盤快捷鍵
 */

import { useEffect, useCallback } from 'react';
import { useDirectorStore } from '../../../stores/directorStore';

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
    removeClip,
    exitDirectorMode,
  } = useDirectorStore();

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
        setCurrentFrame(0);
        break;

      case 'End':
        e.preventDefault();
        setCurrentFrame(timeline.totalFrames);
        break;

      case 'Escape':
        e.preventDefault();
        exitDirectorMode();
        break;

      default:
        break;
    }
  }, [enabled, isDirectorMode, timeline, ui.selectedClipId, play, pause, setCurrentFrame, removeClip, exitDirectorMode]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    // 可以返回一些快捷鍵提示資訊
    shortcuts: [
      { key: 'Space', description: '播放/暫停' },
      { key: '滾輪', description: '縮放時間軸' },
      { key: 'Delete', description: '刪除選中片段' },
      { key: '←/→', description: '移動 1 幀' },
      { key: 'Shift + ←/→', description: '移動 10 幀' },
      { key: 'Home', description: '跳到開頭' },
      { key: 'End', description: '跳到結尾' },
      { key: 'ESC', description: '關閉導演模式' },
    ],
  };
}

export default useKeyboardShortcuts;

