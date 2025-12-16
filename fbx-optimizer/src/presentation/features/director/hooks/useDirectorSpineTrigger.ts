/**
 * useDirectorSpineTrigger - Director Mode Spine 動畫觸發 Hook
 * 
 * 根據時間軸上的 Spine Clip 控制對應的 Spine 元素播放
 */

import { useEffect, useRef, useCallback } from 'react';
import { useDirectorStore } from '../../../stores/directorStore';
import type { DirectorClip } from '../../../../domain/entities/director/director.types';
import type { Layer } from '../../../../domain/value-objects/Layer';
import type { SpineElement2D } from '../../../../domain/value-objects/Element2D';
import { isSpineElement } from '../../../../domain/value-objects/Element2D';
import { getSpineWebglRuntimeAdapter } from '../../../../infrastructure/spine-webgl/SpineWebglRuntimeAdapter';

interface UseDirectorSpineTriggerOptions {
  /** 是否啟用（Director Mode 啟用時） */
  enabled: boolean;
  
  /** 2D 圖層列表（包含 Spine 元素） */
  layers: Layer[];
  
  /** 更新 Spine 元素狀態的回調 */
  onUpdateSpineElement: (layerId: string, elementId: string, updates: Partial<SpineElement2D>) => void;
}

interface SpineClipState {
  /** 上一幀的播放狀態 */
  wasPlaying: boolean;
  /** 上一次更新的局部時間 */
  lastLocalTime: number;
  /** 上一次的動畫名稱 */
  lastAnimation: string | null;
  /** 上一次的 Skin 名稱 */
  lastSkin: string | null;
}

/**
 * Director Mode Spine 動畫觸發 Hook
 */
