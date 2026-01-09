/**
 * 專案載入 Use Case
 * 
 * 負責從 .jr3d 檔案（ZIP 格式）載入專案狀態
 * 
 * 載入流程：
 * 1. 解壓縮 ZIP
 * 2. 驗證 manifest 版本
 * 3. 載入模型素材（FBX + 貼圖）
 * 4. 還原 Transform 設定
 * 5. 還原切割動作（createdClips）
 * 6. 還原導演模式（Director Mode）
 */

import JSZip from 'jszip';
import * as THREE from 'three';
import type { ModelInstance } from '../../domain/value-objects/ModelInstance';
import type { IdentifiableClip } from '../../utils/clip/clipIdentifierUtils';
import { AnimationClipService } from '../../domain/services/AnimationClipService';
import { LoadModelUseCase } from './LoadModelUseCase';
import {
  type ProjectState,
  type ProjectManifest,
  type SerializableModelState,
  type SerializableClipInfo,
  type SerializableDirectorState,
  type SerializableLayer,
  type SerializableElement2D,
  type SerializableSpineInstance,
  type SerializableImageElement2D,
  isVersionCompatible,
} from '../../domain/value-objects/ProjectState';
import type { ShaderGroup, ShaderFeature } from '../../domain/value-objects/ShaderFeature';
import type { Layer } from '../../domain/value-objects/Layer';
import type { Element2D, ImageElement2D } from '../../domain/value-objects/Element2D';
import type { SpineInstance, SpineRawData } from '../../domain/value-objects/SpineInstance';
import { getSpineRuntimeAdapter } from '../../infrastructure/spine';
import { createSpineInstance } from '../../domain/value-objects/SpineInstance';
import type { EffectItem } from '../../presentation/features/effect-panel/components/EffectTestPanel';
import type { EffectTrigger } from '../../domain/value-objects/EffectTrigger';
import { LoadEffectUseCase } from './LoadEffectUseCase';

// ============================================================================
// 載入參數介面
// ============================================================================

/**
 * 載入專案回調函數
 */
export interface LoadProjectCallbacks {
  /** 新增模型 */
  addModel: (model: ModelInstance) => void;
  
  /** 更新模型 */
  updateModel: (id: string, updates: Partial<ModelInstance>) => void;
  
  /** 取得模型 */
  getModel: (id: string) => ModelInstance | null;
  
  /** 清空現有模型 */
  clearModels?: () => void;
  
  /** 設定進度 */
  onProgress?: (progress: number, message: string) => void;
  
  /** 設定 2D 圖層（可選） */
  setLayers?: (layers: Layer[]) => void;
  
  /** 新增 Spine 實例（可選） */
  addSpineInstance?: (instance: SpineInstance) => void;
  
  /** 清空所有 Spine 實例（可選） */
  clearSpineInstances?: () => void;
}

/**
 * 導演模式回調函數
 */
export interface DirectorCallbacks {
  /** 重置導演模式 */
  reset: () => void;
  
  /** 設定 FPS */
  setFps: (fps: number) => void;
  
  /** 設定總幀數 */
  setTotalFrames: (frames: number) => void;
  
  /** 設定入點 */
  setInPoint: (frame: number | null) => void;
  
  /** 設定出點 */
  setOutPoint: (frame: number | null) => void;
  
  /** 切換區間播放 */
  toggleLoopRegion: () => void;
  
  /** 新增軌道 */
  addTrack: (name?: string) => { id: string };
  
  /** 更新軌道 */
  updateTrack: (id: string, updates: { isLocked?: boolean; isMuted?: boolean }) => void;
  
  /** 新增片段 */
  addClip: (params: {
    trackId: string;
    sourceType: string;
    sourceModelId: string;
    sourceModelName: string;
    sourceAnimationId: string;
    sourceAnimationName: string;
    sourceAnimationDuration: number;
    startFrame: number;
    color?: string;
    /** Spine 相關 */
    spineInstanceId?: string;
    spineLayerId?: string;
    spineElementId?: string;
    /** 程式動作類型 */
    proceduralType?: string;
  }) => { id: string } | null;
  
  /** 更新片段 */
  updateClip: (id: string, updates: {
    trimStart?: number;
    trimEnd?: number;
    speed?: number;
    loop?: boolean;
    /** 程式動作設定 */
    proceduralConfig?: Record<string, any>;
  }) => void;
}

/**
 * 載入結果
 */
