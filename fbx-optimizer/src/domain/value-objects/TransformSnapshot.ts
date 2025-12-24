/**
 * Transform 快照介面
 * 
 * 用於保存模型的 Transform 狀態（位置、旋轉、縮放、透明度），
 * 讓用戶可以快速重置或切換到預設的狀態。
 */
export interface TransformSnapshot {
  /** 唯一識別碼 */
  id: string;
  /** 快照名稱 */
  name: string;
  /** 創建時間戳 */
  createdAt: number;
  /** 是否為預設快照（載入時的初始狀態，不可刪除） */
  isDefault: boolean;
  
  /** 模型位置 [x, y, z] */
  position: [number, number, number];
  /** 模型旋轉 [x, y, z] (度數) */
  rotation: [number, number, number];
  /** 模型縮放（等比） */
  scale: number;
  /** 模型透明度 (0-1) */
  opacity: number;
}

/**
 * 創建預設的 Transform 快照（初始狀態）
 */
export function createDefaultTransformSnapshot(): TransformSnapshot {
  return {
    id: 'default',
    name: '初始狀態',
    createdAt: 0,
    isDefault: true,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: 1,
    opacity: 1,
  };
}

/**
 * 創建一個新的 Transform 快照
 */
export function createTransformSnapshot(
  name: string,
  state: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: number;
    opacity: number;
  }
): TransformSnapshot {
  return {
    id: `transform_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    createdAt: Date.now(),
    isDefault: false,
    position: [...state.position] as [number, number, number],
    rotation: [...state.rotation] as [number, number, number],
    scale: state.scale,
    opacity: state.opacity,
  };
}

