/**
 * SpineRuntimeAdapter 單元測試
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SpineWebglRuntimeAdapter, getSpineWebglRuntimeAdapter } from '../../infrastructure/spine-webgl/SpineWebglRuntimeAdapter';

describe('SpineWebglRuntimeAdapter', () => {
  let adapter: SpineWebglRuntimeAdapter;

  const installMockSpineRuntime = () => {
    class Vector2 {
      x = 0;
      y = 0;
      constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
      }
    }

    class CanvasTexture {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      constructor(private image: any) {}
      getImage() {
        return this.image;
      }
      setFilters() {}
      setWraps() {}
      dispose() {}
    }

    class TextureAtlas {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      constructor(_atlasText: string, textureLoader: (path: string) => any) {
        // 讓 textureLoader 至少被呼叫一次，模擬 page texture 建立
        textureLoader('test.png');
      }
      findRegion(_name: string) {
        return { texture: null, renderObject: null };
      }
      dispose() {}
    }

    class AtlasAttachmentLoader {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      constructor(public atlas: any) {}
    }

    const mockSkeletonData = {
      width: 200,
      height: 300,
      version: '3.8.99',
      fps: 30,
      bones: [{ name: 'root' }],
      slots: [{ name: 'root', boneData: { name: 'root' }, attachmentName: null }],
      skins: [{ name: 'default', getAttachments: () => [] }],
      animations: [{ name: 'idle', duration: 1.0 }],
    };

    class SkeletonBinary {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      constructor(_attachmentLoader: any) {}
      scale = 1;
      readSkeletonData(_binary: Uint8Array) {
        return mockSkeletonData;
      }
    }

    class AnimationStateData {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      constructor(public skeletonData: any) {}
      defaultMix = 0.2;
      setMix() {}
    }

    class AnimationState {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      constructor(public data: any) {}
      timeScale = 1;
      tracks: Array<any> = [];
      setAnimation(_trackIndex: number, animationName: string, loop: boolean) {
        const entry = {
          trackIndex: 0,
          loop,
          trackTime: 0,
          animation: { name: animationName, duration: 1.0 },
          isComplete() {
            return !loop && this.trackTime >= this.animation.duration;
          },
        };
        this.tracks[0] = entry;
        return entry;
      }
      update(delta: number) {
        const entry = this.tracks[0];
        if (entry) entry.trackTime += delta;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      apply(_skeleton: any) {
        return true;
      }
      getCurrent(_trackIndex: number) {
        return this.tracks[0] ?? null;
      }
      clearTrack(trackIndex: number) {
        this.tracks[trackIndex] = null;
      }
      clearTracks() {
        this.tracks = [];
      }
      setEmptyAnimation(trackIndex: number) {
        this.clearTrack(trackIndex);
      }
    }

    class Skeleton {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      constructor(public data: any) {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      skin: any = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      slots: any[] = [
        {
          data: { index: 0, name: 'root' },
          bone: { data: { name: 'root' } },
          getAttachment: () => null,
          setAttachment: () => {},
        },
      ];
      bones: Array<any> = [{ parent: null, worldX: 0, worldY: 0 }];
      setToSetupPose() {}
      setSlotsToSetupPose() {}
      updateWorldTransform() {}
      setSkinByName(name: string) {
        this.skin = { name, getAttachments: () => [] };
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getBounds(offset: any, size: any) {
        offset.x = 0;
        offset.y = 0;
        size.x = 200;
        size.y = 300;
      }
      findSlot(slotName: string) {
        return this.slots.find(s => s.data.name === slotName) ?? null;
      }
      setAttachment() {}
    }

    const mockSpine = {
      Vector2,
      canvas: { CanvasTexture },
      TextureAtlas,
      AtlasAttachmentLoader,
      SkeletonBinary,
      Skeleton,
      AnimationStateData,
      AnimationState,
    };

    vi.stubGlobal('spine', mockSpine);
  };

  beforeEach(() => {
    installMockSpineRuntime();
    adapter = getSpineWebglRuntimeAdapter();
    adapter.cleanupAll(); // 清理之前的實例
  });

  afterEach(() => {
    adapter.cleanupAll();
  });

  describe('單例模式', () => {
    it('應該返回相同的實例', () => {
      const adapter1 = getSpineWebglRuntimeAdapter();
      const adapter2 = getSpineWebglRuntimeAdapter();
      expect(adapter1).toBe(adapter2);
    });
  });

  describe('load', () => {
    it('應該成功載入 Spine 骨架', async () => {
      const mockSkelData = new ArrayBuffer(100);
      const mockAtlasText = `
test.png
size: 1024, 1024
format: RGBA8888
filter: Linear, Linear
repeat: none
      `.trim();
      const mockImages = new Map<string, HTMLImageElement>();

      const skeletonInfo = await adapter.load({
        id: 'test-spine',
        skelData: mockSkelData,
        atlasText: mockAtlasText,
        images: mockImages,
      });

      expect(skeletonInfo).toBeDefined();
      expect(skeletonInfo.version).toBe('3.8.99');
      expect(skeletonInfo.animations.length).toBeGreaterThan(0);
      expect(adapter.has('test-spine')).toBe(true);
    });

    it('應該覆蓋已存在的實例', async () => {
      const mockSkelData = new ArrayBuffer(100);
      const mockAtlasText = 'test.png\nsize: 512, 512';
      const mockImages = new Map<string, HTMLImageElement>();

      await adapter.load({
        id: 'test-spine',
        skelData: mockSkelData,
        atlasText: mockAtlasText,
        images: mockImages,
      });

      await adapter.load({
        id: 'test-spine',
        skelData: mockSkelData,
        atlasText: mockAtlasText,
        images: mockImages,
      });

      expect(adapter.getInstanceCount()).toBe(1);
    });
  });

  describe('playAnimation', () => {
    it('應該播放動畫', async () => {
      const mockSkelData = new ArrayBuffer(100);
      const mockAtlasText = 'test.png\nsize: 512, 512';
      const mockImages = new Map<string, HTMLImageElement>();

      await adapter.load({
        id: 'test-spine',
        skelData: mockSkelData,
        atlasText: mockAtlasText,
        images: mockImages,
      });

      adapter.playAnimation('test-spine', 'idle', true);

      const state = adapter.getState('test-spine');
      expect(state?.isPlaying).toBe(true);
      expect(state?.currentAnimation).toBe('idle');
    });

    it('應該忽略不存在的實例', () => {
      // 不應該拋出錯誤
      expect(() => adapter.playAnimation('nonexistent', 'idle', true)).not.toThrow();
    });
  });

  describe('pause / resume / stop', () => {
    beforeEach(async () => {
      const mockSkelData = new ArrayBuffer(100);
      const mockAtlasText = 'test.png\nsize: 512, 512';
      const mockImages = new Map<string, HTMLImageElement>();

      await adapter.load({
        id: 'test-spine',
        skelData: mockSkelData,
        atlasText: mockAtlasText,
        images: mockImages,
      });

      adapter.playAnimation('test-spine', 'idle', true);
    });

    it('應該暫停動畫', () => {
      adapter.pause('test-spine');
      const state = adapter.getState('test-spine');
      expect(state?.isPlaying).toBe(false);
    });

    it('應該繼續動畫', () => {
      adapter.pause('test-spine');
      adapter.resume('test-spine');
      const state = adapter.getState('test-spine');
      expect(state?.isPlaying).toBe(true);
    });

    it('應該停止動畫並重置時間', () => {
      adapter.update('test-spine', 0.5);
      adapter.stop('test-spine');
      const state = adapter.getState('test-spine');
      expect(state?.isPlaying).toBe(false);
      expect(state?.currentTime).toBe(0);
    });
  });

  describe('update', () => {
    it('應該更新動畫時間', async () => {
      const mockSkelData = new ArrayBuffer(100);
      const mockAtlasText = 'test.png\nsize: 512, 512';
      const mockImages = new Map<string, HTMLImageElement>();

      await adapter.load({
        id: 'test-spine',
        skelData: mockSkelData,
        atlasText: mockAtlasText,
        images: mockImages,
      });

      adapter.playAnimation('test-spine', 'idle', true);
      adapter.update('test-spine', 0.5);

      const state = adapter.getState('test-spine');
      expect(state?.currentTime).toBe(0.5);
    });

    it('應該循環播放', async () => {
      const mockSkelData = new ArrayBuffer(100);
      const mockAtlasText = 'test.png\nsize: 512, 512';
      const mockImages = new Map<string, HTMLImageElement>();

      await adapter.load({
        id: 'test-spine',
        skelData: mockSkelData,
        atlasText: mockAtlasText,
        images: mockImages,
      });

      adapter.playAnimation('test-spine', 'idle', true);
      adapter.update('test-spine', 1.5); // 超過動畫時長

      const state = adapter.getState('test-spine');
      expect(state?.currentTime).toBeLessThan(1.0); // 應該循環回來
      expect(state?.isPlaying).toBe(true);
    });

    it('應該在非循環模式下停止播放', async () => {
      const mockSkelData = new ArrayBuffer(100);
      const mockAtlasText = 'test.png\nsize: 512, 512';
      const mockImages = new Map<string, HTMLImageElement>();

      await adapter.load({
        id: 'test-spine',
        skelData: mockSkelData,
        atlasText: mockAtlasText,
        images: mockImages,
      });

      adapter.playAnimation('test-spine', 'idle', false); // loop = false
      adapter.update('test-spine', 1.5); // 超過動畫時長

      const state = adapter.getState('test-spine');
      expect(state?.isPlaying).toBe(false);
    });
  });

  describe('setTimeScale', () => {
    it('應該設定播放速度', async () => {
      const mockSkelData = new ArrayBuffer(100);
      const mockAtlasText = 'test.png\nsize: 512, 512';
      const mockImages = new Map<string, HTMLImageElement>();

      await adapter.load({
        id: 'test-spine',
        skelData: mockSkelData,
        atlasText: mockAtlasText,
        images: mockImages,
      });

      adapter.playAnimation('test-spine', 'idle', true);
      adapter.setTimeScale('test-spine', 2.0);
      adapter.update('test-spine', 0.25);

      const state = adapter.getState('test-spine');
      expect(state?.currentTime).toBe(0.5); // 0.25 * 2.0
    });

    it('應該限制在 0.1 - 2.0 之間', async () => {
      const mockSkelData = new ArrayBuffer(100);
      const mockAtlasText = 'test.png\nsize: 512, 512';
      const mockImages = new Map<string, HTMLImageElement>();

      await adapter.load({
        id: 'test-spine',
        skelData: mockSkelData,
        atlasText: mockAtlasText,
        images: mockImages,
      });

      adapter.setTimeScale('test-spine', 10.0);
      adapter.playAnimation('test-spine', 'idle', true);
      adapter.update('test-spine', 0.1);

      const state = adapter.getState('test-spine');
      expect(state?.currentTime).toBe(0.2); // 0.1 * 2.0 (clamped)
    });
  });

  describe('setSkin', () => {
    it('應該設定 Skin', async () => {
      const mockSkelData = new ArrayBuffer(100);
      const mockAtlasText = 'test.png\nsize: 512, 512';
      const mockImages = new Map<string, HTMLImageElement>();

      await adapter.load({
        id: 'test-spine',
        skelData: mockSkelData,
        atlasText: mockAtlasText,
        images: mockImages,
      });

      // 由於模擬資料只有 default skin，這裡測試不會報錯
      expect(() => adapter.setSkin('test-spine', 'default')).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('應該清理單個實例', async () => {
      const mockSkelData = new ArrayBuffer(100);
      const mockAtlasText = 'test.png\nsize: 512, 512';
      const mockImages = new Map<string, HTMLImageElement>();

      await adapter.load({
        id: 'test-spine-1',
        skelData: mockSkelData,
        atlasText: mockAtlasText,
        images: mockImages,
      });

      await adapter.load({
        id: 'test-spine-2',
        skelData: mockSkelData,
        atlasText: mockAtlasText,
        images: mockImages,
      });

      adapter.cleanup('test-spine-1');

      expect(adapter.has('test-spine-1')).toBe(false);
      expect(adapter.has('test-spine-2')).toBe(true);
    });

    it('應該清理所有實例', async () => {
      const mockSkelData = new ArrayBuffer(100);
      const mockAtlasText = 'test.png\nsize: 512, 512';
      const mockImages = new Map<string, HTMLImageElement>();

      await adapter.load({
        id: 'test-spine-1',
        skelData: mockSkelData,
        atlasText: mockAtlasText,
        images: mockImages,
      });

      await adapter.load({
        id: 'test-spine-2',
        skelData: mockSkelData,
        atlasText: mockAtlasText,
        images: mockImages,
      });

      adapter.cleanupAll();

      expect(adapter.getInstanceCount()).toBe(0);
    });
  });

  describe('事件監聽器', () => {
    it('應該觸發 onStart 事件', async () => {
      const mockSkelData = new ArrayBuffer(100);
      const mockAtlasText = 'test.png\nsize: 512, 512';
      const mockImages = new Map<string, HTMLImageElement>();
      const onStart = vi.fn();

      await adapter.load({
        id: 'test-spine',
        skelData: mockSkelData,
        atlasText: mockAtlasText,
        images: mockImages,
      });

      adapter.addListener({ onStart });
      adapter.playAnimation('test-spine', 'idle', true);

      expect(onStart).toHaveBeenCalledWith('test-spine', 'idle');
    });

    it('應該觸發 onComplete 事件', async () => {
      const mockSkelData = new ArrayBuffer(100);
      const mockAtlasText = 'test.png\nsize: 512, 512';
      const mockImages = new Map<string, HTMLImageElement>();
      const onComplete = vi.fn();

      await adapter.load({
        id: 'test-spine',
        skelData: mockSkelData,
        atlasText: mockAtlasText,
        images: mockImages,
      });

      adapter.addListener({ onComplete });
      adapter.playAnimation('test-spine', 'idle', false);
      adapter.update('test-spine', 1.5); // 超過動畫時長

      expect(onComplete).toHaveBeenCalledWith('test-spine', 'idle');
    });

    it('應該能移除監聽器', async () => {
      const mockSkelData = new ArrayBuffer(100);
      const mockAtlasText = 'test.png\nsize: 512, 512';
      const mockImages = new Map<string, HTMLImageElement>();
      const onStart = vi.fn();
      const listener = { onStart };

      await adapter.load({
        id: 'test-spine',
        skelData: mockSkelData,
        atlasText: mockAtlasText,
        images: mockImages,
      });

      adapter.addListener(listener);
      adapter.removeListener(listener);
      adapter.playAnimation('test-spine', 'idle', true);

      expect(onStart).not.toHaveBeenCalled();
    });
  });
});