export function useDirectorSpineTrigger({
  enabled,
  layers,
  onUpdateSpineElement,
}: UseDirectorSpineTriggerOptions): void {
  // 使用 ref 避免閉包問題
  const layersRef = useRef(layers);
  const onUpdateRef = useRef(onUpdateSpineElement);
  
  // Spine Clip 狀態追蹤
  const clipStatesRef = useRef<Map<string, SpineClipState>>(new Map());
  
  // 上一次的狀態
  const lastFrameRef = useRef<number>(-1);
  const lastIsPlayingRef = useRef<boolean>(false);

  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  useEffect(() => {
    onUpdateRef.current = onUpdateSpineElement;
  }, [onUpdateSpineElement]);

  // 找到 Spine 元素
  const findSpineElement = useCallback((layerId: string, elementId: string): SpineElement2D | null => {
    const layer = layersRef.current.find(l => l.id === layerId);
    if (!layer) return null;
    
    const element = layer.children.find(e => e.id === elementId);
    if (!element || !isSpineElement(element)) return null;
    
    return element;
  }, []);

  // 處理 Spine Clip 更新
  const processSpineClips = useCallback((
    tracks: ReturnType<typeof useDirectorStore.getState>['tracks'],
    currentFrame: number,
    fps: number,
    isPlaying: boolean
  ) => {
    const adapter = getSpineWebglRuntimeAdapter();

    tracks.forEach(track => {
      if (track.isMuted) return;
      
      track.clips.forEach(clip => {
        if (clip.sourceType !== 'spine' || !clip.spineLayerId || !clip.spineElementId) {
          return;
        }

        const clipState = clipStatesRef.current.get(clip.id) ?? {
          wasPlaying: false,
          lastLocalTime: 0,
          lastAnimation: null,
          lastSkin: null,
        };

        // 計算是否在 Clip 範圍內
        const isInRange = currentFrame >= clip.startFrame && currentFrame <= clip.endFrame;
        
        // 計算局部時間（秒）
        const localFrame = currentFrame - clip.startFrame;
        const localTime = Math.max(0, localFrame / fps);

        // 找到對應的 Spine 元素
        const spineElement = findSpineElement(clip.spineLayerId, clip.spineElementId);
        if (!spineElement) {
          return;
        }

        if (isInRange) {
          // 在 Clip 範圍內
          
          // 如果 Skin 不同，切換 Skin（優先處理 Skin，再處理動畫）
          const targetSkin = clip.spineSkin ?? null;
          if (clipState.lastSkin !== targetSkin && targetSkin) {
            console.log('[SpineTrigger] Switch skin:', targetSkin);
            adapter.setSkin(spineElement.spineInstanceId, targetSkin);
            onUpdateRef.current(clip.spineLayerId, clip.spineElementId, {
              currentSkin: targetSkin,
            });
          }
          
          // 如果動畫名稱不同，切換動畫
          if (clipState.lastAnimation !== clip.sourceAnimationId) {
            console.log('[SpineTrigger] Switch animation:', clip.sourceAnimationId);
            adapter.playAnimation(spineElement.spineInstanceId, clip.sourceAnimationId, clip.loop);
            onUpdateRef.current(clip.spineLayerId, clip.spineElementId, {
              currentAnimation: clip.sourceAnimationId,
              loop: clip.loop,
            });
          }

          // 更新播放狀態
          if (isPlaying && !clipState.wasPlaying) {
            // 開始播放
            console.log('[SpineTrigger] Resume:', spineElement.spineInstanceId);
            adapter.resume(spineElement.spineInstanceId);
            onUpdateRef.current(clip.spineLayerId, clip.spineElementId, {
              isPlaying: true,
              currentTime: localTime,
            });
          } else if (!isPlaying && clipState.wasPlaying) {
            // 暫停
            console.log('[SpineTrigger] Pause:', spineElement.spineInstanceId);
            adapter.pause(spineElement.spineInstanceId);
            onUpdateRef.current(clip.spineLayerId, clip.spineElementId, {
              isPlaying: false,
            });
          }

          // 如果時間軸被拖動（暫停或播放中），seek 到新位置
          if (Math.abs(localTime - clipState.lastLocalTime) > 0.05) {
            console.log('[SpineTrigger] Seek:', localTime);
            adapter.seek(spineElement.spineInstanceId, localTime);
            onUpdateRef.current(clip.spineLayerId, clip.spineElementId, {
              currentTime: localTime,
            });
          }

          // 更新狀態
          clipStatesRef.current.set(clip.id, {
            wasPlaying: isPlaying,
            lastLocalTime: localTime,
            lastAnimation: clip.sourceAnimationId,
            lastSkin: clip.spineSkin ?? null,
          });
        } else {
          // 不在 Clip 範圍內，暫停
          if (clipState.wasPlaying || clipState.lastAnimation) {
            console.log('[SpineTrigger] Out of range, pause:', spineElement.spineInstanceId);
            adapter.pause(spineElement.spineInstanceId);
            onUpdateRef.current(clip.spineLayerId, clip.spineElementId, {
              isPlaying: false,
            });
            
            clipStatesRef.current.set(clip.id, {
              wasPlaying: false,
              lastLocalTime: 0,
              lastAnimation: null,
              lastSkin: null,
            });
          }
        }
      });
    });
  }, [findSpineElement]);

  // 使用 Zustand 的 subscribe 訂閱狀態變化
  useEffect(() => {
    if (!enabled) {
      // 清理狀態
      clipStatesRef.current.clear();
      lastFrameRef.current = -1;
      lastIsPlayingRef.current = false;
      return;
    }

    // 訂閱 store 變化（Zustand 4.x 語法）
    const unsubscribe = useDirectorStore.subscribe((state) => {
      const { currentFrame, isPlaying, fps } = state.timeline;
      const { tracks } = state;

      // 只在 currentFrame 或 isPlaying 變化時處理
      if (
        currentFrame === lastFrameRef.current &&
        isPlaying === lastIsPlayingRef.current
      ) {
        return;
      }

      // 檢測停止操作（currentFrame 回到 0 且停止播放）
      const isStopAction = currentFrame === 0 && !isPlaying && 
        (lastFrameRef.current !== 0 || lastIsPlayingRef.current);
      
      if (isStopAction) {
        console.log('[SpineTrigger] Stop detected, clearing all tracks');
        const adapter = getSpineWebglRuntimeAdapter();
        adapter.clearAllTracks();
        clipStatesRef.current.clear();
      }

      lastFrameRef.current = currentFrame;
      lastIsPlayingRef.current = isPlaying;

      // 處理所有 Spine Clips（停止時也要處理，確保狀態同步）
      processSpineClips(tracks, currentFrame, fps, isPlaying);
    });

    // 立即執行一次
    const state = useDirectorStore.getState();
    processSpineClips(
      state.tracks,
      state.timeline.currentFrame,
      state.timeline.fps,
      state.timeline.isPlaying
    );

    return unsubscribe;
  }, [enabled, processSpineClips]);

  // 當 enabled 變為 false 時，暫停所有 Spine
  useEffect(() => {
    if (!enabled) {
      const adapter = getSpineWebglRuntimeAdapter();
      
      // 遍歷所有圖層找出 Spine 元素並暫停
      layersRef.current.forEach(layer => {
        layer.children.forEach(element => {
          if (isSpineElement(element)) {
            adapter.pause(element.spineInstanceId);
          }
        });
      });
    }
  }, [enabled]);
}

export default useDirectorSpineTrigger;
