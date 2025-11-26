import type { Layer } from '../../domain/value-objects/Layer';
import { LayerService } from '../../domain/services/LayerService';

export interface ReorderElementInput {
  /** 層級 ID */
  layerId: string;
  /** 原索引 */
  fromIndex: number;
  /** 目標索引 */
  toIndex: number;
}

/**
 * 調整 2D 元素順序 Use Case
 */
export class ReorderElement2DUseCase {
  /**
   * @param layers - 既有層級
   * @param input - 重新排序參數
   * @returns 更新後層級清單
   */
  static execute(layers: Layer[], input: ReorderElementInput): Layer[] {
    return layers.map(layer => {
      if (layer.id !== input.layerId || layer.type !== '2d') {
        return layer;
      }
      return LayerService.reorderElements(layer, input.fromIndex, input.toIndex);
    });
  }
}




