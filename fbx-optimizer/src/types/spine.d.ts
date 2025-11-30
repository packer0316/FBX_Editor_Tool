/**
 * Spine Runtime 3.8 類型定義
 * 
 * 這是一個簡化的類型定義，用於與 Spine Runtime 互動。
 * 實際的 Runtime 需要從 GitHub 下載 spine-ts 3.8 分支。
 */

declare namespace spine {
  // ============================================================================
  // Core Types
  // ============================================================================

  /**
   * 骨架數據
   */
  export class SkeletonData {
    name: string;
    bones: BoneData[];
    slots: SlotData[];
    skins: Skin[];
    animations: Animation[];
    defaultSkin: Skin | null;
    width: number;
    height: number;
    version: string;
    hash: string;
    fps: number;

    findAnimation(animationName: string): Animation | null;
    findSkin(skinName: string): Skin | null;
    findSlot(slotName: string): SlotData | null;
    findBone(boneName: string): BoneData | null;
  }

  /**
   * 骨架
   */
  export class Skeleton {
    data: SkeletonData;
    bones: Bone[];
    slots: Slot[];
    skin: Skin | null;
    color: Color;
    scaleX: number;
    scaleY: number;
    x: number;
    y: number;

    constructor(data: SkeletonData);

    updateWorldTransform(): void;
    setToSetupPose(): void;
    setBonesToSetupPose(): void;
    setSlotsToSetupPose(): void;
    setSkin(skin: Skin | null): void;
    setSkinByName(skinName: string): void;
    getAttachment(slotIndex: number, attachmentName: string): Attachment | null;
    setAttachment(slotName: string, attachmentName: string | null): void;
    findBone(boneName: string): Bone | null;
    findSlot(slotName: string): Slot | null;
    getBounds(offset: Vector2, size: Vector2, temp?: number[]): void;
  }

  /**
   * 骨骼數據
   */
  export class BoneData {
    index: number;
    name: string;
    parent: BoneData | null;
    length: number;
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
  }

  /**
   * 骨骼
   */
  export class Bone {
    data: BoneData;
    parent: Bone | null;
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
    worldX: number;
    worldY: number;

    updateWorldTransform(): void;
  }

  /**
   * 插槽數據
   */
  export class SlotData {
    index: number;
    name: string;
    boneData: BoneData;
    color: Color;
    attachmentName: string | null;
  }

  /**
   * 插槽
   */
  export class Slot {
    data: SlotData;
    bone: Bone;
    color: Color;
    attachment: Attachment | null;

    setAttachment(attachment: Attachment | null): void;
  }

  /**
   * 附件基類
   */
  export class Attachment {
    name: string;
  }

  /**
   * 區域附件
   */
  export class RegionAttachment extends Attachment {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
    width: number;
    height: number;
    color: Color;
    region: TextureRegion;
  }

  /**
   * 網格附件
   */
  export class MeshAttachment extends Attachment {
    region: TextureRegion;
    color: Color;
    worldVerticesLength: number;
  }

  // ============================================================================
  // Skin
  // ============================================================================

  /**
   * 皮膚
   */
  export class Skin {
    name: string;
    attachments: Map<number, Map<string, Attachment>>;

    constructor(name: string);

    setAttachment(slotIndex: number, name: string, attachment: Attachment): void;
    getAttachment(slotIndex: number, name: string): Attachment | null;
    getAttachments(): { slotIndex: number; name: string; attachment: Attachment }[];
  }

  // ============================================================================
  // Animation
  // ============================================================================

  /**
   * 動畫
   */
  export class Animation {
    name: string;
    duration: number;
    timelines: Timeline[];

    apply(
      skeleton: Skeleton,
      lastTime: number,
      time: number,
      loop: boolean,
      events: Event[] | null,
      alpha: number,
      blend: MixBlend,
      direction: MixDirection
    ): void;
  }

  /**
   * 時間線基類
   */
  export interface Timeline {
    apply(
      skeleton: Skeleton,
      lastTime: number,
      time: number,
      events: Event[] | null,
      alpha: number,
      blend: MixBlend,
      direction: MixDirection
    ): void;
  }

  /**
   * 動畫狀態數據
   */
  export class AnimationStateData {
    skeletonData: SkeletonData;
    defaultMix: number;

    constructor(skeletonData: SkeletonData);

    setMix(fromName: string, toName: string, duration: number): void;
    getMix(from: Animation, to: Animation): number;
  }

  /**
   * 動畫狀態
   */
  export class AnimationState {
    data: AnimationStateData;
    tracks: TrackEntry[];
    timeScale: number;

    constructor(data: AnimationStateData);

    update(delta: number): void;
    apply(skeleton: Skeleton): boolean;
    setAnimation(trackIndex: number, animationName: string, loop: boolean): TrackEntry | null;
    addAnimation(trackIndex: number, animationName: string, loop: boolean, delay: number): TrackEntry | null;
    setEmptyAnimation(trackIndex: number, mixDuration: number): TrackEntry;
    addEmptyAnimation(trackIndex: number, mixDuration: number, delay: number): TrackEntry;
    getCurrent(trackIndex: number): TrackEntry | null;
    clearTracks(): void;
    clearTrack(trackIndex: number): void;

    addListener(listener: AnimationStateListener): void;
    removeListener(listener: AnimationStateListener): void;
  }

