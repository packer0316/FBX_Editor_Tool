import { useRef, useCallback } from 'react';
import { type IdentifiableClip } from '../../utils/clip/clipIdentifierUtils';
import { getClipId } from '../../utils/clip/clipIdentifierUtils';
import { optimizeAnimationClip } from '../../utils/optimizer';

/**
 * Clip 優化 Hook
 * 
 * 提供帶快取的動畫片段優化功能，避免重複計算相同的 clip+tolerance 組合。
 * 使用 Map 快取已優化的結果，大幅減少記憶體分配和計算時間。
 * 
 * @example
 * ```typescript
 * const { optimize } = useClipOptimizer();
 * const optimizedClip = optimize(originalClip, 0.01);
 * ```
 */
export function useClipOptimizer() {
  // 使用 clipId+tolerance 作為 key 的快取
  const cacheRef = useRef<Map<string, IdentifiableClip>>(new Map());
  
  /**
   * 優化動畫片段（帶快取）
   * 
   * @param clip 原始動畫片段
   * @param tolerance 優化容忍度
   * @returns 優化後的動畫片段，如果輸入為 null 則返回 null
   */
  const optimize = useCallback((
    clip: IdentifiableClip | null, 
    tolerance: number
  ): IdentifiableClip | null => {
    if (!clip) return null;
    
    const clipId = getClipId(clip);
    const cacheKey = `${clipId}-${tolerance}`;
    
    // 檢查快取
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    // 計算並快取
    const optimized = optimizeAnimationClip(clip, tolerance) as IdentifiableClip;
    cacheRef.current.set(cacheKey, optimized);
    
    return optimized;
  }, []);
  
  /**
   * 清除快取（用於記憶體管理）
   */
  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);
  
  /**
   * 獲取快取大小（用於監控）
   */
  const getCacheSize = useCallback(() => {
    return cacheRef.current.size;
  }, []);
  
  return {
    optimize,
    clearCache,
    getCacheSize
  };
}

