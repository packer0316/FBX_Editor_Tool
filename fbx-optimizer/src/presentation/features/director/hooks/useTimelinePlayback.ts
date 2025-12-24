/**
 * useTimelinePlayback - 時間軸播放控制 Hook
 * 
 * 實現 Director Mode 的播放功能：
 * - 訂閱 EventBus 的 tick 事件（由 SceneViewer 的 useFrame 發送）
 * - 根據當前幀計算各片段的局部時間
 * - 發送 clipUpdate 事件通知 Model 更新動畫
 */

import { useEffect, useRef, useCallback } from 'react';
import { useDirectorStore } from '../../../stores/directorStore';
import { directorEventBus } from '../../../../infrastructure/events';
import { getClipLocalTime } from '../../../../utils/director/directorUtils';
import type { ClipLocalTimeResult, EasingType } from '../../../../domain/entities/director/director.types';

// Easing 函數（支援強度參數）
const applyEasing = (t: number, easing: EasingType = 'linear', strength: number = 2): number => {
  // strength 範圍 1-5，影響曲線的陡峭程度
  const power = Math.max(1, Math.min(5, strength));
  
  switch (easing) {
    case 'easeIn':
      return Math.pow(t, power);
    case 'easeOut':
      return 1 - Math.pow(1 - t, power);
    case 'easeInOut':
      return t < 0.5 
        ? Math.pow(2, power - 1) * Math.pow(t, power)
        : 1 - Math.pow(-2 * t + 2, power) / 2;
    case 'linear':
    default:
      return t;
  }
};

export interface PlaybackCallbacks {
  /** 當需要更新模型動畫時調用（向後兼容，建議改用 EventBus） */
  onUpdateModelAnimation?: (
    modelId: string,
    animationId: string,
    localTime: number,
    localFrame: number
  ) => void;
  
  /** 當片段開始播放時調用 */
  onClipStart?: (clipId: string, modelId: string, animationId: string) => void;
  
  /** 當片段結束播放時調用 */
  onClipEnd?: (clipId: string, modelId: string, animationId: string) => void;
}

interface UseTimelinePlaybackOptions {
  callbacks?: PlaybackCallbacks;
}

interface UseTimelinePlaybackReturn {
  /** 當前播放中的片段資訊 */
  activeClips: ClipLocalTimeResult[];
}

