/**
 * INI 檔案解析工具
 * 用於解析 FBX 導出設定檔案，提取動畫片段資訊
 */

export interface AnimationClipInfo {
  name: string;
  startFrame: number;
  endFrame: number;
  enabled: boolean;
}

export interface IniParseResult {
  clips: AnimationClipInfo[];
  fps: number;
  totalFrames: number;
}

/**
 * 解析 INI 檔案內容
 * @param content - INI 檔案的文字內容
 * @returns 解析後的動畫片段資訊
 */
export function parseIniFile(content: string): IniParseResult {
  const lines = content.split('\n');
  const clips: AnimationClipInfo[] = [];
  let fps = 30; // 預設 30 fps
  let totalFrames = 0;
  
  let currentClip: Partial<AnimationClipInfo> | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // 跳過空行和註解
    if (!trimmedLine || trimmedLine.startsWith(';') || trimmedLine.startsWith('#')) {
      continue;
    }

    // 檢查是否為片段區塊標題
    const clipSectionMatch = trimmedLine.match(/^\[AnimationClip\s+(\d+)\]$/i);
    if (clipSectionMatch) {
      // 如果有前一個片段，先保存
      if (currentClip && currentClip.name && currentClip.startFrame !== undefined && currentClip.endFrame !== undefined) {
        clips.push({
          name: currentClip.name,
          startFrame: currentClip.startFrame,
          endFrame: currentClip.endFrame,
          enabled: currentClip.enabled ?? true
        });
      }
      // 開始新片段
      currentClip = {};
      continue;
    }

    // 解析鍵值對
    const kvMatch = trimmedLine.match(/^([^=]+)=(.*)$/);
    if (!kvMatch) continue;

    const key = kvMatch[1].trim();
    const value = kvMatch[2].trim();

    // 在 General 區塊中提取 fps 和總幀數
    if (key === 'Resampling') {
      fps = parseFloat(value) || 30;
    } else if (key === 'BakeFrameEnd') {
      totalFrames = parseInt(value) || 0;
    }

    // 在片段區塊中提取資訊
    if (currentClip !== null) {
      switch (key) {
        case 'TakeName':
          currentClip.name = value;
          break;
        case 'StartFrame':
          currentClip.startFrame = parseInt(value);
          break;
        case 'EndFrame':
          currentClip.endFrame = parseInt(value);
          break;
        case 'Enabled':
          currentClip.enabled = value === '1';
          break;
      }
    }
  }

  // 保存最後一個片段
  if (currentClip && currentClip.name && currentClip.startFrame !== undefined && currentClip.endFrame !== undefined) {
    clips.push({
      name: currentClip.name,
      startFrame: currentClip.startFrame,
      endFrame: currentClip.endFrame,
      enabled: currentClip.enabled ?? true
    });
  }

  return {
    clips,
    fps,
    totalFrames
  };
}

/**
 * 從 File 物件讀取並解析 INI 檔案
 * @param file - INI 檔案的 File 物件
 * @returns Promise，解析後的動畫片段資訊
 */
export async function parseIniFromFile(file: File): Promise<IniParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const result = parseIniFile(content);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('讀取檔案失敗'));
    };
    
    reader.readAsText(file, 'utf-8');
  });
}

