import * as THREE from 'three';
import type { ShaderGroup } from '../../domain/value-objects/ShaderFeature';
import { ModelLoaderService } from '../../domain/services/model/ModelLoaderService';

/**
 * 載入模型的結果介面
 */
export interface LoadModelResult {
  /** 載入的 Three.js 模型群組 */
  model: THREE.Group;
  /** 模型中所有 mesh 的名稱陣列 */
  meshNames: string[];
  /** 預設的 Shader 組合（包含所有 mesh） */
  defaultShaderGroup: ShaderGroup | null;
  /** 模型包含的動畫片段陣列 */
  animations: THREE.AnimationClip[];
}

/**
 * 載入模型 Use Case
 * 
 * 負責協調模型載入的業務邏輯，包括：
 * - 檔案分類（FBX 檔案與貼圖檔案）
 * - 模型載入與材質修復
 * - Mesh 名稱提取
 * - 預設 Shader 組合初始化
 * 
 * @example
 * ```typescript
 * const result = await LoadModelUseCase.execute(fileList);
 * console.log(result.model); // THREE.Group
 * console.log(result.meshNames); // ['mesh1', 'mesh2', ...]
 * ```
 */
export class LoadModelUseCase {
  /**
   * 執行模型載入
   * 
   * @param files - 檔案列表，應包含至少一個 FBX 檔案和可選的貼圖檔案
   * @returns Promise 解析為載入結果，包含模型、mesh 名稱、預設 shader 組合和動畫片段
   * @throws {Error} 當檔案列表中沒有 FBX 檔案時拋出錯誤
   * 
   * @example
   * ```typescript
   * try {
   *   const result = await LoadModelUseCase.execute(fileInput.files);
   *   setModel(result.model);
   *   setMeshNames(result.meshNames);
   * } catch (error) {
   *   console.error('載入失敗:', error.message);
   * }
   * ```
   */
  static async execute(files: FileList): Promise<LoadModelResult> {
    // 分類檔案
    const { fbxFile, textureFiles } = ModelLoaderService.classifyFiles(files);

    if (!fbxFile) {
      throw new Error('請至少選擇一個 FBX 檔案！');
    }

    // 載入模型
    const model = await ModelLoaderService.loadFBX(fbxFile, textureFiles);

    // 提取 mesh 名稱
    const meshNames = ModelLoaderService.extractMeshNames(model);

    // 初始化第一組 shader 配置（包含所有 mesh）
    let defaultShaderGroup: ShaderGroup | null = null;
    if (meshNames.length > 0) {
      defaultShaderGroup = {
        id: `group_${Date.now()}`,
        name: '組合 1',
        features: [],
        selectedMeshes: meshNames, // 預設選擇所有 mesh
        expanded: true,
      };
    }

    return {
      model,
      meshNames,
      defaultShaderGroup,
      animations: model.animations || [],
    };
  }
}

