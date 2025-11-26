import type { Layer } from '../../domain/value-objects/Layer';

/**
 * 刪除層級 Use Case
 */
export class DeleteLayerUseCase {
  /**
   * 刪除指定層級
   *
   * @param layers - 既有層級
   * @param layerId - 要刪除的層級 ID
   * @returns 更新後的層級清單
   */
  static execute(layers: Layer[], layerId: string): Layer[] {
    return layers.filter(layer => layer.id !== layerId);
  }
}




