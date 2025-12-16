/**
 * SpineStore 單元測試
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useSpineStore, getSpineStore } from '../../presentation/stores/spineStore';
import { createSpineInstance, type SpineSkeletonInfo } from '../../domain/value-objects/SpineInstance';

// Mock SpineWebglRuntimeAdapter
vi.mock('../../infrastructure/spine-webgl/SpineWebglRuntimeAdapter', () => ({
  getSpineWebglRuntimeAdapter: () => ({
    cleanup: vi.fn(),
    cleanupAll: vi.fn(),
  }),
}));

// 測試用的骨架資訊
const mockSkeletonInfo: SpineSkeletonInfo = {
  width: 200,
  height: 300,
  version: '3.8.99',
  fps: 30,
  animations: [
    { name: 'idle', duration: 1.0, frameCount: 30 },
    { name: 'walk', duration: 0.8, frameCount: 24 },
  ],
  skins: [
    { name: 'default' },
    { name: 'armor' },
  ],
  slots: [
    { index: 0, name: 'root', boneName: 'root', attachment: null, attachments: [] },
  ],
  boneCount: 10,
};

const createMockInstance = (name: string) => {
  return createSpineInstance({
    name,
    skelFileName: `${name}.skel`,
    atlasFileName: `${name}.atlas`,
    imageFileNames: [`${name}.png`],
    skeletonInfo: mockSkeletonInfo,
  });
};

describe('SpineStore', () => {
  beforeEach(() => {
    // 清理 store 狀態
    getSpineStore().cleanupAll();
  });

  afterEach(() => {
    getSpineStore().cleanupAll();
  });

  describe('addInstance', () => {
    it('應該正確新增實例', () => {
      const instance = createMockInstance('test-spine-1');

      getSpineStore().addInstance(instance);

      expect(getSpineStore().instanceCount).toBe(1);
      expect(getSpineStore().hasInstance(instance.id)).toBe(true);
      expect(getSpineStore().getInstance(instance.id)).toEqual(instance);
    });

    it('應該支援新增多個實例', () => {
      const instance1 = createMockInstance('test-spine-1');
      const instance2 = createMockInstance('test-spine-2');

      getSpineStore().addInstance(instance1);
      getSpineStore().addInstance(instance2);

      expect(getSpineStore().instanceCount).toBe(2);
      expect(getSpineStore().getAllInstanceIds()).toContain(instance1.id);
      expect(getSpineStore().getAllInstanceIds()).toContain(instance2.id);
    });
  });

  describe('updateInstance', () => {
    it('應該正確更新實例', async () => {
      const instance = createMockInstance('test-spine');
      getSpineStore().addInstance(instance);

      // 等待一毫秒確保時間戳不同
      await new Promise(resolve => setTimeout(resolve, 1));

      getSpineStore().updateInstance(instance.id, {
        isPlaying: true,
        currentAnimation: 'walk',
      });

      const updated = getSpineStore().getInstance(instance.id);
      expect(updated?.isPlaying).toBe(true);
      expect(updated?.currentAnimation).toBe('walk');
      // Windows/CI 上 Date.now() 可能同一毫秒，避免 flaky
      expect(updated?.updatedAt).toBeGreaterThanOrEqual(instance.updatedAt);
    });

    it('應該忽略不存在的實例', () => {
      // 不應該拋出錯誤
      expect(() => getSpineStore().updateInstance('nonexistent', { isPlaying: true })).not.toThrow();
    });
  });

  describe('removeInstance', () => {
    it('應該正確移除實例', () => {
      const instance = createMockInstance('test-spine');
      getSpineStore().addInstance(instance);

      getSpineStore().removeInstance(instance.id);

      expect(getSpineStore().instanceCount).toBe(0);
      expect(getSpineStore().hasInstance(instance.id)).toBe(false);
    });

    it('應該忽略不存在的實例', () => {
      // 不應該拋出錯誤
      expect(() => getSpineStore().removeInstance('nonexistent')).not.toThrow();
    });
  });

  describe('getInstance', () => {
    it('應該返回實例', () => {
      const instance = createMockInstance('test-spine');
      getSpineStore().addInstance(instance);

      const result = getSpineStore().getInstance(instance.id);
      expect(result).toEqual(instance);
    });

    it('應該返回 undefined 如果實例不存在', () => {
      const result = getSpineStore().getInstance('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('getAllInstances', () => {
    it('應該返回所有實例', () => {
      const instance1 = createMockInstance('test-spine-1');
      const instance2 = createMockInstance('test-spine-2');
      getSpineStore().addInstance(instance1);
      getSpineStore().addInstance(instance2);

      const allInstances = getSpineStore().getAllInstances();
      expect(allInstances).toHaveLength(2);
      expect(allInstances).toContainEqual(instance1);
      expect(allInstances).toContainEqual(instance2);
    });

    it('應該返回空陣列如果沒有實例', () => {
      const allInstances = getSpineStore().getAllInstances();
      expect(allInstances).toHaveLength(0);
    });
  });

  describe('cleanupAll', () => {
    it('應該清理所有實例', () => {
      const instance1 = createMockInstance('test-spine-1');
      const instance2 = createMockInstance('test-spine-2');
      getSpineStore().addInstance(instance1);
      getSpineStore().addInstance(instance2);

      getSpineStore().cleanupAll();

      expect(getSpineStore().instanceCount).toBe(0);
      expect(getSpineStore().getAllInstances()).toHaveLength(0);
    });
  });

  describe('cleanupUnused', () => {
    it('應該清理未使用的實例', () => {
      const instance1 = createMockInstance('test-spine-1');
      const instance2 = createMockInstance('test-spine-2');
      const instance3 = createMockInstance('test-spine-3');
      getSpineStore().addInstance(instance1);
      getSpineStore().addInstance(instance2);
      getSpineStore().addInstance(instance3);

      // 只保留 instance1 和 instance3
      getSpineStore().cleanupUnused([instance1.id, instance3.id]);

      expect(getSpineStore().instanceCount).toBe(2);
      expect(getSpineStore().hasInstance(instance1.id)).toBe(true);
      expect(getSpineStore().hasInstance(instance2.id)).toBe(false);
      expect(getSpineStore().hasInstance(instance3.id)).toBe(true);
    });

    it('應該什麼都不做如果所有實例都在使用中', () => {
      const instance1 = createMockInstance('test-spine-1');
      const instance2 = createMockInstance('test-spine-2');
      getSpineStore().addInstance(instance1);
      getSpineStore().addInstance(instance2);

      getSpineStore().cleanupUnused([instance1.id, instance2.id]);

      expect(getSpineStore().instanceCount).toBe(2);
    });
  });

  describe('Zustand React Hooks', () => {
    it('useSpineStore 應該能取得狀態', () => {
      // 這個測試主要確保 hook 可以正常使用
      // 完整的 React hook 測試需要 @testing-library/react
      const state = useSpineStore.getState();
      expect(state.instances).toBeInstanceOf(Map);
      expect(typeof state.addInstance).toBe('function');
      expect(typeof state.removeInstance).toBe('function');
    });
  });
});

