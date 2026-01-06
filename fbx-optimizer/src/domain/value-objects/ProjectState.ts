/**
 * 專案匯出/載入系統 - 類型定義
 * 
 * 用於序列化和還原專案狀態，包含：
 * - 多模型及其 Transform 設定
 * - 切割動作記憶（createdClips）
 * - 導演模式編排（Director Mode）
 * 
 * @module ProjectState
 */

import type { LoopRegion, AnimationSourceType, ProceduralAnimationType, ProceduralAnimationConfig } from '../entities/director/director.types';

// ============================================================================
// 版本常數
// ============================================================================

/** 專案格式版本 */
export const PROJECT_VERSION = '1.0.0';

/** 專案檔案副檔名 */
export const PROJECT_FILE_EXTENSION = '.jr3d';

// ============================================================================
// 匯出選項
// ============================================================================

/**
 * 匯出選項介面
 * 
 * 控制匯出時要包含哪些資料
 */
export interface ExportOptions {
  /** 3D 模型（必選，永遠 true） */
  include3DModels: true;
  
  /** 動作切割 & 導演模式編排 */
  includeAnimations: boolean;
  
  /** Shader 設定 */
  includeShader: boolean;
  
  /** Audio 音效（預留，暫時 false） */
  includeAudio: false;
  
  /** Effekseer 特效（預留，暫時 false） */
  includeEffekseer: false;
}

/**
 * 建立預設匯出選項
 */
export function createDefaultExportOptions(): ExportOptions {
  return {
    include3DModels: true,
    includeAnimations: true,
    includeShader: true,
    includeAudio: false,
    includeEffekseer: false,
  };
}

// ============================================================================
// 可序列化動作片段
// ============================================================================

/**
 * 可序列化的動作片段資訊
 * 
 * 用於保存 createdClips 的關鍵資訊，載入時可透過
 * AnimationClipService.createSubClip 重建 IdentifiableClip
 */
export interface SerializableClipInfo {
  /** 唯一識別碼（用於導演模式映射） */
  customId: string;
  
  /** 顯示名稱（如 "Attack_1"） */
  displayName: string;
  
  /** 原始動畫名稱（用於從 FBX 還原時參考） */
  originalName: string;
  
  /** 起始幀 */
  startFrame: number;
  
  /** 結束幀 */
  endFrame: number;
  
  /** 時長（秒） */
  duration: number;
  
  /** 幀率 */
  fps: number;
}

// ============================================================================
// 可序列化 Shader 設定
// ============================================================================

/**
 * 可序列化的 Shader 功能
 * 
 * 用於保存 ShaderFeature 的配置，貼圖參數會被轉換為相對路徑
 */
export interface SerializableShaderFeature {
  /** 功能類型（如 'matcap', 'rim_light' 等） */
  type: string;
  
  /** 功能名稱 */
  name: string;
  
  /** 功能描述 */
  description: string;
  
  /** 圖示 */
  icon: string;
  
  /** 是否啟用 */
  enabled: boolean;
  
  /** 參數（貼圖會轉為相對路徑字串） */
  params: Record<string, any>;
}

/**
 * 可序列化的 Shader 組合
 * 
 * 用於保存 ShaderGroup 的配置，包含選中的 mesh 和功能列表
 */
export interface SerializableShaderGroup {
  /** 組合唯一識別碼 */
  id: string;
  
  /** 組合名稱 */
  name: string;
  
  /** 套用到的 Mesh 名稱列表 */
  selectedMeshes: string[];
  
  /** 功能列表 */
  features: SerializableShaderFeature[];
  
  /** 是否啟用 */
  enabled: boolean;
}

// ============================================================================
// 可序列化模型狀態
// ============================================================================

/**
 * 可序列化的模型狀態
 * 
 * 包含模型的基本資訊、Transform 設定、切割動作等
 */
export interface SerializableModelState {
  /** 模型唯一識別碼 */
  id: string;
  
  /** 模型名稱 */
  name: string;
  
  // 素材路徑（相對於 ZIP 內部）
  /** 模型檔案路徑（如 "model.fbx"） */
  modelPath: string;
  
  /** 貼圖檔案路徑陣列 */
  texturePaths: string[];
  
  // 切割動作記憶（當 includeAnimations = true）
  /** 用戶創建的動作片段 */
  createdClips?: SerializableClipInfo[];
  
  // Transform 設定
  /** 模型位置 [x, y, z] */
  position: [number, number, number];
  
  /** 模型旋轉 [x, y, z] 度數 */
  rotation: [number, number, number];
  
  /** 模型縮放 [x, y, z] */
  scale: [number, number, number];
  
  /** 渲染優先級 */
  renderPriority: number;
  
  /** 是否可見 */
  visible: boolean;
  
  /** 透明度 (0.0 - 1.0) */
  opacity: number;
  
  /** 是否啟用循環播放 */
  isLoopEnabled: boolean;
  
  // Shader 設定（當 includeShader = true）
  /** Shader 組合列表 */
  shaderGroups?: SerializableShaderGroup[];
  
  /** Shader 是否啟用（主開關） */
  isShaderEnabled?: boolean;
  
  // 預留擴充欄位（暫不序列化）
  // audioTracks?: SerializableAudioTrack[];
  // effects?: SerializableEffectItem[];
}

// ============================================================================
// 可序列化導演模式狀態
// ============================================================================

/**
 * 可序列化的導演片段
 */