export function useTimelinePlayback(
  options: UseTimelinePlaybackOptions = {}
): UseTimelinePlaybackReturn {
  const { callbacks } = options;
  
  const {
    timeline,
    tracks,
  } = useDirectorStore();
  
  const { isPlaying, currentFrame, fps } = timeline;
  
  // Refs
  const frameRef = useRef<number>(currentFrame);
  const lastIntFrameRef = useRef<number>(Math.floor(currentFrame));
  const activeClipsRef = useRef<Map<string, ClipLocalTimeResult>>(new Map());
  const previousActiveClipIds = useRef<Set<string>>(new Set());
  const callbacksRef = useRef(callbacks);
  const playStartTimeRef = useRef<number | null>(null); // 播放開始時的真實時間（毫秒）
  const playStartFrameRef = useRef<number>(0); // 播放開始時的幀位置
  callbacksRef.current = callbacks;

  // 同步外部 currentFrame 變化（如 seek）
  // 注意：不要在這裡重置 playStartTimeRef，因為 setCurrentFrame 會觸發這個 effect
  // 只有在非播放狀態時才同步 frameRef（用於恢復播放時的起始位置）
  useEffect(() => {
    if (!isPlaying) {
      frameRef.current = currentFrame;
      lastIntFrameRef.current = Math.floor(currentFrame);
    }
  }, [currentFrame, isPlaying]);

  // 處理用戶手動 seek（拖動進度條）- 訂閱 seek 事件
  useEffect(() => {
    const unsubscribe = directorEventBus.onSeek(({ frame }) => {
      frameRef.current = frame;
      lastIntFrameRef.current = Math.floor(frame);
      // 如果正在播放，重置播放開始時間
      if (isPlaying && playStartTimeRef.current !== null) {
        playStartTimeRef.current = performance.now();
        playStartFrameRef.current = frame;
      }
    });
    return unsubscribe;
  }, [isPlaying]);

  // 計算當前幀的所有活躍片段
  const getActiveClipsAtCurrentFrame = useCallback((frame: number): ClipLocalTimeResult[] => {
    const results: ClipLocalTimeResult[] = [];
    
    for (const track of tracks) {
      if (track.isMuted) continue;
      
      for (const clip of track.clips) {
        const result = getClipLocalTime(frame, clip, fps);
        if (result.isActive) {
          results.push(result);
        }
      }
    }
    
    return results;
  }, [tracks, fps]);

  // 更新所有活躍片段並發送事件
  const updateActiveClips = useCallback((frame: number) => {
    const state = useDirectorStore.getState();
    const currentFps = state.timeline.fps;
    const activeClips = getActiveClipsAtCurrentFrame(frame);
    const currentActiveClipIds = new Set<string>();
    
    for (const clipResult of activeClips) {
      const { clip, localTime } = clipResult;
      currentActiveClipIds.add(clip.id);
      
      if (localTime !== null) {
        const localFrame = Math.floor(localTime * currentFps);
        
        // 程式化動畫發送 ProceduralUpdateEvent
        if (clip.sourceType === 'procedural' && clip.proceduralType) {
          const effectiveDuration = (clip.trimEnd ?? clip.sourceAnimationDuration - 1) - (clip.trimStart ?? 0) + 1;
          const progress = effectiveDuration > 1 ? localFrame / (effectiveDuration - 1) : 1;
          const clampedProgress = Math.max(0, Math.min(1, progress));
          
          // 檢查是否是 clip 的第一幀
          const isClipStart = !previousActiveClipIds.current.has(clip.id);
          
          // 應用 easing（支援強度參數）
          const easing = clip.proceduralConfig?.easing || 'linear';
          const easingStrength = clip.proceduralConfig?.easingStrength ?? 2;
          const easedProgress = applyEasing(clampedProgress, easing, easingStrength);
          
          // 計算目標值（這些值會在 useDirectorProceduralTrigger 中基於 clip 起始狀態來應用）
          let targetOpacity = 1;
          let targetScale: number | undefined;
          let targetPosition: { x: number; y: number; z: number } | undefined;
          
          switch (clip.proceduralType) {
            case 'fadeIn':
              targetOpacity = easedProgress;  // 0 → 1
              break;
            case 'fadeOut':
              targetOpacity = 1 - easedProgress;  // 1 → 0
              break;
            case 'scaleTo': {
              // 傳遞目標縮放值和進度，由 trigger 來計算實際值
              targetScale = clip.proceduralConfig?.targetScale ?? 1.5;
              break;
            }
            case 'moveBy': {
              // 傳遞最終位移量，由 trigger 來根據進度計算實際位移
              const moveX = clip.proceduralConfig?.moveX ?? 0;
              const moveY = clip.proceduralConfig?.moveY ?? 0;
              const moveZ = clip.proceduralConfig?.moveZ ?? 0;
              targetPosition = { x: moveX, y: moveY, z: moveZ };
              break;
            }
          }
          
          // visible 根據 opacity 決定（opacity > 0 時 visible）
          const targetVisible = targetOpacity > 0;
          
          directorEventBus.emitProceduralUpdate({
            clipId: clip.id,
            modelId: clip.sourceModelId,
            type: clip.proceduralType,
            progress: easedProgress,  // 使用 eased progress
            isClipStart,
            targetVisible,
            targetOpacity,
            targetScale,
            targetPosition,
          });
        } else {
          // 一般動畫發送 clipUpdate 事件
          directorEventBus.emitClipUpdate({
            modelId: clip.sourceModelId,
            animationId: clip.sourceAnimationId,
            localTime,
            localFrame,
          });
          
          // 向後兼容：同時調用 callback
          callbacksRef.current?.onUpdateModelAnimation?.(
            clip.sourceModelId,
            clip.sourceAnimationId,
            localTime,
            localFrame
          );
        }
      }
      
      // 檢查片段是否剛開始播放
      if (!previousActiveClipIds.current.has(clip.id)) {
        callbacksRef.current?.onClipStart?.(
          clip.id,
          clip.sourceModelId,
          clip.sourceAnimationId
        );
      }
    }
    
    // 檢查片段是否結束
    for (const prevClipId of previousActiveClipIds.current) {
      if (!currentActiveClipIds.has(prevClipId)) {
        const prevClip = activeClipsRef.current.get(prevClipId);
        if (prevClip) {
          const clip = prevClip.clip;
          
          // 程式動作結束時發送最終狀態
          if (clip.sourceType === 'procedural' && clip.proceduralType) {
            let targetOpacity = 1;
            let targetScale: number | undefined;
            let targetPosition: { x: number; y: number; z: number } | undefined;
            
            switch (clip.proceduralType) {
              case 'fadeIn':
                targetOpacity = 1;
                break;
              case 'fadeOut':
                targetOpacity = 0;
                break;
              case 'scaleTo':
                targetScale = clip.proceduralConfig?.targetScale ?? 1.5;
                break;
              case 'moveBy':
                targetPosition = {
                  x: clip.proceduralConfig?.moveX ?? 0,
                  y: clip.proceduralConfig?.moveY ?? 0,
                  z: clip.proceduralConfig?.moveZ ?? 0,
                };
                break;
            }
            
            directorEventBus.emitProceduralUpdate({
              clipId: clip.id,
              modelId: clip.sourceModelId,
              type: clip.proceduralType,
              progress: 1,
              isClipStart: false,
              targetVisible: targetOpacity > 0,
              targetOpacity,
              targetScale,
              targetPosition,
            });
          }
          
          callbacksRef.current?.onClipEnd?.(
            clip.id,
            clip.sourceModelId,
            clip.sourceAnimationId
          );
        }
      }
    }
    
    // 更新狀態
    previousActiveClipIds.current = currentActiveClipIds;
    activeClipsRef.current.clear();
    for (const clipResult of activeClips) {
      activeClipsRef.current.set(clipResult.clip.id, clipResult);
    }
    
    return activeClips;
  }, [getActiveClipsAtCurrentFrame]);

  // 訂閱 tick 事件（取代 requestAnimationFrame）
  useEffect(() => {
    if (!isPlaying) {
      // 停止播放時清除開始時間
      playStartTimeRef.current = null;
      return;
    }

    // 播放開始時記錄真實時間和起始幀
    if (playStartTimeRef.current === null) {
      playStartTimeRef.current = performance.now();
      playStartFrameRef.current = frameRef.current;
    }

    const unsubscribe = directorEventBus.onTick(() => {
      const state = useDirectorStore.getState();
      const { fps: currentFps, totalFrames, isLooping, loopRegion } = state.timeline;

      // 🔥 使用真實時間計算新幀（避免 delta 累積誤差）
      // 這樣即使瀏覽器幀率不穩定，播放速度也會與真實時間同步
      const elapsedMs = performance.now() - playStartTimeRef.current!;
      const elapsedSeconds = elapsedMs / 1000;
      let newFrame = playStartFrameRef.current + elapsedSeconds * currentFps;

      // 區間播放邏輯
      const hasValidLoopRegion = loopRegion.enabled && 
        loopRegion.inPoint !== null && 
        loopRegion.outPoint !== null;

      if (hasValidLoopRegion) {
        const inPoint = loopRegion.inPoint!;
        const outPoint = loopRegion.outPoint!;
        const regionLength = outPoint - inPoint;
        
        // 到達出點時，根據循環設置決定行為
        if (newFrame >= outPoint) {
          if (isLooping) {
            // 循環模式：跳回入點
            const overshoot = newFrame - outPoint;
            playStartTimeRef.current = performance.now();
            playStartFrameRef.current = inPoint;
            newFrame = inPoint + (overshoot % regionLength);
          } else {
            // 非循環模式：停止在出點
            newFrame = outPoint;
            state.pause();
            return;
          }
        }
      } else {
        // 原有的全範圍播放邏輯
        if (newFrame >= totalFrames) {
          if (isLooping) {
            // 重置起始時間和幀，從頭開始計時
            const overshoot = newFrame - totalFrames;
            playStartTimeRef.current = performance.now();
            playStartFrameRef.current = 0;
            newFrame = overshoot % totalFrames;
          } else {
            newFrame = totalFrames;
            state.pause();
            return;
          }
        }
      }

      frameRef.current = newFrame;

      // 只在整數幀變化時更新 store（節流，減少UI重渲染）
      const frameInt = Math.floor(newFrame);
      if (frameInt !== lastIntFrameRef.current) {
        lastIntFrameRef.current = frameInt;
        state.setCurrentFrame(frameInt);
      }

      // 🔥 重要：使用浮點幀更新動畫，保持流暢度和精確度
      // 這樣動畫會在每次 tick 時都得到精確的時間更新
      updateActiveClips(newFrame);
    });

    return unsubscribe;
  }, [isPlaying, updateActiveClips]);

  // 當手動改變幀位置時（非播放狀態），也更新活躍片段
  useEffect(() => {
    if (!isPlaying) {
      updateActiveClips(currentFrame);
    }
  }, [currentFrame, isPlaying, updateActiveClips]);

  // 返回當前活躍片段
  const activeClips = getActiveClipsAtCurrentFrame(currentFrame);

  return {
    activeClips,
  };
}

export default useTimelinePlayback;
