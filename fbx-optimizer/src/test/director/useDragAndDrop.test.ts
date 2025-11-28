/**
 * useDragAndDrop Hook 單元測試
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDragAndDrop } from '../../presentation/features/director/hooks/useDragAndDrop';
import { useDirectorStore } from '../../presentation/stores/directorStore';

describe('useDragAndDrop', () => {
  beforeEach(() => {
    useDirectorStore.getState().reset();
  });

  it('應該正確計算放置幀位置', () => {
    const { result } = renderHook(() => useDragAndDrop({ pixelsPerFrame: 4 }));
    
    // 模擬軌道元素
    const mockTrackElement = {
      getBoundingClientRect: () => ({ left: 100, top: 0, width: 1000, height: 48 }),
      scrollLeft: 0,
    } as HTMLElement;
    
    // clientX = 100 + 40 = 140, 所以 x = 40, frame = 40/4 = 10
    const frame = result.current.calculateDropFrame(140, mockTrackElement);
    expect(frame).toBe(10);
  });

  it('初始狀態 isDragging 應為 false', () => {
    const { result } = renderHook(() => useDragAndDrop({ pixelsPerFrame: 4 }));
    
    expect(result.current.isDragging).toBe(false);
    expect(result.current.draggingData).toBeNull();
  });

  it('handleDragEnd 應該清除拖曳狀態', () => {
    const store = useDirectorStore.getState();
    store.setDragging(true, {
      type: 'new',
      sourceModelId: 'model-1',
      sourceAnimationId: 'clip-1',
      sourceAnimationName: 'walk',
      durationFrames: 60,
    });
    
    const { result } = renderHook(() => useDragAndDrop({ pixelsPerFrame: 4 }));
    
    expect(result.current.isDragging).toBe(true);
    
    act(() => {
      result.current.handleDragEnd();
    });
    
    expect(result.current.isDragging).toBe(false);
    expect(result.current.draggingData).toBeNull();
  });

  it('calculateDropFrame 應該處理 scrollOffsetX (from store)', () => {
    // 設定 store 的 scrollOffsetX
    useDirectorStore.getState().setScrollOffset(200, 0);
    
    const { result } = renderHook(() => useDragAndDrop({ pixelsPerFrame: 4 }));
    
    const mockTrackElement = {
      getBoundingClientRect: () => ({ left: 100, top: 0, width: 1000, height: 48 }),
      scrollLeft: 0, // scrollLeft 不再使用，改用 store 的 scrollOffsetX
    } as HTMLElement;
    
    // clientX = 140, rect.left = 100, scrollOffsetX = 200
    // x = 140 - 100 + 200 = 240, frame = 240/4 = 60
    const frame = result.current.calculateDropFrame(140, mockTrackElement);
    expect(frame).toBe(60);
  });

  it('calculateDropFrame 不應返回負數', () => {
    const { result } = renderHook(() => useDragAndDrop({ pixelsPerFrame: 4 }));
    
    const mockTrackElement = {
      getBoundingClientRect: () => ({ left: 100, top: 0, width: 1000, height: 48 }),
      scrollLeft: 0,
    } as HTMLElement;
    
    // clientX = 50, x = -50, 應該返回 0
    const frame = result.current.calculateDropFrame(50, mockTrackElement);
    expect(frame).toBe(0);
  });
});

