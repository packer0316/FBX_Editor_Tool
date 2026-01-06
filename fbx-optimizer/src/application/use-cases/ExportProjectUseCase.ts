/**
 * 專案匯出 Use Case
 * 
 * 負責將當前專案狀態匯出為 .jr3d 檔案（ZIP 格式）
 * 
 * 匯出內容包含：
 * - manifest.json: 專案描述檔
 * - project-state.json: 完整狀態資料
 * - models/: 模型素材檔案（FBX + 貼圖）
 */

import JSZip from 'jszip';
import type { ModelInstance } from '../../domain/value-objects/ModelInstance';
import type { DirectorTrack } from '../../domain/entities/director/director.types';
import type { IdentifiableClip } from '../../utils/clip/clipIdentifierUtils';
import {
  type ProjectState,
  type ProjectManifest,
  type ExportOptions,
  type SerializableModelState,
  type SerializableClipInfo,
  type SerializableDirectorState,
  type SerializableDirectorClip,
  type SerializableTrack,
  type SerializableShaderGroup,
  type SerializableShaderFeature,
  type GlobalSettings,
  PROJECT_VERSION,
} from '../../domain/value-objects/ProjectState';
import type { ShaderGroup, ShaderFeature } from '../../domain/value-objects/ShaderFeature';

// ============================================================================
// 匯出參數介面
// ============================================================================

/**
 * 匯出專案參數
 */
export interface ExportProjectParams {
  /** 專案名稱 */
  projectName: string;
  
  /** 匯出選項 */
  exportOptions: ExportOptions;
  
  /** 模型列表 */
  models: ModelInstance[];
  
  /** 導演模式軌道列表 */
  directorTracks: DirectorTrack[];
  
  /** 導演模式時間軸設定 */
  directorTimeline: {
    totalFrames: number;
    fps: number;
    loopRegion: {
      inPoint: number | null;
      outPoint: number | null;
      enabled: boolean;
    };
  };
  
  /** 全域設定（可選） */
  globalSettings?: GlobalSettings;
}

/**
 * 匯出結果
 */
export interface ExportProjectResult {
  /** 是否成功 */
  success: boolean;
  
  /** 錯誤訊息 */
  error?: string;
  
  /** 匯出的 Blob */
  blob?: Blob;
  
  /** 檔案名稱 */
  fileName?: string;
}

// ============================================================================
// 序列化工具函數
// ============================================================================

/**
 * 序列化單個動作片段
 */
function serializeClip(clip: IdentifiableClip, fps: number = 30): SerializableClipInfo {
  return {
    customId: clip.customId || clip.uuid,
    displayName: clip.displayName || clip.name,
    originalName: clip.name,
    startFrame: clip.startFrame ?? 0,
    endFrame: clip.endFrame ?? Math.round(clip.duration * fps),
    duration: clip.duration,
    fps,
  };
}

/**
 * 序列化模型的 createdClips
 */
function serializeCreatedClips(clips: IdentifiableClip[], fps: number = 30): SerializableClipInfo[] {
  return clips.map(clip => serializeClip(clip, fps));
}

/**
 * 序列化導演模式片段
 */
function serializeDirectorClip(clip: DirectorTrack['clips'][0]): SerializableDirectorClip {
  return {
    id: clip.id,
    trackId: clip.trackId,
    sourceType: clip.sourceType,
    sourceModelId: clip.sourceModelId,
    sourceModelName: clip.sourceModelName,
    sourceAnimationId: clip.sourceAnimationId,
    sourceAnimationName: clip.sourceAnimationName,
    sourceAnimationDuration: clip.sourceAnimationDuration,
    spineInstanceId: clip.spineInstanceId,
    spineLayerId: clip.spineLayerId,
    spineElementId: clip.spineElementId,
    spineSkin: clip.spineSkin,
    startFrame: clip.startFrame,
    endFrame: clip.endFrame,
    trimStart: clip.trimStart,
    trimEnd: clip.trimEnd,
    speed: clip.speed,
    loop: clip.loop,
    blendIn: clip.blendIn,
    blendOut: clip.blendOut,
    color: clip.color,
    proceduralType: clip.proceduralType,
    proceduralConfig: clip.proceduralConfig,
  };
}

/**
 * 序列化軌道
 */
function serializeTrack(track: DirectorTrack): SerializableTrack {
  return {
    id: track.id,
    name: track.name,
    order: track.order,
    isLocked: track.isLocked,
    isMuted: track.isMuted,
    clips: track.clips.map(serializeDirectorClip),
  };
}

/**
 * 序列化導演模式狀態
 */
