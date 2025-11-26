import type { Element2D } from '../../domain/value-objects/Element2D';
import type { Layer } from '../../domain/value-objects/Layer';
import { LayerService } from '../../domain/services/LayerService';

export type AddElementMode =
  | { kind: 'text' }
  | { kind: 'image'; dataUrl: string }
  | { kind: 'custom'; element: Element2D };

export interface AddElementInput {
  /** 目標層級 ID */
  layerId: string;
  /** 模式 */
  mode: AddElementMode;
}

/**
 * 新增 2D 元素 Use Case
 */
export class AddElement2DUseCase {
  /**
   * @param layers - 既有層級
   * @param input - 新增參數
   * @returns 更新後層級陣列
   */
  static execute(layers: Layer[], input: AddElementInput): Layer[] {
    return layers.map(layer => {
      if (layer.id !== input.layerId) {
        return layer;
      }

      if (layer.type !== '2d') {
        return layer;
      }

      if (input.mode.kind === 'text') {
        return LayerService.appendDefaultTextElement(layer);
      }

      if (input.mode.kind === 'image') {
        return LayerService.appendImageElement(layer, input.mode.dataUrl);
      }

      return LayerService.addElement(layer, input.mode.element);
    });
  }
}


