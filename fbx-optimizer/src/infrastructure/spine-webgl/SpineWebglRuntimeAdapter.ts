/**
 * Spine WebGL Runtime 適配器
 *
 * - 使用 `spine-ts/webgl` 的 WebGL 渲染管線（`spine.webgl.*`）
 * - API 盡量對齊現有 `SpineRuntimeAdapter`，讓上層（Director/Panel/Layer）可直接沿用
 *
 * 注意：
 * - `spine.webgl` 需先載入（建議在 `index.html` 以 `<script src="/vendor/spine/spine-webgl.js">`）
 * - **不要再 import 舊的 `vendor/spine-ts-3.8` runtime**：它會重新賦值 `window.spine`，把 `spine.webgl` 覆蓋掉
 */
import type {
  SpineSkeletonInfo,
  SpineAnimationInfo,
  SpineSkinInfo,
  SpineSlotInfo,
} from '../../domain/value-objects/SpineInstance';

// ============================================================================
// 類型定義
// ============================================================================

export interface SpineWebglLoadParams {
  /** 唯一 ID */
  id: string;
  /** .skel 二進制數據 */
  skelData: ArrayBuffer;
  /** .atlas 文本內容 */
  atlasText: string;
  /** atlas 檔名（用於推斷 -pma） */
  atlasFileName?: string;
  /** 圖片 Map（檔名 -> Image 或 Data URL） */
  images: Map<string, HTMLImageElement | string>;
}

export interface SpineAnimationListener {
  onStart?: (id: string, animationName: string) => void;
  onComplete?: (id: string, animationName: string) => void;
  onInterrupt?: (id: string, animationName: string) => void;
  onEvent?: (id: string, eventName: string, eventData: unknown) => void;
}

export type SpineFitMode = 'fill' | 'contain' | 'cover' | 'none';

export interface SpineWebglRenderOptions {
  /** 背景顏色（null = 透明） */
  backgroundColor?: string | null;
  /** 縮放 */
  scale?: number;
  /** 適應模式 */
  fitMode?: SpineFitMode;
}

interface SpineBounds {
  offset: { x: number; y: number };
  size: { x: number; y: number };
}

interface SpineWebglInstance {
  skeletonInfo: SpineSkeletonInfo;
  isLoaded: boolean;
  currentAnimation: string | null;
  currentTime: number;
  loop: boolean;
  timeScale: number;
  isPlaying: boolean;
  currentSkin: string | null;

  // WebGL resources
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  shader: unknown;
  batcher: unknown;
  mvp: unknown;
  skeletonRenderer: unknown;

  // Spine core/runtime objects
  skeleton: unknown;
  state: unknown;
  stateData: unknown;
  atlas: unknown;
  bounds: SpineBounds;
  premultipliedAlpha: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

const getSpineGlobal = (): unknown => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).spine ?? (typeof spine !== 'undefined' ? spine : undefined);
};

const parseRgba = (color: string): { r: number; g: number; b: number; a: number } | null => {
  // 支援 #RRGGBB / #RRGGBBAA / rgba(r,g,b,a)
  const hex = color.trim();
  if (hex.startsWith('#')) {
    const h = hex.slice(1);
    if (h.length === 6 || h.length === 8) {
      const r = parseInt(h.slice(0, 2), 16) / 255;
      const g = parseInt(h.slice(2, 4), 16) / 255;
      const b = parseInt(h.slice(4, 6), 16) / 255;
      const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
  }
  const rgba = hex.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/i);
  if (rgba) {
    const r = Math.min(255, Math.max(0, Number(rgba[1]))) / 255;
    const g = Math.min(255, Math.max(0, Number(rgba[2]))) / 255;
    const b = Math.min(255, Math.max(0, Number(rgba[3]))) / 255;
    const a = rgba[4] === undefined ? 1 : Math.min(1, Math.max(0, Number(rgba[4])));
    return { r, g, b, a };
  }
  return null;
};

// ============================================================================
// Adapter
// ============================================================================

export class SpineWebglRuntimeAdapter {
  private static instance: SpineWebglRuntimeAdapter | null = null;

  private instances: Map<string, SpineWebglInstance> = new Map();
  private listeners: Set<SpineAnimationListener> = new Set();

  static getInstance(): SpineWebglRuntimeAdapter {
    if (!this.instance) {
      this.instance = new SpineWebglRuntimeAdapter();
    }
    return this.instance;
  }

  private constructor() {}

