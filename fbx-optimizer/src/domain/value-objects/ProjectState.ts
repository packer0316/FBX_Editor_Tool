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
  /** 3D 模型 */
  include3DModels: boolean;
  
  /** 2D 圖層（Layers、Spine、圖片等） */
  include2D: boolean;
  
  /** 動作切割 & 導演模式編排（需要至少勾選 3D 或 2D） */
  includeAnimations: boolean;
  
  /** Shader 設定（需要勾選 3D） */
  includeShader: boolean;
  
  /** Audio 音效（預留，暫時 false） */
  includeAudio: false;
  
  /** Effekseer 特效 */
  includeEffekseer: boolean;
}

/**
 * 建立預設匯出選項
 */
export function createDefaultExportOptions(): ExportOptions {
  return {
    include3DModels: true,
    include2D: true,
    includeAnimations: true,
    includeShader: true,
    includeAudio: false,
    includeEffekseer: true,
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
// 可序列化 Effekseer 特效
// ============================================================================

/**
 * 可序列化的特效觸發器
 * 
 * 用於保存特效觸發設定，載入時會透過 clipIdMap 映射新的 clipId
 */
export interface SerializableEffectTrigger {
  /** 觸發器唯一識別碼 */
  id: string;
  
  /** 關聯的動作片段 ID（匯入時需映射） */
  clipId: string;
  
  /** 動作片段名稱（顯示用） */
  clipName: string;
  
  /** 觸發幀數 */
  frame: number;
  
  /** 播放持續時間（秒），不設定則播放到特效自然結束 */
  duration?: number;
}

/**
 * 可序列化的特效項目
 * 
 * 用於保存 EffectItem 的配置，骨骼綁定使用名稱而非 UUID
 */
export interface SerializableEffectItem {
  /** 唯一識別碼 */
  id: string;
  
  /** 顯示名稱 */
  name: string;
  
  /** 特效路徑（相對路徑，如 "Boss/Explosion.efk"） */
  path: string;
  
  /** 特效來源類型 */
  sourceType: 'public' | 'uploaded';
  
  // Transform 設定
  /** 位置 [x, y, z] */
  position: [number, number, number];
  
  /** 旋轉 [x, y, z] 度數 */
  rotation: [number, number, number];
  
  /** 縮放 [x, y, z] */
  scale: [number, number, number];
  
  /** 播放速度 */
  speed: number;
  
  /** 是否可見 */
  isVisible: boolean;
  
  /** 是否循環 */
  isLooping: boolean;
  
  // 骨骼綁定（使用名稱而非 UUID，匯入時透過名稱查找 UUID）
  /** 綁定的骨骼名稱（null 表示世界座標） */
  boundBoneName: string | null;
  
  // 觸發器
  /** 動畫觸發器列表 */
  triggers: SerializableEffectTrigger[];
  
  /** 特效顏色（用於時間軸顯示） */
  color: string;
  
  // uploaded 類型的資源路徑（ZIP 內相對路徑）
  /** 資源檔案路徑列表（僅 uploaded 類型使用） */
  resourcePaths?: string[];
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
// 可序列化視圖快照
// ============================================================================

/**
 * 可序列化的視圖快照
 * 
 * 用於保存相機和模型的狀態設定，讓用戶可以快速切換到預設的視角
 */
export interface SerializableViewSnapshot {
  /** 唯一識別碼 */
  id: string;
  
  /** 快照名稱 */
  name: string;
  
  /** 創建時間戳 */
  createdAt: number;
  
  // 相機狀態
  /** 相機位置 [x, y, z] */
  cameraPosition: [number, number, number];
  
  /** 相機目標點 [x, y, z] (OrbitControls target) */
  cameraTarget: [number, number, number];
  
  /** 相機 FOV（透視模式） */
  cameraFov: number;
  
  /** 是否為正交相機 */
  cameraIsOrthographic: boolean;
  
  /** 正交相機縮放值 */
  cameraOrthoZoom: number;
  
  // 模型狀態
  /** 模型位置 [x, y, z] */
  modelPosition: [number, number, number];
  
  /** 模型旋轉 [x, y, z] (度數) */
  modelRotation: [number, number, number];
  
  /** 模型縮放 [x, y, z] */
  modelScale: [number, number, number];
  
  /** 動畫播放時間（秒） */
  animationTime: number;
}

// ============================================================================
// 可序列化 Transform 快照
// ============================================================================

/**
 * 可序列化的 Transform 快照
 * 
 * 用於保存模型的 Transform 狀態（位置、旋轉、縮放、透明度），
 * 讓用戶可以快速重置或切換到預設的狀態
 */
export interface SerializableTransformSnapshot {
  /** 唯一識別碼 */
  id: string;
  
  /** 快照名稱 */
  name: string;
  
  /** 創建時間戳 */
  createdAt: number;
  
  /** 是否為預設快照（載入時的初始狀態，不可刪除） */
  isDefault: boolean;
  
  /** 模型位置 [x, y, z] */
  position: [number, number, number];
  
  /** 模型旋轉 [x, y, z] (度數) */
  rotation: [number, number, number];
  
  /** 模型縮放（等比） */
  scale: number;
  
  /** 模型透明度 (0-1) */
  opacity: number;
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
  
  // 快照設定
  /** 視圖快照列表（相機+模型狀態） */
  viewSnapshots?: SerializableViewSnapshot[];
  
  /** Transform 快照列表（位置、旋轉、縮放、透明度） */
  transformSnapshots?: SerializableTransformSnapshot[];
  
  // Effekseer 特效設定（當 includeEffekseer = true）
  /** 特效列表 */
  effects?: SerializableEffectItem[];
  
  // 預留擴充欄位（暫不序列化）
  // audioTracks?: SerializableAudioTrack[];
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
// 可序列化 2D 圖層元素
// ============================================================================

import type { LayerType } from './Layer';
import type {
  Element2DType,
  Element2DPosition,
  Element2DSize,
  SpineFitMode,
} from './Element2D';

/**
 * 可序列化的 2D 元素基礎介面
 * 
 * 與 Element2DBase 相同，用於匯出/載入
 */
export interface SerializableElement2DBase {
  /** 唯一識別碼 */
  id: string;
  /** 元素名稱 */
  name: string;
  /** 元素類型 */
  type: Element2DType;
  /** 顯示狀態 */
  visible: boolean;
  /** 是否鎖定 */
  locked: boolean;
  /** 透明度 */
  opacity: number;
  /** 層內渲染順序 */
  zIndex: number;
  /** 位置設定 */
  position: Element2DPosition;
  /** 尺寸設定 */
  size: Element2DSize;
  /** 旋轉角度 */
  rotation: number;
  /** 建立時間 */
  createdAt: number;
  /** 更新時間 */
  updatedAt: number;
}

/**
 * 可序列化的文字元素
 */
export interface SerializableTextElement2D extends SerializableElement2DBase {
  type: 'text';
  content: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  color: string;
  textAlign: 'left' | 'center' | 'right';
  lineHeight: number;
  textShadow?: string;
  showBackground: boolean;
}

/**
 * 可序列化的圖片元素
 * 
 * 注意：src 改為相對路徑（指向 assets/images/），載入時轉回 Data URL
 */
export interface SerializableImageElement2D extends SerializableElement2DBase {
  type: 'image';
  /** 圖片相對路徑（如 "assets/images/{id}.png"） */
  src: string;
  objectFit: 'cover' | 'contain' | 'fill' | 'none';
  borderRadius: number;
  filter?: string;
}

/**
 * 可序列化的形狀元素
 */
export interface SerializableShapeElement2D extends SerializableElement2DBase {
  type: 'shape';
  shape: 'rect' | 'circle' | 'line';
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  strokeDasharray?: string;
}

/**
 * 可序列化的 HTML 元素
 */
export interface SerializableHtmlElement2D extends SerializableElement2DBase {
  type: 'html';
  html: string;
  css?: string;
}

/**
 * 可序列化的 Spine 元素
 */
export interface SerializableSpineElement2D extends SerializableElement2DBase {
  type: 'spine';
  /** Spine 實例 ID（對應 SerializableSpineInstance.id） */
  spineInstanceId: string;
  currentAnimation: string | null;
  loop: boolean;
  timeScale: number;
  currentSkin: string | null;
  scale: number;
  fitMode: SpineFitMode;
  flipX: boolean;
  flipY: boolean;
  isPlaying: boolean;
  currentTime: number;
}

/**
 * 可序列化的 2D 元素聯集型別
 */
export type SerializableElement2D =
  | SerializableTextElement2D
  | SerializableImageElement2D
  | SerializableShapeElement2D
  | SerializableHtmlElement2D
  | SerializableSpineElement2D;

/**
 * 可序列化的 2D 圖層
 */
export interface SerializableLayer {
  /** 唯一識別碼 */
  id: string;
  /** 層級名稱 */
  name: string;
  /** 層級類型 */
  type: LayerType;
  /** 排序優先權（>0 在 3D 前、=0 3D 層、<0 3D 後） */
  priority: number;
  /** 顯示狀態 */
  visible: boolean;
  /** 是否鎖定 */
  locked: boolean;
  /** 是否展開 */
  expanded: boolean;
  /** 整層透明度 */
  opacity: number;
  /** 子元素列表 */
  children: SerializableElement2D[];
  /** 建立時間 */
  createdAt: number;
  /** 更新時間 */
  updatedAt: number;
}

// ============================================================================
// 可序列化 Spine 實例
// ============================================================================

/**
 * 可序列化的 Spine 實例
 * 
 * 用於保存 Spine 的 metadata 和播放狀態，原始檔案存放在 assets/spine/
 */
export interface SerializableSpineInstance {
  /** 唯一識別碼 */
  id: string;
  
  /** 顯示名稱 */
  name: string;
  
  /** .skel 檔案名稱 */
  skelFileName: string;
  
  /** .atlas 檔案名稱 */
  atlasFileName: string;
  
  /** 圖片檔案名稱列表 */
  imageFileNames: string[];
  
  /** 當前動畫名稱 */
  currentAnimation: string | null;
  
  /** 當前 Skin 名稱 */
  currentSkin: string | null;
  
  /** 是否循環 */
  loop: boolean;
  
  /** 播放速度 */
  timeScale: number;
  
  /** 是否正在播放 */
  isPlaying: boolean;
  
  /** 當前時間（秒） */
  currentTime: number;
  
  /** 建立時間 */
  createdAt: number;
  
  /** 更新時間 */
  updatedAt: number;
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
  
  // ========================================
  // 2D 圖層和 Spine 資料
  // ========================================
  
  /** 2D 圖層列表（可選） */
  layers?: SerializableLayer[];
  
  /** Spine 實例列表（可選） */
  spineInstances?: SerializableSpineInstance[];
  
  // 預留擴充欄位
  /** Shader 設定（未實作） */
  shader?: unknown;
  
  /** Audio 設定（未實作） */
  audio?: unknown;
  
  /** Effekseer 設定（未實作） */
  effekseer?: unknown;
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

