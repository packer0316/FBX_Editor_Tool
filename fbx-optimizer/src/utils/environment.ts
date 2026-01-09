/**
 * 環境檢測與路徑工具
 * 
 * 用於判斷當前運行環境（網頁 vs Electron）並提供正確的資源路徑
 */

/**
 * 是否在 Electron 環境中運行
 * 透過檢查 userAgent 來判斷
 */
export const isElectron: boolean = 
  typeof navigator !== 'undefined' && 
  navigator.userAgent.toLowerCase().includes('electron');

/**
 * 是否在網頁瀏覽器環境中運行
 */
export const isBrowser: boolean = 
  typeof window !== 'undefined' && !isElectron;

/**
 * 是否為開發模式
 */
export const isDev: boolean = import.meta.env.DEV;

/**
 * 是否為生產模式
 */
export const isProd: boolean = import.meta.env.PROD;

/**
 * 取得 public 資源的基礎路徑
 * 
 * - 網頁模式：使用空字串（Vite 會處理 /effekseer/... 路徑）
 * - Electron 模式：使用 app-resource:// 協議
 * 
 * @returns 基礎路徑字串
 */
export function getPublicBasePath(): string {
  if (isElectron) {
    // Electron 使用自定義協議來載入 extraResources
    // 協議會在 main.ts 中註冊
    return 'app-resource://public';
  }
  // 網頁模式使用空字串，讓 Vite 處理
  return '';
}

/**
 * 取得 effekseer 資源的完整路徑
 * 
 * @param subPath - 子路徑，例如 "effekseer.wasm"、"manifest.json" 或 "Boss/effect.efk"
 * @returns 完整的資源路徑
 * 
 * @example
 * ```typescript
 * // 網頁模式
 * getEffekseerPath('effekseer.wasm')     // => '/effekseer/effekseer.wasm'
 * getEffekseerPath('manifest.json')      // => '/effekseer/manifest.json'
 * 
 * // Electron 模式
 * getEffekseerPath('effekseer.wasm')     // => '../public/effekseer/effekseer.wasm'
 * getEffekseerPath('Boss/effect.efk')    // => '../public/effekseer/Boss/effect.efk'
 * ```
 */
export function getEffekseerPath(subPath: string): string {
  const base = getPublicBasePath();
  
  // 移除開頭的斜線（如果有的話）
  const cleanSubPath = subPath.startsWith('/') ? subPath.slice(1) : subPath;
  
  if (base) {
    return `${base}/effekseer/${cleanSubPath}`;
  }
  
  // 網頁模式使用絕對路徑
  return `/effekseer/${cleanSubPath}`;
}

/**
 * 在 Electron 環境中載入文字資源
 * 因為 fetch API 不支援 app-resource:// 協議，需要特殊處理
 * 
 * @param url - 資源 URL (可能是 app-resource:// 或普通 http/https)
 * @returns Promise<string> - 資源內容
 */
export async function fetchTextResource(url: string): Promise<string> {
  if (!isElectron) {
    // 瀏覽器環境直接使用 fetch
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    return response.text();
  }

  // Electron 環境：使用 XMLHttpRequest 直接訪問自定義協議
  // 不需要轉換，直接使用 app-resource:// URL
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    console.log(`[fetchTextResource] 載入資源: ${url}`);
    
    xhr.open('GET', url, true);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        console.log(`[fetchTextResource] ✓ 載入成功: ${url}`);
        resolve(xhr.responseText);
      } else {
        const error = `Failed to load ${url}: ${xhr.status} ${xhr.statusText}`;
        console.error(`[fetchTextResource] ✗ ${error}`);
        reject(new Error(error));
      }
    };
    xhr.onerror = () => {
      const error = `Network error while loading ${url}`;
      console.error(`[fetchTextResource] ✗ ${error}`);
      reject(new Error(error));
    };
    xhr.send();
  });
}

/**
 * 在 Electron 環境中載入 JSON 資源
 * 
 * @param url - 資源 URL
 * @returns Promise<T> - 解析後的 JSON 物件
 */
export async function fetchJsonResource<T = any>(url: string): Promise<T> {
  const text = await fetchTextResource(url);
  return JSON.parse(text) as T;
}

/**
 * 在 Electron 環境中載入二進制資源（Blob）
 * 用於下載圖片、efk 檔案等二進制資源
 * 
 * @param url - 資源 URL (可能是 app-resource:// 或普通 http/https)
 * @returns Promise<Blob> - 資源的 Blob 物件
 */
export async function fetchBlobResource(url: string): Promise<Blob> {
  if (!isElectron) {
    // 瀏覽器環境直接使用 fetch
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    return response.blob();
  }

  // Electron 環境：使用 XMLHttpRequest 載入二進制資源
  return new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    console.log(`[fetchBlobResource] 載入資源: ${url}`);
    
    xhr.open('GET', url, true);
    xhr.responseType = 'blob'; // 設定為 blob 類型
    
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        console.log(`[fetchBlobResource] ✓ 載入成功: ${url}`);
        resolve(xhr.response as Blob);
      } else {
        const error = `Failed to load ${url}: ${xhr.status} ${xhr.statusText}`;
        console.error(`[fetchBlobResource] ✗ ${error}`);
        reject(new Error(error));
      }
    };
    xhr.onerror = () => {
      const error = `Network error while loading ${url}`;
      console.error(`[fetchBlobResource] ✗ ${error}`);
      reject(new Error(error));
    };
    xhr.send();
  });
}

/**
 * 環境資訊物件（方便一次性取得所有環境狀態）
 */
export const Environment = {
  isElectron,
  isBrowser,
  isDev,
  isProd,
  getPublicBasePath,
  getEffekseerPath,
  fetchTextResource,
  fetchJsonResource,
  fetchBlobResource,
} as const;

// 在控制台輸出當前環境（僅開發模式）
if (isDev) {
  console.log(`[Environment] 運行環境: ${isElectron ? '🖥️ Electron' : '🌐 瀏覽器'}`);
}
