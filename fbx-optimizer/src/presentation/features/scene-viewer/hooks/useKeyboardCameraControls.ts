import { useEffect, useRef } from 'react';

/**
 * 鍵盤狀態介面
 */
interface KeyboardState {
  forward: boolean;    // W
  backward: boolean;   // S
  left: boolean;       // A
  right: boolean;      // D
  up: boolean;         // Q
  down: boolean;       // E
  shift: boolean;      // Shift (加速)
}

/**
 * Hook 選項
 */
interface UseKeyboardCameraControlsOptions {
  enabled?: boolean;
  moveSpeed?: number;
  sprintMultiplier?: number;
}

/**
 * 鍵盤相機控制 Hook
 * 
 * 追蹤 WASD/QE 鍵盤按鍵狀態，用於相機移動控制
 * 
 * @param options - 配置選項
 * @returns 當前的鍵盤狀態
 * 
 * @example
 * ```typescript
 * const keyState = useKeyboardCameraControls({
 *   enabled: true,
 *   moveSpeed: 5.0,
 *   sprintMultiplier: 2.0
 * });
 * ```
 */
export function useKeyboardCameraControls(
  options: UseKeyboardCameraControlsOptions = {}
) {
  const { enabled = true } = options;

  // 使用 ref 儲存按鍵狀態，避免觸發重新渲染
  const keyStateRef = useRef<KeyboardState>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
    shift: false,
  });

  useEffect(() => {
    if (!enabled) return;

    /**
     * 檢查是否在輸入元素中
     * 如果在輸入框、文本域等元素中，則忽略鍵盤事件
     */
    const isInputActive = (): boolean => {
      const activeElement = document.activeElement;
      return (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement ||
        (activeElement && activeElement.getAttribute('contenteditable') === 'true')
      );
    };

    /**
     * 處理按鍵按下事件
     */
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果焦點在輸入元素中，忽略事件
      if (isInputActive()) return;

      switch (e.code) {
        case 'KeyW':
          keyStateRef.current.forward = true;
          break;
        case 'KeyS':
          keyStateRef.current.backward = true;
          break;
        case 'KeyA':
          keyStateRef.current.left = true;
          break;
        case 'KeyD':
          keyStateRef.current.right = true;
          break;
        case 'KeyQ':
          keyStateRef.current.up = true;
          break;
        case 'KeyE':
          keyStateRef.current.down = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          keyStateRef.current.shift = true;
          break;
      }
    };

    /**
     * 處理按鍵釋放事件
     */
    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
          keyStateRef.current.forward = false;
          break;
        case 'KeyS':
          keyStateRef.current.backward = false;
          break;
        case 'KeyA':
          keyStateRef.current.left = false;
          break;
        case 'KeyD':
          keyStateRef.current.right = false;
          break;
        case 'KeyQ':
          keyStateRef.current.up = false;
          break;
        case 'KeyE':
          keyStateRef.current.down = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          keyStateRef.current.shift = false;
          break;
      }
    };

    /**
     * 處理視窗失焦事件
     * 當視窗失焦時，重置所有按鍵狀態，避免按鍵「卡住」
     */
    const handleBlur = () => {
      keyStateRef.current = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        up: false,
        down: false,
        shift: false,
      };
    };

    // 註冊事件監聽器
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    // 清理函數
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [enabled]);

  return keyStateRef;
}

