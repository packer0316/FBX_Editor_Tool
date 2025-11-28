/**
 * Director Store 單元測試
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useDirectorStore } from '../../presentation/stores/directorStore';
import { DEFAULT_FPS, DEFAULT_TOTAL_FRAMES } from '../../domain/entities/director/director.types';

describe('DirectorStore', () => {
  // 每個測試前重置 store
  beforeEach(() => {
    useDirectorStore.getState().reset();
  });

  // ========================================
  // 模式控制測試
  // ========================================
  
  describe('模式控制', () => {
    it('初始狀態應該是非導演模式', () => {
      const { isDirectorMode } = useDirectorStore.getState();
      expect(isDirectorMode).toBe(false);
    });

    it('toggleDirectorMode 應該切換模式', () => {
      const store = useDirectorStore.getState();
      
      store.toggleDirectorMode();
      expect(useDirectorStore.getState().isDirectorMode).toBe(true);
      
      store.toggleDirectorMode();
      expect(useDirectorStore.getState().isDirectorMode).toBe(false);
    });

    it('enterDirectorMode 應該進入導演模式', () => {
      useDirectorStore.getState().enterDirectorMode();
      expect(useDirectorStore.getState().isDirectorMode).toBe(true);
    });

    it('exitDirectorMode 應該退出導演模式並停止播放', () => {
      const store = useDirectorStore.getState();
      store.enterDirectorMode();
      store.play();
      
      store.exitDirectorMode();
      
      const state = useDirectorStore.getState();
      expect(state.isDirectorMode).toBe(false);
      expect(state.timeline.isPlaying).toBe(false);
    });
  });

  // ========================================
  // 時間軸測試
  // ========================================
  
  describe('時間軸', () => {
    it('初始時間軸狀態應該正確', () => {
      const { timeline } = useDirectorStore.getState();
      
      expect(timeline.totalFrames).toBe(DEFAULT_TOTAL_FRAMES);
      expect(timeline.fps).toBe(DEFAULT_FPS);
      expect(timeline.currentFrame).toBe(0);
      expect(timeline.isPlaying).toBe(false);
      expect(timeline.isLooping).toBe(false);
    });

    it('setCurrentFrame 應該設定當前幀', () => {
      useDirectorStore.getState().setCurrentFrame(100);
      expect(useDirectorStore.getState().timeline.currentFrame).toBe(100);
    });

    it('setCurrentFrame 應該限制在有效範圍內', () => {
      const store = useDirectorStore.getState();
      
      store.setCurrentFrame(-10);
      expect(useDirectorStore.getState().timeline.currentFrame).toBe(0);
      
      store.setCurrentFrame(9999);
      expect(useDirectorStore.getState().timeline.currentFrame).toBe(DEFAULT_TOTAL_FRAMES);
    });

    it('setFps 應該設定幀率', () => {
      useDirectorStore.getState().setFps(60);
      expect(useDirectorStore.getState().timeline.fps).toBe(60);
    });

    it('setFps 應該限制在 1-120 之間', () => {
      const store = useDirectorStore.getState();
      
      store.setFps(0);
      expect(useDirectorStore.getState().timeline.fps).toBe(1);
      
      store.setFps(200);
      expect(useDirectorStore.getState().timeline.fps).toBe(120);
    });

    it('setTotalFrames 應該設定總幀數', () => {
      useDirectorStore.getState().setTotalFrames(500);
      expect(useDirectorStore.getState().timeline.totalFrames).toBe(500);
    });
  });

  // ========================================
  // 播放控制測試
  // ========================================
  
  describe('播放控制', () => {
    it('play 應該開始播放', () => {
      useDirectorStore.getState().play();
      expect(useDirectorStore.getState().timeline.isPlaying).toBe(true);
    });

    it('pause 應該暫停播放', () => {
      const store = useDirectorStore.getState();
      store.play();
      store.pause();
      expect(useDirectorStore.getState().timeline.isPlaying).toBe(false);
    });

    it('stop 應該停止播放並重置到第 0 幀', () => {
      const store = useDirectorStore.getState();
      store.play();
      store.setCurrentFrame(100);
      store.stop();
      
      const { timeline } = useDirectorStore.getState();
      expect(timeline.isPlaying).toBe(false);
      expect(timeline.currentFrame).toBe(0);
    });

    it('toggleLoop 應該切換循環模式', () => {
      const store = useDirectorStore.getState();
      
      store.toggleLoop();
      expect(useDirectorStore.getState().timeline.isLooping).toBe(true);
      
      store.toggleLoop();
      expect(useDirectorStore.getState().timeline.isLooping).toBe(false);
    });
  });

  // ========================================
  // 軌道操作測試
  // ========================================
  
  describe('軌道操作', () => {
    it('addTrack 應該新增軌道', () => {
      const track = useDirectorStore.getState().addTrack('Test Track');
      
      expect(track.name).toBe('Test Track');
      expect(track.order).toBe(0);
      expect(track.isLocked).toBe(false);
      expect(track.isMuted).toBe(false);
      expect(track.clips).toHaveLength(0);
      
      expect(useDirectorStore.getState().tracks).toHaveLength(1);
    });

    it('addTrack 應該使用預設名稱', () => {
      const track = useDirectorStore.getState().addTrack();
      expect(track.name).toBe('Track 1');
    });

    it('removeTrack 應該移除軌道', () => {
      const store = useDirectorStore.getState();
      const track = store.addTrack();
      
      store.removeTrack(track.id);
      expect(useDirectorStore.getState().tracks).toHaveLength(0);
    });

    it('updateTrack 應該更新軌道屬性', () => {
      const store = useDirectorStore.getState();
      const track = store.addTrack();
      
      store.updateTrack(track.id, { name: 'Updated', isLocked: true });
      
      const updatedTrack = useDirectorStore.getState().tracks[0];
      expect(updatedTrack.name).toBe('Updated');
      expect(updatedTrack.isLocked).toBe(true);
    });

    it('reorderTracks 應該重新排序軌道', () => {
      const store = useDirectorStore.getState();
      const track1 = store.addTrack('Track 1');
      const track2 = store.addTrack('Track 2');
      const track3 = store.addTrack('Track 3');
      
      store.reorderTracks([track3.id, track1.id, track2.id]);
      
      const tracks = useDirectorStore.getState().tracks;
      expect(tracks[0].id).toBe(track3.id);
      expect(tracks[0].order).toBe(0);
      expect(tracks[1].id).toBe(track1.id);
      expect(tracks[1].order).toBe(1);
      expect(tracks[2].id).toBe(track2.id);
      expect(tracks[2].order).toBe(2);
    });
  });

  // ========================================
  // 片段操作測試
  // ========================================
  
  describe('片段操作', () => {
    it('addClip 應該新增片段到軌道', () => {
      const store = useDirectorStore.getState();
      const track = store.addTrack();
      
      const clip = store.addClip({
        trackId: track.id,
        sourceModelId: 'model-1',
        sourceAnimationId: 'anim-1',
        sourceAnimationName: 'walk',
        sourceAnimationDuration: 60,
        startFrame: 0,
      });
      
      expect(clip).not.toBeNull();
      expect(clip!.trackId).toBe(track.id);
      expect(clip!.sourceAnimationName).toBe('walk');
      expect(clip!.startFrame).toBe(0);
      expect(clip!.endFrame).toBe(59); // 0 + 60 - 1
      
      const updatedTrack = useDirectorStore.getState().tracks[0];
      expect(updatedTrack.clips).toHaveLength(1);
    });

    it('addClip 應該拒絕鎖定軌道', () => {
      const store = useDirectorStore.getState();
      const track = store.addTrack();
      store.updateTrack(track.id, { isLocked: true });
      
      const clip = store.addClip({
        trackId: track.id,
        sourceModelId: 'model-1',
        sourceAnimationId: 'anim-1',
        sourceAnimationName: 'walk',
        sourceAnimationDuration: 60,
        startFrame: 0,
      });
      
      expect(clip).toBeNull();
    });

    it('moveClip 應該移動片段位置', () => {
      const store = useDirectorStore.getState();
      const track = store.addTrack();
      const clip = store.addClip({
        trackId: track.id,
        sourceModelId: 'model-1',
        sourceAnimationId: 'anim-1',
        sourceAnimationName: 'walk',
        sourceAnimationDuration: 60,
        startFrame: 0,
      });
      
      const success = store.moveClip({
        clipId: clip!.id,
        newTrackId: track.id,
        newStartFrame: 100,
      });
      
      expect(success).toBe(true);
      
      const movedClip = useDirectorStore.getState().tracks[0].clips[0];
      expect(movedClip.startFrame).toBe(100);
      expect(movedClip.endFrame).toBe(159);
    });

    it('moveClip 應該支援跨軌道移動', () => {
      const store = useDirectorStore.getState();
      const track1 = store.addTrack('Track 1');
      const track2 = store.addTrack('Track 2');
      
      const clip = store.addClip({
        trackId: track1.id,
        sourceModelId: 'model-1',
        sourceAnimationId: 'anim-1',
        sourceAnimationName: 'walk',
        sourceAnimationDuration: 60,
        startFrame: 0,
      });
      
      store.moveClip({
        clipId: clip!.id,
        newTrackId: track2.id,
        newStartFrame: 50,
      });
      
      const tracks = useDirectorStore.getState().tracks;
      expect(tracks[0].clips).toHaveLength(0);
      expect(tracks[1].clips).toHaveLength(1);
      expect(tracks[1].clips[0].startFrame).toBe(50);
    });

    it('removeClip 應該移除片段', () => {
      const store = useDirectorStore.getState();
      const track = store.addTrack();
      const clip = store.addClip({
        trackId: track.id,
        sourceModelId: 'model-1',
        sourceAnimationId: 'anim-1',
        sourceAnimationName: 'walk',
        sourceAnimationDuration: 60,
        startFrame: 0,
      });
      
      store.removeClip(clip!.id);
      expect(useDirectorStore.getState().tracks[0].clips).toHaveLength(0);
    });
  });

  // ========================================
  // 工具方法測試
  // ========================================
  
  describe('工具方法', () => {
    it('getClipById 應該找到片段', () => {
      const store = useDirectorStore.getState();
      const track = store.addTrack();
      const clip = store.addClip({
        trackId: track.id,
        sourceModelId: 'model-1',
        sourceAnimationId: 'anim-1',
        sourceAnimationName: 'walk',
        sourceAnimationDuration: 60,
        startFrame: 0,
      });
      
      const found = store.getClipById(clip!.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(clip!.id);
    });

    it('getActiveClipsAtFrame 應該返回活躍片段', () => {
      const store = useDirectorStore.getState();
      const track = store.addTrack();
      
      // 片段 A: 0-59
      store.addClip({
        trackId: track.id,
        sourceModelId: 'model-1',
        sourceAnimationId: 'anim-1',
        sourceAnimationName: 'walk',
        sourceAnimationDuration: 60,
        startFrame: 0,
      });
      
      // 片段 B: 100-159
      store.addClip({
        trackId: track.id,
        sourceModelId: 'model-1',
        sourceAnimationId: 'anim-2',
        sourceAnimationName: 'run',
        sourceAnimationDuration: 60,
        startFrame: 100,
      });
      
      // 測試幀 30（應該有片段 A）
      let activeClips = store.getActiveClipsAtFrame(30);
      expect(activeClips).toHaveLength(1);
      expect(activeClips[0].sourceAnimationName).toBe('walk');
      
      // 測試幀 80（沒有片段）
      activeClips = store.getActiveClipsAtFrame(80);
      expect(activeClips).toHaveLength(0);
      
      // 測試幀 120（應該有片段 B）
      activeClips = store.getActiveClipsAtFrame(120);
      expect(activeClips).toHaveLength(1);
      expect(activeClips[0].sourceAnimationName).toBe('run');
    });

    it('getActiveClipsAtFrame 應該忽略靜音軌道', () => {
      const store = useDirectorStore.getState();
      const track = store.addTrack();
      
      store.addClip({
        trackId: track.id,
        sourceModelId: 'model-1',
        sourceAnimationId: 'anim-1',
        sourceAnimationName: 'walk',
        sourceAnimationDuration: 60,
        startFrame: 0,
      });
      
      store.updateTrack(track.id, { isMuted: true });
      
      const activeClips = store.getActiveClipsAtFrame(30);
      expect(activeClips).toHaveLength(0);
    });

    it('calculateTotalDuration 應該計算最大結束幀', () => {
      const store = useDirectorStore.getState();
      const track = store.addTrack();
      
      store.addClip({
        trackId: track.id,
        sourceModelId: 'model-1',
        sourceAnimationId: 'anim-1',
        sourceAnimationName: 'walk',
        sourceAnimationDuration: 60,
        startFrame: 0,
      });
      
      store.addClip({
        trackId: track.id,
        sourceModelId: 'model-1',
        sourceAnimationId: 'anim-2',
        sourceAnimationName: 'run',
        sourceAnimationDuration: 60,
        startFrame: 100,
      });
      
      const duration = store.calculateTotalDuration();
      expect(duration).toBe(159); // 100 + 60 - 1
    });
  });

  // ========================================
  // UI 狀態測試
  // ========================================
  
  describe('UI 狀態', () => {
    it('setZoom 應該設定縮放並限制範圍', () => {
      const store = useDirectorStore.getState();
      
      store.setZoom(2);
      expect(useDirectorStore.getState().ui.zoom).toBe(2);
      
      store.setZoom(0.1);
      expect(useDirectorStore.getState().ui.zoom).toBe(0.25);
      
      store.setZoom(10);
      expect(useDirectorStore.getState().ui.zoom).toBe(4);
    });

    it('selectClip 應該選取片段', () => {
      const store = useDirectorStore.getState();
      
      store.selectClip('clip-1');
      expect(useDirectorStore.getState().ui.selectedClipId).toBe('clip-1');
      
      store.selectClip(null);
      expect(useDirectorStore.getState().ui.selectedClipId).toBeNull();
    });

    it('removeClip 應該清除選取狀態', () => {
      const store = useDirectorStore.getState();
      const track = store.addTrack();
      const clip = store.addClip({
        trackId: track.id,
        sourceModelId: 'model-1',
        sourceAnimationId: 'anim-1',
        sourceAnimationName: 'walk',
        sourceAnimationDuration: 60,
        startFrame: 0,
      });
      
      store.selectClip(clip!.id);
      store.removeClip(clip!.id);
      
      expect(useDirectorStore.getState().ui.selectedClipId).toBeNull();
    });
  });
});

