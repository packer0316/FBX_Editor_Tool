import type { Element2D } from '../value-objects/Element2D';
import type { Layer, LayerType } from '../value-objects/Layer';
import {
  createDefaultImageElement,
  createDefaultTextElement,
  generateLayerId,
  generateLayerName,
  getNextElementZIndex,
  getNextPriority,
  PRIORITY_STEP,
  sortLayersByPriority
} from '../../utils/layer/layerUtils';

interface CreateLayerParams {
  type: LayerType;
  name?: string;
  priority?: number;
  direction?: 'front' | 'back';
}

/**
 * 層級相關服務
 */
export class LayerService {
  /**
   * 建立 3D 基準層
   */
  static createDefaultLayers(): Layer[] {
    return [
      {
        id: 'layer_3d_base',
        name: '3D Scene',
        type: '3d',
        priority: 0,
        visible: true,
        locked: true,
        expanded: true,
        opacity: 1,
        children: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ];
  }

  /**
   * 建立新層級
   */
  static createLayer(params: CreateLayerParams, existingLayers: Layer[]): Layer {
    const now = Date.now();
    const priority =
      typeof params.priority === 'number'
        ? params.priority
        : params.type === '3d'
          ? 0
          : getNextPriority(existingLayers, params.direction ?? 'front');

    return {
      id: generateLayerId(),
      name: params.name ?? generateLayerName(params.type, existingLayers),
      type: params.type,
      priority,
      visible: true,
      locked: false,
      expanded: true,
      opacity: 1,
      children: [],
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * 更新層級
   */
  static updateLayer(layer: Layer, updates: Partial<Omit<Layer, 'id' | 'createdAt'>>): Layer {
    return {
      ...layer,
      ...updates,
      opacity: typeof updates.opacity === 'number' ? Math.max(0, Math.min(1, updates.opacity)) : layer.opacity,
      priority: layer.type === '3d' ? 0 : updates.priority ?? layer.priority,
      updatedAt: Date.now()
    };
  }

  /**
   * 重新排列指定方向的層級（Front/Back）
   */
  static reorderDirectionalLayers(
    layers: Layer[],
    fromIndex: number,
    toIndex: number,
    direction: 'front' | 'back'
  ): Layer[] {
    if (fromIndex === toIndex) {
      return layers;
    }

    const directionalLayers = sortLayersByPriority(
      layers.filter(layer => (direction === 'front' ? layer.priority > 0 : layer.priority < 0))
    );

    const sourceList = [...directionalLayers];
    const [moved] = sourceList.splice(fromIndex, 1);
    sourceList.splice(toIndex, 0, moved);

    const reassigned = sourceList.map((layer, index) => {
      const newPriority =
        direction === 'front'
          ? PRIORITY_STEP * (sourceList.length - index)
          : -PRIORITY_STEP * (index + 1);
      return this.updateLayer(layer, { priority: newPriority });
    });

    return layers.map(layer => reassigned.find(item => item.id === layer.id) ?? layer);
  }

  /**
   * 更新指定層級 priority
   */
  static updateLayerPriority(layers: Layer[], layerId: string, newPriority: number): Layer[] {
    return layers.map(layer => {
      if (layer.id !== layerId || layer.type === '3d') {
        return layer;
      }
      return this.updateLayer(layer, { priority: newPriority });
    });
  }

  /**
   * 新增元素
   */
  static addElement(layer: Layer, element: Element2D): Layer {
    const now = Date.now();
    const zIndex = getNextElementZIndex(layer.children);
    const nextElement = {
      ...element,
      zIndex,
      createdAt: now,
      updatedAt: now
    };

    return this.updateLayer(layer, {
      children: [...layer.children, nextElement]
    });
  }

  /**
   * 更新元素
   */
  static updateElement(
    layer: Layer,
    elementId: string,
    updates: Partial<Element2D>
  ): Layer {
    return this.updateLayer(layer, {
      children: layer.children.map(element =>
        element.id === elementId ? { ...element, ...updates, updatedAt: Date.now() } : element
      )
    });
  }

  /**
   * 移除元素
   */
  static removeElement(layer: Layer, elementId: string): Layer {
    return this.updateLayer(layer, {
      children: layer.children.filter(element => element.id !== elementId)
    });
  }

  /**
   * 調整層級內元素順序
   */
  static reorderElements(layer: Layer, fromIndex: number, toIndex: number): Layer {
    if (fromIndex === toIndex) {
      return layer;
    }

    const nextChildren = [...layer.children];
    const [moved] = nextChildren.splice(fromIndex, 1);
    nextChildren.splice(toIndex, 0, moved);

    const normalized = nextChildren.map((element, index) => ({
      ...element,
      zIndex: index + 1,
      updatedAt: Date.now()
    }));

    return this.updateLayer(layer, { children: normalized });
  }

  /**
   * 建立預設字卡元素並加入層級
   */
  static appendDefaultTextElement(layer: Layer): Layer {
    const name = `${layer.name}-Text-${layer.children.length + 1}`;
    const element = createDefaultTextElement(name);
    return this.addElement(layer, element);
  }

  /**
   * 建立圖片元素（透過 dataURL）
   */
  static appendImageElement(layer: Layer, dataUrl: string): Layer {
    const name = `${layer.name}-Image-${layer.children.length + 1}`;
    const element = createDefaultImageElement(name, dataUrl);
    return this.addElement(layer, element);
  }
}


