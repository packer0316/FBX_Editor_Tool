/**
 * Spine 實例值物件
 * 
 * 定義 Spine 動畫的資料結構，包含骨架資訊、動畫列表、Skin 列表等。
 */

// ============================================================================
// 動畫資訊
// ============================================================================

/**
 * Spine 動畫資訊
 */
export interface SpineAnimationInfo {
  /** 動畫名稱 */
  name: string;
  /** 動畫時長（秒） */
  duration: number;
  /** 動畫幀數（duration * fps） */
  frameCount: number;
}

// ============================================================================
// Skin 資訊
// ============================================================================

/**
 * Spine Skin 資訊
 */
export interface SpineSkinInfo {
  /** Skin 名稱 */
  name: string;
}

// ============================================================================
// Slot 資訊
// ============================================================================

/**
 * Spine Slot 資訊
 */
export interface SpineSlotInfo {
  /** Slot 索引 */
  index: number;
  /** Slot 名稱 */
  name: string;
  /** 所屬骨骼名稱 */
  boneName: string;
  /** 目前附加的 Attachment 名稱 */
  attachment: string | null;
  /** 可用的 Attachment 列表 */
  attachments: string[];
}

// ============================================================================
// 骨架資訊
// ============================================================================

/**
 * Spine 骨架資訊
 */
export interface SpineSkeletonInfo {
  /** 原始寬度 */
  width: number;
  /** 原始高度 */
  height: number;
  /** 版本號 */
  version: string;
  /** FPS（每秒幀數） */
  fps: number;
  /** 動畫列表 */
  animations: SpineAnimationInfo[];
  /** Skin 列表 */
  skins: SpineSkinInfo[];
  /** Slot 列表 */
  slots: SpineSlotInfo[];
  /** 骨骼數量 */
  boneCount: number;
}

// ============================================================================
// Spine 實例
// ============================================================================

/**
 * Spine 實例
 * 
 * 代表一個已載入的 Spine 骨架，包含所有必要的資訊和狀態。
 */
export interface SpineInstance {
  /** 唯一 ID */
  id: string;
  
  /** 顯示名稱 */
  name: string;
  
  /** 原始檔案名稱（.skel） */
  skelFileName: string;
  
  /** Atlas 檔案名稱 */
  atlasFileName: string;
  
  /** 圖片檔案名稱列表 */
  imageFileNames: string[];
  
  /** 骨架資訊 */
  skeletonInfo: SpineSkeletonInfo;
  
  /** 當前播放狀態 */
  isPlaying: boolean;
  
  /** 當前時間（秒） */
  currentTime: number;
  
  /** 當前動畫名稱 */
  currentAnimation: string | null;
  
  /** 當前 Skin 名稱 */
  currentSkin: string | null;
  
  /** 是否循環 */
  loop: boolean;
  
  /** 播放速度（1.0 = 正常） */
  timeScale: number;
  
  /** 建立時間 */
  createdAt: number;
  
  /** 更新時間 */
  updatedAt: number;
}

// ============================================================================
// 工廠函數
// ============================================================================

/**
 * 生成唯一 ID
 */
const generateSpineId = (): string => {
  return `spine_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * 建立 Spine 實例
 */
export const createSpineInstance = (params: {
  name: string;
  skelFileName: string;
  atlasFileName: string;
  imageFileNames: string[];
  skeletonInfo: SpineSkeletonInfo;
}): SpineInstance => {
  const now = Date.now();
  const defaultAnimation = params.skeletonInfo.animations[0]?.name ?? null;
  const defaultSkin = params.skeletonInfo.skins[0]?.name ?? null;
  
  return {
    id: generateSpineId(),
    name: params.name,
    skelFileName: params.skelFileName,
    atlasFileName: params.atlasFileName,
    imageFileNames: params.imageFileNames,
    skeletonInfo: params.skeletonInfo,
    isPlaying: false,
    currentTime: 0,
    currentAnimation: defaultAnimation,
    currentSkin: defaultSkin,
    loop: true,
    timeScale: 1.0,
    createdAt: now,
    updatedAt: now,
  };
};

/**
 * 更新 Spine 實例
 */
export const updateSpineInstance = (
  instance: SpineInstance,
  updates: Partial<Pick<SpineInstance, 
    'name' | 'isPlaying' | 'currentTime' | 'currentAnimation' | 
    'currentSkin' | 'loop' | 'timeScale'
  >>
): SpineInstance => {
  return {
    ...instance,
    ...updates,
    updatedAt: Date.now(),
  };
};

// ============================================================================
// 工具函數
// ============================================================================

/**
 * 取得動畫資訊
 */
export const getAnimationInfo = (
  instance: SpineInstance,
  animationName: string
): SpineAnimationInfo | null => {
  return instance.skeletonInfo.animations.find(a => a.name === animationName) ?? null;
};

/**
 * 取得 Skin 資訊
 */
export const getSkinInfo = (
  instance: SpineInstance,
  skinName: string
): SpineSkinInfo | null => {
  return instance.skeletonInfo.skins.find(s => s.name === skinName) ?? null;
};

/**
 * 取得 Slot 資訊
 */
export const getSlotInfo = (
  instance: SpineInstance,
  slotName: string
): SpineSlotInfo | null => {
  return instance.skeletonInfo.slots.find(s => s.name === slotName) ?? null;
};

/**
 * 取得當前動畫時長（秒）
 */
export const getCurrentAnimationDuration = (instance: SpineInstance): number => {
  if (!instance.currentAnimation) return 0;
  const animation = getAnimationInfo(instance, instance.currentAnimation);
  return animation?.duration ?? 0;
};

/**
 * 取得當前動畫幀數
 */
export const getCurrentAnimationFrameCount = (instance: SpineInstance): number => {
  if (!instance.currentAnimation) return 0;
  const animation = getAnimationInfo(instance, instance.currentAnimation);
  return animation?.frameCount ?? 0;
};


