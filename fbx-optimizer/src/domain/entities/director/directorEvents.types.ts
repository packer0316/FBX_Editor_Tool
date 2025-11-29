/**
 * Director Mode 事件類型定義
 */

/** Tick 事件 - 由 SceneViewer 的 useFrame 發送 */
export interface TickEvent {
  /** 距離上一幀的時間（秒） */
  delta: number;
}

/** Seek 事件 - 當用戶手動跳轉時間軸時發送 */
export interface SeekEvent {
  /** 目標幀 */
  frame: number;
}

/** ClipUpdate 事件 - 當 clip 需要更新時發送 */
export interface ClipUpdateEvent {
  /** 模型 ID */
  modelId: string;
  /** 動畫 ID */
  animationId: string;
  /** 局部時間（秒） */
  localTime: number;
  /** 局部幀數 */
  localFrame: number;
}

/** 所有 Director 事件類型的聯合 */
export type DirectorEvent = 
  | { type: 'tick'; payload: TickEvent }
  | { type: 'seek'; payload: SeekEvent }
  | { type: 'clipUpdate'; payload: ClipUpdateEvent };

