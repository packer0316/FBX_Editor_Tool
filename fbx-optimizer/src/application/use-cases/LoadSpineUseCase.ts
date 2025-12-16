/**
 * 載入 Spine Use Case
 * 
 * 負責協調 Spine 骨架載入的業務邏輯，包括：
 * - 檔案分類（.skel、.atlas、圖片）
 * - 檔案讀取
 * - Runtime 載入
 * - SpineInstance 建立
 * 
 * @example
 * ```typescript
 * const result = await LoadSpineUseCase.execute(fileList);
 * console.log(result.instance); // SpineInstance
 * ```
 */

import { getSpineWebglRuntimeAdapter } from '../../infrastructure/spine-webgl';
import {
  createSpineInstance,
  type SpineInstance,
  type SpineSkeletonInfo,
} from '../../domain/value-objects/SpineInstance';

// ============================================================================
// 類型定義
// ============================================================================

/**
 * 載入結果
 */
export interface LoadSpineResult {
  /** Spine 實例 */
  instance: SpineInstance;
  /** 骨架資訊 */
  skeletonInfo: SpineSkeletonInfo;
}

/**
 * 檔案分類結果
 */
interface ClassifiedFiles {
  /** .skel 檔案 */
  skelFile: File | null;
  /** .atlas 檔案 */
  atlasFile: File | null;
  /** 圖片檔案列表 */
  imageFiles: File[];
}

// ============================================================================
// Use Case
// ============================================================================

/**
 * 載入 Spine Use Case
 */
export class LoadSpineUseCase {
  /**
   * 執行載入
   * 
   * @param files 檔案列表（應包含 .skel、.atlas 和圖片檔案）
   * @param name 可選的名稱（預設使用 .skel 檔名）
   * @returns Promise 解析為載入結果
   * @throws {Error} 當缺少必要檔案時拋出錯誤
   */
  static async execute(files: FileList | File[], name?: string): Promise<LoadSpineResult> {
    const fileArray = Array.from(files);
    
    // 1. 分類檔案
    const classified = this.classifyFiles(fileArray);
    
    // 2. 驗證必要檔案
    if (!classified.skelFile) {
      throw new Error('請提供 .skel 檔案（Spine 骨架二進制檔案）');
    }
    if (!classified.atlasFile) {
      throw new Error('請提供 .atlas 檔案（Spine 圖集描述檔案）');
    }
    if (classified.imageFiles.length === 0) {
      throw new Error('請提供至少一個圖片檔案（.png 或 .jpg）');
    }

    // 3. 讀取檔案內容
    const [skelData, atlasText, images] = await Promise.all([
      this.readAsArrayBuffer(classified.skelFile),
      this.readAsText(classified.atlasFile),
      this.loadImages(classified.imageFiles),
    ]);

    // 4. 載入到 Runtime
    const adapter = getSpineWebglRuntimeAdapter();
    const instanceId = `spine_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const skeletonInfo = await adapter.load({
      id: instanceId,
      skelData,
      atlasText,
      atlasFileName: classified.atlasFile.name,
      images,
    });

    // 5. 建立 SpineInstance
    const instanceName = name ?? classified.skelFile.name.replace(/\.skel$/i, '');
    const instance = createSpineInstance({
      name: instanceName,
      skelFileName: classified.skelFile.name,
      atlasFileName: classified.atlasFile.name,
      imageFileNames: classified.imageFiles.map(f => f.name),
      skeletonInfo,
    });

    // 覆寫 ID 以匹配 Runtime
    (instance as { id: string }).id = instanceId;

    console.log(`[LoadSpineUseCase] 載入成功: ${instance.name}`);

    return {
      instance,
      skeletonInfo,
    };
  }

  /**
   * 分類檔案
   */
  private static classifyFiles(files: File[]): ClassifiedFiles {
    const result: ClassifiedFiles = {
      skelFile: null,
      atlasFile: null,
      imageFiles: [],
    };

    for (const file of files) {
      const ext = file.name.toLowerCase().split('.').pop();

      switch (ext) {
        case 'skel':
          result.skelFile = file;
          break;
        case 'atlas':
          result.atlasFile = file;
          break;
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'webp':
          result.imageFiles.push(file);
          break;
        default:
          console.warn(`[LoadSpineUseCase] 忽略不支援的檔案: ${file.name}`);
      }
    }

    return result;
  }

  /**
   * 讀取檔案為 ArrayBuffer
   */
  private static readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(new Error(`讀取檔案失敗: ${file.name}`));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * 讀取檔案為文本
   */
  private static readAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error(`讀取檔案失敗: ${file.name}`));
      reader.readAsText(file);
    });
  }

  /**
   * 載入圖片
   */
  private static async loadImages(files: File[]): Promise<Map<string, HTMLImageElement>> {
    const images = new Map<string, HTMLImageElement>();

    await Promise.all(
      files.map(async (file) => {
        const dataUrl = await this.readAsDataURL(file);
        const img = await this.loadImage(dataUrl);
        images.set(file.name, img);
      })
    );

    return images;
  }

  /**
   * 讀取檔案為 Data URL
   */
  private static readAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error(`讀取檔案失敗: ${file.name}`));
      reader.readAsDataURL(file);
    });
  }

  /**
   * 載入圖片元素
   */
  private static loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('載入圖片失敗'));
      img.src = src;
    });
  }

  /**
   * 驗證檔案列表是否包含 Spine 必要檔案
   */
  static hasSpineFiles(files: FileList | File[]): boolean {
    const fileArray = Array.from(files);
    const classified = this.classifyFiles(fileArray);
    return classified.skelFile !== null && classified.atlasFile !== null;
  }

  /**
   * 取得支援的副檔名
   */
  static getSupportedExtensions(): string[] {
    return ['.skel', '.atlas', '.png', '.jpg', '.jpeg', '.webp'];
  }

  /**
   * 取得 Accept 字串（用於 file input）
   */
  static getAcceptString(): string {
    return '.skel,.atlas,.png,.jpg,.jpeg,.webp';
  }
}


