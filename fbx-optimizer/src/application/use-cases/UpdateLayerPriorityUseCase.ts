import type { Layer } from '../../domain/value-objects/Layer';
import { LayerService } from '../../domain/services/LayerService';

export interface UpdateLayerPriorityInput {
  /** 層級 ID */
  layerId: string;
  /** 新 priority */
  priority: number;
}

/**
 * 更新層級 priority Use Case
 */
export class UpdateLayerPriorityUseCase {
  /**
   * @param layers - 既有層級
   * @param input - 更新參數
   * @returns 更新後層級
   */
  static execute(layers: Layer[], input: UpdateLayerPriorityInput): Layer[] {
    return LayerService.updateLayerPriority(layers, input.layerId, input.priority);
  }
}





