/**
 * Loop Region 單元測試
 * 測試區間播放功能的 Store actions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useDirectorStore } from '../../presentation/stores/directorStore';

describe('Loop Region', () => {
  beforeEach(() => {
    // 重置 store 到初始狀態
    useDirectorStore.getState().reset();
  });

  describe('初始狀態', () => {
    it('loopRegion 應該有正確的初始值', () => {
      const { timeline } = useDirectorStore.getState();
      
      expect(timeline.loopRegion).toEqual({
        inPoint: null,
        outPoint: null,
        enabled: false,
      });
    });
  });

  describe('setInPoint', () => {
    it('應該設定入點', () => {
      const store = useDirectorStore.getState();
      
      store.setInPoint(30);
      
      const { timeline } = useDirectorStore.getState();
      expect(timeline.loopRegion.inPoint).toBe(30);
      expect(timeline.loopRegion.enabled).toBe(true);
    });

    it('應該清除入點當傳入 null', () => {
      const store = useDirectorStore.getState();
      
      store.setInPoint(30);
      store.setInPoint(null);
      
      const { timeline } = useDirectorStore.getState();
      expect(timeline.loopRegion.inPoint).toBe(null);
    });

    it('應該限制入點在 0 到 totalFrames 之間', () => {
      const store = useDirectorStore.getState();
      
      store.setInPoint(-10);
      expect(useDirectorStore.getState().timeline.loopRegion.inPoint).toBe(0);
      
      store.setInPoint(9999);
      const { timeline } = useDirectorStore.getState();
      expect(timeline.loopRegion.inPoint).toBeLessThanOrEqual(timeline.totalFrames);
    });

    it('當入點大於出點時應該交換', () => {
      const store = useDirectorStore.getState();
      
      store.setOutPoint(50);
      store.setInPoint(100);
      
      const { timeline } = useDirectorStore.getState();
      expect(timeline.loopRegion.inPoint).toBe(50);
      expect(timeline.loopRegion.outPoint).toBe(100);
    });
  });

  describe('setOutPoint', () => {
    it('應該設定出點', () => {
      const store = useDirectorStore.getState();
      
      store.setOutPoint(100);
      
      const { timeline } = useDirectorStore.getState();
      expect(timeline.loopRegion.outPoint).toBe(100);
      expect(timeline.loopRegion.enabled).toBe(true);
    });

    it('應該清除出點當傳入 null', () => {
      const store = useDirectorStore.getState();
      
      store.setOutPoint(100);
      store.setOutPoint(null);
      
      const { timeline } = useDirectorStore.getState();
      expect(timeline.loopRegion.outPoint).toBe(null);
    });

    it('應該限制出點在 0 到 totalFrames 之間', () => {
      const store = useDirectorStore.getState();
      
      store.setOutPoint(-10);
      expect(useDirectorStore.getState().timeline.loopRegion.outPoint).toBe(0);
      
      store.setOutPoint(9999);
      const { timeline } = useDirectorStore.getState();
      expect(timeline.loopRegion.outPoint).toBeLessThanOrEqual(timeline.totalFrames);
    });

    it('當出點小於入點時應該交換', () => {
      const store = useDirectorStore.getState();
      
      store.setInPoint(100);
      store.setOutPoint(50);
      
      const { timeline } = useDirectorStore.getState();
      expect(timeline.loopRegion.inPoint).toBe(50);
      expect(timeline.loopRegion.outPoint).toBe(100);
    });
  });

  describe('clearLoopRegion', () => {
    it('應該清除所有區間設定', () => {
      const store = useDirectorStore.getState();
      
      store.setInPoint(30);
      store.setOutPoint(100);
      store.clearLoopRegion();
      
      const { timeline } = useDirectorStore.getState();
      expect(timeline.loopRegion).toEqual({
        inPoint: null,
        outPoint: null,
        enabled: false,
      });
    });
  });

  describe('toggleLoopRegion', () => {
    it('應該切換區間啟用狀態', () => {
      const store = useDirectorStore.getState();
      
      store.setInPoint(30);
      store.setOutPoint(100);
      expect(useDirectorStore.getState().timeline.loopRegion.enabled).toBe(true);
      
      store.toggleLoopRegion();
      expect(useDirectorStore.getState().timeline.loopRegion.enabled).toBe(false);
      
      store.toggleLoopRegion();
      expect(useDirectorStore.getState().timeline.loopRegion.enabled).toBe(true);
    });
  });

  describe('區間有效性', () => {
    it('只有入點時區間應該啟用', () => {
      const store = useDirectorStore.getState();
      
      store.setInPoint(30);
      
      const { timeline } = useDirectorStore.getState();
      expect(timeline.loopRegion.enabled).toBe(true);
      expect(timeline.loopRegion.inPoint).toBe(30);
      expect(timeline.loopRegion.outPoint).toBe(null);
    });

    it('只有出點時區間應該啟用', () => {
      const store = useDirectorStore.getState();
      
      store.setOutPoint(100);
      
      const { timeline } = useDirectorStore.getState();
      expect(timeline.loopRegion.enabled).toBe(true);
      expect(timeline.loopRegion.inPoint).toBe(null);
      expect(timeline.loopRegion.outPoint).toBe(100);
    });

    it('入點和出點都有時區間應該啟用', () => {
      const store = useDirectorStore.getState();
      
      store.setInPoint(30);
      store.setOutPoint(100);
      
      const { timeline } = useDirectorStore.getState();
      expect(timeline.loopRegion.enabled).toBe(true);
      expect(timeline.loopRegion.inPoint).toBe(30);
      expect(timeline.loopRegion.outPoint).toBe(100);
    });
  });

  describe('play 行為與區間', () => {
    it('播放時如果在區間外應該跳到入點', () => {
      const store = useDirectorStore.getState();
      
      // 設定區間 30-100
      store.setInPoint(30);
      store.setOutPoint(100);
      
      // 設定播放頭在區間外
      store.setCurrentFrame(10);
      
      // 播放
      store.play();
      
      const { timeline } = useDirectorStore.getState();
      expect(timeline.currentFrame).toBe(30); // 應該跳到入點
      expect(timeline.isPlaying).toBe(true);
    });

    it('播放時如果在區間內應該保持當前位置', () => {
      const store = useDirectorStore.getState();
      
      // 設定區間 30-100
      store.setInPoint(30);
      store.setOutPoint(100);
      
      // 設定播放頭在區間內
      store.setCurrentFrame(50);
      
      // 播放
      store.play();
      
      const { timeline } = useDirectorStore.getState();
      expect(timeline.currentFrame).toBe(50); // 應該保持原位
      expect(timeline.isPlaying).toBe(true);
    });

    it('沒有區間時正常播放不跳轉', () => {
      const store = useDirectorStore.getState();
      
      // 設定播放頭
      store.setCurrentFrame(50);
      
      // 播放
      store.play();
      
      const { timeline } = useDirectorStore.getState();
      expect(timeline.currentFrame).toBe(50); // 不應該跳轉
      expect(timeline.isPlaying).toBe(true);
    });

    it('區間禁用時不應該跳轉', () => {
      const store = useDirectorStore.getState();
      
      // 設定區間但禁用
      store.setInPoint(30);
      store.setOutPoint(100);
      store.toggleLoopRegion(); // 禁用
      
      // 設定播放頭在區間外
      store.setCurrentFrame(10);
      
      // 播放
      store.play();
      
      const { timeline } = useDirectorStore.getState();
      expect(timeline.currentFrame).toBe(10); // 不應該跳轉
      expect(timeline.isPlaying).toBe(true);
    });
  });

  describe('stop 行為與區間', () => {
    it('停止時有區間應該跳到入點', () => {
      const store = useDirectorStore.getState();
      
      // 設定區間
      store.setInPoint(30);
      store.setOutPoint(100);
      
      // 設定播放頭
      store.setCurrentFrame(50);
      store.play();
      
      // 停止
      store.stop();
      
      const { timeline } = useDirectorStore.getState();
      expect(timeline.currentFrame).toBe(30); // 應該跳到入點
      expect(timeline.isPlaying).toBe(false);
    });

    it('停止時沒有區間應該跳到開頭', () => {
      const store = useDirectorStore.getState();
      
      // 設定播放頭
      store.setCurrentFrame(50);
      store.play();
      
      // 停止
      store.stop();
      
      const { timeline } = useDirectorStore.getState();
      expect(timeline.currentFrame).toBe(0); // 應該跳到開頭
      expect(timeline.isPlaying).toBe(false);
    });

    it('停止時區間禁用應該跳到開頭', () => {
      const store = useDirectorStore.getState();
      
      // 設定區間但禁用
      store.setInPoint(30);
      store.setOutPoint(100);
      store.toggleLoopRegion(); // 禁用
      
      // 設定播放頭
      store.setCurrentFrame(50);
      store.play();
      
      // 停止
      store.stop();
      
      const { timeline } = useDirectorStore.getState();
      expect(timeline.currentFrame).toBe(0); // 應該跳到開頭（區間禁用）
      expect(timeline.isPlaying).toBe(false);
    });
  });
});

