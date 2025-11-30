/**
 * Spine Canvas 渲染器
 * 
 * 使用 Spine Runtime 的 SkeletonRenderer 渲染骨架。
 */

import '../../vendor/spine-ts-3.8';
import { getSpineRuntimeAdapter } from './SpineRuntimeAdapter';

// ============================================================================
// 類型定義
// ============================================================================

/**
 * 適應模式
 */
export type SpineFitMode = 'fill' | 'contain' | 'cover' | 'none';

/**
 * 渲染選項
 */
export interface SpineRenderOptions {
  /** 是否顯示骨骼（調試用） */
  showBones?: boolean;
  /** 是否顯示邊界框（調試用） */
  showBounds?: boolean;
  /** 背景顏色（null = 透明） */
  backgroundColor?: string | null;
  /** 翻轉 X 軸 */
  flipX?: boolean;
  /** 翻轉 Y 軸 */
  flipY?: boolean;
  /** 縮放 */
  scale?: number;
  /** 適應模式 */
  fitMode?: SpineFitMode;
}

// ============================================================================
// Spine Canvas 渲染器
// ============================================================================

export class SpineCanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private isDisposed = false;
  private skeletonRenderer: any | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('[SpineCanvasRenderer] 無法取得 Canvas 2D Context');
    }
    this.ctx = ctx;
    
    // 建立 Spine SkeletonRenderer
    if (typeof spine !== 'undefined' && spine.canvas?.SkeletonRenderer) {
      this.skeletonRenderer = new spine.canvas.SkeletonRenderer(ctx);
      this.skeletonRenderer.triangleRendering = true;
    }
  }

  /**
   * 計算適應模式的縮放比例
   */
  private calculateFitScale(
    containerWidth: number,
    containerHeight: number,
    contentWidth: number,
    contentHeight: number,
    fitMode: SpineFitMode,
    userScale: number
  ): { scaleX: number; scaleY: number } {
    if (contentWidth <= 0 || contentHeight <= 0) {
      return { scaleX: userScale, scaleY: userScale };
    }

    const scaleToFitWidth = containerWidth / contentWidth;
    const scaleToFitHeight = containerHeight / contentHeight;

    let baseScaleX = userScale;
    let baseScaleY = userScale;

    switch (fitMode) {
      case 'fill':
        // 分別縮放 X 和 Y 來填滿容器（可能變形）
        baseScaleX = scaleToFitWidth * userScale;
        baseScaleY = scaleToFitHeight * userScale;
        break;
      case 'contain':
        // 保持比例，完整顯示在容器內
        const containScale = Math.min(scaleToFitWidth, scaleToFitHeight);
        baseScaleX = containScale * userScale;
        baseScaleY = containScale * userScale;
        break;
      case 'cover':
        // 保持比例，覆蓋整個容器
        const coverScale = Math.max(scaleToFitWidth, scaleToFitHeight);
        baseScaleX = coverScale * userScale;
        baseScaleY = coverScale * userScale;
        break;
      case 'none':
      default:
        // 原始大小 × 用戶縮放
        baseScaleX = userScale;
        baseScaleY = userScale;
        break;
    }

    return { scaleX: baseScaleX, scaleY: baseScaleY };
  }

  /**
   * 渲染 Spine 骨架
   */
  render(spineId: string, options: SpineRenderOptions = {}): void {
    if (this.isDisposed) {
      return;
    }

    const {
      showBones = false,
      showBounds = false,
      backgroundColor = null,
      flipX = false,
      flipY = false,
      scale = 1.0,
      fitMode = 'fill',
    } = options;

    const adapter = getSpineRuntimeAdapter();
    const skeleton = adapter.getSkeleton(spineId);
    const skeletonInfo = adapter.getSkeletonInfo(spineId);

    if (!skeleton || !skeletonInfo) {
      this.renderPlaceholder('Spine 實例未載入');
      return;
    }

    const { width, height } = this.canvas;
    const ctx = this.ctx;

    // 清除畫布
    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // 繪製背景
    if (backgroundColor) {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);
    }

    // 設定變換
    ctx.translate(width / 2, height / 2);
    
    // 計算適應模式的縮放
    const { scaleX: fitScaleX, scaleY: fitScaleY } = this.calculateFitScale(
      width,
      height,
      skeletonInfo.width || 200,
      skeletonInfo.height || 200,
      fitMode,
      scale
    );
    
    // 應用翻轉和縮放
    const finalScaleX = flipX ? -fitScaleX : fitScaleX;
    const finalScaleY = flipY ? fitScaleY : -fitScaleY; // Canvas Y 軸向下，Spine Y 軸向上
    ctx.scale(finalScaleX, finalScaleY);

    // 使用 Spine SkeletonRenderer 渲染
    if (this.skeletonRenderer) {
      try {
        this.skeletonRenderer.draw(skeleton);
      } catch (error) {
        console.error('[SpineCanvasRenderer] 渲染錯誤:', error);
        ctx.restore();
        this.renderPlaceholder('渲染錯誤');
        return;
      }
    } else {
      ctx.restore();
      this.renderPlaceholder('SkeletonRenderer 未初始化');
      return;
    }

    // 繪製骨骼（調試）
    if (showBones) {
      this.renderBones(skeleton);
    }

    ctx.restore();

    // 繪製邊界框（調試）
    if (showBounds) {
      this.renderBounds(skeletonInfo.width, skeletonInfo.height);
    }
  }

  /**
   * 渲染骨骼（調試用）
   */
  private renderBones(skeleton: any): void {
    const ctx = this.ctx;
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#22c55e';

    for (const bone of skeleton.bones) {
      if (bone.parent) {
        ctx.beginPath();
        ctx.moveTo(bone.parent.worldX, bone.parent.worldY);
        ctx.lineTo(bone.worldX, bone.worldY);
        ctx.stroke();
      }
      
      // 繪製關節點
      ctx.beginPath();
      ctx.arc(bone.worldX, bone.worldY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * 渲染邊界框（調試用）
   */
  private renderBounds(skeletonWidth: number, skeletonHeight: number): void {
    const ctx = this.ctx;
    const { width, height } = this.canvas;

    ctx.save();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);

    ctx.strokeRect(
      (width - skeletonWidth) / 2,
      (height - skeletonHeight) / 2,
      skeletonWidth,
      skeletonHeight
    );

    ctx.restore();
  }

  /**
   * 渲染佔位符
   */
  private renderPlaceholder(message: string = 'Spine 骨架'): void {
    const ctx = this.ctx;
    const { width, height } = this.canvas;

    ctx.fillStyle = 'rgba(124, 58, 237, 0.1)';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(124, 58, 237, 0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.strokeRect(10, 10, width - 20, height - 20);
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(124, 58, 237, 0.5)';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(message, width / 2, height / 2);
  }

  /**
   * 調整畫布大小
   */
  resize(width: number, height: number): void {
    if (this.isDisposed) return;
    
    this.canvas.width = width;
    this.canvas.height = height;
    
    // 重新建立 SkeletonRenderer（因為 context 可能改變）
    if (typeof spine !== 'undefined' && spine.canvas?.SkeletonRenderer) {
      this.skeletonRenderer = new spine.canvas.SkeletonRenderer(this.ctx);
      this.skeletonRenderer.triangleRendering = true;
    }
  }

  /**
   * 取得畫布
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * 取得 Context
   */
  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  /**
   * 清除畫布
   */
  clear(): void {
    if (this.isDisposed) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * 銷毀渲染器
   */
  dispose(): void {
    if (this.isDisposed) return;
    
    this.skeletonRenderer = null;
    this.isDisposed = true;
  }

  /**
   * 檢查是否已銷毀
   */
  get disposed(): boolean {
    return this.isDisposed;
  }
}

export const createSpineCanvasRenderer = (canvas: HTMLCanvasElement): SpineCanvasRenderer => {
  return new SpineCanvasRenderer(canvas);
};
