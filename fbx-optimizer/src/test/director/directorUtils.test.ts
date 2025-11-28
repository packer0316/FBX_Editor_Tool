/**
 * Director Utils 單元測試
 */

import { describe, it, expect } from 'vitest';
import {
  frameToSeconds,
  secondsToFrame,
  getClipLocalTime,
  isClipsOverlapping,
  hasOverlapInTrack,
  snapToGrid,
  formatFrameTime,
  parseTimeToFrame,
  calculateTrackDuration,
  calculateTimelineDuration,
} from '../../utils/director/directorUtils';
import { DirectorClip, DirectorTrack, DEFAULT_FPS } from '../../domain/entities/director/director.types';

// ============================================================================
// 測試資料工廠
// ============================================================================

function createMockClip(overrides: Partial<DirectorClip> = {}): DirectorClip {
  return {
    id: 'clip-1',
    trackId: 'track-1',
    sourceModelId: 'model-1',
    sourceAnimationId: 'anim-1',
    sourceAnimationName: 'walk',
    sourceAnimationDuration: 60,
    startFrame: 0,
    endFrame: 59,
    speed: 1.0,
    loop: false,
    blendIn: 0,
    blendOut: 0,
    color: '#3B82F6',
    ...overrides,
  };
}

function createMockTrack(overrides: Partial<DirectorTrack> = {}): DirectorTrack {
  return {
    id: 'track-1',
    name: 'Track 1',
    order: 0,
    isLocked: false,
    isMuted: false,
    clips: [],
    ...overrides,
  };
}

// ============================================================================
// 時間轉換測試
// ============================================================================

describe('時間轉換函數', () => {
  describe('frameToSeconds', () => {
    it('應該將幀數轉換為秒數', () => {
      expect(frameToSeconds(30, 30)).toBe(1);
      expect(frameToSeconds(60, 30)).toBe(2);
      expect(frameToSeconds(15, 30)).toBe(0.5);
    });

    it('應該使用預設 FPS', () => {
      expect(frameToSeconds(30)).toBe(1); // DEFAULT_FPS = 30
    });

    it('應該處理 0 幀', () => {
      expect(frameToSeconds(0, 30)).toBe(0);
    });
  });

  describe('secondsToFrame', () => {
    it('應該將秒數轉換為幀數', () => {
      expect(secondsToFrame(1, 30)).toBe(30);
      expect(secondsToFrame(2, 30)).toBe(60);
      expect(secondsToFrame(0.5, 30)).toBe(15);
    });

    it('應該使用預設 FPS', () => {
      expect(secondsToFrame(1)).toBe(30); // DEFAULT_FPS = 30
    });

    it('應該四捨五入', () => {
      expect(secondsToFrame(0.333, 30)).toBe(10); // 9.99 → 10
    });
  });
});

// ============================================================================
// 片段局部時間測試
// ============================================================================

describe('getClipLocalTime', () => {
  it('應該計算活躍片段的局部時間', () => {
    const clip = createMockClip({ startFrame: 100, endFrame: 159 });
    
    const result = getClipLocalTime(130, clip, 30);
    
    expect(result.isActive).toBe(true);
    expect(result.localTime).toBe(1); // (130 - 100) / 30 = 1 秒
    expect(result.clip).toBe(clip);
  });

  it('應該返回 null 當幀在片段之前', () => {
    const clip = createMockClip({ startFrame: 100, endFrame: 159 });
    
    const result = getClipLocalTime(50, clip, 30);
    
    expect(result.isActive).toBe(false);
    expect(result.localTime).toBeNull();
  });

  it('應該返回 null 當幀在片段之後', () => {
    const clip = createMockClip({ startFrame: 100, endFrame: 159 });
    
    const result = getClipLocalTime(200, clip, 30);
    
    expect(result.isActive).toBe(false);
    expect(result.localTime).toBeNull();
  });

  it('應該處理片段邊界', () => {
    const clip = createMockClip({ startFrame: 100, endFrame: 159 });
    
    // 起始幀
    let result = getClipLocalTime(100, clip, 30);
    expect(result.isActive).toBe(true);
    expect(result.localTime).toBe(0);
    
    // 結束幀
    result = getClipLocalTime(159, clip, 30);
    expect(result.isActive).toBe(true);
    expect(result.localTime).toBeCloseTo(1.967, 2); // (159 - 100) / 30
  });
});

// ============================================================================
// 片段重疊檢測測試
// ============================================================================

