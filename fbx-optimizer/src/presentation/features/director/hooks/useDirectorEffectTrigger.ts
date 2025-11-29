/**
 * useDirectorEffectTrigger - Director Mode 特效觸發 Hook
 * 
 * 訂閱 clipUpdate 事件，處理特效觸發邏輯
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { directorEventBus, type ClipUpdateEvent } from '../../../../infrastructure/events';
import { PlayEffectUseCase } from '../../../../application/use-cases/PlayEffectUseCase';
import type { EffectItem } from '../../../features/effect-panel/components/EffectTestPanel';

interface ModelWithEffect {
  id: string;
  model: THREE.Group | null;
  bones: THREE.Bone[];
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

            // 計算位置（包含骨骼綁定）
            let x = effect.position[0];
            let y = effect.position[1];
            let z = effect.position[2];

            if (effect.boundBoneUuid && model.model) {
              const boundBone = model.bones.find(b => b.uuid === effect.boundBoneUuid);
              if (boundBone) {
                const boneWorldPos = new THREE.Vector3();
                boundBone.getWorldPosition(boneWorldPos);
                x = boneWorldPos.x + effect.position[0];
                y = boneWorldPos.y + effect.position[1];
                z = boneWorldPos.z + effect.position[2];
              }
            }

            // 計算旋轉
            let rx = effect.rotation[0];
            let ry = effect.rotation[1];
            let rz = effect.rotation[2];

            if (effect.boundBoneUuid && model.model) {
              const boundBone = model.bones.find(b => b.uuid === effect.boundBoneUuid);
              if (boundBone) {
                const boneWorldQuat = new THREE.Quaternion();
                boundBone.getWorldQuaternion(boneWorldQuat);
                const boneEuler = new THREE.Euler().setFromQuaternion(boneWorldQuat);

                rx = (boneEuler.x * 180 / Math.PI) + effect.rotation[0];
                ry = (boneEuler.y * 180 / Math.PI) + effect.rotation[1];
                rz = (boneEuler.z * 180 / Math.PI) + effect.rotation[2];
              }
            }

            // 播放特效
            PlayEffectUseCase.execute({
              id: effect.id,
              x, y, z,
              rx: rx * Math.PI / 180,
              ry: ry * Math.PI / 180,
              rz: rz * Math.PI / 180,
              sx: effect.scale[0],
              sy: effect.scale[1],
              sz: effect.scale[2],
              speed: effect.speed,
            });
          }
        });
      });
    });

    return unsubscribe;
  }, [enabled]);
}

export default useDirectorEffectTrigger;