function serializeDirectorState(
  tracks: DirectorTrack[],
  timeline: ExportProjectParams['directorTimeline']
): SerializableDirectorState {
  return {
    timeline: {
      totalFrames: timeline.totalFrames,
      fps: timeline.fps,
      loopRegion: timeline.loopRegion,
    },
    tracks: tracks.map(serializeTrack),
  };
}

/**
 * Shader 貼圖檔案資訊（用於打包到 ZIP）
 */
interface ShaderTextureInfo {
  /** 參數路徑（用於識別） */
  paramKey: string;
  /** 貼圖檔案 */
  file: File;
  /** ZIP 內的相對路徑 */
  relativePath: string;
}

/**
 * 序列化 Shader 功能
 */
function serializeShaderFeature(
  feature: ShaderFeature,
  groupIndex: number,
  featureIndex: number,
  textureInfos: ShaderTextureInfo[]
): SerializableShaderFeature {
  const serializedParams: Record<string, any> = {};
  let textureCounter = 0;

  // 處理每個參數
  Object.entries(feature.params).forEach(([key, value]) => {
    if (value instanceof File) {
      // 是貼圖檔案，轉換為相對路徑
      textureCounter++;
      const extension = value.name.split('.').pop() || 'png';
      const relativePath = `shader/textures/${key}_${groupIndex}_${featureIndex}_${textureCounter}.${extension}`;
      
      textureInfos.push({
        paramKey: `${feature.id}.${key}`,
        file: value,
        relativePath,
      });
      
      serializedParams[key] = relativePath;
    } else {
      // 其他參數直接複製
      serializedParams[key] = value;
    }
  });

  return {
    type: feature.type,
    name: feature.name,
    description: feature.description,
    icon: feature.icon,
    enabled: feature.enabled,
    params: serializedParams,
  };
}

/**
 * 序列化 Shader 組合
 */
function serializeShaderGroup(
  group: ShaderGroup,
  groupIndex: number,
  textureInfos: ShaderTextureInfo[]
): SerializableShaderGroup {
  return {
    id: group.id,
    name: group.name,
    selectedMeshes: [...group.selectedMeshes],
    features: group.features.map((feature, featureIndex) => 
      serializeShaderFeature(feature, groupIndex, featureIndex, textureInfos)
    ),
    enabled: group.enabled ?? true,
  };
}

/**
 * 序列化模型狀態
 */
function serializeModelState(
  model: ModelInstance,
  includeAnimations: boolean,
  includeShader: boolean,
  shaderTextureInfos: ShaderTextureInfo[]
): SerializableModelState {
  // 取得貼圖檔案名稱
  const texturePaths: string[] = [];
  
  // 序列化 Shader 組合（如果啟用）
  let shaderGroups: SerializableShaderGroup[] | undefined;
  let isShaderEnabled: boolean | undefined;
  
  if (includeShader && model.shaderGroups && model.shaderGroups.length > 0) {
    shaderGroups = model.shaderGroups.map((group, groupIndex) => 
      serializeShaderGroup(group, groupIndex, shaderTextureInfos)
    );
    isShaderEnabled = model.isShaderEnabled;
  }
  
  return {
    id: model.id,
    name: model.name,
    modelPath: model.file?.name || 'model.fbx',
    texturePaths,
    createdClips: includeAnimations 
      ? serializeCreatedClips(model.createdClips)
      : undefined,
    position: model.position,
    rotation: model.rotation,
    scale: model.scale,
    renderPriority: model.renderPriority,
    visible: model.visible,
    opacity: model.opacity,
    isLoopEnabled: model.isLoopEnabled,
    shaderGroups,
    isShaderEnabled,
  };
}

// ============================================================================
// 匯出 Use Case
// ============================================================================

