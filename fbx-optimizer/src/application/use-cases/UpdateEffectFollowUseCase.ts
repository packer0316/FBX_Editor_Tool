import { EffectHandleRegistry } from '../../infrastructure/effect/EffectHandleRegistry';

/**
 * UpdateEffectFollowUseCase
 *
 * 統一更新所有「綁定骨骼跟隨」的 Effekseer 特效。
 * 這個更新必須在 Three.js 已更新完 bone 的 matrixWorld 之後呼叫，
 * 否則會出現「有時對、有時不對」的方向/位置抖動。
 */
export class UpdateEffectFollowUseCase {
  static execute(): void {
    EffectHandleRegistry.updateAll();
  }
}



