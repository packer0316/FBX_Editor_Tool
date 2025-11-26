import type { Element2D, Element2DType, TextElement2D } from '../../domain/value-objects/Element2D';
import type { Layer } from '../../domain/value-objects/Layer';

export const PRIORITY_STEP = 10;

/**
 * 產生層級 ID
 */
export const generateLayerId = (): string => `layer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

/**
 * 產生元素 ID
 */
export const generateElementId = (): string => `element_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

/**
 * 根據層級類型產生預設名稱
 */
export const generateLayerName = (type: '2d' | '3d', existingLayers: Layer[]): string => {
  const base = type === '3d' ? '3D Layer' : '2D Layer';
  const count = existingLayers.filter(layer => layer.type === type).length + 1;
  return `${base} ${count}`;
};

/**
 * 依 priority 由大到小排序層級
 */
export const sortLayersByPriority = (layers: Layer[]): Layer[] =>
  [...layers].sort((a, b) => b.priority - a.priority);

/**
 * 取得下一個可用 priority
 */
export const getNextPriority = (layers: Layer[], direction: 'front' | 'back'): number => {
  if (direction === 'front') {
    const maxPositive = layers
      .filter(layer => layer.priority > 0)
      .reduce((max, layer) => Math.max(max, layer.priority), 0);
    return maxPositive + PRIORITY_STEP;
  }

  const minNegative = layers
    .filter(layer => layer.priority < 0)
    .reduce((min, layer) => Math.min(min, layer.priority), 0);
  return minNegative - PRIORITY_STEP || -PRIORITY_STEP;
};

/**
 * 取得層級內下一個 Z Index
 */
export const getNextElementZIndex = (elements: Element2D[]): number => {
  if (elements.length === 0) {
    return 1;
  }

  return Math.max(...elements.map(element => element.zIndex)) + 1;
};

/**
 * 建立預設文字元素
 */
export const createDefaultTextElement = (name: string): TextElement2D => ({
  id: generateElementId(),
  name,
  type: 'text',
  visible: true,
  locked: false,
  opacity: 1,
  zIndex: 1,
  position: { x: 50, y: 50, unit: 'percent' },
  size: { width: 320, height: 120, unit: 'px' },
  rotation: 0,
  content: '新的字卡',
  fontSize: 32,
  fontFamily: 'Noto Sans TC, sans-serif',
  fontWeight: 600,
  color: '#FFFFFF',
  textAlign: 'center',
  lineHeight: 1.4,
  showBackground: true,
  createdAt: Date.now(),
  updatedAt: Date.now()
});

/**
 * 建立預設圖片元素
 */
export const createDefaultImageElement = (name: string, dataUrl: string): Element2D => ({
  id: generateElementId(),
  name,
  type: 'image',
  visible: true,
  locked: false,
  opacity: 1,
  zIndex: 1,
  position: { x: 50, y: 50, unit: 'percent' },
  size: { width: 512, height: 512, unit: 'px' },
  rotation: 0,
  src: dataUrl,
  objectFit: 'contain',
  borderRadius: 0,
  createdAt: Date.now(),
  updatedAt: Date.now()
});

/**
 * 依元素類型產生預設名稱
 */
export const generateElementName = (type: Element2DType, existingElements: Element2D[]): string => {
  const baseMap: Record<Element2DType, string> = {
    text: 'Text',
    image: 'Image',
    shape: 'Shape',
    html: 'HTML'
  };
  const base = baseMap[type] || 'Element';
  const count = existingElements.filter(element => element.type === type).length + 1;
  return `${base} ${count}`;
};