export interface SerializableDirectorClip {
  /** 唯一識別碼 */
  id: string;
  
  /** 所屬軌道 ID */
  trackId: string;
  
  /** 來源類型 */
  sourceType: AnimationSourceType;
  
  /** 來源模型 ID */
  sourceModelId: string;
  
  /** 來源模型名稱 */
  sourceModelName: string;
  
  /** 動作 ID（對應 SerializableClipInfo.customId） */
  sourceAnimationId: string;
  
  /** 動作名稱 */
  sourceAnimationName: string;
  
  /** 動作幀數 */
  sourceAnimationDuration: number;
  
  // Spine 專用（預留）
  spineInstanceId?: string;
  spineLayerId?: string;
  spineElementId?: string;
  spineSkin?: string;
  
  // 時間軸位置
  /** 起始幀 */
  startFrame: number;
  
  /** 結束幀 */
  endFrame: number;
  
  // 剪裁設定
  /** 剪裁入點 */
  trimStart: number;
  
  /** 剪裁出點 */
  trimEnd: number;
  
  // 進階設定
  /** 播放速度 */
  speed: number;
  
  /** 是否循環 */
  loop: boolean;
  
  /** 混合入幀數 */
  blendIn: number;
  
  /** 混合出幀數 */
  blendOut: number;
  
  /** 顯示顏色 */
  color: string;
  
  // 程式化動畫（預留）
  proceduralType?: ProceduralAnimationType;
  proceduralConfig?: ProceduralAnimationConfig;
}

/**
 * 可序列化的軌道
 */
export interface SerializableTrack {
  /** 唯一識別碼 */
  id: string;
  
  /** 軌道名稱 */
  name: string;
  
  /** 顯示順序 */
  order: number;
  
  /** 是否鎖定 */
  isLocked: boolean;
  
  /** 是否靜音 */
  isMuted: boolean;
  
  /** 軌道上的片段列表 */
  clips: SerializableDirectorClip[];
}

/**
 * 可序列化的導演模式狀態
 */
export interface SerializableDirectorState {
  /** 時間軸設定 */
  timeline: {
    /** 總幀數 */
    totalFrames: number;
    
    /** 幀率 */
    fps: number;
    
    /** 區間播放設定 */
    loopRegion: LoopRegion;
  };
  
  /** 軌道列表 */
  tracks: SerializableTrack[];
}

// ============================================================================
// 全域設定
// ============================================================================

/**
 * 全域設定（相機等）
 */
export interface GlobalSettings {
  /** 相機 FOV */
  cameraFov?: number;
  
  /** 相機近裁剪面 */
  cameraNear?: number;
  
  /** 相機遠裁剪面 */
  cameraFar?: number;
  
  /** 場景背景顏色 */
  sceneBgColor?: string;
  
  /** 是否顯示網格 */
  showGrid?: boolean;
  
  /** 是否顯示地面 */
  showGroundPlane?: boolean;
}

// ============================================================================
// 專案狀態（主結構）
// ============================================================================

/**
 * 專案狀態（可序列化）
 * 
 * 專案檔案的主要資料結構，包含所有需要保存的狀態
 */
export interface ProjectState {
  /** 專案格式版本 */
  version: string;
  
  /** 專案名稱 */
  name: string;
  
  /** 建立時間（ISO 時間戳） */
  createdAt: string;
  
  /** 更新時間（ISO 時間戳） */
  updatedAt: string;
  
  /** 匯出選項記錄 */
  exportOptions: ExportOptions;
  
  /** 多模型狀態 */
  models: SerializableModelState[];
  
  /** 導演模式狀態（可選，當 includeAnimations = true） */
  director?: SerializableDirectorState;
  
  /** 全域設定 */
  globalSettings: GlobalSettings;
  
  // 預留擴充欄位
  /** Shader 設定（未實作） */
  shader?: unknown;
  
  /** Audio 設定（未實作） */
  audio?: unknown;
  
  /** Effekseer 設定（未實作） */
  effekseer?: unknown;
  
  /** Spine 設定（未實作） */
  spine?: unknown;
}

// ============================================================================
// Manifest（專案描述檔）
// ============================================================================

/**
 * 專案描述檔（manifest.json）
 * 
 * 用於快速檢查專案版本相容性
 */
export interface ProjectManifest {
  /** 專案格式版本 */
  version: string;
  
  /** 建立時間 */
  createdAt: string;
  
  /** 應用程式版本 */
  appVersion: string;
  
  /** 專案名稱 */
  projectName: string;
  
  /** 模型數量 */
  modelCount: number;
  
  /** 是否包含動畫 */
  hasAnimations: boolean;
}

// ============================================================================
// 工具函數
// ============================================================================

/**
 * 檢查版本相容性
 * 
 * @param version - 專案版本
 * @returns 是否相容
 */
export function isVersionCompatible(version: string): boolean {
  // 目前只支援 1.x.x 版本
  const [major] = version.split('.');
  return major === '1';
}

/**
 * 建立空的專案狀態
 * 
 * @param name - 專案名稱
 * @returns 空的專案狀態
 */
export function createEmptyProjectState(name: string): ProjectState {
  const now = new Date().toISOString();
  
  return {
    version: PROJECT_VERSION,
    name,
    createdAt: now,
    updatedAt: now,
    exportOptions: createDefaultExportOptions(),
    models: [],
    globalSettings: {},
  };
}

