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
import * as THREE from 'three';
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
  type SerializableLayer,
  type SerializableElement2D,
  type SerializableSpineInstance,
  type SerializableEffectItem,
  type SerializableEffectTrigger,
  type GlobalSettings,
  PROJECT_VERSION,
} from '../../domain/value-objects/ProjectState';
import type { ShaderGroup, ShaderFeature } from '../../domain/value-objects/ShaderFeature';
import type { Layer } from '../../domain/value-objects/Layer';
import type { Element2D, ImageElement2D } from '../../domain/value-objects/Element2D';
import type { SpineInstance } from '../../domain/value-objects/SpineInstance';
import type { EffectItem } from '../../presentation/features/effect-panel/components/EffectTestPanel';
import type { EffectTrigger } from '../../domain/value-objects/EffectTrigger';
import { getEffekseerPath } from '../../utils/environment';

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
  
  /** 2D 圖層列表（可選） */
  layers?: Layer[];
  
  /** Spine 實例 Map（可選） */
  spineInstances?: Map<string, SpineInstance>;
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

// ============================================================================
// 2D 圖層序列化函數
// ============================================================================

/**
 * 2D 圖片檔案資訊（用於打包到 ZIP）
 */
interface Image2DFileInfo {
  /** 元素 ID */
  elementId: string;
  /** Data URL */
  dataUrl: string;
  /** ZIP 內的相對路徑 */
  relativePath: string;
}

/**
 * 序列化 2D 元素
 * 
 * 將 ImageElement2D 的 Data URL 替換為相對路徑
 */
function serializeElement2D(
  element: Element2D,
  imageInfos: Image2DFileInfo[]
): SerializableElement2D {
  if (element.type === 'image') {
    const imageElement = element as ImageElement2D;
    
    // 決定圖片格式（根據 Data URL 判斷）
    let extension = 'png';
    if (imageElement.src.startsWith('data:image/jpeg') || imageElement.src.startsWith('data:image/jpg')) {
      extension = 'jpg';
    } else if (imageElement.src.startsWith('data:image/webp')) {
      extension = 'webp';
    } else if (imageElement.src.startsWith('data:image/gif')) {
      extension = 'gif';
    }
    
    const relativePath = `assets/images/${element.id}.${extension}`;
    
    // 收集圖片資訊用於打包
    imageInfos.push({
      elementId: element.id,
      dataUrl: imageElement.src,
      relativePath,
    });
    
    // 返回序列化後的元素（src 改為相對路徑）
    return {
      ...imageElement,
      src: relativePath,
    };
  }
  
  // 其他類型元素直接返回
  return element as SerializableElement2D;
}

/**
 * 序列化 2D 圖層
 */
function serializeLayer(
  layer: Layer,
  imageInfos: Image2DFileInfo[]
): SerializableLayer {
  return {
    id: layer.id,
    name: layer.name,
    type: layer.type,
    priority: layer.priority,
    visible: layer.visible,
    locked: layer.locked,
    expanded: layer.expanded,
    opacity: layer.opacity,
    children: layer.children.map(element => serializeElement2D(element, imageInfos)),
    createdAt: layer.createdAt,
    updatedAt: layer.updatedAt,
  };
}

/**
 * 序列化所有 2D 圖層
 */
function serializeLayers(
  layers: Layer[],
  imageInfos: Image2DFileInfo[]
): SerializableLayer[] {
  return layers.map(layer => serializeLayer(layer, imageInfos));
}

/**
 * 序列化 Spine 實例
 */
function serializeSpineInstance(instance: SpineInstance): SerializableSpineInstance {
  return {
    id: instance.id,
    name: instance.name,
    skelFileName: instance.skelFileName,
    atlasFileName: instance.atlasFileName,
    imageFileNames: instance.imageFileNames,
    currentAnimation: instance.currentAnimation,
    currentSkin: instance.currentSkin,
    loop: instance.loop,
    timeScale: instance.timeScale,
    isPlaying: instance.isPlaying,
    currentTime: instance.currentTime,
    createdAt: instance.createdAt,
    updatedAt: instance.updatedAt,
  };
}

/**
 * Data URL 轉 Uint8Array
 */
function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
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

// ============================================================================
// Effekseer 特效序列化函數
// ============================================================================

/**
 * Effekseer 特效檔案資訊（用於打包到 ZIP）
 */
interface EffectFileInfo {
  /** 特效 ID */
  effectId: string;
  /** 檔案 */
  file: File | Blob;
  /** 檔案名稱 */
  fileName: string;
  /** ZIP 內的相對路徑 */
  relativePath: string;
}

/**
 * 序列化特效觸發器
 */
function serializeEffectTrigger(trigger: EffectTrigger): SerializableEffectTrigger {
  return {
    id: trigger.id,
    clipId: trigger.clipId,
    clipName: trigger.clipName,
    frame: trigger.frame,
    duration: trigger.duration,
  };
}

