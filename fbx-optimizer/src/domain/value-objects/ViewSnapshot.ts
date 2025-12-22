/**
 * 視圖快照介面
 * 
 * 用於保存相機和模型的狀態設定，讓用戶可以快速切換到預設的視角。
 */
export interface ViewSnapshot {
  /** 唯一識別碼 */
  id: string;
  /** 快照名稱 */
  name: string;
  /** 創建時間戳 */
  createdAt: number;
  
  // 相機狀態
  /** 相機位置 [x, y, z] */
  cameraPosition: [number, number, number];
  /** 相機目標點 [x, y, z] (OrbitControls target) */
  cameraTarget: [number, number, number];
  /** 相機 FOV（透視模式） */
  cameraFov: number;
  /** 是否為正交相機 */
  cameraIsOrthographic: boolean;
  /** 正交相機縮放值 */
  cameraOrthoZoom: number;
  
  // 模型狀態
  /** 模型位置 [x, y, z] */
  modelPosition: [number, number, number];
  /** 模型旋轉 [x, y, z] (度數) */
  modelRotation: [number, number, number];
  /** 模型縮放 [x, y, z] */
  modelScale: [number, number, number];
  /** 動畫播放時間（秒） */
  animationTime: number;
}

/**
 * 創建一個新的視圖快照
 */
export function createViewSnapshot(
  name: string,
  cameraState: {
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
    isOrthographic: boolean;
    orthoZoom: number;
  },
  modelState: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
    animationTime: number;
  }
): ViewSnapshot {
  return {
    id: `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    createdAt: Date.now(),
    cameraPosition: cameraState.position,
    cameraTarget: cameraState.target,
    cameraFov: cameraState.fov,
    cameraIsOrthographic: cameraState.isOrthographic,
    cameraOrthoZoom: cameraState.orthoZoom,
    modelPosition: modelState.position,
    modelRotation: modelState.rotation,
    modelScale: modelState.scale,
    animationTime: modelState.animationTime,
  };
}






