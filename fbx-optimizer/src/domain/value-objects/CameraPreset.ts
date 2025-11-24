/**
 * 相機預設類型
 * 
 * 定義不同場景的相機曝光和 tone mapping 設定，用於快速切換以匹配不同環境的亮度。
 */
export type CameraPresetType = 'outdoor' | 'indoor' | 'night';

/**
 * 相機預設配置
 */
export interface CameraPreset {
  /** 預設名稱 */
  name: string;
  /** 預設類型 */
  type: CameraPresetType;
  /** Tone Mapping 曝光值 */
  toneMappingExposure: number;
  /** Tone Mapping 白點值（ACES Filmic） */
  whitePoint?: number;
  /** 描述 */
  description?: string;
}

/**
 * 預設的相機預設列表
 */
export const CAMERA_PRESETS: Record<CameraPresetType, CameraPreset> = {
  outdoor: {
    name: '室外',
    type: 'outdoor',
    toneMappingExposure: 1.0,
    whitePoint: 1.0,
    description: '適合明亮的室外場景，標準曝光'
  },
  indoor: {
    name: '室內',
    type: 'indoor',
    toneMappingExposure: 0.8,
    whitePoint: 1.0,
    description: '適合室內場景，稍微降低曝光'
  },
  night: {
    name: '夜間',
    type: 'night',
    toneMappingExposure: 1.5,
    whitePoint: 1.0,
    description: '適合夜間場景，提高曝光以顯示更多細節'
  }
};



