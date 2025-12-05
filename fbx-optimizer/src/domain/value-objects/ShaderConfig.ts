/**
 * Shader 配置匯出/匯入的資料結構
 */

import type { ShaderGroup } from './ShaderFeature';

/**
 * 匯出的 Shader 配置格式
 */
export interface ShaderConfigExport {
  version: string;
  exportDate: string;
  modelName?: string;
  shaderGroups: ShaderGroupExport[];
}

/**
 * 匯出的 ShaderGroup 格式
 * 與原始 ShaderGroup 類似，但貼圖參數改為相對路徑
 */
export interface ShaderGroupExport {
  id: string;
  name: string;
  selectedMeshes: string[];
  features: ShaderFeatureExport[];
}

/**
 * 匯出的 ShaderFeature 格式
 */
export interface ShaderFeatureExport {
  type: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  params: Record<string, any>; // 貼圖參數會被轉換為相對路徑字串
}

/**
 * 貼圖檔案資訊
 */
export interface TextureFileInfo {
  paramPath: string;    // 例如: "groups[0].features[1].params.texture"
  file: File;
  relativePath: string; // 例如: "textures/matcap_01.png"
}

