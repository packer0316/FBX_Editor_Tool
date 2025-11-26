import type { Layer } from '../../domain/value-objects/Layer';
import { LayerService } from '../../domain/services/LayerService';

/**
 * 初始化 Layer Stack
 */
export class InitializeLayerStackUseCase {
  /**
   * 產生預設層級配置
   */
  static execute(): Layer[] {
    return LayerService.createDefaultLayers();
  }
}




