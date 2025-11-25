import * as THREE from 'three';

/**
 * 片段識別工具
 * 
 * 提供片段唯一識別相關的工具函數，解決相同名稱片段無法區分的問題。
 */

/**
 * 擴展的 AnimationClip 類型，包含自訂識別屬性
 */
export interface IdentifiableClip extends THREE.AnimationClip {
  customId?: string;      // 自訂唯一 ID
  displayName?: string;   // UI 顯示名稱（可能包含序號）
  startFrame?: number;    // 起始幀
  endFrame?: number;      // 結束幀
}

/**
 * 生成唯一的 Clip ID
 * 
 * @returns 唯一的識別碼（時間戳 + 隨機數）
 * 
 * @example
 * ```typescript
 * const id = generateUniqueClipId(); // "clip_1234567890123_abc"
 * ```
 */
export function generateUniqueClipId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 5);
  return `clip_${timestamp}_${random}`;
}

/**
 * 生成唯一的顯示名稱
 * 
 * 如果名稱已存在，自動添加序號。
 * 
 * @param baseName - 基礎名稱
 * @param existingNames - 已存在的名稱列表
 * @returns 唯一的顯示名稱
 * 
 * @example
 * ```typescript
 * generateUniqueDisplayName('Attack', ['Attack', 'Attack_1'])
 * // 返回: "Attack_2"
 * ```
 */
export function generateUniqueDisplayName(
  baseName: string,
  existingNames: string[]
): string {
  // 如果名稱不存在，直接返回
  if (!existingNames.includes(baseName)) {
    return baseName;
  }

  // 尋找可用的序號
  let counter = 1;
  let uniqueName = `${baseName}_${counter}`;
  
  while (existingNames.includes(uniqueName)) {
    counter++;
    uniqueName = `${baseName}_${counter}`;
  }
  
  return uniqueName;
}

/**
 * 為 Clip 設定識別屬性
 * 
 * @param clip - 動畫片段
 * @param customId - 自訂 ID（選填，未提供則自動生成）
 * @param displayName - 顯示名稱（選填，未提供則使用 clip.name）
 * @param startFrame - 起始幀（選填）
 * @param endFrame - 結束幀（選填）
 * 
 * @example
 * ```typescript
 * const clip = new THREE.AnimationClip('Attack', 1.0, tracks);
 * setClipIdentifier(clip, undefined, 'Attack_1', 0, 30);
 * console.log(clip.customId); // "clip_1234567890123_abc"
 * console.log(clip.displayName); // "Attack_1"
 * ```
 */
export function setClipIdentifier(
  clip: IdentifiableClip,
  customId?: string,
  displayName?: string,
  startFrame?: number,
  endFrame?: number
): void {
  clip.customId = customId || generateUniqueClipId();
  clip.displayName = displayName || clip.name;
  
  if (startFrame !== undefined) {
    clip.startFrame = startFrame;
  }
  if (endFrame !== undefined) {
    clip.endFrame = endFrame;
  }
}

/**
 * 複製 Clip 的識別屬性
 * 
 * 當 clone() 片段時，保留原始片段的 metadata，但生成新的 customId。
 * 
 * @param sourceClip - 來源片段
 * @param targetClip - 目標片段
 * @param generateNewId - 是否生成新的 customId（預設為 true）
 * 
 * @example
 * ```typescript
 * const clonedClip = originalClip.clone();
 * copyClipIdentifier(originalClip, clonedClip);
 * // clonedClip 會有新的 customId，但保留 displayName 和 frame 資訊
 * ```
 */
export function copyClipIdentifier(
  sourceClip: IdentifiableClip,
  targetClip: IdentifiableClip,
  generateNewId: boolean = true
): void {
  targetClip.customId = generateNewId ? generateUniqueClipId() : sourceClip.customId;
  targetClip.displayName = sourceClip.displayName;
  targetClip.startFrame = sourceClip.startFrame;
  targetClip.endFrame = sourceClip.endFrame;
}

/**
 * 取得 Clip 的顯示名稱
 * 
 * @param clip - 動畫片段
 * @returns 顯示名稱（優先使用 displayName，fallback 到 name）
 */
export function getClipDisplayName(clip: IdentifiableClip): string {
  return clip.displayName || clip.name;
}

/**
 * 取得 Clip 的唯一識別碼
 * 
 * @param clip - 動畫片段
 * @returns 唯一識別碼（優先使用 customId，fallback 到 uuid）
 */
export function getClipId(clip: IdentifiableClip): string {
  return clip.customId || clip.uuid;
}

/**
 * 檢查兩個 Clip 是否為同一片段
 * 
 * @param clip1 - 片段 1
 * @param clip2 - 片段 2
 * @returns 是否為同一片段
 */
export function isSameClip(clip1: IdentifiableClip | null, clip2: IdentifiableClip | null): boolean {
  if (!clip1 || !clip2) return false;
  return getClipId(clip1) === getClipId(clip2);
}

/**
 * 從 Clips 列表中取得所有顯示名稱
 * 
 * @param clips - 片段列表
 * @returns 顯示名稱陣列
 */
export function getExistingDisplayNames(clips: IdentifiableClip[]): string[] {
  return clips.map(clip => getClipDisplayName(clip));
}