export interface LoadProjectResult {
  /** 是否成功 */
  success: boolean;
  
  /** 錯誤訊息 */
  error?: string;
  
  /** 專案狀態 */
  projectState?: ProjectState;
  
  /** 模型 ID 映射表（舊ID → 新ID） */
  modelIdMap?: Map<string, string>;
  
  /** 動作 ID 映射表（舊customId → 新customId） */
  clipIdMap?: Map<string, string>;
  
  /** Spine ID 映射表（舊ID → 新ID） */
  spineIdMap?: Map<string, string>;
}

// ============================================================================
// 載入 Use Case
// ============================================================================

export class LoadProjectUseCase {
  /**
   * 執行專案載入
   * 
   * @param file - .jr3d 檔案
   * @param modelCallbacks - 模型操作回調
   * @param directorCallbacks - 導演模式操作回調（可選）
   * @returns 載入結果
   */
  static async execute(
    file: File,
    modelCallbacks: LoadProjectCallbacks,
    directorCallbacks?: DirectorCallbacks
  ): Promise<LoadProjectResult> {
    const modelIdMap = new Map<string, string>();
    const clipIdMap = new Map<string, string>();
    const spineIdMap = new Map<string, string>();

    try {
      // 1. 解壓縮 ZIP
      modelCallbacks.onProgress?.(5, '正在解壓縮專案檔案...');
      const zip = await JSZip.loadAsync(file);

      // 2. 讀取並驗證 manifest
      modelCallbacks.onProgress?.(10, '正在驗證專案版本...');
      const manifestFile = zip.file('manifest.json');
      if (!manifestFile) {
        return { success: false, error: '無效的專案檔案：找不到 manifest.json' };
      }
      
      const manifestText = await manifestFile.async('string');
      const manifest: ProjectManifest = JSON.parse(manifestText);
      
      if (!isVersionCompatible(manifest.version)) {
        return { success: false, error: `專案版本不相容：${manifest.version}` };
      }

      // 3. 讀取 project-state.json
      modelCallbacks.onProgress?.(15, '正在讀取專案狀態...');
      const stateFile = zip.file('project-state.json');
      if (!stateFile) {
        return { success: false, error: '無效的專案檔案：找不到 project-state.json' };
      }
      
      const stateText = await stateFile.async('string');
      const projectState: ProjectState = JSON.parse(stateText);

      // 4. 清空現有模型（如果提供了回調）
      modelCallbacks.clearModels?.();

      // 5. 載入模型（保存實例以便後續處理）
      const loadedModels = new Map<string, ModelInstance>(); // 舊ID -> 新模型實例
      const totalModels = projectState.models.length;
      for (let i = 0; i < totalModels; i++) {
        const savedModel = projectState.models[i];
        const progress = 20 + (i / totalModels) * 40;
        modelCallbacks.onProgress?.(progress, `正在載入模型 ${i + 1}/${totalModels}: ${savedModel.name}`);

        try {
          const newModel = await this.loadModel(zip, savedModel, modelCallbacks);
          if (newModel) {
            modelIdMap.set(savedModel.id, newModel.id);
            loadedModels.set(savedModel.id, newModel);
          }
        } catch (error) {
          console.error(`載入模型失敗: ${savedModel.name}`, error);
        }
      }

      // 6. 還原 Transform 設定
      modelCallbacks.onProgress?.(65, '正在還原模型設定...');
      for (const savedModel of projectState.models) {
        const newModelId = modelIdMap.get(savedModel.id);
        if (newModelId) {
          this.restoreTransform(newModelId, savedModel, modelCallbacks);
        }
      }

      // 7. 還原 Shader 配置
      if (projectState.exportOptions.includeShader) {
        modelCallbacks.onProgress?.(70, '正在還原 Shader 配置...');
        for (const savedModel of projectState.models) {
          const newModelId = modelIdMap.get(savedModel.id);
          if (newModelId && savedModel.shaderGroups && savedModel.shaderGroups.length > 0) {
            await this.restoreShaderGroups(zip, savedModel, newModelId, modelCallbacks);
          }
        }
      }

      // 7.5. 還原 Effekseer 特效（需要在 clipIdMap 填充後才能正確映射觸發器）
      // 注意：這裡先收集，等 clipIdMap 完成後再執行
      const effectRestoreTasks: Array<{
        savedModel: SerializableModelState;
        newModelId: string;
        loadedModel: ModelInstance;
      }> = [];
      
      if (projectState.exportOptions.includeEffekseer) {
        for (const savedModel of projectState.models) {
          const newModelId = modelIdMap.get(savedModel.id);
          const loadedModel = loadedModels.get(savedModel.id);
          if (newModelId && loadedModel && savedModel.effects && savedModel.effects.length > 0) {
            effectRestoreTasks.push({ savedModel, newModelId, loadedModel });
          }
        }
      }

      // 8. 還原切割動作（直接使用載入的模型實例，避免異步狀態問題）
      if (projectState.exportOptions.includeAnimations) {
        modelCallbacks.onProgress?.(80, '正在還原動作片段...');
        for (const savedModel of projectState.models) {
          const loadedModel = loadedModels.get(savedModel.id);
          if (loadedModel && savedModel.createdClips && savedModel.createdClips.length > 0) {
            await this.restoreCreatedClipsWithModel(
              loadedModel,
              savedModel.createdClips,
              modelCallbacks,
              clipIdMap
            );
          }
        }
      }

      // 8.5. 還原 Effekseer 特效（現在 clipIdMap 已填充完成）
      if (effectRestoreTasks.length > 0) {
        modelCallbacks.onProgress?.(85, '正在還原 Effekseer 特效...');
        for (const task of effectRestoreTasks) {
          await this.restoreEffects(
            zip,
            task.savedModel,
            task.newModelId,
            task.loadedModel.bones,
            clipIdMap,
            modelCallbacks
          );
        }
      }

      // 9. 還原 Spine 實例（必須在導演模式之前，因為導演模式需要 spineIdMap）
      if (projectState.spineInstances && projectState.spineInstances.length > 0) {
        modelCallbacks.onProgress?.(88, '正在還原 Spine 實例...');
        
        // 先清空現有 Spine 實例
        modelCallbacks.clearSpineInstances?.();
        
        for (const savedSpine of projectState.spineInstances) {
          try {
            const newSpine = await this.restoreSpineInstance(zip, savedSpine);
            if (newSpine) {
              spineIdMap.set(savedSpine.id, newSpine.id);
              modelCallbacks.addSpineInstance?.(newSpine);
              console.log(`✅ Spine 實例還原成功: ${savedSpine.name} (${savedSpine.id} -> ${newSpine.id})`);
            }
          } catch (error) {
            console.error(`❌ 還原 Spine 實例失敗: ${savedSpine.name}`, error);
          }
        }
      }

      // 10. 還原 2D 圖層（也需要 spineIdMap）
      if (projectState.layers && projectState.layers.length > 0 && modelCallbacks.setLayers) {
        modelCallbacks.onProgress?.(92, '正在還原 2D 圖層...');
        const restoredLayers = await this.restoreLayers(zip, projectState.layers, spineIdMap);
        modelCallbacks.setLayers(restoredLayers);
        console.log(`✅ 還原 ${restoredLayers.length} 個 2D 圖層`);
      }

      // 11. 還原導演模式（在 Spine 和 2D 圖層之後，確保 spineIdMap 已正確填充）
      if (projectState.director && directorCallbacks) {
        modelCallbacks.onProgress?.(96, '正在還原導演模式...');
        this.restoreDirectorMode(
          projectState.director,
          modelIdMap,
          clipIdMap,
          directorCallbacks,
          spineIdMap
        );
      }

      modelCallbacks.onProgress?.(100, '載入完成！');

      return {
        success: true,
        projectState,
        modelIdMap,
        clipIdMap,
        spineIdMap,
      };
    } catch (error) {
      console.error('載入專案失敗:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '載入失敗',
      };
    }
  }