export class ExportProjectUseCase {
  /**
   * 執行專案匯出
   * 
   * @param params - 匯出參數
   * @returns 匯出結果
   */
  static async execute(params: ExportProjectParams): Promise<ExportProjectResult> {
    const {
      projectName,
      exportOptions,
      models,
      directorTracks,
      directorTimeline,
      globalSettings = {},
    } = params;

    try {
      // 檢查是否有模型
      if (models.length === 0) {
        return {
          success: false,
          error: '沒有模型可匯出',
        };
      }

      // 建立 ZIP
      const zip = new JSZip();
      const now = new Date().toISOString();

      // 1. 建立 manifest.json
      const manifest: ProjectManifest = {
        version: PROJECT_VERSION,
        createdAt: now,
        appVersion: '1.0.0',
        projectName,
        modelCount: models.length,
        hasAnimations: exportOptions.includeAnimations,
      };
      zip.file('manifest.json', JSON.stringify(manifest, null, 2));

      // 2. 收集模型檔案並建立資料夾
      const serializedModels: SerializableModelState[] = [];
      
      for (const model of models) {
        const modelFolder = zip.folder(`models/${model.id}`);
        
        if (!modelFolder) {
          console.warn(`無法建立模型資料夾: ${model.id}`);
          continue;
        }

        // 加入 FBX 檔案
        if (model.file) {
          modelFolder.file(model.file.name, model.file);
        } else {
          console.warn(`模型 ${model.name} 沒有原始檔案`);
        }

        // 加入模型貼圖檔案（載入時保存的原始貼圖）
        const textureFiles = this.extractTextureFiles(model);
        const texturePaths: string[] = [];
        
        for (const textureFile of textureFiles) {
          modelFolder.file(textureFile.name, textureFile);
          texturePaths.push(textureFile.name);
        }

        // 收集 Shader 貼圖資訊
        const shaderTextureInfos: ShaderTextureInfo[] = [];
        
        // 序列化模型狀態（含 Shader）
        const serializedModel = serializeModelState(
          model, 
          exportOptions.includeAnimations,
          exportOptions.includeShader,
          shaderTextureInfos
        );
        serializedModel.texturePaths = texturePaths;
        
        // 加入 Shader 貼圖到 ZIP
        if (exportOptions.includeShader && shaderTextureInfos.length > 0) {
          console.log(`📦 模型 ${model.name} 有 ${shaderTextureInfos.length} 個 Shader 貼圖`);
          
          for (const textureInfo of shaderTextureInfos) {
            modelFolder.file(textureInfo.relativePath, textureInfo.file);
            console.log(`  🖼️ 加入 Shader 貼圖: ${textureInfo.relativePath}`);
          }
        }
        
        serializedModels.push(serializedModel);
      }

      // 3. 建立 project-state.json
      const projectState: ProjectState = {
        version: PROJECT_VERSION,
        name: projectName,
        createdAt: now,
        updatedAt: now,
        exportOptions,
        models: serializedModels,
        director: exportOptions.includeAnimations
          ? serializeDirectorState(directorTracks, directorTimeline)
          : undefined,
        globalSettings,
      };
      zip.file('project-state.json', JSON.stringify(projectState, null, 2));

      // 4. 生成 ZIP Blob
      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      const fileName = `${projectName}.jr3d`;

      return {
        success: true,
        blob,
        fileName,
      };
    } catch (error) {
      console.error('匯出專案失敗:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '匯出失敗',
      };
    }
  }

  /**
   * 從模型中提取貼圖檔案
   * 
   * @param model - 模型實例
   * @returns 貼圖 File 陣列
   */
  private static extractTextureFiles(model: ModelInstance): File[] {
    const textureFiles: File[] = [];
    
    // 優先使用 model.textureFiles（載入時保存的原始貼圖）
    if (model.textureFiles && model.textureFiles.length > 0) {
      textureFiles.push(...model.textureFiles);
    }
    
    // 也從 shaderGroups 中提取貼圖檔案（用戶可能後續添加的貼圖）
    for (const group of model.shaderGroups || []) {
      // 檢查各種貼圖設定
      if (group.mainTexture && group.mainTexture instanceof File) {
        textureFiles.push(group.mainTexture);
      }
      if (group.matcapTexture && group.matcapTexture instanceof File) {
        textureFiles.push(group.matcapTexture);
      }
      if (group.normalTexture && group.normalTexture instanceof File) {
        textureFiles.push(group.normalTexture);
      }
    }
    
    // 去除重複（依檔名）
    const uniqueFiles = new Map<string, File>();
    for (const file of textureFiles) {
      if (!uniqueFiles.has(file.name)) {
        uniqueFiles.set(file.name, file);
      }
    }
    
    return Array.from(uniqueFiles.values());
  }

  /**
   * 觸發瀏覽器下載
   * 
   * @param blob - 檔案 Blob
   * @param fileName - 檔案名稱
   */
  static downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * 匯出並下載專案
   * 
   * @param params - 匯出參數
   * @returns 是否成功
   */
  static async exportAndDownload(params: ExportProjectParams): Promise<boolean> {
    const result = await this.execute(params);
    
    if (result.success && result.blob && result.fileName) {
      this.downloadBlob(result.blob, result.fileName);
      return true;
    }
    
    if (result.error) {
      console.error('匯出失敗:', result.error);
      alert(`匯出失敗: ${result.error}`);
    }
    
    return false;
  }
}

