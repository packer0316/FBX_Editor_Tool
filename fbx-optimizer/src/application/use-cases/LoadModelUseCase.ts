import * as THREE from 'three';
import type { ShaderGroup } from '../../domain/value-objects/ShaderFeature';
import { ModelLoaderService } from '../../domain/services/model/ModelLoaderService';
import type { ModelInstance } from '../../domain/value-objects/ModelInstance';
import { setClipIdentifier, type IdentifiableClip } from '../../utils/clip/clipIdentifierUtils';
import { createDefaultTransformSnapshot } from '../../domain/value-objects/TransformSnapshot';

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

  /**
   * 載入模型並創建 ModelInstance
   * 
   * @param files - 檔案列表，應包含至少一個 FBX 檔案和可選的貼圖檔案
   * @param modelName - 可選的模型名稱（預設使用檔名）
   * @returns Promise 解析為 ModelInstance
   * @throws {Error} 當檔案列表中沒有 FBX 檔案時拋出錯誤
   * 
   * @example
   * ```typescript
   * const instance = await LoadModelUseCase.executeAndCreateInstance(files, '我的模型');
   * console.log(instance.id); // "model_1234567890_abc"
   * ```
   */
  static async executeAndCreateInstance(
    files: FileList,
    modelName?: string
  ): Promise<ModelInstance> {
    const result = await this.execute(files);
    const { fbxFile } = ModelLoaderService.classifyFiles(files);
    
    // 提取骨骼與可綁定節點（從三個來源：樹狀結構、SkinnedMesh.skeleton、Dummy）
    const boneSet = new Set<THREE.Object3D>();
    result.model.traverse((child) => {
      // 來源1: 樹狀結構中的 Bone 節點
      if (child.type === 'Bone' || (child as any).isBone) {
        boneSet.add(child);
      }
      // 來源2: SkinnedMesh 的 skeleton.bones
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
        const skinnedMesh = child as THREE.SkinnedMesh;
        if (skinnedMesh.skeleton && skinnedMesh.skeleton.bones) {
          skinnedMesh.skeleton.bones.forEach((bone) => {
            boneSet.add(bone);
          });
        }
      }
      // 來源3: Dummy 節點（3DS Max 輔助物件）
      // Dummy 在 FBX 匯入後會變成普通的 Object3D，透過名稱識別
      if (child.name.toLowerCase().includes('dummy')) {
        boneSet.add(child);
      }
    });
    const bones = Array.from(boneSet);

    // 處理動畫片段
    let originalClip: IdentifiableClip | null = null;
    let masterClip: IdentifiableClip | null = null;
    let optimizedClip: IdentifiableClip | null = null;
    
    if (result.animations.length > 0) {
      const clip = result.animations[0] as IdentifiableClip;
      if (!clip.customId) {
        setClipIdentifier(clip);
      }
      originalClip = clip;
      masterClip = clip;
    }

    return {
      id: `model_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name: modelName || fbxFile?.name.replace(/\.fbx$/i, '') || '未命名模型',
      file: fbxFile || null,
      model: result.model,
      meshNames: result.meshNames,
      bones,
      originalClip,
      masterClip,
      optimizedClip,
      createdClips: [],
      tolerance: 0,
      shaderGroups: result.defaultShaderGroup ? [result.defaultShaderGroup] : [],
      isShaderEnabled: true,
      audioTracks: [],
      effects: [],
      proceduralActions: [],
      isPlaying: false,
      currentTime: 0,
      duration: originalClip?.duration || 0,
      isLoopEnabled: true,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      renderPriority: 0,
      visible: true,
      showTransformGizmo: true,
      showWireframe: false,
      opacity: 1.0,
      isCameraOrbiting: false,
      cameraOrbitSpeed: 30,
      isModelRotating: false,
      modelRotationSpeed: 30,
      viewSnapshots: [],
      transformSnapshots: [createDefaultTransformSnapshot()],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }
}

