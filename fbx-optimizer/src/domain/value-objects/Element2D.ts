/**
 * 2D 元素可用的單位
 */
export type ElementUnit = 'px' | 'percent';

/**
 * 2D 元素類型
 */
export type Element2DType = 'image' | 'text' | 'shape' | 'html';

/**
 * 位置設定
 */
export interface Element2DPosition {
  /** X 軸位置 */
  x: number;
  /** Y 軸位置 */
  y: number;
  /** 座標單位 */
  unit: ElementUnit;
}

/**
 * 尺寸設定
 */
export interface Element2DSize {
  /** 寬度 */
  width: number;
  /** 高度 */
  height: number;
  /** 尺寸單位 */
  unit: ElementUnit;
}

/**
 * 2D 元素的共同屬性
 */
export interface Element2DBase {
  /** 唯一識別碼 */
  id: string;
  /** 元素名稱 */
  name: string;
  /** 元素類型 */
  type: Element2DType;
  /** 顯示狀態 */
  visible: boolean;
  /** 是否鎖定（不可編輯） */
  locked: boolean;
  /** 整體透明度 */
  opacity: number;
  /** 層內渲染順序 */
  zIndex: number;
  /** 位置設定 */
  position: Element2DPosition;
  /** 尺寸設定 */
  size: Element2DSize;
  /** 旋轉角度（度） */
  rotation: number;
  /** 建立時間 */
  createdAt: number;
  /** 更新時間 */
  updatedAt: number;
}

/**
 * 文字元素
 */
export interface TextElement2D extends Element2DBase {
  type: 'text';
  /** 文字內容 */
  content: string;
  /** 字體大小 */
  fontSize: number;
  /** 字體 */
  fontFamily: string;
  /** 字重 */
  fontWeight: number;
  /** 文字顏色 */
  color: string;
  /** 對齊方式 */
  textAlign: 'left' | 'center' | 'right';
  /** 行高 */
  lineHeight: number;
  /** 文字陰影 */
  textShadow?: string;
  /** 是否顯示底板背景 */
  showBackground: boolean;
}

/**
 * 圖片元素
 */
export interface ImageElement2D extends Element2DBase {
  type: 'image';
  /** 圖片來源（Data URL 或上傳結果） */
  src: string;
  /** 圖片填滿方式 */
  objectFit: 'cover' | 'contain' | 'fill' | 'none';
  /** 圖片圓角 */
  borderRadius: number;
  /** CSS 濾鏡字串 */
  filter?: string;
}

/**
 * 形狀元素
 */
export interface ShapeElement2D extends Element2DBase {
  type: 'shape';
  /** 形狀種類 */
  shape: 'rect' | 'circle' | 'line';
  /** 填色 */
  fillColor: string;
  /** 邊框色 */
  strokeColor: string;
  /** 邊框寬度 */
  strokeWidth: number;
  /** 虛線樣式 */
  strokeDasharray?: string;
}

/**
 * HTML 元素
 */
export interface HtmlElement2D extends Element2DBase {
  type: 'html';
  /** 原始 HTML 內容 */
  html: string;
  /** 自訂 CSS */
  css?: string;
}

/**
 * 2D 元素聯集型別
 */
export type Element2D = TextElement2D | ImageElement2D | ShapeElement2D | HtmlElement2D;

/**
 * 判斷元素是否為圖片
 */
export const isImageElement = (element: Element2D): element is ImageElement2D => element.type === 'image';

/**
 * 判斷元素是否為文字
 */
export const isTextElement = (element: Element2D): element is TextElement2D => element.type === 'text';

/**
 * 判斷元素是否為形狀
 */
export const isShapeElement = (element: Element2D): element is ShapeElement2D => element.type === 'shape';