  async load(params: SpineWebglLoadParams): Promise<SpineSkeletonInfo> {
    const spineRuntime = getSpineGlobal();
    if (!spineRuntime) {
      throw new Error('[SpineWebglRuntimeAdapter] Spine Runtime 未載入');
    }

    const {
      id,
      skelData,
      atlasText,
      atlasFileName,
      images,
    } = params;

    if (this.instances.has(id)) {
      this.cleanup(id);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = spineRuntime as any;

    const isTestEnv = typeof process !== 'undefined' && !!process.env.VITEST;

    // 建立 per-instance canvas（就算 headless 也建立，方便上層掛載）
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    // 嘗試取得 WebGL context（jsdom 會因為未實作而直接 throw，所以測試環境要避開）
    const gl = isTestEnv
      ? null
      : (canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false }) as WebGLRenderingContext | null) ??
        (canvas.getContext('experimental-webgl', { alpha: true, premultipliedAlpha: false }) as WebGLRenderingContext | null);

    const hasWebglRuntime = !!(s.webgl?.Shader && s.webgl?.PolygonBatcher && s.webgl?.SkeletonRenderer && s.webgl?.GLTexture);

    if (!hasWebglRuntime && !isTestEnv) {
      throw new Error('[SpineWebglRuntimeAdapter] spine.webgl 未載入（請確認 index.html 已載入 spine-webgl.js）');
    }

    // Texture loader：優先用 WebGL 的 GLTexture；測試/無 WebGL 時 fallback 用 CanvasTexture
    const textureLoader = (path: string): unknown => {
      const fileName = path.split('/').pop() || path;
      let image = images.get(fileName);
      if (!image) {
        for (const [key, img] of images.entries()) {
          if (key.toLowerCase() === fileName.toLowerCase() || key.toLowerCase().endsWith(fileName.toLowerCase())) {
            image = img;
            break;
          }
        }
      }

      const toImageElement = (src: string): HTMLImageElement => {
        const img = new Image();
        img.src = src;
        return img;
      };

      if (!image) {
        console.warn(`[SpineWebglRuntimeAdapter] 找不到圖片: ${fileName}`);
        // 1x1 PNG（magenta）避免在 jsdom 觸發 canvas/toDataURL 未實作
        const img = toImageElement(
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='
        );
        if (hasWebglRuntime && gl) return new s.webgl.GLTexture(gl, img);
        return new s.canvas.CanvasTexture(img);
      }

      const imgEl = typeof image === 'string' ? toImageElement(image) : image;
      if (hasWebglRuntime && gl) return new s.webgl.GLTexture(gl, imgEl);
      return new s.canvas.CanvasTexture(imgEl);
    };

    // 建立 atlas / attachment loader / skeleton data
    const atlas = new s.TextureAtlas(atlasText, textureLoader);
    const attachmentLoader = new s.AtlasAttachmentLoader(atlas);
    const skeletonBinary = new s.SkeletonBinary(attachmentLoader);
    skeletonBinary.scale = 1;
    const skeletonData = skeletonBinary.readSkeletonData(new Uint8Array(skelData));

    const skeleton = new s.Skeleton(skeletonData);
    skeleton.setToSetupPose();
    skeleton.updateWorldTransform();

    const bounds = this.calculateSetupPoseBounds(skeleton);

    const stateData = new s.AnimationStateData(skeletonData);
    stateData.defaultMix = 0.2;
    const state = new s.AnimationState(stateData);

    const skeletonInfo = this.extractSkeletonInfo(skeletonData);

    const currentAnimation = skeletonInfo.animations[0]?.name ?? null;
    const currentSkin = skeletonInfo.skins[0]?.name ?? null;

    if (currentAnimation) {
      state.setAnimation(0, currentAnimation, true);
    }

    if (currentSkin) {
      skeleton.setSkinByName(currentSkin);
      skeleton.setSlotsToSetupPose();
    }

    // WebGL pipeline objects（若 gl 不存在，render 會變成 no-op）
    const shader = hasWebglRuntime && gl ? s.webgl.Shader.newTwoColoredTextured(gl) : null;
    const batcher = hasWebglRuntime && gl ? new s.webgl.PolygonBatcher(gl) : null;
    const mvp = hasWebglRuntime && gl ? new s.webgl.Matrix4() : null;
    const skeletonRenderer = hasWebglRuntime && gl ? new s.webgl.SkeletonRenderer(gl) : null;

    const premultipliedAlpha =
      (atlasFileName?.toLowerCase().includes('-pma') ?? false) ||
      // 某些輸出會在 atlasText/page name 出現 -pma
      atlasText.toLowerCase().includes('-pma');

