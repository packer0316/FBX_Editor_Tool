/**
 * Spine Runtime 3.8 全域命名空間聲明
 * 
 * Spine Runtime 使用 TypeScript 命名空間（module spine {}）語法，
 * 需要在全域宣告 spine 變數。
 */

// 宣告全域 spine 命名空間
declare global {
  namespace spine {
    // 基礎類型
    class Color {
      r: number;
      g: number;
      b: number;
      a: number;
      constructor(r?: number, g?: number, b?: number, a?: number);
      set(r: number, g: number, b: number, a: number): this;
      setFromColor(c: Color): this;
      setFromString(hex: string): this;
      add(r: number, g: number, b: number, a: number): this;
      clamp(): this;
    }

    class Vector2 {
      x: number;
      y: number;
      constructor(x?: number, y?: number);
      set(x: number, y: number): this;
      length(): number;
      normalize(): this;
    }

    // 骨架數據
    class SkeletonData {
      name: string;
      bones: BoneData[];
      slots: SlotData[];
      skins: Skin[];
      defaultSkin: Skin | null;
      events: EventData[];
      animations: Animation[];
      ikConstraints: IkConstraintData[];
      transformConstraints: TransformConstraintData[];
      pathConstraints: PathConstraintData[];
      width: number;
      height: number;
      version: string;
      hash: string;
      fps: number;
      imagesPath: string;
      audioPath: string;

      findBone(boneName: string): BoneData | null;
      findBoneIndex(boneName: string): number;
      findSlot(slotName: string): SlotData | null;
      findSlotIndex(slotName: string): number;
      findSkin(skinName: string): Skin | null;
      findEvent(eventDataName: string): EventData | null;
      findAnimation(animationName: string): Animation | null;
      findIkConstraint(constraintName: string): IkConstraintData | null;
      findTransformConstraint(constraintName: string): TransformConstraintData | null;
      findPathConstraint(constraintName: string): PathConstraintData | null;
    }

    // 骨架
    class Skeleton {
      data: SkeletonData;
      bones: Bone[];
      slots: Slot[];
      drawOrder: Slot[];
      ikConstraints: IkConstraint[];
      transformConstraints: TransformConstraint[];
      pathConstraints: PathConstraint[];
      skin: Skin | null;
      color: Color;
      time: number;
      scaleX: number;
      scaleY: number;
      x: number;
      y: number;

      constructor(data: SkeletonData);
      updateCache(): void;
      updateWorldTransform(): void;
      setToSetupPose(): void;
      setBonesToSetupPose(): void;
      setSlotsToSetupPose(): void;
      getRootBone(): Bone | null;
      findBone(boneName: string): Bone | null;
      findBoneIndex(boneName: string): number;
      findSlot(slotName: string): Slot | null;
      findSlotIndex(slotName: string): number;
      setSkinByName(skinName: string): void;
      setSkin(newSkin: Skin | null): void;
      getAttachmentByName(slotName: string, attachmentName: string): Attachment | null;
      getAttachment(slotIndex: number, attachmentName: string): Attachment | null;
      setAttachment(slotName: string, attachmentName: string | null): void;
      findIkConstraint(constraintName: string): IkConstraint | null;
      findTransformConstraint(constraintName: string): TransformConstraint | null;
      findPathConstraint(constraintName: string): PathConstraint | null;
      getBounds(offset: Vector2, size: Vector2, temp?: number[]): void;
      update(delta: number): void;
    }

    // 骨骼數據
    class BoneData {
      index: number;
      name: string;
      parent: BoneData | null;
      length: number;
      x: number;
      y: number;
      rotation: number;
      scaleX: number;
      scaleY: number;
      shearX: number;
      shearY: number;
      transformMode: TransformMode;
      skinRequired: boolean;
      color: Color;
      constructor(index: number, name: string, parent: BoneData | null);
    }

    // 骨骼
    class Bone {
      data: BoneData;
      skeleton: Skeleton;
      parent: Bone | null;
      children: Bone[];
      x: number;
      y: number;
      rotation: number;
      scaleX: number;
      scaleY: number;
      shearX: number;
      shearY: number;
      ax: number;
      ay: number;
      arotation: number;
      ascaleX: number;
      ascaleY: number;
      ashearX: number;
      ashearY: number;
      appliedValid: boolean;
      a: number;
      b: number;
      c: number;
      d: number;
      worldX: number;
      worldY: number;
      active: boolean;

      constructor(data: BoneData, skeleton: Skeleton, parent: Bone | null);
      update(): void;
      updateWorldTransform(): void;
      updateWorldTransformWith(x: number, y: number, rotation: number, scaleX: number, scaleY: number, shearX: number, shearY: number): void;
      setToSetupPose(): void;
      getWorldRotationX(): number;
      getWorldRotationY(): number;
      getWorldScaleX(): number;
      getWorldScaleY(): number;
      worldToLocal(world: Vector2): Vector2;
      localToWorld(local: Vector2): Vector2;
    }

    // 插槽數據
    class SlotData {
      index: number;
      name: string;
      boneData: BoneData;
      color: Color;
      darkColor: Color | null;
      attachmentName: string | null;
      blendMode: BlendMode;
      constructor(index: number, name: string, boneData: BoneData);
    }

    // 插槽
    class Slot {
      data: SlotData;
      bone: Bone;
      color: Color;
      darkColor: Color | null;
      attachment: Attachment | null;
      attachmentTime: number;
      deform: number[];

      constructor(data: SlotData, bone: Bone);
      getAttachment(): Attachment | null;
      setAttachment(attachment: Attachment | null): void;
      setAttachmentTime(time: number): void;
      getAttachmentTime(): number;
      setToSetupPose(): void;
    }

    // 皮膚
    class Skin {
      name: string;
      attachments: Map<number, Map<string, Attachment>>;
      bones: BoneData[];
      constraints: ConstraintData[];

      constructor(name: string);
      setAttachment(slotIndex: number, name: string, attachment: Attachment): void;
      addSkin(skin: Skin): void;
      copySkin(skin: Skin): void;
      getAttachment(slotIndex: number, name: string): Attachment | null;
      removeAttachment(slotIndex: number, name: string): void;
      getAttachments(): { slotIndex: number; name: string; attachment: Attachment }[];
      getAttachmentsForSlot(slotIndex: number, attachments: { name: string; attachment: Attachment }[]): void;
      clear(): void;
      attachAll(skeleton: Skeleton, oldSkin: Skin): void;
    }

    // 動畫
    class Animation {
      name: string;
      timelines: Timeline[];
      timelineIds: boolean[];
      duration: number;

      constructor(name: string, timelines: Timeline[], duration: number);
      hasTimeline(id: number): boolean;
      apply(skeleton: Skeleton, lastTime: number, time: number, loop: boolean, events: Event[] | null, alpha: number, blend: MixBlend, direction: MixDirection): void;
    }

    // 動畫狀態數據
    class AnimationStateData {
      skeletonData: SkeletonData;
      animationToMixTime: Map<string, number>;
      defaultMix: number;

      constructor(skeletonData: SkeletonData);
      setMix(fromName: string, toName: string, duration: number): void;
      setMixWith(from: Animation, to: Animation, duration: number): void;
      getMix(from: Animation, to: Animation): number;
    }

    // 動畫狀態
    class AnimationState {
      data: AnimationStateData;
      tracks: TrackEntry[];
      timeScale: number;
      listeners: AnimationStateListener[];

      constructor(data: AnimationStateData);
      update(delta: number): void;
      updateMixingFrom(to: TrackEntry, delta: number): boolean;
      apply(skeleton: Skeleton): boolean;
      applyMixingFrom(to: TrackEntry, skeleton: Skeleton, blend: MixBlend): number;
      setAnimation(trackIndex: number, animationName: string, loop: boolean): TrackEntry | null;
      setAnimationWith(trackIndex: number, animation: Animation, loop: boolean): TrackEntry;
      addAnimation(trackIndex: number, animationName: string, loop: boolean, delay: number): TrackEntry | null;
      addAnimationWith(trackIndex: number, animation: Animation, loop: boolean, delay: number): TrackEntry;
      setEmptyAnimation(trackIndex: number, mixDuration: number): TrackEntry;
      addEmptyAnimation(trackIndex: number, mixDuration: number, delay: number): TrackEntry;
      setEmptyAnimations(mixDuration: number): void;
      getCurrent(trackIndex: number): TrackEntry | null;
      addListener(listener: AnimationStateListener): void;
      removeListener(listener: AnimationStateListener): void;
      clearListeners(): void;
      clearTracks(): void;
      clearTrack(trackIndex: number): void;
    }

    // 軌道條目
    class TrackEntry {
      animation: Animation;
      next: TrackEntry | null;
      mixingFrom: TrackEntry | null;
      mixingTo: TrackEntry | null;
      listener: AnimationStateListener | null;
      trackIndex: number;
      loop: boolean;
      holdPrevious: boolean;
      eventThreshold: number;
      attachmentThreshold: number;
      drawOrderThreshold: number;
      animationStart: number;
      animationEnd: number;
      animationLast: number;
      nextAnimationLast: number;
      delay: number;
      trackTime: number;
      trackLast: number;
      nextTrackLast: number;
      trackEnd: number;
      timeScale: number;
      alpha: number;
      mixTime: number;
      mixDuration: number;
      interruptAlpha: number;
      totalAlpha: number;
      mixBlend: MixBlend;

      getAnimationTime(): number;
      setAnimationLast(animationLast: number): void;
      isComplete(): boolean;
      resetRotationDirections(): void;
    }

    // 動畫狀態監聽器
    interface AnimationStateListener {
      start?(entry: TrackEntry): void;
      interrupt?(entry: TrackEntry): void;
      end?(entry: TrackEntry): void;
      dispose?(entry: TrackEntry): void;
      complete?(entry: TrackEntry): void;
      event?(entry: TrackEntry, event: Event): void;
    }

    // 事件數據
    class EventData {
      name: string;
      intValue: number;
      floatValue: number;
      stringValue: string;
      audioPath: string;
      volume: number;
      balance: number;
      constructor(name: string);
    }

    // 事件
    class Event {
      data: EventData;
      intValue: number;
      floatValue: number;
      stringValue: string;
      time: number;
      volume: number;
      balance: number;
      constructor(time: number, data: EventData);
    }

    // 貼圖
    interface Texture {
      getImage(): HTMLImageElement;
      dispose(): void;
    }

    // 貼圖區域
    class TextureRegion {
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

    // 圖集
    class TextureAtlas {
      pages: TextureAtlasPage[];
      regions: TextureAtlasRegion[];

      constructor(atlasText: string, textureLoader: (path: string) => Texture);
      findRegion(name: string): TextureAtlasRegion | null;
      dispose(): void;
    }

    class TextureAtlasPage {
      name: string;
      texture: Texture;
      width: number;
      height: number;
    }

    class TextureAtlasRegion extends TextureRegion {
      page: TextureAtlasPage;
      name: string;
      index: number;
    }

    // 附件載入器
    interface AttachmentLoader {
      newRegionAttachment(skin: Skin, name: string, path: string): RegionAttachment | null;
      newMeshAttachment(skin: Skin, name: string, path: string): MeshAttachment | null;
      newBoundingBoxAttachment(skin: Skin, name: string): BoundingBoxAttachment | null;
      newClippingAttachment(skin: Skin, name: string): ClippingAttachment | null;
      newPathAttachment(skin: Skin, name: string): PathAttachment | null;
      newPointAttachment(skin: Skin, name: string): PointAttachment | null;
    }

    class AtlasAttachmentLoader implements AttachmentLoader {
      atlas: TextureAtlas;
      constructor(atlas: TextureAtlas);
      newRegionAttachment(skin: Skin, name: string, path: string): RegionAttachment | null;
      newMeshAttachment(skin: Skin, name: string, path: string): MeshAttachment | null;
      newBoundingBoxAttachment(skin: Skin, name: string): BoundingBoxAttachment | null;
      newClippingAttachment(skin: Skin, name: string): ClippingAttachment | null;
      newPathAttachment(skin: Skin, name: string): PathAttachment | null;
      newPointAttachment(skin: Skin, name: string): PointAttachment | null;
    }

    // 骨架 JSON 載入器
    class SkeletonJson {
      attachmentLoader: AttachmentLoader;
      scale: number;
      linkedMeshes: any[];
      constructor(attachmentLoader: AttachmentLoader);
      readSkeletonData(json: string | any): SkeletonData;
    }

    // 骨架二進制載入器
    class SkeletonBinary {
      attachmentLoader: AttachmentLoader;
      scale: number;
      linkedMeshes: any[];
      constructor(attachmentLoader: AttachmentLoader);
      readSkeletonData(binary: Uint8Array): SkeletonData;
    }

    // 附件基類
    abstract class Attachment {
      name: string;
      constructor(name: string);
      abstract copy(): Attachment;
    }

    // 區域附件
    class RegionAttachment extends Attachment {
      region: TextureRegion;
      path: string;
      x: number;
      y: number;
      scaleX: number;
      scaleY: number;
      rotation: number;
      width: number;
      height: number;
      color: Color;
      offset: number[];
      uvs: number[];
      tempColor: Color;

      constructor(name: string);
      updateOffset(): void;
      setRegion(region: TextureRegion): void;
      computeWorldVertices(bone: Bone, worldVertices: number[], offset: number, stride: number): void;
      copy(): Attachment;
    }

    // 網格附件
    class MeshAttachment extends Attachment {
      region: TextureRegion;
      path: string;
      regionUVs: number[];
      uvs: number[];
      triangles: number[];
      color: Color;
      width: number;
      height: number;
      hullLength: number;
      edges: number[];
      tempColor: Color;

      constructor(name: string);
      updateUVs(): void;
      copy(): Attachment;
      newLinkedMesh(): MeshAttachment;
    }

    class BoundingBoxAttachment extends Attachment {
      constructor(name: string);
      copy(): Attachment;
    }

    class ClippingAttachment extends Attachment {
      endSlot: SlotData | null;
      constructor(name: string);
      copy(): Attachment;
    }

    class PathAttachment extends Attachment {
      lengths: number[];
      closed: boolean;
      constantSpeed: boolean;
      constructor(name: string);
      copy(): Attachment;
    }

    class PointAttachment extends Attachment {
      x: number;
      y: number;
      rotation: number;
      constructor(name: string);
      computeWorldPosition(bone: Bone, point: Vector2): Vector2;
      computeWorldRotation(bone: Bone): number;
      copy(): Attachment;
    }

    // 約束
    interface ConstraintData {
      name: string;
      order: number;
      skinRequired: boolean;
    }

    class IkConstraintData implements ConstraintData {
      name: string;
      order: number;
      skinRequired: boolean;
      bones: BoneData[];
      target: BoneData;
      bendDirection: number;
      compress: boolean;
      stretch: boolean;
      uniform: boolean;
      mix: number;
      softness: number;
      constructor(name: string);
    }

    class TransformConstraintData implements ConstraintData {
      name: string;
      order: number;
      skinRequired: boolean;
      bones: BoneData[];
      target: BoneData;
      rotateMix: number;
      translateMix: number;
      scaleMix: number;
      shearMix: number;
      offsetRotation: number;
      offsetX: number;
      offsetY: number;
      offsetScaleX: number;
      offsetScaleY: number;
      offsetShearY: number;
      relative: boolean;
      local: boolean;
      constructor(name: string);
    }

    class PathConstraintData implements ConstraintData {
      name: string;
      order: number;
      skinRequired: boolean;
      bones: BoneData[];
      target: SlotData;
      positionMode: PositionMode;
      spacingMode: SpacingMode;
      rotateMode: RotateMode;
      offsetRotation: number;
      position: number;
      spacing: number;
      rotateMix: number;
      translateMix: number;
      constructor(name: string);
    }

    class IkConstraint {
      data: IkConstraintData;
      bones: Bone[];
      target: Bone;
      bendDirection: number;
      compress: boolean;
      stretch: boolean;
      mix: number;
      softness: number;
      active: boolean;
      constructor(data: IkConstraintData, skeleton: Skeleton);
      update(): void;
      apply(): void;
    }

    class TransformConstraint {
      data: TransformConstraintData;
      bones: Bone[];
      target: Bone;
      rotateMix: number;
      translateMix: number;
      scaleMix: number;
      shearMix: number;
      active: boolean;
      constructor(data: TransformConstraintData, skeleton: Skeleton);
      update(): void;
      apply(): void;
    }

    class PathConstraint {
      data: PathConstraintData;
      bones: Bone[];
      target: Slot;
      position: number;
      spacing: number;
      rotateMix: number;
      translateMix: number;
      active: boolean;
      constructor(data: PathConstraintData, skeleton: Skeleton);
      update(): void;
    }

    // 時間線基類
    interface Timeline {
      apply(skeleton: Skeleton, lastTime: number, time: number, events: Event[] | null, alpha: number, blend: MixBlend, direction: MixDirection): void;
      getPropertyId(): number;
    }

    // 枚舉
    enum BlendMode {
      Normal = 0,
      Additive = 1,
      Multiply = 2,
      Screen = 3
    }

    enum TransformMode {
      Normal = 0,
      OnlyTranslation = 1,
      NoRotationOrReflection = 2,
      NoScale = 3,
      NoScaleOrReflection = 4
    }

    enum MixBlend {
      setup = 0,
      first = 1,
      replace = 2,
      add = 3
    }

    enum MixDirection {
      mixIn = 0,
      mixOut = 1
    }

    enum PositionMode {
      Fixed = 0,
      Percent = 1
    }

    enum SpacingMode {
      Length = 0,
      Fixed = 1,
      Percent = 2
    }

    enum RotateMode {
      Tangent = 0,
      Chain = 1,
      ChainScale = 2
    }

    // Canvas 渲染器
    class SkeletonRenderer {
      ctx: CanvasRenderingContext2D;
      triangleRendering: boolean;
      debugRendering: boolean;
      
      constructor(context: CanvasRenderingContext2D);
      draw(skeleton: Skeleton): void;
    }

    // Canvas 貼圖
    class CanvasTexture implements Texture {
      constructor(image: HTMLImageElement);
      getImage(): HTMLImageElement;
      dispose(): void;
    }

    // 資源管理器
    class AssetManager {
      constructor(pathPrefix?: string);
      loadBinary(path: string, success?: (data: Uint8Array) => void, error?: (error: string) => void): void;
      loadText(path: string, success?: (data: string) => void, error?: (error: string) => void): void;
      loadTexture(path: string, success?: (texture: Texture) => void, error?: (error: string) => void): void;
      loadTextureData(path: string, data: string, success?: (texture: Texture) => void, error?: (error: string) => void): void;
      loadTextureAtlas(path: string, success?: (atlas: TextureAtlas) => void, error?: (error: string) => void): void;
      get(path: string): any;
      require(path: string): any;
      remove(path: string): any;
      removeAll(): void;
      isLoadingComplete(): boolean;
      getToLoad(): number;
      getLoaded(): number;
      dispose(): void;
      hasErrors(): boolean;
      getErrors(): Map<string, string>;
    }
  }
}

// 確保全域 spine 存在
if (typeof window !== 'undefined' && !(window as any).spine) {
  (window as any).spine = {};
}

export {};


