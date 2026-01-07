/**
 * Director Mode 類型定義
 * 
 * 導演模式允許使用者在時間軸上排列多個動作片段，
 * 實現跨模型的統一動畫編排。
 */

// ============================================================================
// 常數定義
// ============================================================================

/** 預設幀率 */
export const DEFAULT_FPS = 30;

/** 預設總幀數 */
export const DEFAULT_TOTAL_FRAMES = 300;

/** 每幀像素寬度（縮放基準） */
export const DEFAULT_PIXELS_PER_FRAME = 4;

/** 最小縮放倍率 */
export const MIN_ZOOM = 0.1;

/** 最大縮放倍率 */
export const MAX_ZOOM = 5.0;

// ============================================================================
// 核心類型
// ============================================================================

/**
 * 動畫來源類型
 */
export type AnimationSourceType = '3d-model' | 'spine' | 'procedural';

// ============================================================================
// 程式化動畫類型
// ============================================================================

/**
 * 程式化動畫類型
 */
export type ProceduralAnimationType = 
  | 'fadeIn'    // 淡入（透明度 0→1）
  | 'fadeOut'   // 淡出（透明度 1→0）
  | 'scaleTo'   // 縮放（從當前大小到目標大小）
  | 'moveBy';   // 移動（相對位移）

/**
 * 緩動函數類型
 */
export type EasingType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';

/**
 * 程式化動畫設定
 */
export interface ProceduralAnimationConfig {
  /** 動畫類型 */
  type: ProceduralAnimationType;
  
  /** 緩動函數 */
  easing?: EasingType;
  
  /** 緩動強度（1-5，預設 2）- 僅 easeIn/easeOut/easeInOut 時有效 */
  easingStrength?: number;
  
  /** ScaleTo: 目標縮放值（1.0 = 100%） */
  targetScale?: number;
  
  /** MoveBy: X 軸位移量 */
  moveX?: number;
  
  /** MoveBy: Y 軸位移量 */
  moveY?: number;
  
  /** MoveBy: Z 軸位移量 */
  moveZ?: number;
}

/**
 * 預設程式化動畫定義
 */
export const PROCEDURAL_ANIMATION_PRESETS: Record<ProceduralAnimationType, {
  displayName: string;
  defaultDuration: number;  // 幀數
  color: string;
  defaultConfig?: Partial<ProceduralAnimationConfig>;
}> = {
  fadeIn: {
    displayName: 'FadeIn',
    defaultDuration: 30,
    color: '#4ade80',
  },
  fadeOut: {
    displayName: 'FadeOut',
    defaultDuration: 30,
    color: '#f87171',
  },
  scaleTo: {
    displayName: 'ScaleTo',
    defaultDuration: 30,
    color: '#60a5fa',
    defaultConfig: {
      targetScale: 1.5,
      easing: 'easeOut',
    },
  },
  moveBy: {
    displayName: 'MoveBy',
    defaultDuration: 30,
    color: '#c084fc',
    defaultConfig: {
      moveX: 0,
      moveY: 1,
      moveZ: 0,
      easing: 'easeOut',
    },
  },
};

/**
 * 片段（Clip）- 動作在軌道上的實例
 */
export interface DirectorClip {
  /** 唯一識別碼 */
  id: string;
  
  /** 所屬軌道 ID */
  trackId: string;
  
  /** 來源類型：3D 模型或 Spine */
  sourceType: AnimationSourceType;
  
  // 來源資訊（3D 模型）
  /** 來源模型 ID */
  sourceModelId: string;
  
  /** 來源模型名稱 */
  sourceModelName: string;
  
  // 來源資訊（Spine）
  /** Spine 實例 ID（sourceType === 'spine' 時使用） */
  spineInstanceId?: string;
  
  /** Spine 元素所在的 Layer ID */
  spineLayerId?: string;
  
  /** Spine 元素 ID */
  spineElementId?: string;
  
  /** Spine 播放時使用的 Skin 名稱（sourceType === 'spine' 時使用） */
  spineSkin?: string;
  
