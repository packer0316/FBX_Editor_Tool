/**
 * useDragAndDrop - 拖放邏輯 Hook
 */

import { useCallback, useRef } from 'react';
import { useDirectorStore } from '../../../stores/directorStore';
import { snapToGrid, snapToClipEdges } from '../../../../utils/director/directorUtils';
import type { DraggingClipData } from '../../../../domain/entities/director/director.types';

interface UseDragAndDropOptions {
  pixelsPerFrame: number;
  enableSnap?: boolean;
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
  const { pixelsPerFrame, enableSnap = true, snapThreshold = 5 } = options;
  
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
    
    if (enableSnap) {
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
  }, [pixelsPerFrame, enableSnap, snapThreshold, tracks, ui.draggingClipData?.clipId, ui.scrollOffsetX]);

  // 動作來源拖曳開始
  const handleSourceDragStart = useCallback((
    e: React.DragEvent,
    data: Omit<DraggingClipData, 'type'>
  ) => {
    const dragData: DraggingClipData = { type: 'new', ...data };
    
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    
    setDragging(true, dragData);
  }, [setDragging]);

  // 現有片段拖曳開始
  const handleClipDragStart = useCallback((
    e: React.DragEvent,
    clipId: string,
    data: Omit<DraggingClipData, 'type' | 'clipId'>
  ) => {
    const dragData: DraggingClipData = { type: 'existing', clipId, ...data };
    
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    
    setDragging(true, dragData);
  }, [setDragging]);

  // 軌道 DragOver 處理
  const handleTrackDragOver = useCallback((
    e: React.DragEvent,
    trackId: string
  ) => {
    const track = getTrackById(trackId);
    if (!track || track.isLocked) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }
    
    e.preventDefault();
    e.dataTransfer.dropEffect = ui.draggingClipData?.type === 'new' ? 'copy' : 'move';
  }, [getTrackById, ui.draggingClipData?.type]);

  // 軌道放置處理
  const handleTrackDrop = useCallback((
    e: React.DragEvent,
    trackId: string,
    trackElement: HTMLElement
  ) => {
    e.preventDefault();
    
    const track = getTrackById(trackId);
    if (!track || track.isLocked) return;
    
    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      
      const data = JSON.parse(dataStr) as DraggingClipData;
      const startFrame = calculateDropFrame(e.clientX, trackElement);
      
      if (data.type === 'new') {
        // 新增片段
        addClip({
          trackId,
          sourceModelId: data.sourceModelId,
          sourceModelName: data.sourceModelName,
          sourceAnimationId: data.sourceAnimationId,
          sourceAnimationName: data.sourceAnimationName,
          sourceAnimationDuration: data.durationFrames,
          startFrame,
          color: data.color,
        });
      } else if (data.type === 'existing' && data.clipId) {
        // 移動現有片段
        moveClip({
          clipId: data.clipId,
          newTrackId: trackId,
          newStartFrame: startFrame,
        });
      }
    } catch {
      // 忽略解析錯誤
    }
    
    setDragging(false, null);
  }, [getTrackById, calculateDropFrame, addClip, moveClip, setDragging]);

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

