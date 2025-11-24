import * as THREE from 'three';
import { copyClipIdentifier, type IdentifiableClip } from '../../utils/clip/clipIdentifierUtils';

/**
 * 動作序列播放管理 Use Case
 * 
 * 負責管理動畫序列播放的業務邏輯，包括：
 * - 添加片段到序列
 * - 從序列移除片段
 * - 重新排序序列
 * - 獲取下一個要播放的片段
 * 
 * @example
 * ```typescript
 * let playlist: THREE.AnimationClip[] = [];
 * playlist = PlaylistUseCase.addToPlaylist(playlist, clip1);
 * playlist = PlaylistUseCase.addToPlaylist(playlist, clip2);
 * const next = PlaylistUseCase.getNextClip(playlist, 0);
 * ```
 */
export class PlaylistUseCase {
  /**
   * 添加片段到動作序列
   * 
   * 將動畫片段添加到序列的末尾。為了確保每個序列項目都有唯一的引用，
   * 此方法會複製片段，避免重複添加相同片段時造成的播放問題。
   * 
   * @param playlist - 當前的序列陣列
   * @param clip - 要添加的動畫片段
   * @returns 新的序列陣列（包含複製後的片段）
   * 
   * @example
   * ```typescript
   * const newPlaylist = PlaylistUseCase.addToPlaylist(
   *   currentPlaylist,
   *   animationClip
   * );
   * setPlaylist(newPlaylist);
   * ```
   */
  static addToPlaylist(playlist: IdentifiableClip[], clip: IdentifiableClip): IdentifiableClip[] {
    // Clone the clip to ensure each playlist item has a unique reference
    // This fixes the issue where adding the same clip multiple times causes playback problems
    const clonedClip = clip.clone() as IdentifiableClip;
    
    // 複製識別資訊（保留原 customId 以共享 Audio Trigger 設定）
    copyClipIdentifier(clip, clonedClip, false);
    
    return [...playlist, clonedClip];
  }

  /**
   * 從動作序列移除片段
   * 
   * 從序列中移除指定索引的片段，並自動調整當前播放索引。
   * 如果移除的是當前正在播放的片段，會標記需要停止播放。
   * 
   * @param playlist - 當前的序列陣列
   * @param index - 要移除的片段索引
   * @param currentIndex - 當前正在播放的片段索引
   * @returns 包含新序列、是否應該停止播放、以及新的當前索引的物件
   * 
   * @example
   * ```typescript
   * const result = PlaylistUseCase.removeFromPlaylist(playlist, 2, 1);
   * setPlaylist(result.newPlaylist);
   * if (result.shouldStop) {
   *   pausePlayback();
   * }
   * setCurrentIndex(result.newCurrentIndex);
   * ```
   */
  static removeFromPlaylist(
    playlist: IdentifiableClip[],
    index: number,
    currentIndex: number
  ): { newPlaylist: IdentifiableClip[]; shouldStop: boolean; newCurrentIndex: number } {
    const newPlaylist = playlist.filter((_, i) => i !== index);
    let newCurrentIndex = currentIndex;
    let shouldStop = false;

    // Adjust current index if needed
    if (index < currentIndex) {
      newCurrentIndex = currentIndex - 1;
    } else if (index === currentIndex) {
      // If removing currently playing clip, stop playback
      shouldStop = true;
      newCurrentIndex = 0;
    }

    return { newPlaylist, shouldStop, newCurrentIndex };
  }

  /**
   * 重新排序動作序列
   * 
   * 將序列中的片段從一個位置移動到另一個位置。
   * 為了安全起見，如果在播放過程中重新排序，會標記需要停止播放。
   * 
   * @param playlist - 當前的序列陣列
   * @param fromIndex - 要移動的片段原始索引
   * @param toIndex - 目標索引位置
   * @returns 包含新序列和是否應該停止播放的物件
   * 
   * @example
   * ```typescript
   * // 將索引 0 的片段移動到索引 2
   * const result = PlaylistUseCase.reorderPlaylist(playlist, 0, 2);
   * setPlaylist(result.newPlaylist);
   * if (result.shouldStop) {
   *   pausePlayback();
   * }
   * ```
   */
  static reorderPlaylist(
    playlist: IdentifiableClip[],
    fromIndex: number,
    toIndex: number
  ): { newPlaylist: IdentifiableClip[]; shouldStop: boolean } {
    const newPlaylist = [...playlist];
    const [movedClip] = newPlaylist.splice(fromIndex, 1);
    newPlaylist.splice(toIndex, 0, movedClip);

    // If reordering during playback, stop for safety
    return { newPlaylist, shouldStop: true };
  }

  /**
   * 獲取下一個片段
   * 
   * 根據當前播放索引獲取下一個要播放的片段。如果已經到達序列末尾，
   * 則返回 null 並標記為結束。
   * 
   * @param playlist - 當前的序列陣列
   * @param currentIndex - 當前正在播放的片段索引
   * @returns 包含下一個片段、下一個索引、以及是否已到達末尾的物件
   * 
   * @example
   * ```typescript
   * const next = PlaylistUseCase.getNextClip(playlist, 0);
   * if (!next.isEnd && next.nextClip) {
   *   playClip(next.nextClip);
   *   setCurrentIndex(next.nextIndex);
   * } else {
   *   stopPlayback();
   * }
   * ```
   */
  static getNextClip(playlist: THREE.AnimationClip[], currentIndex: number): {
    nextClip: THREE.AnimationClip | null;
    nextIndex: number;
    isEnd: boolean;
  } {
    const nextIndex = currentIndex + 1;
    if (nextIndex < playlist.length) {
      return {
        nextClip: playlist[nextIndex],
        nextIndex,
        isEnd: false,
      };
    }
    return {
      nextClip: null,
      nextIndex: currentIndex, // Keep at last item
      isEnd: true,
    };
  }
}