  /** 動作名稱（來自 IdentifiableClip 的 displayName） */
  sourceAnimationName: string;
  
  /** 原始動作 ID（來自 IdentifiableClip 的 customId） */
  sourceAnimationId: string;
  
  /** 原始動作幀數 */
  sourceAnimationDuration: number;
  
  // 時間軸位置
  /** 起始幀 */
  startFrame: number;
  
  /** 結束幀（自動計算：startFrame + 有效長度 - 1） */
  endFrame: number;
  
  // 剪裁設定（Trim）
  /** 剪裁入點（從原始動畫的第幾幀開始播放，預設 0） */
  trimStart: number;
  
  /** 剪裁出點（到原始動畫的第幾幀結束，預設為 sourceAnimationDuration - 1） */
  trimEnd: number;
  
  // 進階設定（未來擴充）
  /** 播放速度（預設 1.0） */
  speed: number;
  
  /** 是否在片段內循環 */
  loop: boolean;
  
  /** 混合入幀數 */
  blendIn: number;
  
  /** 混合出幀數 */
  blendOut: number;
  
  /** 顯示顏色（用於視覺區分） */
  color: string;
  
  // 程式化動畫專用欄位（sourceType === 'procedural' 時使用）
  /** 程式化動畫類型 */
  proceduralType?: ProceduralAnimationType;
  
  /** 程式化動畫設定 */
  proceduralConfig?: ProceduralAnimationConfig;
}

/**
 * 軌道（Track）- 可放置動作片段的橫向軌道
 */
export interface DirectorTrack {
  /** 唯一識別碼 */
  id: string;
  
  /** 軌道名稱 */
  name: string;
  
  /** 顯示順序 */
  order: number;
  
  /** 是否鎖定（鎖定時不可編輯） */
  isLocked: boolean;
  
  /** 是否靜音（靜音時不播放動畫） */
  isMuted: boolean;
  
  /** 軌道上的片段列表 */
  clips: DirectorClip[];
}

/**
 * 區間播放狀態（Loop Region / In-Out Points）
 */
export interface LoopRegion {
  /** 入點幀數（null 表示未設定） */
  inPoint: number | null;
  
  /** 出點幀數（null 表示未設定） */
  outPoint: number | null;
  
  /** 是否啟用區間播放 */
  enabled: boolean;
}

/**
 * 時間軸狀態
 */
export interface TimelineState {
  /** 總幀數 */
  totalFrames: number;
  
  /** 幀率 (FPS) */
  fps: number;
  
  /** 當前幀位置 */
  currentFrame: number;
  
  /** 是否正在播放 */
  isPlaying: boolean;
  
  /** 是否循環播放 */
  isLooping: boolean;
  
  /** 區間播放設定 */
  loopRegion: LoopRegion;
}

/**
 * 導演會話（DirectorSession）- 完整的編輯狀態
 */
export interface DirectorSession {
  /** 唯一識別碼 */
  id: string;
  
  /** 會話名稱 */
  name: string;
  
  /** 建立時間 */
  createdAt: Date;
  
  /** 更新時間 */
  updatedAt: Date;
  
  /** 時間軸設定 */
  timeline: Pick<TimelineState, 'totalFrames' | 'fps'>;
  
  /** 軌道列表 */
  tracks: DirectorTrack[];
}

// ============================================================================
// UI 狀態類型
// ============================================================================

/**
 * UI 狀態
 */
export interface DirectorUIState {
  /** 縮放比例（1.0 = 100%） */
  zoom: number;
  
  /** 水平捲動偏移（像素） */
  scrollOffsetX: number;
  
  /** 垂直捲動偏移（像素） */
  scrollOffsetY: number;
  
  /** 當前選中的片段 ID 列表（支援多選） */
  selectedClipIds: string[];
  
  /** Shift 選取錨點 ID */
  selectionAnchorId: string | null;
  
  /** 當前選中的軌道 ID */
  selectedTrackId: string | null;
  
