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
  isVersionCompatible,
} from '../../domain/value-objects/ProjectState';

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
  }) => { id: string } | null;
  
  /** 更新片段 */
  updateClip: (id: string, updates: {
    trimStart?: number;
    trimEnd?: number;
    speed?: number;
    loop?: boolean;
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

      // 7. 還原切割動作（直接使用載入的模型實例，避免異步狀態問題）
      if (projectState.exportOptions.includeAnimations) {
        modelCallbacks.onProgress?.(75, '正在還原動作片段...');
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

        // 8. 還原導演模式
        if (projectState.director && directorCallbacks) {
          modelCallbacks.onProgress?.(85, '正在還原導演模式...');
          this.restoreDirectorMode(
            projectState.director,
            modelIdMap,
            clipIdMap,
            directorCallbacks
          );
        }
      }

      modelCallbacks.onProgress?.(100, '載入完成！');

      return {
        success: true,
        projectState,
        modelIdMap,
        clipIdMap,
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
   * 還原導演模式
   */
  private static restoreDirectorMode(
    savedDirector: SerializableDirectorState,
    modelIdMap: Map<string, string>,
    clipIdMap: Map<string, string>,
    callbacks: DirectorCallbacks
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
        // 映射新的 ID
        const newModelId = modelIdMap.get(savedClip.sourceModelId);
        const newClipId = clipIdMap.get(savedClip.sourceAnimationId);

        if (!newModelId) {
          console.warn('無法還原片段，找不到對應的模型:', savedClip.sourceModelId);
          continue;
        }

        // 新增片段
        const addedClip = callbacks.addClip({
          trackId: newTrack.id,
          sourceType: savedClip.sourceType,
          sourceModelId: newModelId,
          sourceModelName: savedClip.sourceModelName,
          sourceAnimationId: newClipId || savedClip.sourceAnimationId,
          sourceAnimationName: savedClip.sourceAnimationName,
          sourceAnimationDuration: savedClip.sourceAnimationDuration,
          startFrame: savedClip.startFrame,
          color: savedClip.color,
        });

        // 還原進階設定
        if (addedClip) {
          callbacks.updateClip(addedClip.id, {
            trimStart: savedClip.trimStart,
            trimEnd: savedClip.trimEnd,
            speed: savedClip.speed,
            loop: savedClip.loop,
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

