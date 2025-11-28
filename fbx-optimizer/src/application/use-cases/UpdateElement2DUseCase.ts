import type { Element2D } from '../../domain/value-objects/Element2D';
import type { Layer } from '../../domain/value-objects/Layer';
import { LayerService } from '../../domain/services/LayerService';

export interface UpdateElementInput {
  /** 層級 ID */
  layerId: string;
  /** 元素 ID */
  elementId: string;
  /** 更新內容 */
  updates: Partial<Element2D>;
}

/**
 * 更新 2D 元素 Use Case
 */
export class UpdateElement2DUseCase {
  /**
   * 更新指定元素
   *
   * @param layers - 所有層級
   * @param input - 更新參數
   * @returns 更新後層級陣列
   */
  static execute(layers: Layer[], input: UpdateElementInput): Layer[] {
    return layers.map(layer => {
      if (layer.id !== input.layerId || layer.type !== '2d') {
        return layer;
      }
      return LayerService.updateElement(layer, input.elementId, input.updates);
    });
  }
}





