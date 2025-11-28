import type { Element2D } from './Element2D';

/**
 * 層級類型
 */
export type LayerType = '3d' | '2d';

/**
 * 層級位置（由 priority 推導）
 */
export type LayerPosition = 'front' | 'inline' | 'back';

/**
 * 層級定義
 */
export interface Layer {
  /** 唯一識別碼 */
  id: string;
  /** 層級名稱 */
  name: string;
  /** 層級類型 */
  type: LayerType;
  /** 排序優先權（>0 在 3D 前、=0 3D 層、<0 3D 後） */
  priority: number;
  /** 顯示狀態 */
  visible: boolean;
  /** 是否鎖定（不可操作） */
  locked: boolean;
  /** 是否展開子節點 */
  expanded: boolean;
  /** 整層透明度 */
  opacity: number;
  /** 子節點（僅 2D 層使用） */
  children: Element2D[];
  /** 建立時間 */
  createdAt: number;
  /** 更新時間 */
  updatedAt: number;
}

/**
 * 根據 priority 推導層級位置
 *
 * @param priority - priority 數值
 * @returns 層級位置
 */
export const resolveLayerPosition = (priority: number): LayerPosition => {
  if (priority === 0) {
    return 'inline';
  }

  return priority > 0 ? 'front' : 'back';
};





