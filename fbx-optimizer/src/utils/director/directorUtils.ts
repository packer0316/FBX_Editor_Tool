/**
 * Director Mode 工具函數
 */

import type {
  DirectorClip,
  DirectorTrack,
  ClipLocalTimeResult,
} from '../../domain/entities/director/director.types';
import { DEFAULT_FPS } from '../../domain/entities/director/director.types';

// ============================================================================
// 時間轉換函數
// ============================================================================

/**
 * 將幀數轉換為秒數
 */
export function frameToSeconds(frame: number, fps: number = DEFAULT_FPS): number {
  return frame / fps;
}

/**
 * 將秒數轉換為幀數
 */
export function secondsToFrame(seconds: number, fps: number = DEFAULT_FPS): number {
  return Math.round(seconds * fps);
}

/**
 * 計算片段在全域時間軸上的局部時間
 * 
 * @param globalFrame - 全域時間軸當前幀
 * @param clip - 片段
 * @param fps - 幀率
 * @returns 局部時間結果
 */
export function getClipLocalTime(
  globalFrame: number,
  clip: DirectorClip,
  fps: number = DEFAULT_FPS
): ClipLocalTimeResult {
  const isActive = globalFrame >= clip.startFrame && globalFrame <= clip.endFrame;
  
  if (!isActive) {
    return {
      isActive: false,
      localTime: null,
      clip,
    };
  }
  
  const localFrame = globalFrame - clip.startFrame;
  const localTime = frameToSeconds(localFrame, fps);
  
  return {
    isActive: true,
    localTime,
    clip,
  };
}

/**
 * 取得指定幀所有活躍的片段及其局部時間
 */
export function getActiveClipsWithLocalTime(
  globalFrame: number,
  tracks: DirectorTrack[],
  fps: number = DEFAULT_FPS
): ClipLocalTimeResult[] {
  const results: ClipLocalTimeResult[] = [];
  
  for (const track of tracks) {
    if (track.isMuted) continue;
    
    for (const clip of track.clips) {
      const result = getClipLocalTime(globalFrame, clip, fps);
      if (result.isActive) {
        results.push(result);
      }
    }
  }
  
  return results;
}

// ============================================================================
// 片段衝突檢測
// ============================================================================

/**
 * 檢查兩個片段是否重疊
 */
export function isClipsOverlapping(clipA: DirectorClip, clipB: DirectorClip): boolean {
  return !(clipA.endFrame < clipB.startFrame || clipB.endFrame < clipA.startFrame);
}

/**
 * 檢查新片段是否與軌道上現有片段重疊
 * 
 * @param track - 軌道
 * @param startFrame - 新片段起始幀
 * @param endFrame - 新片段結束幀
 * @param excludeClipId - 排除的片段 ID（用於移動時排除自身）
 */
export function hasOverlapInTrack(
  track: DirectorTrack,
  startFrame: number,
  endFrame: number,
  excludeClipId?: string
): boolean {
  for (const clip of track.clips) {
    if (excludeClipId && clip.id === excludeClipId) {
      continue;
    }
    
    if (!(endFrame < clip.startFrame || clip.endFrame < startFrame)) {
      return true;
    }
  }
  
  return false;
}

/**
 * 找出與指定範圍重疊的所有片段
 */
export function findOverlappingClips(
  track: DirectorTrack,
  startFrame: number,
  endFrame: number,
  excludeClipId?: string
): DirectorClip[] {
  return track.clips.filter((clip) => {
    if (excludeClipId && clip.id === excludeClipId) {
      return false;
    }
    return !(endFrame < clip.startFrame || clip.endFrame < startFrame);
  });
}

// ============================================================================
// 吸附功能
// ============================================================================

/**
 * 吸附到最近的幀格線
 * 
 * @param frame - 當前幀
 * @param gridSize - 格線間距（幀數）
 */
export function snapToGrid(frame: number, gridSize: number = 1): number {
  return Math.round(frame / gridSize) * gridSize;
}

/**
 * 吸附到最近的片段邊緣
 * 
 * @param frame - 當前幀
 * @param tracks - 軌道列表
 * @param threshold - 吸附閾值（幀數）
 * @param excludeClipId - 排除的片段 ID
 */
export function snapToClipEdges(
  frame: number,
  tracks: DirectorTrack[],
  threshold: number = 5,
  excludeClipId?: string
): number {
  let nearestFrame = frame;
  let minDistance = threshold + 1;
  
  for (const track of tracks) {
    for (const clip of track.clips) {
      if (excludeClipId && clip.id === excludeClipId) {
        continue;
      }
      
      // 檢查起始幀
      const startDistance = Math.abs(frame - clip.startFrame);
      if (startDistance < minDistance) {
        minDistance = startDistance;
        nearestFrame = clip.startFrame;
      }
      
      // 檢查結束幀 + 1（下一個片段的起始位置）
      const endDistance = Math.abs(frame - (clip.endFrame + 1));
      if (endDistance < minDistance) {
        minDistance = endDistance;
        nearestFrame = clip.endFrame + 1;
      }
    }
  }
  
  return nearestFrame;
}

// ============================================================================
// 時間格式化
// ============================================================================

/**
 * 將幀數格式化為時間字串
 * 
 * @param frame - 幀數
 * @param fps - 幀率
 * @param showFrames - 是否顯示幀數
 */
export function formatFrameTime(
  frame: number,
  fps: number = DEFAULT_FPS,
  showFrames: boolean = true
): string {
  const totalSeconds = frame / fps;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const frames = frame % fps;
  
  if (showFrames) {
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  }
  
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * 將時間字串解析為幀數
 * 
 * @param timeString - 時間字串（格式：MM:SS 或 MM:SS:FF）
 * @param fps - 幀率
 */
export function parseTimeToFrame(timeString: string, fps: number = DEFAULT_FPS): number {
  const parts = timeString.split(':').map(Number);
  
  if (parts.length === 2) {
    // MM:SS
    const [minutes, seconds] = parts;
    return (minutes * 60 + seconds) * fps;
  } else if (parts.length === 3) {
    // MM:SS:FF
    const [minutes, seconds, frames] = parts;
    return (minutes * 60 + seconds) * fps + frames;
  }
  
  return 0;
}

// ============================================================================
// 軌道操作
// ============================================================================

/**
 * 計算軌道上所有片段佔用的總幀數
 */
export function calculateTrackDuration(track: DirectorTrack): number {
  if (track.clips.length === 0) return 0;
  
  return Math.max(...track.clips.map((c) => c.endFrame));
}

/**
 * 計算所有軌道的最大結束幀
 */
export function calculateTimelineDuration(tracks: DirectorTrack[]): number {
  if (tracks.length === 0) return 0;
  
  return Math.max(...tracks.map(calculateTrackDuration), 0);
}

/**
 * 根據模型 ID 分組片段
 */
export function groupClipsByModel(tracks: DirectorTrack[]): Map<string, DirectorClip[]> {
  const result = new Map<string, DirectorClip[]>();
  
  for (const track of tracks) {
    for (const clip of track.clips) {
      const existing = result.get(clip.sourceModelId) ?? [];
      existing.push(clip);
      result.set(clip.sourceModelId, existing);
    }
  }
  
  return result;
}