  /**
   * 載入單個模型
   */
  private static async loadModel(
    zip: JSZip,
    savedModel: SerializableModelState,
    callbacks: LoadProjectCallbacks
  ): Promise<ModelInstance | null> {
    const modelFolderPath = `models/${savedModel.id}`;
    
    // 收集所有檔案
    const files: File[] = [];

    // 讀取 FBX 檔案（使用完整路徑）
    const fbxPath = `${modelFolderPath}/${savedModel.modelPath}`;
    const fbxFile = zip.file(fbxPath);
    if (fbxFile) {
      const fbxBlob = await fbxFile.async('blob');
      files.push(new File([fbxBlob], savedModel.modelPath, { type: 'model/fbx' }));
      console.log(`✅ 載入 FBX 檔案: ${fbxPath}`);
    } else {
      console.warn(`❌ 找不到 FBX 檔案: ${fbxPath}`);
    }

    // 讀取貼圖檔案
    for (const texturePath of savedModel.texturePaths) {
      const fullTexturePath = `${modelFolderPath}/${texturePath}`;
      const textureFile = zip.file(fullTexturePath);
      if (textureFile) {
        const textureBlob = await textureFile.async('blob');
        const mimeType = this.getMimeType(texturePath);
        files.push(new File([textureBlob], texturePath, { type: mimeType }));
        console.log(`✅ 載入貼圖檔案: ${fullTexturePath}`);
      } else {
        console.warn(`❌ 找不到貼圖檔案: ${fullTexturePath}`);
      }
    }

    if (files.length === 0) {
      console.warn(`模型 ${savedModel.name} 沒有檔案，嘗試列出 ZIP 內容...`);
      // Debug: 列出 ZIP 中的所有檔案
      zip.forEach((relativePath) => {
        if (relativePath.startsWith(modelFolderPath)) {
          console.log(`  ZIP 中的檔案: ${relativePath}`);
        }
      });
      return null;
    }

    // 建立 FileList
    const fileList = this.createFileList(files);

    // 使用 LoadModelUseCase 載入
    const { instance: newModel } = await LoadModelUseCase.executeAndCreateInstance(fileList, savedModel.name);
    
    // 加入模型管理
    callbacks.addModel(newModel);
    
    console.log(`✅ 模型載入成功: ${newModel.name} (ID: ${newModel.id}), 有動畫: ${!!newModel.originalClip}`);

    return newModel;
  }

