/**
 * useDirectorAudioTrigger - Director Mode 音效觸發 Hook
 * 
 * 訂閱 clipUpdate 事件，處理音效觸發邏輯
 */

import { useEffect, useRef } from 'react';
import { directorEventBus, type ClipUpdateEvent } from '../../../../infrastructure/events';
import type { AudioTrack } from '../../../../domain/value-objects/AudioTrack';

interface AudioController {
  play: (track: AudioTrack) => void;
}

interface ModelWithAudio {
  id: string;
  audioTracks: AudioTrack[];
}

interface UseDirectorAudioTriggerOptions {
  enabled: boolean;
  models: ModelWithAudio[];
  audioController: AudioController;
}

export function useDirectorAudioTrigger({
  enabled,
  models,
  audioController,
}: UseDirectorAudioTriggerOptions): void {
  // 使用 ref 避免閉包問題
  const modelsRef = useRef(models);
  const audioControllerRef = useRef(audioController);

  useEffect(() => {
    modelsRef.current = models;
  }, [models]);

  useEffect(() => {
    audioControllerRef.current = audioController;
  }, [audioController]);

  // 追蹤已觸發的音效（避免重複觸發）
  const triggeredAudioRef = useRef<Set<string>>(new Set());
  const lastFrameRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!enabled) {
      triggeredAudioRef.current.clear();
      lastFrameRef.current.clear();
      return;
    }

    const unsubscribe = directorEventBus.onClipUpdate((event: ClipUpdateEvent) => {
      const { modelId, animationId, localFrame } = event;

      // 找到對應的模型
      const model = modelsRef.current.find(m => m.id === modelId);
      if (!model) return;

      // 檢查是否跳到新幀（避免同一幀重複觸發）
      const frameKey = `${modelId}-${animationId}`;
      const lastFrame = lastFrameRef.current.get(frameKey);
      
      if (lastFrame === localFrame) return;
      lastFrameRef.current.set(frameKey, localFrame);

      // 清理已觸發的音效（如果幀倒退了）
      if (lastFrame !== undefined && localFrame < lastFrame) {
        triggeredAudioRef.current.clear();
      }

      // 觸發音效
      model.audioTracks.forEach((track) => {
        track.triggers.forEach((trigger) => {
          if (trigger.clipId === animationId && trigger.frame === localFrame) {
            const triggerKey = `${track.id}-${trigger.clipId}-${trigger.frame}`;
            
            // 避免重複觸發
            if (!triggeredAudioRef.current.has(triggerKey)) {
              triggeredAudioRef.current.add(triggerKey);
              audioControllerRef.current.play(track);
            }
          }
        });
      });
    });

    return unsubscribe;
  }, [enabled]);
}

export default useDirectorAudioTrigger;

