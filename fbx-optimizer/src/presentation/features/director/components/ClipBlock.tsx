/**
 * ClipBlock - 片段方塊（支援即時拖曳）
 */

import React, { memo, useCallback, useState, useRef, useEffect, useMemo } from 'react';
import { Box, Bone } from 'lucide-react';
import { useDirectorStore } from '../../../stores/directorStore';
import type { DirectorClip } from '../../../../domain/entities/director/director.types';
import { snapToGrid, snapToClipEdges } from '../../../../utils/director/directorUtils';

interface ClipBlockProps {
  clip: DirectorClip;
  pixelsPerFrame: number;
  isLocked: boolean;
}

export const ClipBlock: React.FC<ClipBlockProps> = memo(({
  clip,
  pixelsPerFrame,
  isLocked,
}) => {
  const { ui, selectClip, removeClip, moveClip, tracks } = useDirectorStore();
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartX = useRef(0);
  const originalStartFrame = useRef(clip.startFrame);
  
  const isSelected = ui.selectedClipId === clip.id;
  const width = clip.sourceAnimationDuration * pixelsPerFrame;
  
  // 使用 useMemo 計算顯示位置和吸附狀態
  const { displayFrame, showSnapIndicator } = useMemo(() => {
    let frame = isDragging 
      ? Math.max(0, originalStartFrame.current + Math.round(dragOffset / pixelsPerFrame))
      : clip.startFrame;
    
    let isSnapped = false;
    
    // 拖曳時應用吸附（只有開啟吸附功能時才生效）
    if (isDragging && ui.clipSnapping) {
      const snapThreshold = 5; // 5 幀內吸附
      const snappedFrame = snapToClipEdges(frame, tracks, snapThreshold, clip.id);
      if (snappedFrame !== frame) {
        frame = snappedFrame;
        isSnapped = true;
      } else {
        frame = snapToGrid(frame, 1);
        isSnapped = false;
      }
    }
    
    return { displayFrame: frame, showSnapIndicator: isSnapped };
  }, [isDragging, dragOffset, pixelsPerFrame, clip.startFrame, clip.id, tracks, ui.clipSnapping]);
  
  const left = displayFrame * pixelsPerFrame;

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    selectClip(clip.id);
  }, [selectClip, clip.id]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      removeClip(clip.id);
    }
  }, [removeClip, clip.id]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isLocked || e.button !== 0) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    dragStartX.current = e.clientX;
    originalStartFrame.current = clip.startFrame;
    setIsDragging(true);
    setDragOffset(0);
    selectClip(clip.id);
  }, [isLocked, clip.startFrame, clip.id, selectClip]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - dragStartX.current;
      setDragOffset(delta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      
      // 計算最終位置
      const rawFrame = Math.max(0, originalStartFrame.current + Math.round(dragOffset / pixelsPerFrame));
      let finalFrame = rawFrame;
      
      // 只有開啟吸附功能時才應用吸附
      if (ui.clipSnapping) {
        const snapThreshold = 5;
        finalFrame = snapToClipEdges(rawFrame, tracks, snapThreshold, clip.id);
        if (finalFrame === rawFrame) {
          finalFrame = snapToGrid(rawFrame, 1);
        }
      }
      
      // 只有位置改變才更新
      if (finalFrame !== clip.startFrame) {
        moveClip({
          clipId: clip.id,
          newTrackId: clip.trackId,
          newStartFrame: finalFrame,
        });
      }
      
      setDragOffset(0);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, pixelsPerFrame, clip.id, clip.trackId, clip.startFrame, moveClip, tracks, ui.clipSnapping]);

  return (
    <>
      {/* 吸附指示線 */}
      {isDragging && showSnapIndicator && (
        <>
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-40 pointer-events-none"
            style={{ left }}
          />
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-40 pointer-events-none"
            style={{ left: left + width }}
          />
        </>
      )}
      
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        className={`absolute top-1 bottom-1 rounded px-2 flex items-center overflow-hidden select-none
          ${isSelected ? 'ring-2 ring-white/50' : ''}
          ${isLocked ? 'cursor-not-allowed opacity-70' : 'cursor-grab'}
          ${isDragging ? 'cursor-grabbing opacity-90 z-50' : 'hover:brightness-110'}
          ${showSnapIndicator ? 'ring-1 ring-amber-400' : ''}
          transition-colors duration-100`}
        style={{
          left,
          width: Math.max(width, 20),
          backgroundColor: clip.color,
          transition: isDragging ? 'none' : undefined,
        }}
      >
      {/* 來源類型圖標 */}
      {clip.sourceType === 'spine' ? (
        <Bone size={12} className="flex-shrink-0 text-white/80 mr-1.5 pointer-events-none" />
      ) : (
        <Box size={12} className="flex-shrink-0 text-white/80 mr-1.5 pointer-events-none" />
      )}
      
      <span className="text-xs text-white font-medium truncate drop-shadow-sm pointer-events-none">
        {clip.sourceModelName} - {clip.sourceAnimationName}
      </span>
      
      {/* 片段時長顯示 */}
      {width > 80 && (
        <span className="ml-auto text-[10px] text-white/70 font-mono pointer-events-none">
          {clip.sourceAnimationDuration}f
        </span>
      )}
    </div>
    </>
  );
});

ClipBlock.displayName = 'ClipBlock';

export default ClipBlock;