  /**
   * 還原 Transform 設定
   */
  private static restoreTransform(
    modelId: string,
    savedModel: SerializableModelState,
    callbacks: LoadProjectCallbacks
  ): void {
    callbacks.updateModel(modelId, {
      name: savedModel.name,
      position: savedModel.position,
      rotation: savedModel.rotation,
      scale: savedModel.scale,
      renderPriority: savedModel.renderPriority,
      visible: savedModel.visible,
      opacity: savedModel.opacity,
      isLoopEnabled: savedModel.isLoopEnabled,
      // 還原視圖快照（相機+模型狀態）
      viewSnapshots: savedModel.viewSnapshots || [],
      // 還原 Transform 快照（位置、旋轉、縮放、透明度）
      transformSnapshots: savedModel.transformSnapshots || [],
    });
  }

  /**
   * 還原切割動作（使用傳入的模型實例，避免異步狀態問題）
   */
  private static async restoreCreatedClipsWithModel(
    model: ModelInstance,
    savedClips: SerializableClipInfo[],
    callbacks: LoadProjectCallbacks,
    clipIdMap: Map<string, string>
  ): Promise<void> {
    console.log(`[restoreCreatedClips] 模型 ${model.id} (${model.name}):`, {
      hasOriginalClip: !!model.originalClip,
      originalClipDuration: model.originalClip?.duration,
      savedClipsCount: savedClips.length,
    });
    
    if (!model.originalClip) {
      console.warn(`❌ 無法還原動作：模型 ${model.name} 沒有原始動畫`);
      return;
    }

    const restoredClips: IdentifiableClip[] = [];

    for (const savedClip of savedClips) {
      try {
        console.log(`[restoreCreatedClips] 還原動作: ${savedClip.displayName} (${savedClip.startFrame}-${savedClip.endFrame})`);
        
        // 使用 AnimationClipService.createSubClip 重建動作
        const newClip = AnimationClipService.createSubClip(
          model.originalClip,
          savedClip.displayName,
          savedClip.startFrame,
          savedClip.endFrame,
          savedClip.fps,
          restoredClips.map(c => c.displayName || c.name)
        );

        // 記錄 ID 映射
        clipIdMap.set(savedClip.customId, newClip.customId || newClip.uuid);

        restoredClips.push(newClip);
        console.log(`✅ 動作還原成功: ${savedClip.displayName}`);
      } catch (error) {
        console.error(`❌ 還原動作失敗: ${savedClip.displayName}`, error);
      }
    }

    // 更新模型的 createdClips
    if (restoredClips.length > 0) {
      callbacks.updateModel(model.id, { createdClips: restoredClips });
      console.log(`✅ 已更新模型 ${model.name} 的 createdClips，共 ${restoredClips.length} 個動作`);
    }
  }

