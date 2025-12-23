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

/** 程式化動畫類型（從 director.types.ts 引用，這裡重複定義避免循環依賴） */
export type ProceduralAnimationTypeEvent = 'show' | 'hide' | 'fadeIn' | 'fadeOut';

/** ProceduralUpdate 事件 - 當程式化動畫需要更新時發送 */
export interface ProceduralUpdateEvent {
  /** 目標模型 ID */
  modelId: string;
  /** 程式化動畫類型 */
  type: ProceduralAnimationTypeEvent;
  /** 進度 (0-1)，瞬間動畫為 0 或 1 */
  progress: number;
  /** 計算後的目標可見性 */
  targetVisible: boolean;
  /** 計算後的目標透明度 */
  targetOpacity: number;
}

/** 所有 Director 事件類型的聯合 */
export type DirectorEvent = 
  | { type: 'tick'; payload: TickEvent }
  | { type: 'seek'; payload: SeekEvent }
  | { type: 'clipUpdate'; payload: ClipUpdateEvent }
  | { type: 'proceduralUpdate'; payload: ProceduralUpdateEvent };

