/**
 * useDirectorEffectTrigger - Director Mode 特效觸發 Hook
 * 
 * 訂閱 clipUpdate 事件，處理特效觸發邏輯
 */

import { useEffect, useRef } from 'react';
import type * as THREE from 'three';
import { directorEventBus, type ClipUpdateEvent } from '../../../../infrastructure/events';
import { PlayEffectUseCase } from '../../../../application/use-cases/PlayEffectUseCase';
import { EffectHandleRegistry } from '../../../../infrastructure/effect/EffectHandleRegistry';
import type { EffectItem } from '../../../features/effect-panel/components/EffectTestPanel';

interface ModelWithEffect {
  id: string;
  model: THREE.Group | null;
  bones: THREE.Object3D[];
  effects: EffectItem[];
}

interface UseDirectorEffectTriggerOptions {
  enabled: boolean;
  models: ModelWithEffect[];
}

export function useDirectorEffectTrigger({
  enabled,
  models,
}: UseDirectorEffectTriggerOptions): void {
  // 使用 ref 避免閉包問題
  const modelsRef = useRef(models);

  useEffect(() => {
    modelsRef.current = models;
  }, [models]);

  // 追蹤已觸發的特效（避免重複觸發）
  const triggeredEffectsRef = useRef<Set<string>>(new Set());
  const lastFrameRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!enabled) {
      triggeredEffectsRef.current.clear();
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

      // 清理已觸發的特效（如果幀倒退了）
      if (lastFrame !== undefined && localFrame < lastFrame) {
        triggeredEffectsRef.current.clear();
      }

      // 觸發特效
      model.effects.forEach((effect) => {
        if (!effect.isLoaded) return;

        effect.triggers.forEach((trigger) => {
          if (trigger.clipId === animationId && trigger.frame === localFrame) {
            const triggerKey = `${effect.id}-${trigger.clipId}-${trigger.frame}`;

            // 避免重複觸發
            if (triggeredEffectsRef.current.has(triggerKey)) return;
            triggeredEffectsRef.current.add(triggerKey);

            // 計算位置和旋轉（包含骨骼綁定，使用 Local Space 模擬 parent-child 關係）
            const modelGroup = model.model;
            const boundBone = effect.boundBoneUuid
              ? model.bones.find(b => b.uuid === effect.boundBoneUuid)
              : undefined;

            const shouldFollowBone = !!(boundBone && modelGroup);

            // 播放特效
            const handle = PlayEffectUseCase.execute({
              id: effect.id,
              x: shouldFollowBone ? 0 : effect.position[0],
              y: shouldFollowBone ? 0 : effect.position[1],
              z: shouldFollowBone ? 0 : effect.position[2],
              rx: shouldFollowBone ? 0 : effect.rotation[0] * Math.PI / 180,
              ry: shouldFollowBone ? 0 : effect.rotation[1] * Math.PI / 180,
              rz: shouldFollowBone ? 0 : effect.rotation[2] * Math.PI / 180,
              sx: effect.scale[0],
              sy: effect.scale[1],
              sz: effect.scale[2],
              speed: effect.speed,
            });

            // 如果有綁定骨骼，註冊到 Registry 以持續跟隨
            if (handle && shouldFollowBone && boundBone) {
              EffectHandleRegistry.registerWithTrigger(
                effect.id,
                trigger.id,
                handle,
                boundBone,
                effect.position,
                effect.rotation,
                effect.scale,
                trigger.duration
              );
            }
          }
        });
      });
    });

    return () => {
      unsubscribe();
    };
  }, [enabled]);
}

export default useDirectorEffectTrigger;