  /** 是否正在拖曳 */
  isDragging: boolean;
  
  /** 拖曳中的片段資料 */
  draggingClipData: DraggingClipData | null;
  
  /** 片段吸附（Clip Snapping）開關 */
  clipSnapping: boolean;
  
  /** 多選拖曳狀態（讓所有選中的 clips 都能讀取偏移量） */
  multiDragOffset: { x: number; y: number } | null;
}

/**
 * 拖曳中的片段資料
 */
export interface DraggingClipData {
  /** 片段類型：'new' 表示從左側面板拖入，'existing' 表示移動現有片段 */
  type: 'new' | 'existing';
  
  /** 片段 ID（existing 類型時使用） */
  clipId?: string;
  
  /** 來源類型：3D 模型或 Spine */
  sourceType: AnimationSourceType;
  
  /** 來源模型 ID（3D 模型） */
  sourceModelId: string;
  
  /** 來源模型名稱 */
  sourceModelName: string;
  
  /** Spine 實例 ID（Spine 類型） */
  spineInstanceId?: string;
  
  /** Spine 元素所在的 Layer ID */
  spineLayerId?: string;
  
  /** Spine 元素 ID */
  spineElementId?: string;
  
  /** 動作 ID */
  sourceAnimationId: string;
  
  /** 動作名稱 */
  sourceAnimationName: string;
  
  /** 動作幀數 */
  durationFrames: number;
  
  /** 片段顏色（依據模型區分） */
  color?: string;
  
  /** 程式化動畫類型（sourceType === 'procedural' 時使用） */
  proceduralType?: ProceduralAnimationType;
}

// ============================================================================
// 動作來源類型（左側面板使用）
// ============================================================================

/**
 * 動作項目（用於左側面板顯示）
 */
export interface ActionSourceItem {
  /** 動作 ID（對應 IdentifiableClip 的 customId） */
  clipId: string;
  
  /** 顯示名稱 */
  displayName: string;
  
  /** 動作時長（幀數） */
  durationFrames: number;
  
  /** 動作時長（秒） */
  durationSeconds: number;
}

/**
 * 模型動作來源（用於左側面板的模型分組）
 */
export interface ActionSource {
  /** 來源類型 */
  sourceType: AnimationSourceType;
  
  /** 模型/Spine ID */
  modelId: string;
  
  /** 模型/Spine 名稱 */
  modelName: string;
  
  /** 顏色（用於片段顯示） */
  modelColor: string;
  
  /** 動作列表 */
  clips: ActionSourceItem[];
  
  /** Spine 相關資訊（sourceType === 'spine' 時） */
  spineInfo?: {
    layerId: string;
    elementId: string;
    instanceId: string;
  };
}

// ============================================================================
// 播放模式
// ============================================================================

/**
 * 播放模式
 */
export type PlaybackMode = 'single' | 'playlist' | 'director';

// ============================================================================
// 工具函數類型
// ============================================================================

/**
 * 建立新片段的參數
 */
export interface CreateClipParams {
  trackId: string;
  sourceType: AnimationSourceType;
  sourceModelId: string;
  sourceModelName: string;
  sourceAnimationId: string;
  sourceAnimationName: string;
  sourceAnimationDuration: number;
  startFrame: number;
  color?: string;
  
  /** Spine 相關（sourceType === 'spine' 時） */
  spineInstanceId?: string;
  spineLayerId?: string;
  spineElementId?: string;
  
  /** 程式化動畫相關（sourceType === 'procedural' 時） */
  proceduralType?: ProceduralAnimationType;
}

/**
 * 移動片段的參數
 */
export interface MoveClipParams {
  clipId: string;
  newTrackId: string;
  newStartFrame: number;
}

/**
 * 時間軸轉換結果
 */
export interface ClipLocalTimeResult {
  /** 是否在播放範圍內 */
  isActive: boolean;
  
  /** 局部時間（秒），null 表示不在播放範圍 */
  localTime: number | null;
  
  /** 片段資訊 */
  clip: DirectorClip;
}
