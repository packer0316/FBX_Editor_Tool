/**
 * useTimelinePlayback - 時間軸播放控制 Hook
 * 
 * 實現 Director Mode 的播放功能：
 * - requestAnimationFrame 播放循環
 * - 根據當前幀計算各片段的局部時間
 * - 回調通知外部更新模型動畫
 */

import { useEffect, useRef, useCallback } from 'react';
import { useDirectorStore } from '../../../stores/directorStore';
import { getClipLocalTime } from '../../../../utils/director/directorUtils';
import type { ClipLocalTimeResult } from '../../../../domain/entities/director/director.types';

export interface PlaybackCallbacks {
  /** 當需要更新模型動畫時調用 */
  onUpdateModelAnimation: (
    modelId: string,
    animationId: string,
    localTime: number,
    localFrame: number // 當前幀數（用於觸發音效和特效）
  ) => void;
  
  /** 當片段開始播放時調用 */
  onClipStart?: (clipId: string, modelId: string, animationId: string) => void;
  
  /** 當片段結束播放時調用 */
  onClipEnd?: (clipId: string, modelId: string, animationId: string) => void;
}

interface UseTimelinePlaybackOptions {
  callbacks: PlaybackCallbacks;
}

interface UseTimelinePlaybackReturn {
  /** 當前播放中的片段資訊 */
  activeClips: ClipLocalTimeResult[];
}

export function useTimelinePlayback(
  options: UseTimelinePlaybackOptions
): UseTimelinePlaybackReturn {
  const { callbacks } = options;
  
  const {
    timeline,
    tracks,
    setCurrentFrame,
  } = useDirectorStore();
  
  const { isPlaying, currentFrame, fps, totalFrames, isLooping } = timeline;
  
  // Refs for animation loop
  const lastTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  const currentFrameRef = useRef<number>(currentFrame); // 追蹤當前幀（避免閉包問題）
  const activeClipsRef = useRef<Map<string, ClipLocalTimeResult>>(new Map());
  const previousActiveClipIds = useRef<Set<string>>(new Set());
  
  // 同步 currentFrame 到 ref
  useEffect(() => {
    currentFrameRef.current = currentFrame;
  }, [currentFrame]);
  
  // Callbacks ref to avoid stale closures
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

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

  // 更新所有活躍片段的動畫
  const updateActiveClips = useCallback((frame: number) => {
    const activeClips = getActiveClipsAtCurrentFrame(frame);
    const currentActiveClipIds = new Set<string>();
    
    // 更新活躍片段的動畫
    for (const clipResult of activeClips) {
      const { clip, localTime } = clipResult;
      currentActiveClipIds.add(clip.id);
      
      // 通知外部更新模型動畫
      if (localTime !== null) {
        const localFrame = Math.floor(localTime * fps);
        callbacksRef.current.onUpdateModelAnimation(
          clip.sourceModelId,
          clip.sourceAnimationId,
          localTime,
          localFrame
        );
      }
      
      // 檢查片段是否剛開始播放
      if (!previousActiveClipIds.current.has(clip.id)) {
        callbacksRef.current.onClipStart?.(
          clip.id,
          clip.sourceModelId,
          clip.sourceAnimationId
        );
      }
    }
    
    // 檢查片段是否結束
    for (const prevClipId of previousActiveClipIds.current) {
      if (!currentActiveClipIds.has(prevClipId)) {
        // 找到結束的片段資訊
        const prevClip = activeClipsRef.current.get(prevClipId);
        if (prevClip) {
          callbacksRef.current.onClipEnd?.(
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

  // 播放循環
  useEffect(() => {
    if (!isPlaying) {
      // 停止播放時取消動畫幀
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = 0;
      }
      return;
    }
    
    lastTimeRef.current = performance.now();
    
    const animate = (currentTime: number) => {
      const deltaTime = (currentTime - lastTimeRef.current) / 1000; // 轉換為秒
      lastTimeRef.current = currentTime;
      
      // 獲取當前狀態
      const state = useDirectorStore.getState();
      const { fps: currentFps, totalFrames: currentTotalFrames, isLooping: currentIsLooping } = state.timeline;
      
      // 計算新的幀位置（使用 ref 避免閉包問題）
      const frameDelta = deltaTime * currentFps;
      let newFrame = currentFrameRef.current + frameDelta;
      
      // 處理循環或結束
      if (newFrame >= currentTotalFrames) {
        if (currentIsLooping) {
          newFrame = newFrame % currentTotalFrames;
        } else {
          newFrame = currentTotalFrames;
          // 播放結束，停止
          state.pause();
          return;
        }
      }
      
      // 更新當前幀
      const frameInt = Math.floor(newFrame);
      currentFrameRef.current = newFrame; // 保持小數精度
      state.setCurrentFrame(frameInt);
      
      // 更新活躍片段
      updateActiveClips(frameInt);
      
      // 繼續下一幀
      if (useDirectorStore.getState().timeline.isPlaying) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = 0;
      }
    };
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

