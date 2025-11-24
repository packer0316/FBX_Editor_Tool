import * as THREE from 'three';
import { 
  setClipIdentifier, 
  generateUniqueDisplayName, 
  type IdentifiableClip 
} from '../../utils/clip/clipIdentifierUtils';

/**
 * 動畫片段服務
 * 
 * 負責處理動畫片段的創建、切割等操作。此服務提供了從原始動畫片段中
 * 提取指定時間範圍的關鍵幀，創建新的子片段的功能。
 * 
 * @example
 * ```typescript
 * // 從原始動畫中提取第 10-50 幀
 * const subClip = AnimationClipService.createSubClip(
 *   originalClip,
 *   'Attack',
 *   10,
 *   50,
 *   30
 * );
 * ```
 */
export class AnimationClipService {
  /**
   * 從原始片段創建一個新的片段（指定起始和結束幀）
   * 
   * 從原始動畫片段中提取指定幀範圍內的關鍵幀，創建一個新的動畫片段。
   * 新片段的時間會重置為從 0 開始，並保留原始片段的所有軌道（Tracks）。
   * 
   * @param sourceClip - 原始動畫片段，將從中提取關鍵幀
   * @param name - 新片段的名稱
   * @param startFrame - 起始幀數（從 0 開始）
   * @param endFrame - 結束幀數（必須大於 startFrame）
   * @param fps - 幀率，預設為 30 FPS，用於將幀數轉換為時間（秒）
   * @returns 新創建的動畫片段，包含指定範圍內的關鍵幀，時間從 0 開始
   * @throws {Error} 當 endFrame 小於或等於 startFrame 時拋出 '結束時間必須大於起始時間' 錯誤
   * 
   * @example
   * ```typescript
   * try {
   *   // 提取第 0-30 幀（1 秒，假設 30 FPS）
   *   const attackClip = AnimationClipService.createSubClip(
   *     masterClip,
   *     'Attack Animation',
   *     0,
   *     30,
   *     30
   *   );
   *   console.log('新片段時長:', attackClip.duration); // 1.0
   * } catch (error) {
   *   console.error('創建失敗:', error.message);
   * }
   * ```
   */
  static createSubClip(
    sourceClip: THREE.AnimationClip,
    name: string,
    startFrame: number,
    endFrame: number,
    fps: number = 30,
    existingNames: string[] = []
  ): IdentifiableClip {
    const startTime = startFrame / fps;
    const endTime = endFrame / fps;
    const duration = endTime - startTime;

    if (duration <= 0) {
      throw new Error('結束時間必須大於起始時間');
    }

    // 創建新的 AnimationClip
    const newTracks: THREE.KeyframeTrack[] = [];

    sourceClip.tracks.forEach(track => {
      const times: number[] = [];
      const values: number[] = [];
      const itemSize = track.getValueSize();

      for (let keyframeIndex = 0; keyframeIndex < track.times.length; keyframeIndex++) {
        const currentTime = track.times[keyframeIndex];
        if (currentTime >= startTime && currentTime <= endTime) {
          times.push(currentTime - startTime); // 重置時間從 0 開始

          // 複製對應的值
          for (let valueIndex = 0; valueIndex < itemSize; valueIndex++) {
            values.push(track.values[keyframeIndex * itemSize + valueIndex]);
          }
        }
      }

      if (times.length > 0) {
        // 根據 track 類型創建新 track
        const TrackConstructor = track.constructor as any;
        newTracks.push(new TrackConstructor(track.name, times, values));
      }
    });

    // 生成唯一的顯示名稱（如果有重複）
    const uniqueDisplayName = generateUniqueDisplayName(name, existingNames);
    
    const newClip = new THREE.AnimationClip(name, duration, newTracks) as IdentifiableClip;

    // 設定完整的識別資訊
    setClipIdentifier(
      newClip,
      undefined,  // 自動生成 customId
      uniqueDisplayName,
      startFrame,
      endFrame
    );

    return newClip;
  }
}