/**
 * 序列化特效項目
 * 
 * @param effect - 特效項目
 * @param bones - 模型骨骼列表（用於將 UUID 轉為名稱）
 * @param effectFileInfos - 收集特效檔案資訊（用於打包）
 * @param modelId - 所屬模型 ID
 * @returns 序列化後的特效項目
 */
async function serializeEffectItem(
  effect: EffectItem,
  bones: THREE.Object3D[],
  effectFileInfos: EffectFileInfo[],
  modelId: string
): Promise<SerializableEffectItem> {
  // 將骨骼 UUID 轉換為名稱
  const boundBoneName = effect.boundBoneUuid
    ? bones.find(b => b.uuid === effect.boundBoneUuid)?.name || null
    : null;
  
  // 收集資源路徑
  const resourcePaths: string[] = [];
  
  if (effect.sourceType === 'uploaded' && effect.rawFiles && effect.rawFiles.length > 0) {
    // uploaded 類型：使用記憶體中的原始檔案
    const effectFolderPath = `assets/effects/${modelId}/${effect.id}`;
    
    for (const file of effect.rawFiles) {
      // 取得原始相對路徑或使用檔名
      const originalPath = effect.zipPathByFileName?.get(file.name) || file.name;
      // 只保留檔名部分（去掉上層資料夾）
      const fileName = originalPath.split('/').pop() || file.name;
      const relativePath = `${effectFolderPath}/${fileName}`;
      
      effectFileInfos.push({
        effectId: effect.id,
        file,
        fileName,
        relativePath,
      });
      
      resourcePaths.push(relativePath);
    }
  } else if (effect.sourceType === 'public' || !effect.sourceType) {
    // public 類型：從 public/effekseer 取得檔案
    try {
      const effectUrl = getEffekseerPath(effect.path);
      const baseDir = effectUrl.substring(0, effectUrl.lastIndexOf('/') + 1);
      const effectFolderPath = `assets/effects/${modelId}/${effect.id}`;
      
      // 取得主 .efk 檔案
      const efkResponse = await fetch(effectUrl);
      if (efkResponse.ok) {
        const efkBlob = await efkResponse.blob();
        const efkFileName = effect.path.split('/').pop() || 'effect.efk';
        const efkRelativePath = `${effectFolderPath}/${efkFileName}`;
        
        effectFileInfos.push({
          effectId: effect.id,
          file: efkBlob,
          fileName: efkFileName,
          relativePath: efkRelativePath,
        });
        
        resourcePaths.push(efkRelativePath);
      }
      
      // 取得引用的資源檔案
      if (effect.resourceStatus) {
        for (const resource of effect.resourceStatus) {
          if (!resource.exists) continue;
          
          try {
            // 處理資源路徑
            let resourceUrl = resource.path;
            if (!resourceUrl.startsWith('/') && !resourceUrl.startsWith('http')) {
              resourceUrl = baseDir + resource.path;
            }
            
            const resourceResponse = await fetch(resourceUrl);
            if (resourceResponse.ok) {
              const resourceBlob = await resourceResponse.blob();
              const resourceFileName = resource.path.split('/').pop() || resource.path;
              const resourceRelativePath = `${effectFolderPath}/${resourceFileName}`;
              
              effectFileInfos.push({
                effectId: effect.id,
                file: resourceBlob,
                fileName: resourceFileName,
                relativePath: resourceRelativePath,
              });
              
              resourcePaths.push(resourceRelativePath);
            }
          } catch (err) {
            console.warn(`⚠️ 無法取得特效資源: ${resource.path}`, err);
          }
        }
      }
    } catch (err) {
      console.warn(`⚠️ 無法取得 public 特效: ${effect.path}`, err);
    }
  }
  
  return {
    id: effect.id,
    name: effect.name,
    path: effect.path,
    sourceType: effect.sourceType || 'public',
    position: effect.position,
    rotation: effect.rotation,
    scale: effect.scale,
    speed: effect.speed,
    isVisible: effect.isVisible,
    isLooping: effect.isLooping,
    boundBoneName,
    triggers: effect.triggers.map(serializeEffectTrigger),
    color: effect.color,
    resourcePaths: resourcePaths.length > 0 ? resourcePaths : undefined,
  };
}

