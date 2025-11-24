import * as THREE from 'three';

/**
 * 計算動畫片段中的關鍵幀總數
 * 
 * 遍歷動畫片段中的所有軌道（Tracks），計算所有關鍵幀的總數。
 * 這通常用於顯示優化前後的關鍵幀數量對比。
 * 
 * @param clip - Three.js 動畫片段，如果為 null 則返回 0
 * @returns 關鍵幀總數
 * 
 * @example
 * ```typescript
 * const originalCount = countKeyframes(originalClip);
 * const optimizedCount = countKeyframes(optimizedClip);
 * console.log(`優化前: ${originalCount} 個關鍵幀`);
 * console.log(`優化後: ${optimizedCount} 個關鍵幀`);
 * console.log(`減少: ${((1 - optimizedCount / originalCount) * 100).toFixed(1)}%`);
 * ```
 */
export function countKeyframes(clip: THREE.AnimationClip | null): number {
  if (!clip) return 0;
  return clip.tracks.reduce((acc, track) => acc + track.times.length, 0);
}

