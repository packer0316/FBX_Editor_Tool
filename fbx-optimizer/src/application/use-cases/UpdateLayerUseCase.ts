import type { Layer } from '../../domain/value-objects/Layer';
import { LayerService } from '../../domain/services/LayerService';

export interface UpdateLayerInput {
  /** 要更新的層級 ID */
  layerId: string;
  /** 層級更新資料 */
  updates: Partial<Omit<Layer, 'id' | 'children' | 'createdAt'>>;
}

/**
 * 更新層級資訊 Use Case
 */
export class UpdateLayerUseCase {
  /**
   * 更新層級
   *
   * @param layers - 既有層級
   * @param input - 更新參數
   * @returns 更新後的層級陣列
   */
  static execute(layers: Layer[], input: UpdateLayerInput): Layer[] {
    return layers.map(layer =>
      layer.id === input.layerId
        ? LayerService.updateLayer(layer, input.updates)
        : layer
    );
  }
}





