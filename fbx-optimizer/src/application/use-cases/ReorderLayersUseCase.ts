import type { Layer } from '../../domain/value-objects/Layer';
import { LayerService } from '../../domain/services/LayerService';

export interface ReorderLayersInput {
  /** 原本索引 */
  fromIndex: number;
  /** 目標索引 */
  toIndex: number;
  /** 層級方向 */
  direction: 'front' | 'back';
}

/**
 * 調整層級排序 Use Case
 */
export class ReorderLayersUseCase {
  /**
   * 調整層級順序並重算 priority
   *
   * @param layers - 既有層級
   * @param input - 排序參數
   * @returns 更新後層級陣列
   */
  static execute(layers: Layer[], input: ReorderLayersInput): Layer[] {
    return LayerService.reorderDirectionalLayers(
      layers,
      input.fromIndex,
      input.toIndex,
      input.direction
    );
  }
}




