import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { TGALoader } from 'three/examples/jsm/loaders/TGALoader';
import { MaterialFixService } from './MaterialFixService';

/**
 * 模型載入服務
 * 
 * 負責處理 FBX 檔案載入、貼圖處理等技術細節。此服務封裝了：
 * - FBX 檔案與貼圖檔案的分類
 * - 貼圖 URL 修改器的建立（用於從上傳的檔案中提供貼圖）
 * - FBX 模型的載入與解析
 * - Mesh 名稱的提取
 * 
 * @example
 * ```typescript
 * const { fbxFile, textureFiles } = ModelLoaderService.classifyFiles(fileList);
 * const model = await ModelLoaderService.loadFBX(fbxFile, textureFiles);
 * const meshNames = ModelLoaderService.extractMeshNames(model);
 * ```
 */
export class ModelLoaderService {
  /**
   * 分類檔案：找出 FBX 檔案、貼圖檔案和 INI 檔案
   * 
   * 從檔案列表中分離出 FBX 檔案、貼圖檔案和 INI 檔案。貼圖檔案會以小寫檔名作為 key
   * 儲存在 Map 中，以便後續快速查找。
   * 
   * @param files - 檔案列表（通常來自 input[type="file"] 的 files 屬性）
   * @returns 包含 FBX 檔案（可能為 null）、貼圖檔案 Map 和 INI 檔案（可能為 null）的物件
   * 
   * @example
   * ```typescript
   * const { fbxFile, textureFiles, iniFile } = ModelLoaderService.classifyFiles(fileInput.files);
   * if (!fbxFile) {
   *   throw new Error('未找到 FBX 檔案');
   * }
   * console.log('找到', textureFiles.size, '個貼圖檔案');
   * if (iniFile) {
   *   console.log('找到 INI 檔案:', iniFile.name);
   * }
   * ```
   */
  static classifyFiles(files: FileList): { 
    fbxFile: File | null; 
    textureFiles: Map<string, File>;
    iniFile: File | null;
  } {
    let fbxFile: File | null = null;
    let iniFile: File | null = null;
    const textureFiles = new Map<string, File>();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const lowerName = file.name.toLowerCase();
      
      if (lowerName.endsWith('.fbx')) {
        fbxFile = file;
      } else if (lowerName.endsWith('.ini')) {
        iniFile = file;
      } else {
        // 儲存貼圖檔案 (使用小寫檔名作為 Key)
        textureFiles.set(lowerName, file);
      }
    }

