import type { EffectItem } from '../../presentation/features/effect-panel/components/EffectTestPanel';
import { PlayEffectUseCase } from './PlayEffectUseCase';
import { getClipId, type IdentifiableClip } from '../../utils/clip/clipIdentifierUtils';
import { EffectHandleRegistry } from '../../infrastructure/effect/EffectHandleRegistry';
import * as THREE from 'three';

/**
 * 特效同步 Use Case
 * 負責處理動畫播放時的特效觸發邏輯
 */
export class EffectSyncUseCase {
  private lastTimeRef: React.MutableRefObject<number>;
  private lastEffectFrameRef: React.MutableRefObject<number>;
  private fps: number = 30;
  private getModel: () => THREE.Group | null;
  private getBones: () => THREE.Object3D[];

  constructor(
    lastTimeRef: React.MutableRefObject<number>,
    lastEffectFrameRef: React.MutableRefObject<number>,
    getModel: () => THREE.Group | null,
    getBones: () => THREE.Object3D[]
  ) {
    this.lastTimeRef = lastTimeRef;
    this.lastEffectFrameRef = lastEffectFrameRef;
    this.getModel = getModel;
    this.getBones = getBones;
  }

  /**
   * 處理時間更新並觸發特效
   */
  handleTimeUpdate(
    time: number,
    isPlaying: boolean,
    clip: IdentifiableClip | null,
    effects: EffectItem[]
  ): void {
    // 不論是否在播放，都要更新跟隨骨骼的特效位置
    EffectHandleRegistry.updateAll();

    if (!isPlaying || !clip) {
      return;
    }

    // Detect loop or seek (if time goes backward)
    if (time < this.lastTimeRef.current) {
      this.lastEffectFrameRef.current = -1;
      this.lastTimeRef.current = time;
      // console.log(`[EffectSync] Time went backward, resetting. New time: ${time.toFixed(3)}s`);
      return;
    }

    const previousTime = this.lastTimeRef.current;
    const currentClipId = getClipId(clip);
    
    // 重要：保存 previousTime，因為我們需要在處理完成後才更新 lastTimeRef
    const savedPreviousTime = previousTime;
    
    // 效能優化：移除過於頻繁的警告訊息
    // 僅在開發模式且時間完全相同時才警告（極端情況）
    if (import.meta.env.DEV && savedPreviousTime === time && savedPreviousTime !== 0) {
      console.warn(`[EffectSync] ⚠️ previousTime 和 currentTime 完全相同 (${time.toFixed(3)}s)，可能導致觸發檢測問題`);
    }

    effects.forEach(effect => {
      if (!effect.isLoaded) {
        if (effect.triggers.length > 0) {
          console.log(`[EffectSync] ⚠️ Effect "${effect.name}" has ${effect.triggers.length} triggers but is NOT LOADED!`);
        }
        return;
      }

      if (effect.triggers.length === 0) {
        return;
      }

      effect.triggers.forEach(trigger => {
        // 使用 customId 進行精確匹配
        const triggerClipId = trigger.clipId;
        
        // 詳細日誌每個 trigger
        if (triggerClipId === currentClipId) {
          // 改進觸發檢測：使用 frame 數來判斷，避免浮點數精度問題
          const currentFrame = Math.floor(time * this.fps);
          const previousFrame = Math.floor(savedPreviousTime * this.fps);
          const triggerFrame = trigger.frame;
          
          // 觸發條件：當前 frame 等於或超過 trigger frame，且之前還沒觸發過
          // 使用更寬鬆的條件：如果 previousFrame < triggerFrame <= currentFrame，就觸發
          // 這確保即使時間跳躍也能觸發
          const shouldTrigger = previousFrame < triggerFrame && triggerFrame <= currentFrame;
          
          // 僅在實際觸發時記錄，避免大量重複日誌
          if (shouldTrigger) {
            console.log(`[EffectSync] ✓ Trigger "${effect.name}" @ frame ${trigger.frame}: clipId=${triggerClipId}, currentFrame=${currentFrame}, previousFrame=${previousFrame}`);
          }

          if (shouldTrigger) {
            console.log(`[Effect Trigger] ✓✓✓ PLAYING: ${effect.name} at frame ${trigger.frame} for clip ${clip.displayName || clip.name}`);
            
            // 計算位置
            let x = effect.position[0];
            let y = effect.position[1];
            let z = effect.position[2];
            
            // 處理 bone 綁定
            const model = this.getModel();
            const bones = this.getBones();
            
            if (effect.boundBoneUuid && model) {
              const boundBone = bones.find(b => b.uuid === effect.boundBoneUuid);
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
            
            if (effect.boundBoneUuid && model) {
              const boundBone = bones.find(b => b.uuid === effect.boundBoneUuid);
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
            const handle = PlayEffectUseCase.execute({
              id: effect.id,
              x, y, z,
              rx: rx * Math.PI / 180,
              ry: ry * Math.PI / 180,
              rz: rz * Math.PI / 180,
              sx: effect.scale[0], sy: effect.scale[1], sz: effect.scale[2],
              speed: effect.speed
            });
            
            if (!handle) {
              console.error(`[Effect Trigger] ✗✗✗ FAILED to play effect: ${effect.name} (id: ${effect.id})`);
            } else {
              console.log(`[Effect Trigger] ✓✓✓ Successfully started playing effect: ${effect.name}`);
              
              // 如果有綁定骨骼，註冊到 Registry 以持續跟隨
              if (effect.boundBoneUuid && model) {
                const boundBone = bones.find(b => b.uuid === effect.boundBoneUuid);
                if (boundBone) {
                  // 使用 trigger.id 作為 key，確保同一個 trigger 只有一個播放實例
                  EffectHandleRegistry.registerWithTrigger(
                    effect.id,
                    trigger.id,
                    handle,
                    boundBone,
                    effect.position,
                    effect.rotation,
                    trigger.duration
                  );
                }
              }
            }
          }
        } else {
          // 只在第一次不匹配時記錄，避免日誌過多
          if (time < 0.1) {
            console.log(`[EffectSync] Trigger "${effect.name}" @ frame ${trigger.frame}: clipId mismatch (${triggerClipId} !== ${currentClipId})`);
          }
        }
      });
    });

    // 在處理完所有觸發後，更新 lastTimeRef
    // 這樣下次調用時，previousTime 就是這次的 time
    this.lastTimeRef.current = time;
  }
}