/**
 * 序列化模型狀態
 * 
 * 注意：effects 需要另外處理（因為需要 async 操作），這裡先不包含
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
    // 視圖快照（相機+模型狀態）
    viewSnapshots: model.viewSnapshots && model.viewSnapshots.length > 0
      ? model.viewSnapshots
      : undefined,
    // Transform 快照（位置、旋轉、縮放、透明度）
    transformSnapshots: model.transformSnapshots && model.transformSnapshots.length > 0
      ? model.transformSnapshots
      : undefined,
    // effects 會在 execute() 中另外處理
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
      layers = [],
      spineInstances,
    } = params;

    try {
      // 檢查是否有內容可匯出
      const has3DContent = exportOptions.include3DModels && models.length > 0;
      const has2DContent = exportOptions.include2D && (layers.length > 0 || (spineInstances && spineInstances.size > 0));
      
      if (!has3DContent && !has2DContent) {
        return {
          success: false,
          error: '沒有內容可匯出（請確認有 3D 模型或 2D 圖層）',
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

      // 2. 收集模型檔案並建立資料夾（僅當 include3DModels 時）
      const serializedModels: SerializableModelState[] = [];
      
      if (exportOptions.include3DModels) {
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
          
          // 處理 Effekseer 特效（當 includeEffekseer = true）
          if (exportOptions.includeEffekseer && model.effects && model.effects.length > 0) {
            console.log(`✨ 模型 ${model.name} 有 ${model.effects.length} 個特效`);
            
            const effectFileInfos: EffectFileInfo[] = [];
            const serializedEffects: SerializableEffectItem[] = [];
            
            for (const effect of model.effects) {
              try {
                const serializedEffect = await serializeEffectItem(
                  effect,
                  model.bones,
                  effectFileInfos,
                  model.id
                );
                serializedEffects.push(serializedEffect);
                console.log(`  ✅ 序列化特效: ${effect.name}`);
              } catch (err) {
                console.warn(`  ⚠️ 序列化特效失敗: ${effect.name}`, err);
              }
            }
            
            // 將特效檔案加入 ZIP
            for (const fileInfo of effectFileInfos) {
              zip.file(fileInfo.relativePath, fileInfo.file);
              console.log(`  📁 加入特效檔案: ${fileInfo.relativePath}`);
            }
            
            // 加入序列化後的特效到模型狀態
            serializedModel.effects = serializedEffects;
          }
          
          serializedModels.push(serializedModel);
        }
      }

      // 3. 處理 2D 圖層和圖片（僅當 include2D 時）
      const imageInfos: Image2DFileInfo[] = [];
      let serializedLayers: SerializableLayer[] | undefined;
      let serializedSpineInstances: SerializableSpineInstance[] | undefined;
      
      if (exportOptions.include2D) {
        if (layers.length > 0) {
          console.log(`📦 匯出 ${layers.length} 個 2D 圖層...`);
          serializedLayers = serializeLayers(layers, imageInfos);
          
          // 將圖片檔案加入 ZIP
          for (const imageInfo of imageInfos) {
            const imageData = dataUrlToUint8Array(imageInfo.dataUrl);
            zip.file(imageInfo.relativePath, imageData);
            console.log(`  🖼️ 加入 2D 圖片: ${imageInfo.relativePath}`);
          }
        }
      
        // 4. 處理 Spine 實例
        if (spineInstances && spineInstances.size > 0) {
          console.log(`📦 匯出 ${spineInstances.size} 個 Spine 實例...`);
          serializedSpineInstances = [];
          
          for (const [instanceId, instance] of spineInstances) {
            // 序列化 Spine metadata
            serializedSpineInstances.push(serializeSpineInstance(instance));
            
            // 打包原始檔案（如果有）
            if (instance.rawData) {
              const spineFolder = zip.folder(`assets/spine/${instanceId}`);
              
              if (spineFolder) {
                // 加入 .skel 檔案
                spineFolder.file('skeleton.skel', instance.rawData.skelData);
                console.log(`  📄 加入 Spine skel: assets/spine/${instanceId}/skeleton.skel`);
                
                // 加入 .atlas 檔案
                spineFolder.file('skeleton.atlas', instance.rawData.atlasText);
                console.log(`  📄 加入 Spine atlas: assets/spine/${instanceId}/skeleton.atlas`);
                
                // 加入圖片檔案
                const texturesFolder = spineFolder.folder('textures');
                if (texturesFolder) {
                  for (const [fileName, dataUrl] of instance.rawData.images) {
                    const imageData = dataUrlToUint8Array(dataUrl);
                    texturesFolder.file(fileName, imageData);
                    console.log(`  🖼️ 加入 Spine 貼圖: assets/spine/${instanceId}/textures/${fileName}`);
                  }
                }
              }
            } else {
              console.warn(`  ⚠️ Spine 實例 ${instance.name} 沒有原始資料，無法匯出`);
            }
          }
        }
      } // end of include2D

      // 5. 建立 project-state.json
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
        layers: serializedLayers,
        spineInstances: serializedSpineInstances,
      };
      zip.file('project-state.json', JSON.stringify(projectState, null, 2));

      // 6. 生成 ZIP Blob
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

