/**
 * useSpineAnimation Hook
 * 
 * 管理 Spine 動畫的播放狀態和更新。
 * 提供播放控制、時間同步等功能。
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { getSpineWebglRuntimeAdapter, type SpineAnimationListener } from '../../infrastructure/spine-webgl/SpineWebglRuntimeAdapter';

// ============================================================================
// 類型定義
// ============================================================================

interface UseSpineAnimationOptions {
  /** Spine 實例 ID */
  spineId: string;
  /** 是否啟用（當元素不可見時可以停用） */
  enabled?: boolean;
  /** 動畫完成回調 */
  onComplete?: (animationName: string) => void;
  /** 動畫開始回調 */
  onStart?: (animationName: string) => void;
  /** 事件觸發回調 */
  onEvent?: (eventName: string, eventData: unknown) => void;
}

interface UseSpineAnimationResult {
  /** 是否正在播放 */
  isPlaying: boolean;
  /** 當前時間（秒） */
  currentTime: number;
  /** 當前動畫名稱 */
  currentAnimation: string | null;
  /** 動畫時長（秒） */
  duration: number;
  /** 播放 */
  play: (animationName?: string, loop?: boolean) => void;
  /** 暫停 */
  pause: () => void;
  /** 停止 */
  stop: () => void;
  /** 跳轉 */
  seek: (time: number) => void;
  /** 設定播放速度 */
  setSpeed: (speed: number) => void;
  /** 設定 Skin */
  setSkin: (skinName: string) => void;
  /** 是否已載入 */
  isLoaded: boolean;
}

// ============================================================================
// Hook
// ============================================================================

export function useSpineAnimation(options: UseSpineAnimationOptions): UseSpineAnimationResult {
  const { spineId, enabled = true, onComplete, onStart, onEvent } = options;
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [state, setState] = useState({
    isPlaying: false,
    currentTime: 0,
    currentAnimation: null as string | null,
    duration: 0,
  });
  
  const listenerRef = useRef<SpineAnimationListener | null>(null);
  const updateIntervalRef = useRef<number>();

  // 檢查 Spine 實例是否存在
  useEffect(() => {
    const adapter = getSpineWebglRuntimeAdapter();
    const loaded = adapter.has(spineId);
    setIsLoaded(loaded);
    
    if (loaded) {
      const currentState = adapter.getState(spineId);
      if (currentState) {
        setState({
          isPlaying: currentState.isPlaying,
          currentTime: currentState.currentTime,
          currentAnimation: currentState.currentAnimation,
          duration: currentState.duration,
        });
      }
    }
  }, [spineId]);

  // 設定事件監聽器
  useEffect(() => {
    if (!enabled || !isLoaded) return;

    const adapter = getSpineWebglRuntimeAdapter();
    
    const listener: SpineAnimationListener = {
      onStart: (id, animationName) => {
        if (id === spineId) {
          onStart?.(animationName);
        }
      },
      onComplete: (id, animationName) => {
        if (id === spineId) {
          onComplete?.(animationName);
        }
      },
      onEvent: (id, eventName, eventData) => {
        if (id === spineId) {
          onEvent?.(eventName, eventData);
        }
      },
    };
    
    listenerRef.current = listener;
    adapter.addListener(listener);

    return () => {
      if (listenerRef.current) {
        adapter.removeListener(listenerRef.current);
        listenerRef.current = null;
      }
    };
  }, [spineId, enabled, isLoaded, onStart, onComplete, onEvent]);

  // 定期同步狀態
  useEffect(() => {
    if (!enabled || !isLoaded) return;

    const adapter = getSpineWebglRuntimeAdapter();
    
    const syncState = () => {
      const currentState = adapter.getState(spineId);
      if (currentState) {
        setState(prev => {
          // 只有當狀態真正改變時才更新
          if (
            prev.isPlaying !== currentState.isPlaying ||
            Math.abs(prev.currentTime - currentState.currentTime) > 0.01 ||
            prev.currentAnimation !== currentState.currentAnimation ||
            prev.duration !== currentState.duration
          ) {
            return {
              isPlaying: currentState.isPlaying,
              currentTime: currentState.currentTime,
              currentAnimation: currentState.currentAnimation,
              duration: currentState.duration,
            };
          }
          return prev;
        });
      }
    };

    // 每 100ms 同步一次狀態
    updateIntervalRef.current = window.setInterval(syncState, 100);

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [spineId, enabled, isLoaded]);

  // 播放
  const play = useCallback((animationName?: string, loop = true) => {
    if (!isLoaded) return;
    
    const adapter = getSpineWebglRuntimeAdapter();
    const animation = animationName ?? state.currentAnimation;
    
    if (animation) {
      adapter.playAnimation(spineId, animation, loop);
      setState(prev => ({ ...prev, isPlaying: true, currentAnimation: animation }));
    }
  }, [spineId, isLoaded, state.currentAnimation]);

  // 暫停
  const pause = useCallback(() => {
    if (!isLoaded) return;
    
    const adapter = getSpineWebglRuntimeAdapter();
    adapter.pause(spineId);
    setState(prev => ({ ...prev, isPlaying: false }));
  }, [spineId, isLoaded]);

  // 停止
  const stop = useCallback(() => {
    if (!isLoaded) return;
    
    const adapter = getSpineWebglRuntimeAdapter();
    adapter.stop(spineId);
    setState(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
  }, [spineId, isLoaded]);

  // 跳轉
  const seek = useCallback((time: number) => {
    if (!isLoaded) return;
    
    const adapter = getSpineWebglRuntimeAdapter();
    adapter.seek(spineId, time);
    setState(prev => ({ ...prev, currentTime: time }));
  }, [spineId, isLoaded]);

  // 設定播放速度
  const setSpeed = useCallback((speed: number) => {
    if (!isLoaded) return;
    
    const adapter = getSpineWebglRuntimeAdapter();
    adapter.setTimeScale(spineId, speed);
  }, [spineId, isLoaded]);

  // 設定 Skin
  const setSkin = useCallback((skinName: string) => {
    if (!isLoaded) return;
    
    const adapter = getSpineWebglRuntimeAdapter();
    adapter.setSkin(spineId, skinName);
  }, [spineId, isLoaded]);

  return {
    isPlaying: state.isPlaying,
    currentTime: state.currentTime,
    currentAnimation: state.currentAnimation,
    duration: state.duration,
    play,
    pause,
    stop,
    seek,
    setSpeed,
    setSkin,
    isLoaded,
  };
}

export default useSpineAnimation;


