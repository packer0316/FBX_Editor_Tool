/**
 * Spine Runtime 適配器
 * 
 * 封裝 Spine Runtime，提供統一的 API 來管理骨架、動畫狀態等。
 * 使用單例模式確保資源統一管理。
 */

// 匯入本地 Spine Runtime 3.8
import '../../vendor/spine-ts-3.8';

import type {
  SpineSkeletonInfo,
  SpineAnimationInfo,
  SpineSkinInfo,
  SpineSlotInfo,
} from '../../domain/value-objects/SpineInstance';

// ============================================================================
// 類型定義
// ============================================================================

/**
 * 載入參數
 */
export interface SpineLoadParams {
  /** 唯一 ID */
  id: string;
  /** .skel 二進制數據 */
  skelData: ArrayBuffer;
  /** .atlas 文本內容 */
  atlasText: string;
  /** 圖片 Map（檔名 -> Image 或 Data URL） */
  images: Map<string, HTMLImageElement | string>;
}

/**
 * 內部骨架實例
 */
interface SpineRuntimeInstance {
  /** 骨架資訊 */
  skeletonInfo: SpineSkeletonInfo;
  /** 是否已載入 */
  isLoaded: boolean;
  /** 當前動畫 */
  currentAnimation: string | null;
  /** 當前時間 */
  currentTime: number;
  /** 是否循環 */
  loop: boolean;
  /** 播放速度 */
  timeScale: number;
  /** 是否正在播放 */
  isPlaying: boolean;
  /** 當前 Skin */
  currentSkin: string | null;
  
  // Spine Runtime 實例
  skeleton: any | null;
  state: any | null;
  stateData: any | null;
  atlas: any | null;
}

/**
 * 動畫事件監聽器
 */
export interface SpineAnimationListener {
  onStart?: (id: string, animationName: string) => void;
  onComplete?: (id: string, animationName: string) => void;
  onInterrupt?: (id: string, animationName: string) => void;
  onEvent?: (id: string, eventName: string, eventData: unknown) => void;
}

// ============================================================================
// Spine Runtime 適配器
// ============================================================================

export class SpineRuntimeAdapter {
  private static instance: SpineRuntimeAdapter | null = null;
  
  private instances: Map<string, SpineRuntimeInstance> = new Map();
  private listeners: Set<SpineAnimationListener> = new Set();

  static getInstance(): SpineRuntimeAdapter {
    if (!this.instance) {
      this.instance = new SpineRuntimeAdapter();
    }
    return this.instance;
  }

  private constructor() {}

