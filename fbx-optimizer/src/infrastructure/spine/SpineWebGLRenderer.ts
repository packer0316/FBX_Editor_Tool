/**
 * Spine WebGL 渲染器
 * 
 * 使用 WebGL 渲染 Spine 骨架，正確處理所有 Blend Mode。
 * 解決 Canvas 2D 無法正確處理 Additive 混合的黑色背景問題。
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
// Spine WebGL 渲染器
// ============================================================================

export class SpineWebGLRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private context: any = null; // ManagedWebGLRenderingContext
  private shader: any = null;
  private batcher: any = null;
  private skeletonRenderer: any = null;
  private mvp: any = null;
  private isDisposed = false;
  private isInitialized = false;
  
  // 紋理快取（從 Canvas 紋理轉換為 WebGL 紋理）
  private textureCache: Map<any, any> = new Map();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.initialize();
  }

  /**
   * 初始化 WebGL 資源
   */
  private initialize(): void {
    if (this.isInitialized) return;

    try {
      // 取得 WebGL Context
      // 重要：premultipliedAlpha 必須為 true，配合預乘 alpha 的混合模式
      const gl = this.canvas.getContext('webgl', { 
        alpha: true,
        premultipliedAlpha: true,
        preserveDrawingBuffer: true
      }) || this.canvas.getContext('experimental-webgl', {
        alpha: true,
        premultipliedAlpha: true,
        preserveDrawingBuffer: true
      });

      if (!gl) {
        console.error('[SpineWebGLRenderer] 無法取得 WebGL Context');
        return;
      }

      this.gl = gl as WebGLRenderingContext;

      // 檢查 spine.webgl 是否可用
      if (typeof spine === 'undefined' || !spine.webgl) {
        console.error('[SpineWebGLRenderer] Spine WebGL 模組未載入');
        return;
      }

      // 建立 ManagedWebGLRenderingContext
      this.context = new spine.webgl.ManagedWebGLRenderingContext(this.gl);

      // 建立 Shader（支援 Two Color Tint）
      this.shader = spine.webgl.Shader.newTwoColoredTextured(this.context);

      // 建立 PolygonBatcher
      this.batcher = new spine.webgl.PolygonBatcher(this.context, true);

      // 建立 SkeletonRenderer
      this.skeletonRenderer = new spine.webgl.SkeletonRenderer(this.context, true);

      // 建立 MVP 矩陣
      this.mvp = new spine.webgl.Matrix4();

      this.isInitialized = true;
      console.log('[SpineWebGLRenderer] 初始化成功');
    } catch (error) {
      console.error('[SpineWebGLRenderer] 初始化失敗:', error);
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
        baseScaleX = scaleToFitWidth * userScale;
        baseScaleY = scaleToFitHeight * userScale;
        break;
      case 'contain': {
        const containScale = Math.min(scaleToFitWidth, scaleToFitHeight);
        baseScaleX = containScale * userScale;
        baseScaleY = containScale * userScale;
        break;
      }
      case 'cover': {
        const coverScale = Math.max(scaleToFitWidth, scaleToFitHeight);
        baseScaleX = coverScale * userScale;
        baseScaleY = coverScale * userScale;
        break;
      }
      case 'none':
      default:
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
    if (this.isDisposed || !this.isInitialized || !this.gl) {
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

    const gl = this.gl;
    const { width, height } = this.canvas;

    // 設定 viewport
    gl.viewport(0, 0, width, height);

    // 清除畫布
    if (backgroundColor) {
      const color = this.parseColor(backgroundColor);
      gl.clearColor(color.r, color.g, color.b, color.a);
    } else {
      gl.clearColor(0, 0, 0, 0); // 透明背景
    }
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 計算適應模式的縮放
    const { scaleX: fitScaleX, scaleY: fitScaleY } = this.calculateFitScale(
      width,
      height,
      skeletonInfo.width || 200,
      skeletonInfo.height || 200,
      fitMode,
      scale
    );

    // 應用翻轉
    const finalScaleX = flipX ? -fitScaleX : fitScaleX;
    const finalScaleY = flipY ? -fitScaleY : fitScaleY;

    // 設定正交投影矩陣
    // 將座標系統轉換為以畫布中心為原點
    this.mvp.ortho2d(0, 0, width, height);
    this.mvp.translate(width / 2, height / 2, 0);
    this.mvp.scale(finalScaleX, finalScaleY, 1);

    // 確保紋理已轉換為 WebGL 格式
    this.ensureWebGLTextures(skeleton);

    // 開始批次渲染
    this.shader.bind();
    this.shader.setUniformi(spine.webgl.Shader.SAMPLER, 0);
    this.shader.setUniform4x4f(spine.webgl.Shader.MVP_MATRIX, this.mvp.values);

    this.batcher.begin(this.shader);

    // 渲染骨架
    try {
      this.skeletonRenderer.draw(this.batcher, skeleton);
    } catch (error) {
      console.error('[SpineWebGLRenderer] 渲染錯誤:', error);
    }

    this.batcher.end();
    this.shader.unbind();

    // 繪製調試資訊（使用 Canvas 2D 疊加）
    if (showBones || showBounds) {
      this.renderDebugOverlay(skeleton, skeletonInfo, showBones, showBounds, finalScaleX, finalScaleY);
    }
  }

  /**
   * 確保骨架中的所有紋理都已轉換為 WebGL 格式
   * 這是因為 SpineRuntimeAdapter 預設使用 Canvas 紋理
   */
  private ensureWebGLTextures(skeleton: any): void {
    if (!this.gl || !this.context) return;

    const drawOrder = skeleton.drawOrder;
    for (let i = 0, n = drawOrder.length; i < n; i++) {
      const slot = drawOrder[i];
      const attachment = slot.getAttachment();

      if (!attachment) continue;

      let region: any = null;
      if (attachment.region) {
        region = attachment.region;
      } else if (attachment.getRegion) {
        region = attachment.getRegion();
      }

      if (region && region.renderObject) {
        const renderObj = region.renderObject;
        
        // 檢查是否已經是 WebGL 紋理
        if (renderObj.texture && !renderObj.texture._glTexture) {
          // 從 Canvas 紋理獲取圖片
          let image: HTMLImageElement | null = null;
          if (renderObj.texture.getImage) {
            image = renderObj.texture.getImage();
          } else if (renderObj.texture._image) {
            image = renderObj.texture._image;
          }

          if (image) {
            // 檢查快取
            if (!this.textureCache.has(renderObj.texture)) {
              // 創建 WebGL 紋理
              const glTexture = new spine.webgl.GLTexture(this.context, image, false);
              this.textureCache.set(renderObj.texture, glTexture);
            }
            // 替換紋理
            renderObj.texture = this.textureCache.get(renderObj.texture);
          }
        }
      }
    }
  }

  /**
   * 解析顏色字串
   */
  private parseColor(color: string): { r: number; g: number; b: number; a: number } {
    // 簡單的顏色解析（支援 #RRGGBB 和 #RRGGBBAA）
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 6) {
        return {
          r: parseInt(hex.slice(0, 2), 16) / 255,
          g: parseInt(hex.slice(2, 4), 16) / 255,
          b: parseInt(hex.slice(4, 6), 16) / 255,
          a: 1,
        };
      } else if (hex.length === 8) {
        return {
          r: parseInt(hex.slice(0, 2), 16) / 255,
          g: parseInt(hex.slice(2, 4), 16) / 255,
          b: parseInt(hex.slice(4, 6), 16) / 255,
          a: parseInt(hex.slice(6, 8), 16) / 255,
        };
      }
    }
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  /**
   * 渲染調試疊加層（骨骼和邊界框）
   * 注意：這會使用額外的 Canvas 2D 來繪製調試資訊
   */
  private renderDebugOverlay(
    skeleton: any,
    skeletonInfo: any,
    showBones: boolean,
    showBounds: boolean,
    scaleX: number,
    scaleY: number
  ): void {
    // 建立臨時的 2D Canvas 來繪製調試資訊
    const debugCanvas = document.createElement('canvas');
    debugCanvas.width = this.canvas.width;
    debugCanvas.height = this.canvas.height;
    const ctx = debugCanvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = this.canvas;

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(scaleX, -scaleY); // WebGL Y 軸向上

    if (showBones) {
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1 / Math.abs(scaleX);
      ctx.fillStyle = '#22c55e';

      for (const bone of skeleton.bones) {
        if (bone.parent) {
          ctx.beginPath();
          ctx.moveTo(bone.parent.worldX, bone.parent.worldY);
          ctx.lineTo(bone.worldX, bone.worldY);
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(bone.worldX, bone.worldY, 3 / Math.abs(scaleX), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

    if (showBounds) {
      ctx.save();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(
        (width - skeletonInfo.width * Math.abs(scaleX)) / 2,
        (height - skeletonInfo.height * Math.abs(scaleY)) / 2,
        skeletonInfo.width * Math.abs(scaleX),
        skeletonInfo.height * Math.abs(scaleY)
      );
      ctx.restore();
    }

    // 將調試畫布疊加到 WebGL 畫布上
    // 注意：這需要在 WebGL 畫布上方有一個額外的 Canvas 元素
    // 或者我們可以將 WebGL 畫布內容讀取出來再合併
  }

  /**
   * 渲染佔位符
   */
  private renderPlaceholder(message: string = 'Spine 骨架'): void {
    if (!this.gl) return;

    const gl = this.gl;
    gl.clearColor(0.486, 0.227, 0.929, 0.1); // rgba(124, 58, 237, 0.1)
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 佔位符文字需要使用 2D Canvas 疊加
    // 這裡只繪製背景
  }

  /**
   * 調整畫布大小
   */
  resize(width: number, height: number): void {
    if (this.isDisposed) return;

    this.canvas.width = width;
    this.canvas.height = height;

    if (this.gl) {
      this.gl.viewport(0, 0, width, height);
    }
  }

  /**
   * 取得畫布
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * 取得 WebGL Context
   */
  getContext(): WebGLRenderingContext | null {
    return this.gl;
  }

  /**
   * 清除畫布
   */
  clear(): void {
    if (this.isDisposed || !this.gl) return;
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  /**
   * 銷毀渲染器
   */
  dispose(): void {
    if (this.isDisposed) return;

    // 清理紋理快取
    for (const texture of this.textureCache.values()) {
      if (texture && texture.dispose) {
        texture.dispose();
      }
    }
    this.textureCache.clear();

    if (this.batcher) {
      this.batcher.dispose();
      this.batcher = null;
    }

    if (this.shader) {
      this.shader.dispose();
      this.shader = null;
    }

    this.skeletonRenderer = null;
    this.mvp = null;
    this.context = null;
    this.gl = null;
    this.isDisposed = true;
    this.isInitialized = false;

    console.log('[SpineWebGLRenderer] 已銷毀');
  }

  /**
   * 檢查是否已銷毀
   */
  get disposed(): boolean {
    return this.isDisposed;
  }

  /**
   * 檢查是否已初始化
   */
  get initialized(): boolean {
    return this.isInitialized;
  }
}

export const createSpineWebGLRenderer = (canvas: HTMLCanvasElement): SpineWebGLRenderer => {
  return new SpineWebGLRenderer(canvas);
};