  /**
   * 還原 Shader 配置
   * 
   * @param zip - ZIP 檔案
   * @param savedModel - 已保存的模型狀態
   * @param newModelId - 新模型 ID
   * @param callbacks - 回調函數
   */
  private static async restoreShaderGroups(
    zip: JSZip,
    savedModel: SerializableModelState,
    newModelId: string,
    callbacks: LoadProjectCallbacks
  ): Promise<void> {
    if (!savedModel.shaderGroups || savedModel.shaderGroups.length === 0) {
      return;
    }

    console.log(`🎨 還原 Shader 配置: ${savedModel.name}, ${savedModel.shaderGroups.length} 個組合`);

    const modelFolderPath = `models/${savedModel.id}`;
    const restoredGroups: ShaderGroup[] = [];

    for (const savedGroup of savedModel.shaderGroups) {
      const restoredFeatures: ShaderFeature[] = [];

      for (const savedFeature of savedGroup.features) {
        const restoredParams: Record<string, any> = {};

        // 處理每個參數
        for (const [key, value] of Object.entries(savedFeature.params)) {
          // 如果是字串且看起來像貼圖路徑
          if (typeof value === 'string' && value.startsWith('shader/textures/')) {
            const texturePath = `${modelFolderPath}/${value}`;
            const textureZipFile = zip.file(texturePath);
            
            if (textureZipFile) {
              const blob = await textureZipFile.async('blob');
              const fileName = value.split('/').pop() || value;
              const mimeType = this.getMimeType(fileName);
              const file = new File([blob], fileName, { type: mimeType });
              restoredParams[key] = file;
              console.log(`  🖼️ 還原貼圖: ${key} <- ${value}`);
            } else {
              console.warn(`  ⚠️ 找不到貼圖: ${texturePath}`);
              restoredParams[key] = null;
            }
          } else {
            // 其他參數直接複製
            restoredParams[key] = value;
          }
        }

        // 建立還原的 ShaderFeature
        const restoredFeature: ShaderFeature = {
          id: `${savedFeature.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: savedFeature.type as ShaderFeature['type'],
          name: savedFeature.name,
          description: savedFeature.description,
          icon: savedFeature.icon,
          expanded: false,
          enabled: savedFeature.enabled,
          params: restoredParams,
        };

        restoredFeatures.push(restoredFeature);
      }

      // 建立還原的 ShaderGroup
      const restoredGroup: ShaderGroup = {
        id: savedGroup.id || `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: savedGroup.name,
        selectedMeshes: [...savedGroup.selectedMeshes],
        features: restoredFeatures,
        expanded: true,
        enabled: savedGroup.enabled,
      };

      restoredGroups.push(restoredGroup);
      console.log(`  ✅ 還原組合: ${savedGroup.name}, Meshes: [${savedGroup.selectedMeshes.join(', ')}], 啟用: ${savedGroup.enabled}`);
    }

    // 更新模型的 Shader 設定
    callbacks.updateModel(newModelId, {
      shaderGroups: restoredGroups,
      isShaderEnabled: savedModel.isShaderEnabled ?? true,
    });

    console.log(`✅ Shader 配置還原完成: ${restoredGroups.length} 個組合`);
  }

  /**
   * 還原 Effekseer 特效
   * 
   * @param zip - ZIP 檔案
   * @param savedModel - 已保存的模型狀態
   * @param newModelId - 新模型 ID
   * @param newBones - 新模型的骨骼列表
   * @param clipIdMap - 動作 ID 映射表
   * @param callbacks - 回調函數
   */
  private static async restoreEffects(
    zip: JSZip,
    savedModel: SerializableModelState,
    newModelId: string,
    newBones: THREE.Object3D[],
    clipIdMap: Map<string, string>,
    callbacks: LoadProjectCallbacks
  ): Promise<void> {
    if (!savedModel.effects || savedModel.effects.length === 0) {
      return;
    }

    console.log(`✨ 還原特效: ${savedModel.name}, ${savedModel.effects.length} 個特效`);

    const restoredEffects: EffectItem[] = [];

    for (const savedEffect of savedModel.effects) {
      try {
        // 將骨骼名稱轉換回 UUID
        const boundBoneUuid = savedEffect.boundBoneName
          ? newBones.find(b => b.name === savedEffect.boundBoneName)?.uuid || null
          : null;

        // 映射觸發器的 clipId
        const restoredTriggers: EffectTrigger[] = savedEffect.triggers.map(t => ({
          id: t.id,
          clipId: clipIdMap.get(t.clipId) || t.clipId,
          clipName: t.clipName,
          frame: t.frame,
          duration: t.duration,
        }));

        // 從 ZIP 讀取特效檔案（uploaded 類型）
        let rawFiles: File[] | undefined;
        let zipPathByFileName: Map<string, string> | undefined;
        let isLoaded = false;

        if (savedEffect.resourcePaths && savedEffect.resourcePaths.length > 0) {
          // 從 ZIP 解壓檔案
          rawFiles = [];
          zipPathByFileName = new Map();
          
          // 收集所有檔案
          const fileBlobs: { file: File; fileName: string }[] = [];
          
          for (const resourcePath of savedEffect.resourcePaths) {
            const zipFile = zip.file(resourcePath);
            if (zipFile) {
              const blob = await zipFile.async('blob');
              const fileName = resourcePath.split('/').pop() || resourcePath;
              const mimeType = this.getMimeType(fileName);
              const file = new File([blob], fileName, { type: mimeType });
              rawFiles.push(file);
              zipPathByFileName.set(fileName, resourcePath);
              fileBlobs.push({ file, fileName });
              console.log(`  📁 讀取特效檔案: ${resourcePath}`);
            } else {
              console.warn(`  ⚠️ 找不到特效檔案: ${resourcePath}`);
            }
          }
          
          // 載入到 Effekseer Runtime
          if (rawFiles.length > 0) {
            try {
              await LoadEffectUseCase.execute({
                id: savedEffect.id,
                files: rawFiles,
                scale: 1.0,
              });
              isLoaded = true;
              console.log(`  ✅ 特效載入到 Runtime: ${savedEffect.name}`);
            } catch (err) {
              console.warn(`  ⚠️ 特效載入失敗: ${savedEffect.name}`, err);
            }
          }
        }

        // 建立還原的 EffectItem
        const restoredEffect: EffectItem = {
          id: savedEffect.id,
          name: savedEffect.name,
          path: savedEffect.path,
          isLoaded,
          isLoading: false,
          isPlaying: false,
          isLooping: savedEffect.isLooping,
          loopIntervalId: null,
          isVisible: savedEffect.isVisible,
          position: savedEffect.position,
          rotation: savedEffect.rotation,
          scale: savedEffect.scale,
          speed: savedEffect.speed,
          boundBoneUuid,
          triggers: restoredTriggers,
          color: savedEffect.color,
          sourceType: savedEffect.sourceType,
          rawFiles,
          zipPathByFileName,
        };

        restoredEffects.push(restoredEffect);
        console.log(`  ✅ 特效還原成功: ${savedEffect.name} (骨骼綁定: ${savedEffect.boundBoneName || '無'})`);
      } catch (err) {
        console.error(`  ❌ 特效還原失敗: ${savedEffect.name}`, err);
      }
    }

    // 更新模型的特效列表
    if (restoredEffects.length > 0) {
      callbacks.updateModel(newModelId, { effects: restoredEffects });
      console.log(`✅ 特效還原完成: ${restoredEffects.length} 個特效`);
    }
  }

  /**
   * 還原 Spine 實例
   */
  private static async restoreSpineInstance(
    zip: JSZip,
    savedSpine: SerializableSpineInstance
  ): Promise<SpineInstance | null> {
    const spineFolderPath = `assets/spine/${savedSpine.id}`;
    
    // 讀取 .skel 檔案
    const skelFile = zip.file(`${spineFolderPath}/skeleton.skel`);
    if (!skelFile) {
      console.warn(`找不到 Spine skel 檔案: ${spineFolderPath}/skeleton.skel`);
      return null;
    }
    const skelData = await skelFile.async('arraybuffer');
    
    // 讀取 .atlas 檔案
    const atlasFile = zip.file(`${spineFolderPath}/skeleton.atlas`);
    if (!atlasFile) {
      console.warn(`找不到 Spine atlas 檔案: ${spineFolderPath}/skeleton.atlas`);
      return null;
    }
    const atlasText = await atlasFile.async('string');
    
    // 讀取圖片檔案
    const images = new Map<string, HTMLImageElement>();
    const imageDataUrls = new Map<string, string>();
    
    for (const imageFileName of savedSpine.imageFileNames) {
      const imagePath = `${spineFolderPath}/textures/${imageFileName}`;
      const imageFile = zip.file(imagePath);
      
      if (imageFile) {
        const imageBlob = await imageFile.async('blob');
        const dataUrl = await this.blobToDataUrl(imageBlob);
        const img = await this.loadImage(dataUrl);
        images.set(imageFileName, img);
        imageDataUrls.set(imageFileName, dataUrl);
      } else {
        console.warn(`找不到 Spine 圖片: ${imagePath}`);
      }
    }
    
    // 載入到 Runtime
    const adapter = getSpineRuntimeAdapter();
    const instanceId = `spine_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const skeletonInfo = await adapter.load({
      id: instanceId,
      skelData,
      atlasText,
      images,
    });
    
    // 建立 SpineRawData
    const rawData: SpineRawData = {
      skelData: skelData.slice(0),
      atlasText,
      images: imageDataUrls,
    };
    
    // 建立 SpineInstance
    const instance = createSpineInstance({
      name: savedSpine.name,
      skelFileName: savedSpine.skelFileName,
      atlasFileName: savedSpine.atlasFileName,
      imageFileNames: savedSpine.imageFileNames,
      skeletonInfo,
      rawData,
    });
    
    // 覆寫 ID 以匹配 Runtime
    (instance as { id: string }).id = instanceId;
    
    // 還原播放狀態
    (instance as SpineInstance).currentAnimation = savedSpine.currentAnimation;
    (instance as SpineInstance).currentSkin = savedSpine.currentSkin;
    (instance as SpineInstance).loop = savedSpine.loop;
    (instance as SpineInstance).timeScale = savedSpine.timeScale;
    (instance as SpineInstance).isPlaying = savedSpine.isPlaying;
    (instance as SpineInstance).currentTime = savedSpine.currentTime;
    
    return instance;
  }

  /**
   * 還原 2D 圖層
   */
  private static async restoreLayers(
    zip: JSZip,
    savedLayers: SerializableLayer[],
    spineIdMap: Map<string, string>
  ): Promise<Layer[]> {
    const restoredLayers: Layer[] = [];
    
    for (const savedLayer of savedLayers) {
      const restoredChildren: Element2D[] = [];
      
      for (const savedElement of savedLayer.children) {
        const restoredElement = await this.restoreElement2D(zip, savedElement, spineIdMap);
        if (restoredElement) {
          restoredChildren.push(restoredElement);
        }
      }
      
      const restoredLayer: Layer = {
        id: savedLayer.id,
        name: savedLayer.name,
        type: savedLayer.type,
        priority: savedLayer.priority,
        visible: savedLayer.visible,
        locked: savedLayer.locked,
        expanded: savedLayer.expanded,
        opacity: savedLayer.opacity,
        children: restoredChildren,
        createdAt: savedLayer.createdAt,
        updatedAt: savedLayer.updatedAt,
      };
      
      restoredLayers.push(restoredLayer);
    }
    
    return restoredLayers;
  }

  /**
   * 還原 2D 元素
   */
  private static async restoreElement2D(
    zip: JSZip,
    savedElement: SerializableElement2D,
    spineIdMap: Map<string, string>
  ): Promise<Element2D | null> {
    if (savedElement.type === 'image') {
      // 圖片元素：從 ZIP 讀取圖片並轉為 Data URL
      const imageElement = savedElement as SerializableImageElement2D;
      const imagePath = imageElement.src; // 相對路徑如 "assets/images/{id}.png"
      const imageFile = zip.file(imagePath);
      
      if (imageFile) {
        const imageBlob = await imageFile.async('blob');
        const dataUrl = await this.blobToDataUrl(imageBlob);
        
        return {
          ...imageElement,
          src: dataUrl,
        } as ImageElement2D;
      } else {
        console.warn(`找不到 2D 圖片: ${imagePath}`);
        return null;
      }
    }
    
    if (savedElement.type === 'spine') {
      // Spine 元素：更新 spineInstanceId 映射
      const spineElement = savedElement as Element2D & { spineInstanceId: string };
      const newSpineId = spineIdMap.get(spineElement.spineInstanceId);
      
      if (newSpineId) {
        return {
          ...spineElement,
          spineInstanceId: newSpineId,
        };
      } else {
        console.warn(`找不到 Spine 實例映射: ${spineElement.spineInstanceId}`);
        // 仍然返回元素，但 spineInstanceId 可能無效
        return spineElement as Element2D;
      }
    }
    
    // 其他類型元素直接返回
    return savedElement as Element2D;
  }

  /**
   * Blob 轉 Data URL
   */
  private static blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read blob'));
      reader.readAsDataURL(blob);
    });
  }

  /**
   * 載入圖片
   */
  private static loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = src;
    });
  }

  /**
   * 還原導演模式
   */
  private static restoreDirectorMode(
    savedDirector: SerializableDirectorState,
    modelIdMap: Map<string, string>,
    clipIdMap: Map<string, string>,
    callbacks: DirectorCallbacks,
    spineIdMap: Map<string, string> = new Map()
  ): void {
    // 1. 重置導演模式
    callbacks.reset();

    // 2. 還原時間軸設定
    callbacks.setFps(savedDirector.timeline.fps);
    callbacks.setTotalFrames(savedDirector.timeline.totalFrames);

    // 3. 還原區間播放
    const lr = savedDirector.timeline.loopRegion;
    if (lr.inPoint !== null) {
      callbacks.setInPoint(lr.inPoint);
    }
    if (lr.outPoint !== null) {
      callbacks.setOutPoint(lr.outPoint);
    }
    if (lr.enabled) {
      callbacks.toggleLoopRegion();
    }

    // 4. 還原軌道與片段
    for (const savedTrack of savedDirector.tracks) {
      // 新增軌道
      const newTrack = callbacks.addTrack(savedTrack.name);

      // 設定軌道屬性
      callbacks.updateTrack(newTrack.id, {
        isLocked: savedTrack.isLocked,
        isMuted: savedTrack.isMuted,
      });

      // 還原片段
      for (const savedClip of savedTrack.clips) {
        // 類型特殊處理
        const isProcedural = savedClip.sourceType === 'procedural';
        const isSpine = savedClip.sourceType === 'spine';
        
        // 根據類型映射 ID
        let newModelId: string | undefined;
        if (isSpine) {
          // Spine 片段：sourceModelId 是 Spine 實例的 ID，需要從 spineIdMap 查找
          newModelId = spineIdMap.get(savedClip.sourceModelId) || savedClip.sourceModelId;
        } else {
          // 普通 3D 模型片段：從 modelIdMap 查找
          newModelId = modelIdMap.get(savedClip.sourceModelId);
        }
        
        const newClipId = clipIdMap.get(savedClip.sourceAnimationId);

        if (!newModelId) {
          console.warn('無法還原片段，找不到對應的模型/實例:', savedClip.sourceModelId, '類型:', savedClip.sourceType);
          continue;
        }

        // 新增片段
        const addedClip = callbacks.addClip({
          trackId: newTrack.id,
          sourceType: savedClip.sourceType,
          sourceModelId: newModelId,
          sourceModelName: savedClip.sourceModelName,
          sourceAnimationId: isSpine
            ? savedClip.sourceAnimationId  // Spine 動畫名稱不變
            : (isProcedural 
                ? savedClip.sourceAnimationId  // 程式動作使用原始 ID
                : (newClipId || savedClip.sourceAnimationId)),
          sourceAnimationName: savedClip.sourceAnimationName,
          sourceAnimationDuration: savedClip.sourceAnimationDuration,
          startFrame: savedClip.startFrame,
          color: savedClip.color,
          // Spine 相關（更新 ID 映射）
          spineInstanceId: savedClip.spineInstanceId 
            ? (spineIdMap.get(savedClip.spineInstanceId) || savedClip.spineInstanceId)
            : undefined,
          spineLayerId: savedClip.spineLayerId,
          spineElementId: savedClip.spineElementId,
          // 程式動作類型
          proceduralType: savedClip.proceduralType,
        });

        // 還原進階設定
        if (addedClip) {
          callbacks.updateClip(addedClip.id, {
            trimStart: savedClip.trimStart,
            trimEnd: savedClip.trimEnd,
            speed: savedClip.speed,
            loop: savedClip.loop,
            // 程式動作設定
            proceduralConfig: savedClip.proceduralConfig,
          });
        }
      }
    }
  }

  /**
   * 建立 FileList
   */
  private static createFileList(files: File[]): FileList {
    const dataTransfer = new DataTransfer();
    for (const file of files) {
      dataTransfer.items.add(file);
    }
    return dataTransfer.files;
  }

  /**
   * 取得 MIME 類型
   */
  private static getMimeType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      case 'tga':
        return 'image/x-tga';
      default:
        return 'application/octet-stream';
    }
  }
}