describe('isClipsOverlapping', () => {
  it('應該檢測重疊的片段', () => {
    const clipA = createMockClip({ startFrame: 0, endFrame: 59 });
    const clipB = createMockClip({ startFrame: 30, endFrame: 89 });
    
    expect(isClipsOverlapping(clipA, clipB)).toBe(true);
  });

  it('應該檢測不重疊的片段', () => {
    const clipA = createMockClip({ startFrame: 0, endFrame: 59 });
    const clipB = createMockClip({ startFrame: 100, endFrame: 159 });
    
    expect(isClipsOverlapping(clipA, clipB)).toBe(false);
  });

  it('應該處理相鄰片段（不重疊）', () => {
    const clipA = createMockClip({ startFrame: 0, endFrame: 59 });
    const clipB = createMockClip({ startFrame: 60, endFrame: 119 });
    
    expect(isClipsOverlapping(clipA, clipB)).toBe(false);
  });

  it('應該處理完全包含的片段', () => {
    const clipA = createMockClip({ startFrame: 0, endFrame: 100 });
    const clipB = createMockClip({ startFrame: 30, endFrame: 60 });
    
    expect(isClipsOverlapping(clipA, clipB)).toBe(true);
  });
});

describe('hasOverlapInTrack', () => {
  it('應該檢測軌道中的重疊', () => {
    const track = createMockTrack({
      clips: [
        createMockClip({ id: 'clip-1', startFrame: 0, endFrame: 59 }),
        createMockClip({ id: 'clip-2', startFrame: 100, endFrame: 159 }),
      ],
    });
    
    // 與 clip-1 重疊
    expect(hasOverlapInTrack(track, 30, 89)).toBe(true);
    
    // 與 clip-2 重疊
    expect(hasOverlapInTrack(track, 120, 180)).toBe(true);
    
    // 沒有重疊
    expect(hasOverlapInTrack(track, 60, 99)).toBe(false);
  });

  it('應該排除指定片段', () => {
    const track = createMockTrack({
      clips: [
        createMockClip({ id: 'clip-1', startFrame: 0, endFrame: 59 }),
      ],
    });
    
    // 與自己重疊，但排除後應該為 false
    expect(hasOverlapInTrack(track, 0, 59, 'clip-1')).toBe(false);
  });
});

// ============================================================================
// 吸附功能測試
// ============================================================================

describe('snapToGrid', () => {
  it('應該吸附到格線', () => {
    expect(snapToGrid(7, 5)).toBe(5);
    expect(snapToGrid(8, 5)).toBe(10);
    expect(snapToGrid(10, 5)).toBe(10);
  });

  it('應該使用預設格線大小 1', () => {
    expect(snapToGrid(7.4)).toBe(7);
    expect(snapToGrid(7.6)).toBe(8);
  });
});

// ============================================================================
// 時間格式化測試
// ============================================================================

describe('formatFrameTime', () => {
  it('應該格式化為 MM:SS:FF', () => {
    expect(formatFrameTime(0, 30, true)).toBe('00:00:00');
    expect(formatFrameTime(30, 30, true)).toBe('00:01:00');
    expect(formatFrameTime(90, 30, true)).toBe('00:03:00');
    expect(formatFrameTime(45, 30, true)).toBe('00:01:15');
  });

  it('應該格式化為 MM:SS（不顯示幀）', () => {
    expect(formatFrameTime(30, 30, false)).toBe('00:01');
    expect(formatFrameTime(90, 30, false)).toBe('00:03');
  });

  it('應該處理分鐘', () => {
    expect(formatFrameTime(1800, 30, true)).toBe('01:00:00'); // 60 秒
    expect(formatFrameTime(3600, 30, true)).toBe('02:00:00'); // 120 秒
  });
});

describe('parseTimeToFrame', () => {
  it('應該解析 MM:SS 格式', () => {
    expect(parseTimeToFrame('00:01', 30)).toBe(30);
    expect(parseTimeToFrame('01:00', 30)).toBe(1800);
    expect(parseTimeToFrame('00:10', 30)).toBe(300);
  });

  it('應該解析 MM:SS:FF 格式', () => {
    expect(parseTimeToFrame('00:01:15', 30)).toBe(45);
    expect(parseTimeToFrame('01:00:00', 30)).toBe(1800);
  });

  it('應該處理無效格式', () => {
    expect(parseTimeToFrame('invalid', 30)).toBe(0);
  });
});

// ============================================================================
// 軌道計算測試
// ============================================================================

describe('calculateTrackDuration', () => {
  it('應該計算軌道的最大結束幀', () => {
    const track = createMockTrack({
      clips: [
        createMockClip({ startFrame: 0, endFrame: 59 }),
        createMockClip({ startFrame: 100, endFrame: 159 }),
      ],
    });
    
    expect(calculateTrackDuration(track)).toBe(159);
  });

  it('應該處理空軌道', () => {
    const track = createMockTrack({ clips: [] });
    expect(calculateTrackDuration(track)).toBe(0);
  });
});

describe('calculateTimelineDuration', () => {
  it('應該計算所有軌道的最大結束幀', () => {
    const tracks = [
      createMockTrack({
        id: 'track-1',
        clips: [createMockClip({ startFrame: 0, endFrame: 59 })],
      }),
      createMockTrack({
        id: 'track-2',
        clips: [createMockClip({ startFrame: 100, endFrame: 200 })],
      }),
    ];
    
    expect(calculateTimelineDuration(tracks)).toBe(200);
  });

  it('應該處理空軌道列表', () => {
    expect(calculateTimelineDuration([])).toBe(0);
  });
});

