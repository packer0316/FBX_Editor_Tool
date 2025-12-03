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
import type { ClipLocalTimeResult } from '../../../../domain/entities/director/director.types';

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
  callbacksRef.current = callbacks;

  // 同步外部 currentFrame 變化（如 seek）
  useEffect(() => {
    frameRef.current = currentFrame;
    lastIntFrameRef.current = Math.floor(currentFrame);
  }, [currentFrame]);

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
      
      // 發送 clipUpdate 事件
      if (localTime !== null) {
        const localFrame = Math.floor(localTime * currentFps);
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
          callbacksRef.current?.onClipEnd?.(
            prevClip.clip.id,
            prevClip.clip.sourceModelId,
            prevClip.clip.sourceAnimationId
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
    if (!isPlaying) return;

    const unsubscribe = directorEventBus.onTick(({ delta }) => {
      const state = useDirectorStore.getState();
      const { fps: currentFps, totalFrames, isLooping, loopRegion } = state.timeline;

      // 計算新幀
      let newFrame = frameRef.current + delta * currentFps;

      // 區間播放邏輯
      const hasValidLoopRegion = loopRegion.enabled && 
        loopRegion.inPoint !== null && 
        loopRegion.outPoint !== null;

      if (hasValidLoopRegion) {
        const inPoint = loopRegion.inPoint!;
        const outPoint = loopRegion.outPoint!;
        
        // 到達出點時跳回入點
        if (newFrame >= outPoint) {
          newFrame = inPoint + (newFrame - outPoint);
          // 確保不會超過出點（處理極大的 delta）
          if (newFrame >= outPoint) {
            newFrame = inPoint;
          }
        }
      } else {
        // 原有的全範圍播放邏輯
        if (newFrame >= totalFrames) {
          if (isLooping) {
            newFrame = newFrame % totalFrames;
          } else {
            newFrame = totalFrames;
            state.pause();
            return;
          }
        }
      }

      frameRef.current = newFrame;

      // 只在整數幀變化時更新 store（節流）
      const frameInt = Math.floor(newFrame);
      if (frameInt !== lastIntFrameRef.current) {
        lastIntFrameRef.current = frameInt;
        state.setCurrentFrame(frameInt);
      }

      // 更新活躍片段並發送事件
      updateActiveClips(frameInt);
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