    const instance: SpineWebglInstance = {
      skeletonInfo,
      isLoaded: true,
      currentAnimation,
      currentTime: 0,
      loop: true,
      timeScale: 1.0,
      isPlaying: false,
      currentSkin,
      canvas,
      gl: gl ?? (null as unknown as WebGLRenderingContext),
      shader,
      batcher,
      mvp,
      skeletonRenderer,
      skeleton,
      state,
      stateData,
      atlas,
      bounds,
      premultipliedAlpha,
    };

    this.instances.set(id, instance);
    return skeletonInfo;
  }

  // ============================================================================
  // Playback control (API 對齊既有 adapter)
  // ============================================================================

  playAnimation(id: string, animationName: string, loop: boolean = true): void {
    const instance = this.instances.get(id);
    if (!instance?.state) return;
    const animation = instance.skeletonInfo.animations.find(a => a.name === animationName);
    if (!animation) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = instance.state as any;
    state.setAnimation(0, animationName, loop);

    instance.currentAnimation = animationName;
    instance.loop = loop;
    instance.currentTime = 0;
    instance.isPlaying = true;
    this.notifyListeners('onStart', id, animationName);
  }

  pause(id: string): void {
    const instance = this.instances.get(id);
    if (instance) instance.isPlaying = false;
  }

  resume(id: string): void {
    const instance = this.instances.get(id);
    if (instance) instance.isPlaying = true;
  }

  stop(id: string): void {
    const instance = this.instances.get(id);
    if (!instance) return;
    instance.isPlaying = false;
    instance.currentTime = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = instance.state as any;
    state?.setEmptyAnimation?.(0, 0);
  }

  clearTrack(id: string, trackIndex: number = 0): void {
    const instance = this.instances.get(id);
    if (!instance?.state) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = instance.state as any;
    state.clearTrack(trackIndex);
    instance.isPlaying = false;
    instance.currentTime = 0;
    instance.currentAnimation = null;
  }

  clearAllTracks(): void {
    for (const [id, instance] of this.instances) {
      if (!instance.state) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const state = instance.state as any;
      state.clearTracks();
      instance.isPlaying = false;
      instance.currentTime = 0;
      instance.currentAnimation = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (instance.skeleton as any)?.setToSetupPose?.();
      this.render(id, { backgroundColor: null });
    }
  }

  setTimeScale(id: string, timeScale: number): void {
    const instance = this.instances.get(id);
    if (!instance) return;
    instance.timeScale = Math.max(0.1, Math.min(2.0, timeScale));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = instance.state as any;
    if (state) state.timeScale = instance.timeScale;
  }

  setSkin(id: string, skinName: string): void {
    const instance = this.instances.get(id);
    if (!instance?.skeleton) return;
    const skin = instance.skeletonInfo.skins.find(s => s.name === skinName);
    if (!skin) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const skeleton = instance.skeleton as any;
    skeleton.setSkinByName(skinName);
    skeleton.setSlotsToSetupPose();
    instance.currentSkin = skinName;
    skeleton.updateWorldTransform();
  }

  seek(id: string, time: number): void {
    const instance = this.instances.get(id);
    if (!instance || !instance.currentAnimation || !instance.state || !instance.skeleton) return;
    const animation = instance.skeletonInfo.animations.find(a => a.name === instance.currentAnimation);
    if (!animation) return;

    instance.currentTime = Math.max(0, Math.min(time, animation.duration));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = instance.state as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const skeleton = instance.skeleton as any;
    const track = state.getCurrent(0);
    if (track) track.trackTime = instance.currentTime;
    state.apply(skeleton);
    skeleton.updateWorldTransform();
  }

  update(id: string, deltaTime: number): void {
    const instance = this.instances.get(id);
    if (!instance || !instance.isPlaying || !instance.state || !instance.skeleton) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = instance.state as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const skeleton = instance.skeleton as any;
    state.update(deltaTime * instance.timeScale);
    state.apply(skeleton);
    skeleton.updateWorldTransform();

    const track = state.getCurrent(0);
    if (track) {
      const duration = track.animation?.duration || 1;
      instance.currentTime = track.trackTime % duration;
      if (!instance.loop && track.isComplete?.()) {
        instance.isPlaying = false;
        this.notifyListeners('onComplete', id, instance.currentAnimation || '');
      }
    }
  }

  // ============================================================================
  // Rendering
  // ============================================================================

  getCanvas(id: string): HTMLCanvasElement | null {
    return this.instances.get(id)?.canvas ?? null;
  }

  resize(id: string, width: number, height: number): void {
    const instance = this.instances.get(id);
    if (!instance) return;
    if (width <= 0 || height <= 0) return;
    instance.canvas.width = Math.floor(width);
    instance.canvas.height = Math.floor(height);
    if (instance.gl) {
      instance.gl.viewport(0, 0, instance.canvas.width, instance.canvas.height);
    }
  }

  render(id: string, options: SpineWebglRenderOptions = {}): void {
    const instance = this.instances.get(id);
    if (!instance) return;
    if (!instance.gl || !instance.shader || !instance.batcher || !instance.mvp || !instance.skeletonRenderer) {
      // headless / 非 WebGL 環境下 no-op（單元測試會走到這）
      return;
    }

    const {
      backgroundColor = null,
      scale = 1.0,
      fitMode = 'contain',
    } = options;

    const { gl, canvas } = instance;

    const bg = backgroundColor ? parseRgba(backgroundColor) : null;
    if (bg) gl.clearColor(bg.r, bg.g, bg.b, bg.a);
    else gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = getSpineGlobal() as any;

    const bounds = instance.bounds;
    const centerX = bounds.offset.x + bounds.size.x / 2;
    const centerY = bounds.offset.y + bounds.size.y / 2;

    const w = canvas.width;
    const h = canvas.height;

    const contentW = Math.max(1e-6, bounds.size.x);
    const contentH = Math.max(1e-6, bounds.size.y);

    const userScale = Math.max(0.01, scale);

    let viewWorldW = w / userScale;
    let viewWorldH = h / userScale;

    if (fitMode !== 'none') {
      const worldPerPixelX = contentW / w;
      const worldPerPixelY = contentH / h;
      if (fitMode === 'fill') {
        viewWorldW = contentW / userScale;
        viewWorldH = contentH / userScale;
      } else if (fitMode === 'contain') {
        const wpp = Math.max(worldPerPixelX, worldPerPixelY) / userScale;
        viewWorldW = w * wpp;
        viewWorldH = h * wpp;
      } else if (fitMode === 'cover') {
        const wpp = Math.min(worldPerPixelX, worldPerPixelY) / userScale;
        viewWorldW = w * wpp;
        viewWorldH = h * wpp;
      }
    }

    // 設定投影（對齊官方範例：用 ortho2d 定義世界座標視窗）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mvp = instance.mvp as any;
    mvp.ortho2d(centerX - viewWorldW / 2, centerY - viewWorldH / 2, viewWorldW, viewWorldH);
    gl.viewport(0, 0, w, h);

    // Bind shader + MVP
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shader = instance.shader as any;
    shader.bind();
    shader.setUniformi(s.webgl.Shader.SAMPLER, 0);
    shader.setUniform4x4f(s.webgl.Shader.MVP_MATRIX, mvp.values);

    // Batch draw
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const batcher = instance.batcher as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const skeletonRenderer = instance.skeletonRenderer as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const skeleton = instance.skeleton as any;

    batcher.begin(shader);
    skeletonRenderer.premultipliedAlpha = instance.premultipliedAlpha;
    skeletonRenderer.draw(batcher, skeleton);
    batcher.end();
    shader.unbind();
  }

  // ============================================================================
  // Query
  // ============================================================================

  getSkeleton(id: string): unknown | null {
    return this.instances.get(id)?.skeleton ?? null;
  }

  getState(id: string): { isPlaying: boolean; currentTime: number; currentAnimation: string | null; duration: number } | null {
    const instance = this.instances.get(id);
    if (!instance) return null;
    const animation = instance.currentAnimation
      ? instance.skeletonInfo.animations.find(a => a.name === instance.currentAnimation)
      : null;
    return {
      isPlaying: instance.isPlaying,
      currentTime: instance.currentTime,
      currentAnimation: instance.currentAnimation,
      duration: animation?.duration ?? 0,
    };
  }

  getSkeletonInfo(id: string): SpineSkeletonInfo | null {
    return this.instances.get(id)?.skeletonInfo ?? null;
  }

  has(id: string): boolean {
    return this.instances.has(id);
  }

  // ============================================================================
  // Listeners
  // ============================================================================

  addListener(listener: SpineAnimationListener): void {
    this.listeners.add(listener);
  }

  removeListener(listener: SpineAnimationListener): void {
    this.listeners.delete(listener);
  }

  private notifyListeners(
    event: keyof SpineAnimationListener,
    id: string,
    animationOrEventName: string,
    eventData?: unknown
  ): void {
    for (const listener of this.listeners) {
      const handler = listener[event];
      if (!handler) continue;
      if (event === 'onEvent') {
        (handler as (id: string, eventName: string, eventData: unknown) => void)(id, animationOrEventName, eventData);
      } else {
        (handler as (id: string, animationName: string) => void)(id, animationOrEventName);
      }
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  cleanup(id: string): void {
    const instance = this.instances.get(id);
    if (!instance) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (instance.atlas as any)?.dispose?.();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (instance.batcher as any)?.dispose?.();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (instance.shader as any)?.dispose?.();
      // skeletonRenderer 沒有 dispose 也 OK
    } catch (error) {
      console.warn('[SpineWebglRuntimeAdapter] cleanup warning:', error);
    }

    this.instances.delete(id);
  }

  cleanupAll(): void {
    for (const id of this.instances.keys()) {
      this.cleanup(id);
    }
    this.listeners.clear();
  }

  getAllIds(): string[] {
    return Array.from(this.instances.keys());
  }

  getInstanceCount(): number {
    return this.instances.size;
  }

  // ============================================================================
  // Slot control (沿用原 API)
  // ============================================================================

  setSlotAttachment(id: string, slotName: string, attachmentName: string | null): void {
    const instance = this.instances.get(id);
    if (!instance?.skeleton) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const skeleton = instance.skeleton as any;
    const slot = skeleton.findSlot(slotName);
    if (!slot) return;
    if (attachmentName === null) slot.setAttachment(null);
    else skeleton.setAttachment(slotName, attachmentName);
    skeleton.updateWorldTransform();
  }

  getSlotAttachment(id: string, slotName: string): string | null {
    const instance = this.instances.get(id);
    if (!instance?.skeleton) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const skeleton = instance.skeleton as any;
    const slot = skeleton.findSlot(slotName);
    return slot?.getAttachment()?.name ?? null;
  }

  getSlotAttachments(id: string, slotName: string): string[] {
    const instance = this.instances.get(id);
    if (!instance?.skeleton) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const skeleton = instance.skeleton as any;
    const slot = skeleton.findSlot(slotName);
    if (!slot) return [];
    const skin = skeleton.skin || skeleton.data.defaultSkin;
    if (!skin) return [];
    const attachments: string[] = [];
    try {
      const skinAttachments = skin.getAttachments();
      for (const entry of skinAttachments) {
        if (entry.slotIndex === slot.data.index) attachments.push(entry.name);
      }
    } catch {
      // fallback
    }
    return attachments;
  }

  getSlotsState(id: string): Array<{
    index: number;
    name: string;
    boneName: string;
    currentAttachment: string | null;
    availableAttachments: string[];
  }> {
    const instance = this.instances.get(id);
    if (!instance?.skeleton) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const skeleton = instance.skeleton as any;
    const result: Array<{
      index: number;
      name: string;
      boneName: string;
      currentAttachment: string | null;
      availableAttachments: string[];
    }> = [];
    for (let i = 0; i < skeleton.slots.length; i++) {
      const slot = skeleton.slots[i];
      const slotName = slot.data.name;
      result.push({
        index: i,
        name: slotName,
        boneName: slot.bone.data.name,
        currentAttachment: slot.getAttachment()?.name ?? null,
        availableAttachments: this.getSlotAttachments(id, slotName),
      });
    }
    return result;
  }

  // ============================================================================
  // Internal
  // ============================================================================

  private calculateSetupPoseBounds(skeleton: unknown): SpineBounds {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sk = skeleton as any;
    sk.setToSetupPose();
    sk.updateWorldTransform();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = getSpineGlobal() as any;
    const offset = new s.Vector2();
    const size = new s.Vector2();
    sk.getBounds(offset, size, []);
    return { offset: { x: offset.x, y: offset.y }, size: { x: size.x, y: size.y } };
  }

  private extractSkeletonInfo(skeletonData: unknown): SpineSkeletonInfo {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = skeletonData as any;

    const animations: SpineAnimationInfo[] = data.animations.map((anim: any) => ({
      name: anim.name,
      duration: anim.duration,
      frameCount: Math.ceil(anim.duration * 30),
    }));

    const skins: SpineSkinInfo[] = data.skins.map((skin: any) => ({
      name: skin.name,
    }));

    const slots: SpineSlotInfo[] = data.slots.map((slot: any, index: number) => ({
      index,
      name: slot.name,
      boneName: slot.boneData.name,
      attachment: slot.attachmentName,
      attachments: [],
    }));

    return {
      width: data.width || 200,
      height: data.height || 200,
      version: data.version || '3.8',
      fps: data.fps || 30,
      animations,
      skins,
      slots,
      boneCount: data.bones.length,
    };
  }
}

export const getSpineWebglRuntimeAdapter = (): SpineWebglRuntimeAdapter => {
  return SpineWebglRuntimeAdapter.getInstance();
};


