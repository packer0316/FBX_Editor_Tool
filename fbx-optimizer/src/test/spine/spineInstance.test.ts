/**
 * SpineInstance 單元測試
 */

import { describe, it, expect } from 'vitest';
import {
  createSpineInstance,
  updateSpineInstance,
  getAnimationInfo,
  getSkinInfo,
  getSlotInfo,
  getCurrentAnimationDuration,
  getCurrentAnimationFrameCount,
  type SpineSkeletonInfo,
} from '../../domain/value-objects/SpineInstance';

// 測試用的骨架資訊
const mockSkeletonInfo: SpineSkeletonInfo = {
  width: 200,
  height: 300,
  version: '3.8.99',
  fps: 30,
  animations: [
    { name: 'idle', duration: 1.0, frameCount: 30 },
    { name: 'walk', duration: 0.8, frameCount: 24 },
    { name: 'run', duration: 0.5, frameCount: 15 },
  ],
  skins: [
    { name: 'default' },
    { name: 'armor' },
  ],
  slots: [
    { index: 0, name: 'root', boneName: 'root', attachment: null, attachments: [] },
    { index: 1, name: 'body', boneName: 'spine', attachment: 'body', attachments: ['body', 'body2'] },
  ],
  boneCount: 10,
};

describe('SpineInstance', () => {
  describe('createSpineInstance', () => {
    it('應該正確建立 SpineInstance', () => {
      const instance = createSpineInstance({
        name: 'test-spine',
        skelFileName: 'test.skel',
        atlasFileName: 'test.atlas',
        imageFileNames: ['test.png'],
        skeletonInfo: mockSkeletonInfo,
      });

      expect(instance.id).toMatch(/^spine_\d+_[a-z0-9]+$/);
      expect(instance.name).toBe('test-spine');
      expect(instance.skelFileName).toBe('test.skel');
      expect(instance.atlasFileName).toBe('test.atlas');
      expect(instance.imageFileNames).toEqual(['test.png']);
      expect(instance.skeletonInfo).toEqual(mockSkeletonInfo);
    });

    it('應該預設選擇第一個動畫和 Skin', () => {
      const instance = createSpineInstance({
        name: 'test-spine',
        skelFileName: 'test.skel',
        atlasFileName: 'test.atlas',
        imageFileNames: ['test.png'],
        skeletonInfo: mockSkeletonInfo,
      });

      expect(instance.currentAnimation).toBe('idle');
      expect(instance.currentSkin).toBe('default');
    });

    it('應該正確初始化播放狀態', () => {
      const instance = createSpineInstance({
        name: 'test-spine',
        skelFileName: 'test.skel',
        atlasFileName: 'test.atlas',
        imageFileNames: ['test.png'],
        skeletonInfo: mockSkeletonInfo,
      });

      expect(instance.isPlaying).toBe(false);
      expect(instance.currentTime).toBe(0);
      expect(instance.loop).toBe(true);
      expect(instance.timeScale).toBe(1.0);
    });
  });

  describe('updateSpineInstance', () => {
    it('應該正確更新屬性', async () => {
      const instance = createSpineInstance({
        name: 'test-spine',
        skelFileName: 'test.skel',
        atlasFileName: 'test.atlas',
        imageFileNames: ['test.png'],
        skeletonInfo: mockSkeletonInfo,
      });

      // 等待一毫秒確保時間戳不同
      await new Promise(resolve => setTimeout(resolve, 1));

      const updated = updateSpineInstance(instance, {
        isPlaying: true,
        currentTime: 0.5,
        currentAnimation: 'walk',
      });

      expect(updated.isPlaying).toBe(true);
      expect(updated.currentTime).toBe(0.5);
      expect(updated.currentAnimation).toBe('walk');
      expect(updated.updatedAt).toBeGreaterThanOrEqual(instance.updatedAt);
    });

    it('應該保留未更新的屬性', () => {
      const instance = createSpineInstance({
        name: 'test-spine',
        skelFileName: 'test.skel',
        atlasFileName: 'test.atlas',
        imageFileNames: ['test.png'],
        skeletonInfo: mockSkeletonInfo,
      });

      const updated = updateSpineInstance(instance, {
        name: 'new-name',
      });

      expect(updated.name).toBe('new-name');
      expect(updated.skelFileName).toBe(instance.skelFileName);
      expect(updated.skeletonInfo).toEqual(instance.skeletonInfo);
    });
  });

  describe('getAnimationInfo', () => {
    it('應該正確取得動畫資訊', () => {
      const instance = createSpineInstance({
        name: 'test-spine',
        skelFileName: 'test.skel',
        atlasFileName: 'test.atlas',
        imageFileNames: ['test.png'],
        skeletonInfo: mockSkeletonInfo,
      });

      const animation = getAnimationInfo(instance, 'walk');
      expect(animation).toEqual({ name: 'walk', duration: 0.8, frameCount: 24 });
    });

    it('應該返回 null 如果動畫不存在', () => {
      const instance = createSpineInstance({
        name: 'test-spine',
        skelFileName: 'test.skel',
        atlasFileName: 'test.atlas',
        imageFileNames: ['test.png'],
        skeletonInfo: mockSkeletonInfo,
      });

      const animation = getAnimationInfo(instance, 'nonexistent');
      expect(animation).toBeNull();
    });
  });

  describe('getSkinInfo', () => {
    it('應該正確取得 Skin 資訊', () => {
      const instance = createSpineInstance({
        name: 'test-spine',
        skelFileName: 'test.skel',
        atlasFileName: 'test.atlas',
        imageFileNames: ['test.png'],
        skeletonInfo: mockSkeletonInfo,
      });

      const skin = getSkinInfo(instance, 'armor');
      expect(skin).toEqual({ name: 'armor' });
    });

    it('應該返回 null 如果 Skin 不存在', () => {
      const instance = createSpineInstance({
        name: 'test-spine',
        skelFileName: 'test.skel',
        atlasFileName: 'test.atlas',
        imageFileNames: ['test.png'],
        skeletonInfo: mockSkeletonInfo,
      });

      const skin = getSkinInfo(instance, 'nonexistent');
      expect(skin).toBeNull();
    });
  });

  describe('getSlotInfo', () => {
    it('應該正確取得 Slot 資訊', () => {
      const instance = createSpineInstance({
        name: 'test-spine',
        skelFileName: 'test.skel',
        atlasFileName: 'test.atlas',
        imageFileNames: ['test.png'],
        skeletonInfo: mockSkeletonInfo,
      });

      const slot = getSlotInfo(instance, 'body');
      expect(slot).toEqual({
        index: 1,
        name: 'body',
        boneName: 'spine',
        attachment: 'body',
        attachments: ['body', 'body2'],
      });
    });
  });

  describe('getCurrentAnimationDuration', () => {
    it('應該返回當前動畫的時長', () => {
      const instance = createSpineInstance({
        name: 'test-spine',
        skelFileName: 'test.skel',
        atlasFileName: 'test.atlas',
        imageFileNames: ['test.png'],
        skeletonInfo: mockSkeletonInfo,
      });

      const duration = getCurrentAnimationDuration(instance);
      expect(duration).toBe(1.0); // idle animation
    });

    it('應該返回 0 如果沒有當前動畫', () => {
      const instance = createSpineInstance({
        name: 'test-spine',
        skelFileName: 'test.skel',
        atlasFileName: 'test.atlas',
        imageFileNames: ['test.png'],
        skeletonInfo: { ...mockSkeletonInfo, animations: [] },
      });

      const duration = getCurrentAnimationDuration(instance);
      expect(duration).toBe(0);
    });
  });

  describe('getCurrentAnimationFrameCount', () => {
    it('應該返回當前動畫的幀數', () => {
      const instance = createSpineInstance({
        name: 'test-spine',
        skelFileName: 'test.skel',
        atlasFileName: 'test.atlas',
        imageFileNames: ['test.png'],
        skeletonInfo: mockSkeletonInfo,
      });

      const frameCount = getCurrentAnimationFrameCount(instance);
      expect(frameCount).toBe(30); // idle animation
    });
  });
});

