/**
 * Spine TypeScript Runtime 3.8
 * 
 * 本地整合的 Spine Runtime，從 GitHub spine-runtimes 3.8 分支下載並編譯。
 * 
 * 使用方式：
 * ```typescript
 * import '../vendor/spine-ts-3.8';
 * // 現在可以使用全域 spine 變數
 * const atlas = new spine.TextureAtlas(...);
 * ```
 */

// 載入 spine-runtime.js（會自動暴露 spine 到 window/globalThis）
import './spine-runtime.js';

// 確保 TypeScript 知道 spine 是全域變數
declare global {
  const spine: {
    // Core
    Animation: any;
    AnimationState: any;
    AnimationStateData: any;
    AtlasAttachmentLoader: any;
    Bone: any;
    BoneData: any;
    Event: any;
    EventData: any;
    Skeleton: any;
    SkeletonBinary: any;
    SkeletonBounds: any;
    SkeletonClipping: any;
    SkeletonData: any;
    SkeletonJson: any;
    Skin: any;
    Slot: any;
    SlotData: any;
    TextureAtlas: any;
    TextureAtlasPage: any;
    TextureAtlasRegion: any;
    TextureRegion: any;
    Utils: any;
    Color: any;
    // Canvas module
    canvas: {
      CanvasTexture: any;
      SkeletonRenderer: any;
    };
    // Attachments
    RegionAttachment: any;
    MeshAttachment: any;
    BoundingBoxAttachment: any;
    ClippingAttachment: any;
    PathAttachment: any;
    PointAttachment: any;
  };
}

export {};