    return { fbxFile, textureFiles, iniFile };
  }

  /**
   * 建立貼圖 URL 修改器
   * 
   * 建立一個函數，用於攔截 Three.js 的貼圖載入請求，並從上傳的檔案中提供貼圖。
   * 這個函數會：
   * - 解析原始貼圖 URL，提取檔名
   * - 在上傳的檔案中尋找匹配的貼圖
   * - 如果找到，返回 Blob URL；如果找不到，返回一個透明的 1x1 PNG data URI
   * 
   * @param textureFiles - 貼圖檔案的 Map，key 為小寫檔名，value 為 File 物件
   * @returns URL 修改器函數，接受原始 URL，返回修改後的 URL
   * 
   * @example
   * ```typescript
   * const urlModifier = ModelLoaderService.createTextureURLModifier(textureFiles);
   * loadingManager.setURLModifier(urlModifier);
   * ```
   */
  static createTextureURLModifier(textureFiles: Map<string, File>): (url: string) => string {
    return (url: string) => {
      console.log(`[Texture Request] Original URL: ${url} `);

      // 1. 如果是 data URI 或 blob URI，直接回傳
      if (url.startsWith('data:') || url.startsWith('blob:')) {
        return url;
      }

      // 2. 提取檔名 (處理各種路徑格式)
      let fileName = url;

      // 移除可能的協議前綴
      fileName = fileName.replace(/^(http:\/\/|https:\/\/|file:\/\/\/)/, '');

      // 處理 Windows 路徑
      fileName = fileName.replace(/\\/g, '/');

      // 取得最後一段 (檔名)
      fileName = fileName.split('/').pop() || '';
      fileName = fileName.toLowerCase();

      console.log(`[Texture Request] Extracted FileName: ${fileName} `);

      // 3. 在上傳的檔案中尋找
      if (textureFiles.has(fileName)) {
        const textureFile = textureFiles.get(fileName)!;
        const blobUrl = URL.createObjectURL(textureFile);
        console.log(`[Texture Match]Found: ${fileName} -> ${blobUrl} `);
        return blobUrl;
      }

      console.warn(`[Texture Missing] Could not find: ${fileName} `);
      console.warn(`[Available Textures]: `, Array.from(textureFiles.keys()));

      // 回傳一個假的 URL (會載入失敗，但不會中斷整個流程)
      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    };
  }

  /**
   * 載入 FBX 模型
   * 
   * 從 File 物件載入 FBX 模型，並自動處理貼圖載入。此方法會：
   * - 將 FBX 檔案讀取為 ArrayBuffer
   * - 設定 LoadingManager 來攔截貼圖請求
   * - 註冊 TGA Loader（支援 .tga 格式的貼圖）
   * - 使用 URL 修改器從上傳的檔案中提供貼圖
   * - 載入並解析 FBX 模型
   * - 自動修復材質問題
   * 
   * @param fbxFile - FBX 檔案物件
   * @param textureFiles - 貼圖檔案的 Map，key 為小寫檔名，value 為 File 物件
   * @returns Promise 解析為載入的 Three.js 模型群組
   * @throws {Error} 當 FBX 檔案格式錯誤或載入失敗時可能拋出錯誤
   * 
   * @example
   * ```typescript
   * try {
   *   const model = await ModelLoaderService.loadFBX(fbxFile, textureFiles);
   *   scene.add(model);
   * } catch (error) {
   *   console.error('載入失敗:', error);
   * }
   * ```
   */
  static async loadFBX(fbxFile: File, textureFiles: Map<string, File>): Promise<THREE.Group> {
    // 讀取 FBX 為 ArrayBuffer
    const fbxArrayBuffer = await fbxFile.arrayBuffer();

    // 設定 LoadingManager 來攔截貼圖請求
    const manager = new THREE.LoadingManager();

    // 註冊 TGA Loader
    manager.addHandler(/\.tga$/i, new TGALoader(manager));

    // 設定 URL 修改器
    manager.setURLModifier(this.createTextureURLModifier(textureFiles));

    const loader = new FBXLoader(manager);

    // 使用 parse 而非 loadAsync，這樣我們可以完全控制路徑解析
    const loadedModel = loader.parse(fbxArrayBuffer, '');

    console.log('[FBX Loaded]', loadedModel);

    // 修復材質
    MaterialFixService.fixMaterials(loadedModel);

    return loadedModel;
  }

  /**
   * 提取模型中的所有 mesh 名稱
   * 
   * 遍歷模型樹狀結構，找出所有 Mesh 和 SkinnedMesh 節點，並收集它們的名稱。
   * 這些名稱通常用於 Shader 組合的 mesh 選擇功能。
   * 
   * @param model - Three.js 模型群組
   * @returns Mesh 名稱陣列，按照遍歷順序排列
   * 
   * @example
   * ```typescript
   * const meshNames = ModelLoaderService.extractMeshNames(model);
   * console.log('找到', meshNames.length, '個 mesh');
   * // ['body', 'head', 'arm_left', 'arm_right', ...]
   * ```
   */
  static extractMeshNames(model: THREE.Group): string[] {
    const meshes: string[] = [];
    model.traverse((child) => {
      if (child.type === 'SkinnedMesh' || child.type === 'Mesh') {
        meshes.push(child.name);
      }
    });
    return meshes;
  }
}

