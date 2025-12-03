import { useRef, useEffect, useCallback, useMemo } from 'react';
import * as THREE from 'three';

interface UseAnimationMixerOptions {
  /** 是否循環播放 */
  loop?: boolean;
  /** 是否自動播放 */
  autoPlay?: boolean;
  /** 初始時間位置 */
  initialTime?: number;
  /** 初始播放狀態 */
  initialPlaying?: boolean;
  /** 動畫結束回調 */
  onFinish?: () => void;
}

/**
 * AnimationMixer 生命週期管理 Hook
 * 
 * 封裝 Three.js AnimationMixer 的創建、更新和清理邏輯。
 * 自動管理快取清理，避免記憶體洩漏。
 * 
 * @param model Three.js 模型
 * @param clip 動畫片段
 * @param options 選項
 * 
 * @example
 * ```typescript
 * const { mixer, action, play, pause, seekTo } = useAnimationMixer(
 *   model, 
 *   clip, 
 *   { loop: true, autoPlay: true }
 * );
 * ```
 */
export function useAnimationMixer(
  model: THREE.Group | null,
  clip: THREE.AnimationClip | null,
  options: UseAnimationMixerOptions = {}
) {
  const {
    loop = true,
    autoPlay = true,
    initialTime,
    initialPlaying = true,
    onFinish
  } = options;

  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionRef = useRef<THREE.AnimationAction | null>(null);
  const isPlayingRef = useRef(autoPlay);
  
  // 追蹤所有使用過的 clips，用於統一清理
  const usedClipsRef = useRef<THREE.AnimationClip[]>([]);
  
  // 追蹤是否已初始化
  const initializedRef = useRef(false);
  
  // 創建和清理 Mixer（跟隨 model）
  useEffect(() => {
    if (!model) return;
    
    const mixer = new THREE.AnimationMixer(model);
    mixerRef.current = mixer;
    
    return () => {
      // 組件卸載時統一清理所有快取
      usedClipsRef.current.forEach(usedClip => {
        try {
          mixer.uncacheClip(usedClip);
        } catch (error) {
          // 忽略已清理的錯誤
        }
      });
      
      // 清理整個模型的快取
      mixer.uncacheRoot(model);
      
      mixerRef.current = null;
      usedClipsRef.current = [];
      initializedRef.current = false;
    };
  }, [model]);
  
  // 管理 Clip 和 Action（跟隨 clip、loop、initialPlaying、initialTime）
  useEffect(() => {
    if (!mixerRef.current || !clip || !model) return;
    
    const mixer = mixerRef.current;
    
    // 停止舊 action（但不立即 uncache）
    if (actionRef.current) {
      actionRef.current.stop();
      actionRef.current = null;
      initializedRef.current = false;
    }
    
    // 創建新 action
    const action = mixer.clipAction(clip);
    
    // 追蹤這個 clip
    if (!usedClipsRef.current.includes(clip)) {
      usedClipsRef.current.push(clip);
    }
    
    // 設置循環模式
    if (loop) {
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.clampWhenFinished = false;
    } else {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    }
    
    // 設置初始時間
    if (initialTime !== undefined && initialTime !== null && !isNaN(initialTime)) {
      action.time = initialTime;
    }
    
    // 設置初始播放狀態
    action.paused = !initialPlaying;
    isPlayingRef.current = initialPlaying;
    
    if (initialPlaying) {
      action.play();
    }
    
    actionRef.current = action;
    initializedRef.current = true;
    
    // 設置完成監聽器
    const handleFinished = () => {
      if (onFinish) onFinish();
    };
    
    if (!loop && onFinish) {
      mixer.addEventListener('finished', handleFinished);
    }
    
    return () => {
      if (!loop && onFinish) {
        mixer.removeEventListener('finished', handleFinished);
      }
    };
  }, [clip, model, loop, initialPlaying, initialTime, onFinish]);
  
  // 控制方法
  const play = useCallback(() => {
    if (!actionRef.current) return;
    
    const action = actionRef.current;
    
    // 如果動畫已經結束且不循環，重置後播放
    if (!action.isRunning() && action.time >= action.getClip().duration && !loop) {
      action.reset();
    }
    
    if (!action.isRunning()) {
      action.play();
    }
    
    action.paused = false;
    isPlayingRef.current = true;
  }, [loop]);
  
  const pause = useCallback(() => {
    if (!actionRef.current) return;
    
    actionRef.current.paused = true;
    isPlayingRef.current = false;
  }, []);
  
  const seekTo = useCallback((time: number) => {
    if (!actionRef.current || !mixerRef.current || !initializedRef.current) {
      return;
    }
    
    try {
      const action = actionRef.current;
      const mixer = mixerRef.current;
      
      // 設置時間
      action.time = time;
      
      // 同步到 model.userData
      if (model) {
        model.userData.animationTime = time;
      }
      
      // 強制更新骨架（即使暫停）
      const wasPaused = action.paused;
      action.paused = false;
      mixer.update(0.001);
      action.paused = wasPaused;
    } catch (error) {
      console.warn('[useAnimationMixer] seekTo failed:', error);
    }
  }, [model]);
  
  const setAnimationTime = useCallback((time: number) => {
    if (!actionRef.current || !mixerRef.current || !initializedRef.current) {
      return;
    }
    
    try {
      const action = actionRef.current;
      const mixer = mixerRef.current;
      
      action.time = time;
      action.paused = false;
      mixer.update(0);
      action.paused = true;
    } catch (error) {
      console.warn('[useAnimationMixer] setAnimationTime failed:', error);
    }
  }, []);
  
  const getCurrentTime = useCallback(() => {
    return actionRef.current?.time ?? 0;
  }, []);
  
  const getDuration = useCallback(() => {
    return actionRef.current?.getClip().duration ?? 0;
  }, []);
  
  const update = useCallback((delta: number) => {
    if (mixerRef.current && isPlayingRef.current) {
      mixerRef.current.update(delta);
    }
  }, []);
  
  return useMemo(() => ({
    mixer: mixerRef.current,
    action: actionRef.current,
    isPlaying: isPlayingRef.current,
    play,
    pause,
    seekTo,
    setAnimationTime,
    getCurrentTime,
    getDuration,
    update
  }), [play, pause, seekTo, setAnimationTime, getCurrentTime, getDuration, update]);
}

