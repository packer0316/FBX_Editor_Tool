import type { Layer, LayerType } from '../../domain/value-objects/Layer';
import { LayerService } from '../../domain/services/LayerService';

export interface CreateLayerInput {
  /** 層級類型 */
  type: LayerType;
  /** 自訂名稱 */
  name?: string;
  /** 指定 priority（選填） */
  priority?: number;
  /** 當未提供 priority 時，指定自動產生方向 */
  direction?: 'front' | 'back';
}

/**
 * 建立新層級 Use Case
 */
export class CreateLayerUseCase {
  /**
   * 建立層級並回傳新的層級清單
   *
   * @param layers - 既有層級
   * @param input - 建立參數
   * @returns 更新後的層級陣列
   */
  static execute(layers: Layer[], input: CreateLayerInput): Layer[] {
    const newLayer = LayerService.createLayer(input, layers);
    return [...layers, newLayer];
  }
}




