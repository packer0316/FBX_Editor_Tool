/**
 * useDragAndDrop - 拖放邏輯 Hook
 */

import { useCallback, useRef } from 'react';
import { useDirectorStore } from '../../../stores/directorStore';
import { snapToGrid, snapToClipEdges } from '../../../../utils/director/directorUtils';
import type { DraggingClipData } from '../../../../domain/entities/director/director.types';

interface UseDragAndDropOptions {
  pixelsPerFrame: number;
  snapThreshold?: number;
}

interface UseDragAndDropReturn {
  // 拖曳狀態
  isDragging: boolean;
  draggingData: DraggingClipData | null;
  
  // 動作來源拖曳
  handleSourceDragStart: (
    e: React.DragEvent,
    data: Omit<DraggingClipData, 'type'>
  ) => void;
  
  // 現有片段拖曳
  handleClipDragStart: (
    e: React.DragEvent,
    clipId: string,
    data: Omit<DraggingClipData, 'type' | 'clipId'>
  ) => void;
  
  // 軌道放置處理
  handleTrackDragOver: (e: React.DragEvent, trackId: string) => void;
  handleTrackDrop: (e: React.DragEvent, trackId: string, trackElement: HTMLElement) => void;
  
  // 拖曳結束
  handleDragEnd: () => void;
  
  // 計算放置位置
  calculateDropFrame: (clientX: number, trackElement: HTMLElement) => number;
}

