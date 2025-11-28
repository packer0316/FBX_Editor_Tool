import type { Layer } from '../../domain/value-objects/Layer';
import { LayerService } from '../../domain/services/LayerService';

export interface RemoveElementInput {
  /** 層級 ID */
  layerId: string;
  /** 元素 ID */
  elementId: string;
}

/**
 * 移除 2D 元素 Use Case
 */
export class RemoveElement2DUseCase {
  /**
   * @param layers - 層級清單
   * @param input - 移除參數
   * @returns 更新後層級
   */
  static execute(layers: Layer[], input: RemoveElementInput): Layer[] {
    return layers.map(layer => {
      if (layer.id !== input.layerId || layer.type !== '2d') {
        return layer;
      }
      return LayerService.removeElement(layer, input.elementId);
    });
  }
}