  /**
   * 軌道條目
   */
  export class TrackEntry {
    animation: Animation;
    loop: boolean;
    trackIndex: number;
    trackTime: number;
    animationStart: number;
    animationEnd: number;
    animationLast: number;
    alpha: number;
    mixTime: number;
    mixDuration: number;
    timeScale: number;
    delay: number;

    getAnimationTime(): number;
  }

  /**
   * 動畫狀態監聽器
   */
  export interface AnimationStateListener {
    start?(entry: TrackEntry): void;
    interrupt?(entry: TrackEntry): void;
    end?(entry: TrackEntry): void;
    dispose?(entry: TrackEntry): void;
    complete?(entry: TrackEntry): void;
    event?(entry: TrackEntry, event: Event): void;
  }

  // ============================================================================
  // Events
  // ============================================================================

  /**
   * 事件數據
   */
  export class EventData {
    name: string;
    intValue: number;
    floatValue: number;
    stringValue: string;
    audioPath: string;
    volume: number;
    balance: number;
  }

  /**
   * 事件
   */
  export class Event {
    data: EventData;
    intValue: number;
    floatValue: number;
    stringValue: string;
    time: number;
    volume: number;
    balance: number;
  }

  // ============================================================================
  // Texture & Atlas
  // ============================================================================

  /**
   * 貼圖
   */
  export interface Texture {
    getImage(): HTMLImageElement;
    dispose(): void;
  }

  /**
   * 貼圖區域
   */
  export class TextureRegion {
    texture: Texture;
    u: number;
    v: number;
    u2: number;
    v2: number;
    width: number;
    height: number;
    rotate: boolean;
    offsetX: number;
    offsetY: number;
    originalWidth: number;
    originalHeight: number;
  }

  /**
   * 圖集
   */
  export class TextureAtlas {
    pages: TextureAtlasPage[];
    regions: TextureAtlasRegion[];

    constructor(atlasText: string, textureLoader: TextureLoader);

    findRegion(name: string): TextureAtlasRegion | null;
    dispose(): void;
  }

  /**
   * 圖集頁面
   */
  export class TextureAtlasPage {
    name: string;
    texture: Texture;
    width: number;
    height: number;
  }

  /**
   * 圖集區域
   */
  export class TextureAtlasRegion extends TextureRegion {
    page: TextureAtlasPage;
    name: string;
    index: number;
  }

  /**
   * 貼圖載入器
   */
  export interface TextureLoader {
    load(page: TextureAtlasPage, path: string): void;
    unload(texture: Texture): void;
  }

  // ============================================================================
  // Binary Loader
  // ============================================================================

  /**
   * 骨架二進制數據
   */
  export class SkeletonBinary {
    scale: number;

    constructor(attachmentLoader: AttachmentLoader);

    readSkeletonData(binary: Uint8Array): SkeletonData;
  }

  /**
   * 骨架 JSON 數據
   */
  export class SkeletonJson {
    scale: number;

    constructor(attachmentLoader: AttachmentLoader);

    readSkeletonData(json: string | object): SkeletonData;
  }

  /**
   * 附件載入器
   */
  export interface AttachmentLoader {
    newRegionAttachment(skin: Skin, name: string, path: string): RegionAttachment | null;
    newMeshAttachment(skin: Skin, name: string, path: string): MeshAttachment | null;
    newBoundingBoxAttachment(skin: Skin, name: string): Attachment | null;
    newClippingAttachment(skin: Skin, name: string): Attachment | null;
    newPathAttachment(skin: Skin, name: string): Attachment | null;
    newPointAttachment(skin: Skin, name: string): Attachment | null;
  }

  /**
   * 圖集附件載入器
   */
  export class AtlasAttachmentLoader implements AttachmentLoader {
    atlas: TextureAtlas;

    constructor(atlas: TextureAtlas);

    newRegionAttachment(skin: Skin, name: string, path: string): RegionAttachment | null;
    newMeshAttachment(skin: Skin, name: string, path: string): MeshAttachment | null;
    newBoundingBoxAttachment(skin: Skin, name: string): Attachment | null;
    newClippingAttachment(skin: Skin, name: string): Attachment | null;
    newPathAttachment(skin: Skin, name: string): Attachment | null;
    newPointAttachment(skin: Skin, name: string): Attachment | null;
  }

  // ============================================================================
  // Canvas Renderer
  // ============================================================================

  /**
   * Canvas 骨架渲染器
   */
  export class SkeletonRenderer {
    ctx: CanvasRenderingContext2D;
    triangleRendering: boolean;
    debugRendering: boolean;

    constructor(ctx: CanvasRenderingContext2D);

    draw(skeleton: Skeleton): void;
  }

  // ============================================================================
  // Utility Types
  // ============================================================================

  /**
   * 顏色
   */
  export class Color {
    r: number;
    g: number;
    b: number;
    a: number;

    constructor(r?: number, g?: number, b?: number, a?: number);

    set(r: number, g: number, b: number, a: number): this;
    setFromColor(color: Color): this;
    setFromString(hex: string): this;
  }

  /**
   * 2D 向量
   */
  export class Vector2 {
    x: number;
    y: number;

    constructor(x?: number, y?: number);

    set(x: number, y: number): this;
  }

  /**
   * 混合模式
   */
  export enum MixBlend {
    setup = 0,
    first = 1,
    replace = 2,
    add = 3,
  }

  /**
   * 混合方向
   */
  export enum MixDirection {
    mixIn = 0,
    mixOut = 1,
  }
}

// 導出為模組
export = spine;
export as namespace spine;