  /**
   * 載入 Spine 骨架
   */
  async load(params: SpineLoadParams): Promise<SpineSkeletonInfo> {
    const { id, skelData, atlasText, images } = params;
    
    if (this.instances.has(id)) {
      this.cleanup(id);
    }

    try {
      // 確保 spine 全域變數存在
      if (typeof spine === 'undefined') {
        throw new Error('Spine Runtime 未載入');
      }

      // 1. 建立貼圖載入器
      const textureLoader = (path: string): any => {
        // 從 images Map 中找到對應的圖片
        const fileName = path.split('/').pop() || path;
        
        // 嘗試多種匹配方式
        let image = images.get(fileName);
        if (!image) {
          // 嘗試不帶路徑的檔名
          for (const [key, img] of images.entries()) {
            if (key.toLowerCase() === fileName.toLowerCase() || 
                key.toLowerCase().endsWith(fileName.toLowerCase())) {
              image = img;
              break;
            }
          }
        }
        
        if (!image) {
          console.warn(`[SpineRuntimeAdapter] 找不到圖片: ${fileName}, 可用: ${Array.from(images.keys()).join(', ')}`);
          // 返回一個空的 CanvasTexture
          const canvas = document.createElement('canvas');
          canvas.width = 1;
          canvas.height = 1;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ff00ff';
            ctx.fillRect(0, 0, 1, 1);
          }
          const img = new Image();
          img.src = canvas.toDataURL();
          return new spine.canvas.CanvasTexture(img);
        }
        
        // 圖片載入成功
        
        if (typeof image === 'string') {
          // Data URL - 需要先載入為 HTMLImageElement
          const img = new Image();
          img.src = image;
          return new spine.canvas.CanvasTexture(img);
        }
        
        return new spine.canvas.CanvasTexture(image);
      };

      // 2. 建立 TextureAtlas
      const atlas = new spine.TextureAtlas(atlasText, textureLoader);
      
      // 3. 建立 AtlasAttachmentLoader
      const attachmentLoader = new spine.AtlasAttachmentLoader(atlas);
      
      // 4. 建立 SkeletonBinary 並讀取骨架數據
      const skeletonBinary = new spine.SkeletonBinary(attachmentLoader);
      skeletonBinary.scale = 1;
      
      const skeletonData = skeletonBinary.readSkeletonData(new Uint8Array(skelData));
      
      // 5. 建立 Skeleton
      const skeleton = new spine.Skeleton(skeletonData);
      skeleton.setToSetupPose();
      skeleton.updateWorldTransform();
      
      // 6. 建立 AnimationStateData 和 AnimationState
      const stateData = new spine.AnimationStateData(skeletonData);
      stateData.defaultMix = 0.2;
      const state = new spine.AnimationState(stateData);

      // 7. 提取骨架資訊
      const skeletonInfo = this.extractSkeletonInfo(skeletonData);
      
      // 8. 建立實例
      const instance: SpineRuntimeInstance = {
        skeletonInfo,
        isLoaded: true,
        currentAnimation: skeletonInfo.animations[0]?.name ?? null,
        currentTime: 0,
        loop: true,
        timeScale: 1.0,
        isPlaying: false,
        currentSkin: skeletonInfo.skins[0]?.name ?? null,
        skeleton,
        state,
        stateData,
        atlas,
      };
      
      // 設定預設動畫
      if (instance.currentAnimation) {
        state.setAnimation(0, instance.currentAnimation, true);
      }
      
      // 設定預設 Skin
      if (instance.currentSkin) {
        skeleton.setSkinByName(instance.currentSkin);
        skeleton.setSlotsToSetupPose();
      }
      
      this.instances.set(id, instance);
      
      console.log(`[SpineRuntimeAdapter] 載入成功: ${id}, 動畫: ${skeletonInfo.animations.map(a => a.name).join(', ')}`);
      return skeletonInfo;
      
    } catch (error) {
      console.error(`[SpineRuntimeAdapter] 載入失敗: ${id}`, error);
      throw error;
    }
  }

  /**
   * 從 SkeletonData 提取骨架資訊
   */
  private extractSkeletonInfo(skeletonData: any): SpineSkeletonInfo {
    // 提取動畫
    const animations: SpineAnimationInfo[] = skeletonData.animations.map((anim: any) => ({
      name: anim.name,
      duration: anim.duration,
      frameCount: Math.ceil(anim.duration * 30), // 假設 30 FPS
    }));

    // 提取皮膚
    const skins: SpineSkinInfo[] = skeletonData.skins.map((skin: any) => ({
      name: skin.name,
    }));

    // 提取插槽
    const slots: SpineSlotInfo[] = skeletonData.slots.map((slot: any, index: number) => ({
      index,
      name: slot.name,
      boneName: slot.boneData.name,
      attachment: slot.attachmentName,
      attachments: [], // 可以從 skin 中提取
    }));

    return {
      width: skeletonData.width || 200,
      height: skeletonData.height || 200,
      version: skeletonData.version || '3.8',
      fps: skeletonData.fps || 30,
      animations,
      skins,
      slots,
      boneCount: skeletonData.bones.length,
    };
  }

  /**
   * 播放動畫
   */
  playAnimation(id: string, animationName: string, loop: boolean = true): void {
    const instance = this.instances.get(id);
    if (!instance || !instance.state) {
      console.warn(`[SpineRuntimeAdapter] 找不到實例: ${id}`);
      return;
    }
    
    // 驗證動畫是否存在
    const animation = instance.skeletonInfo.animations.find(a => a.name === animationName);
    if (!animation) {
      console.warn(`[SpineRuntimeAdapter] 找不到動畫: ${animationName}`);
      return;
    }
    
    instance.state.setAnimation(0, animationName, loop);
    instance.currentAnimation = animationName;
    instance.loop = loop;
    instance.currentTime = 0;
    instance.isPlaying = true;
    
    this.notifyListeners('onStart', id, animationName);
    console.log(`[SpineRuntimeAdapter] 播放動畫: ${id} -> ${animationName} (loop=${loop})`);
  }

  /**
   * 暫停動畫
   */
  pause(id: string): void {
    const instance = this.instances.get(id);
    if (instance) {
      instance.isPlaying = false;
    }
  }

  /**
   * 繼續動畫
   */
  resume(id: string): void {
    const instance = this.instances.get(id);
    if (instance) {
      instance.isPlaying = true;
    }
  }

  /**
   * 停止動畫
   */
  stop(id: string): void {
    const instance = this.instances.get(id);
    if (instance) {
      instance.isPlaying = false;
      instance.currentTime = 0;
      if (instance.state) {
        instance.state.setEmptyAnimation(0, 0);
      }
    }
  }

  /**
   * 清除單一實例的所有動畫軌道
   * 
   * 用於完全停止動畫，清除所有混合和佇列
   */
  clearTrack(id: string, trackIndex: number = 0): void {
    const instance = this.instances.get(id);
    if (instance?.state) {
      instance.state.clearTrack(trackIndex);
      instance.isPlaying = false;
      instance.currentTime = 0;
      instance.currentAnimation = null;
    }
  }

  /**
   * 清除所有實例的動畫軌道
   * 
   * 用於 Director Mode 停止時，確保所有 Spine 動畫完全停止
   */
  clearAllTracks(): void {
    for (const [id, instance] of this.instances) {
      if (instance.state) {
        instance.state.clearTracks();
        instance.isPlaying = false;
        instance.currentTime = 0;
        instance.currentAnimation = null;
        
        // 重置骨架到設定姿勢
        if (instance.skeleton) {
          instance.skeleton.setToSetupPose();
        }
      }
    }
    console.log('[SpineRuntimeAdapter] 清除所有實例的動畫軌道');
  }

  /**
   * 設定播放速度
   */
  setTimeScale(id: string, timeScale: number): void {
    const instance = this.instances.get(id);
    if (instance) {
      instance.timeScale = Math.max(0.1, Math.min(2.0, timeScale));
      if (instance.state) {
        instance.state.timeScale = instance.timeScale;
      }
    }
  }

  /**
   * 設定 Skin
   */
  setSkin(id: string, skinName: string): void {
    const instance = this.instances.get(id);
    if (!instance || !instance.skeleton) return;
    
    const skin = instance.skeletonInfo.skins.find(s => s.name === skinName);
    if (!skin) {
      console.warn(`[SpineRuntimeAdapter] 找不到 Skin: ${skinName}`);
      return;
    }
    
    instance.skeleton.setSkinByName(skinName);
    instance.skeleton.setSlotsToSetupPose();
    instance.currentSkin = skinName;
    console.log(`[SpineRuntimeAdapter] 設定 Skin: ${id} -> ${skinName}`);
  }

  /**
   * 跳轉到指定時間（暫停時也會更新骨架姿勢）
   */
  seek(id: string, time: number): void {
    const instance = this.instances.get(id);
    if (!instance || !instance.currentAnimation) return;
    
    const animation = instance.skeletonInfo.animations.find(
      a => a.name === instance.currentAnimation
    );
    if (!animation) return;
    
    instance.currentTime = Math.max(0, Math.min(time, animation.duration));
    
    // 更新動畫狀態到指定時間
    if (instance.state && instance.skeleton) {
      const track = instance.state.getCurrent(0);
      if (track) {
        track.trackTime = instance.currentTime;
      }
      
      // 關鍵：應用動畫狀態到骨架並更新世界變換
      // 這樣暫停時拖動進度條也能看到對應的姿勢
      instance.state.apply(instance.skeleton);
      instance.skeleton.updateWorldTransform();
    }
  }

  /**
   * 更新動畫
   */
  update(id: string, deltaTime: number): void {
    const instance = this.instances.get(id);
    if (!instance || !instance.isPlaying || !instance.state || !instance.skeleton) return;
    
    // 更新動畫狀態
    instance.state.update(deltaTime * instance.timeScale);
    instance.state.apply(instance.skeleton);
    instance.skeleton.updateWorldTransform();
    
    // 更新當前時間
    const track = instance.state.getCurrent(0);
    if (track) {
      instance.currentTime = track.trackTime % (track.animation?.duration || 1);
      
      // 檢查動畫完成
      if (!instance.loop && track.isComplete()) {
        instance.isPlaying = false;
        this.notifyListeners('onComplete', id, instance.currentAnimation || '');
      }
    }
  }

  /**
   * 取得 Skeleton（用於渲染）
   */
  getSkeleton(id: string): any | null {
    return this.instances.get(id)?.skeleton ?? null;
  }

  /**
   * 取得實例狀態
   */
  getState(id: string): {
    isPlaying: boolean;
    currentTime: number;
    currentAnimation: string | null;
    duration: number;
  } | null {
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

  /**
   * 取得骨架資訊
   */
  getSkeletonInfo(id: string): SpineSkeletonInfo | null {
    return this.instances.get(id)?.skeletonInfo ?? null;
  }

  /**
   * 檢查實例是否存在
   */
  has(id: string): boolean {
    return this.instances.has(id);
  }

  /**
   * 添加事件監聽器
   */
  addListener(listener: SpineAnimationListener): void {
    this.listeners.add(listener);
  }

  /**
   * 移除事件監聯器
   */
  removeListener(listener: SpineAnimationListener): void {
    this.listeners.delete(listener);
  }

  /**
   * 通知監聽器
   */
  private notifyListeners(
    event: keyof SpineAnimationListener,
    id: string,
    animationOrEventName: string,
    eventData?: unknown
  ): void {
    for (const listener of this.listeners) {
      const handler = listener[event];
      if (handler) {
        if (event === 'onEvent') {
          (handler as (id: string, eventName: string, eventData: unknown) => void)(
            id,
            animationOrEventName,
            eventData
          );
        } else {
          (handler as (id: string, animationName: string) => void)(id, animationOrEventName);
        }
      }
    }
  }

  /**
   * 清理單個實例
   */
  cleanup(id: string): void {
    const instance = this.instances.get(id);
    if (!instance) return;
    
    // 清理 Spine Runtime 資源
    if (instance.atlas) {
      instance.atlas.dispose();
    }
    
    this.instances.delete(id);
    console.log(`[SpineRuntimeAdapter] 清理實例: ${id}`);
  }

  /**
   * 清理所有實例
   */
  cleanupAll(): void {
    for (const id of this.instances.keys()) {
      this.cleanup(id);
    }
    this.listeners.clear();
    console.log('[SpineRuntimeAdapter] 清理所有實例');
  }

  /**
   * 取得所有實例 ID
   */
  getAllIds(): string[] {
    return Array.from(this.instances.keys());
  }

  /**
   * 取得實例數量
   */
  getInstanceCount(): number {
    return this.instances.size;
  }

  // ============================================================================
  // Slot 控制
  // ============================================================================

  /**
   * 設定 Slot 的 Attachment
   */
  setSlotAttachment(id: string, slotName: string, attachmentName: string | null): void {
    const instance = this.instances.get(id);
    if (!instance || !instance.skeleton) return;
    
    const slot = instance.skeleton.findSlot(slotName);
    if (!slot) {
      console.warn(`[SpineRuntimeAdapter] 找不到 Slot: ${slotName}`);
      return;
    }
    
    if (attachmentName === null) {
      slot.setAttachment(null);
    } else {
      const attachment = instance.skeleton.getAttachment(slot.data.index, attachmentName);
      if (attachment) {
        slot.setAttachment(attachment);
      } else {
        console.warn(`[SpineRuntimeAdapter] 找不到 Attachment: ${attachmentName} in Slot: ${slotName}`);
      }
    }
    
    instance.skeleton.updateWorldTransform();
  }

  /**
   * 取得 Slot 的當前 Attachment 名稱
   */
  getSlotAttachment(id: string, slotName: string): string | null {
    const instance = this.instances.get(id);
    if (!instance || !instance.skeleton) return null;
    
    const slot = instance.skeleton.findSlot(slotName);
    return slot?.getAttachment()?.name ?? null;
  }

  /**
   * 取得 Slot 的可用 Attachments（從當前 Skin 提取）
   */
  getSlotAttachments(id: string, slotName: string): string[] {
    const instance = this.instances.get(id);
    if (!instance || !instance.skeleton) return [];
    
    const slot = instance.skeleton.findSlot(slotName);
    if (!slot) return [];
    
    const skin = instance.skeleton.skin || instance.skeleton.data.defaultSkin;
    if (!skin) return [];
    
    const attachments: string[] = [];
    
    // Spine 3.8 API: skin.getAttachments() 或遍歷
    try {
      const skinAttachments = skin.getAttachments();
      for (let i = 0; i < skinAttachments.length; i++) {
        const entry = skinAttachments[i];
        if (entry.slotIndex === slot.data.index) {
          attachments.push(entry.name);
        }
      }
    } catch {
      // 備用方案：嘗試從 entries 陣列獲取
      if (skin.attachments) {
        for (const slotAttachments of skin.attachments) {
          if (slotAttachments) {
            for (const name of Object.keys(slotAttachments)) {
              attachments.push(name);
            }
          }
        }
      }
    }
    
    return attachments;
  }

  /**
   * 取得所有 Slots 的即時狀態（包含當前 attachment）
   */
  getSlotsState(id: string): Array<{
    index: number;
    name: string;
    boneName: string;
    currentAttachment: string | null;
    availableAttachments: string[];
  }> {
    const instance = this.instances.get(id);
    if (!instance || !instance.skeleton) return [];
    
    const skeleton = instance.skeleton;
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
}

export const getSpineRuntimeAdapter = (): SpineRuntimeAdapter => {
  return SpineRuntimeAdapter.getInstance();
};
