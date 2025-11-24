import * as THREE from 'three';
import { AnimationClipService } from '../../domain/services/AnimationClipService';
import { getExistingDisplayNames, type IdentifiableClip } from '../../utils/clip/clipIdentifierUtils';

/**
 * 創建片段 Use Case
 * 
 * 負責協調動畫片段創建的業務邏輯，從原始動畫片段中提取指定範圍的關鍵幀，
 * 創建一個新的子片段。這通常用於將長動畫分割成多個較短的片段。
 * 
 * @example
 * ```typescript
 * // 從原始動畫中提取第 10-50 幀作為新片段
 * const newClip = CreateClipUseCase.execute(
 *   originalClip,
 *   'Attack Animation',
 *   10,
 *   50,
 *   30
 * );
 * ```
 */
export class CreateClipUseCase {
  /**
   * 執行片段創建
   * 
   * @param sourceClip - 原始動畫片段，將從中提取關鍵幀
   * @param name - 新片段的名稱
   * @param startFrame - 起始幀數（從 0 開始）
   * @param endFrame - 結束幀數（必須大於 startFrame）
   * @param fps - 幀率，預設為 30 FPS，用於將幀數轉換為時間
   * @returns 新創建的動畫片段，包含指定範圍內的關鍵幀
   * @throws {Error} 當 endFrame 小於或等於 startFrame 時拋出錯誤
   * 
   * @example
   * ```typescript
   * try {
   *   const attackClip = CreateClipUseCase.execute(
   *     masterClip,
   *     'Attack',
   *     0,
   *     30,
   *     30
   *   );
   *   console.log('新片段時長:', attackClip.duration); // 1.0 秒
   * } catch (error) {
   *   console.error('創建失敗:', error.message);
   * }
   * ```
   */
  static execute(
    sourceClip: THREE.AnimationClip,
    name: string,
    startFrame: number,
    endFrame: number,
    fps: number = 30,
    existingClips: IdentifiableClip[] = []
  ): IdentifiableClip {
    // 取得現有的顯示名稱以避免衝突
    const existingNames = getExistingDisplayNames(existingClips);
    
    return AnimationClipService.createSubClip(
      sourceClip, 
      name, 
      startFrame, 
      endFrame, 
      fps,
      existingNames
    );
  }
}