export function useDragAndDrop(options: UseDragAndDropOptions): UseDragAndDropReturn {
  const { pixelsPerFrame, snapThreshold = 5 } = options;
  
  const {
    ui,
    tracks,
    setDragging,
    addClip,
    moveClip,
    getTrackById,
  } = useDirectorStore();
  
  const dragImageRef = useRef<HTMLDivElement | null>(null);

  // 計算放置的幀位置
  const calculateDropFrame = useCallback((
    clientX: number,
    trackElement: HTMLElement
  ): number => {
    const rect = trackElement.getBoundingClientRect();
    // 使用 store 中的 scrollOffset，因為滾動發生在父容器
    const x = clientX - rect.left + ui.scrollOffsetX;
    let frame = Math.max(0, Math.round(x / pixelsPerFrame));
    
    // 使用 store 中的 clipSnapping 狀態
    if (ui.clipSnapping) {
      // 先嘗試吸附到片段邊緣
      const snappedToEdge = snapToClipEdges(
        frame,
        tracks,
        snapThreshold,
        ui.draggingClipData?.clipId
      );
      
      if (snappedToEdge !== frame) {
        frame = snappedToEdge;
      } else {
        // 否則吸附到格線
        frame = snapToGrid(frame, 1);
      }
    }
    
    return frame;
  }, [pixelsPerFrame, snapThreshold, tracks, ui.clipSnapping, ui.draggingClipData?.clipId, ui.scrollOffsetX]);

  // 動作來源拖曳開始
  const handleSourceDragStart = useCallback((
    e: React.DragEvent,
    data: Omit<DraggingClipData, 'type'>
  ) => {
    const dragData: DraggingClipData = { type: 'new', ...data };
    
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData('text/plain', JSON.stringify(dragData));
    
    setDragging(true, dragData);
  }, [setDragging]);

  // 現有片段拖曳開始
  const handleClipDragStart = useCallback((
    e: React.DragEvent,
    clipId: string,
    data: Omit<DraggingClipData, 'type' | 'clipId'>
  ) => {
    const dragData: DraggingClipData = { type: 'existing', clipId, ...data };
    
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData('text/plain', JSON.stringify(dragData));
    
    setDragging(true, dragData);
  }, [setDragging]);

  // 軌道 DragOver 處理
  const handleTrackDragOver = useCallback((
    e: React.DragEvent,
    trackId: string
  ) => {
    // 必須先調用 preventDefault() 才能接收 drop 事件
    e.preventDefault();
    
    const track = getTrackById(trackId);
    
    if (!track) {
      console.warn('[useDragAndDrop] DragOver: Track not found:', trackId);
      e.dataTransfer.dropEffect = 'none';
      return;
    }
    
    if (track.isLocked) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }
    
    e.dataTransfer.dropEffect = ui.draggingClipData?.type === 'new' ? 'copy' : 'move';
  }, [getTrackById, ui.draggingClipData?.type]);

  // 軌道放置處理
  const handleTrackDrop = useCallback((
    e: React.DragEvent,
    trackId: string,
    trackElement: HTMLElement
  ) => {
    e.preventDefault();
    
    console.log('[useDragAndDrop] Drop on track:', trackId);
    
    const track = getTrackById(trackId);
    if (!track) {
      console.warn('[useDragAndDrop] Drop: Track not found:', trackId);
      return;
    }
    if (track.isLocked) {
      console.log('[useDragAndDrop] Drop: Track is locked:', trackId);
      return;
    }
    
    try {
      let dataStr = e.dataTransfer.getData('text/plain');
      console.log('[useDragAndDrop] Drop data from dataTransfer:', dataStr);
      
      // Fallback: 如果 dataTransfer 沒有數據，使用 store 中的 draggingClipData
      let data: DraggingClipData | null = null;
      
      if (dataStr) {
        data = JSON.parse(dataStr) as DraggingClipData;
      } else if (ui.draggingClipData) {
        console.log('[useDragAndDrop] Using fallback from store:', ui.draggingClipData);
        data = ui.draggingClipData;
      }
      
      if (!data) {
        console.warn('[useDragAndDrop] Drop: No data available');
        return;
      }
      const startFrame = calculateDropFrame(e.clientX, trackElement);
      
      console.log('[useDragAndDrop] Parsed data:', data, 'startFrame:', startFrame);
      
      if (data.type === 'new') {
        // 檢查該軌道是否有片段，如果有就自動貼合到最後一個片段後面
        let finalStartFrame = startFrame;
        if (track.clips.length > 0) {
          // 找出軌道上最後一個片段的結束位置
          const lastEndFrame = Math.max(...track.clips.map(c => c.endFrame + 1));
          finalStartFrame = lastEndFrame;
        }
        
        // 新增片段
        const result = addClip({
          trackId,
          sourceType: data.sourceType ?? '3d-model',
          sourceModelId: data.sourceModelId,
          sourceModelName: data.sourceModelName,
          sourceAnimationId: data.sourceAnimationId,
          sourceAnimationName: data.sourceAnimationName,
          sourceAnimationDuration: data.durationFrames,
          startFrame: finalStartFrame,
          color: data.color,
          // Spine 特有屬性
          ...(data.sourceType === 'spine' && {
            spineInstanceId: data.spineInstanceId,
            spineLayerId: data.spineLayerId,
            spineElementId: data.spineElementId,
          }),
          // 程式化動畫特有屬性
          ...(data.sourceType === 'procedural' && {
            proceduralType: (data as unknown as { proceduralType?: string }).proceduralType,
          }),
        });
        console.log('[useDragAndDrop] addClip result:', result);
      } else if (data.type === 'existing' && data.clipId) {
        // 移動現有片段
        const result = moveClip({
          clipId: data.clipId,
          newTrackId: trackId,
          newStartFrame: startFrame,
        });
        console.log('[useDragAndDrop] moveClip result:', result);
      }
    } catch (error) {
      console.error('[useDragAndDrop] Drop error:', error);
    }
    
    setDragging(false, null);
  }, [getTrackById, calculateDropFrame, addClip, moveClip, setDragging, ui.draggingClipData]);

  // 拖曳結束
  const handleDragEnd = useCallback(() => {
    setDragging(false, null);
  }, [setDragging]);

  return {
    isDragging: ui.isDragging,
    draggingData: ui.draggingClipData,
    handleSourceDragStart,
    handleClipDragStart,
    handleTrackDragOver,
    handleTrackDrop,
    handleDragEnd,
    calculateDropFrame,
  };
}

export default useDragAndDrop;

