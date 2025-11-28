/**
 * ClipBlock - 片段方塊（支援即時拖曳）
 */

import React, { memo, useCallback, useState, useRef, useEffect } from 'react';
import { useDirectorStore } from '../../../stores/directorStore';
import type { DirectorClip } from '../../../../domain/entities/director/director.types';

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
  const { ui, selectClip, removeClip, moveClip } = useDirectorStore();
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartX = useRef(0);
  const originalStartFrame = useRef(clip.startFrame);
  
  const isSelected = ui.selectedClipId === clip.id;
  const width = clip.sourceAnimationDuration * pixelsPerFrame;
  
  // 計算顯示位置（拖曳時使用臨時位置）
  const displayFrame = isDragging 
    ? Math.max(0, originalStartFrame.current + Math.round(dragOffset / pixelsPerFrame))
    : clip.startFrame;
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
      
      // 計算最終幀位置
      const newStartFrame = Math.max(0, originalStartFrame.current + Math.round(dragOffset / pixelsPerFrame));
      
      // 只有位置改變才更新
      if (newStartFrame !== clip.startFrame) {
        moveClip({
          clipId: clip.id,
          newTrackId: clip.trackId,
          newStartFrame,
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
  }, [isDragging, dragOffset, pixelsPerFrame, clip.id, clip.trackId, clip.startFrame, moveClip]);

  return (
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
        transition-colors duration-100`}
      style={{
        left,
        width: Math.max(width, 20),
        backgroundColor: clip.color,
        transition: isDragging ? 'none' : undefined,
      }}
    >
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
  );
});

ClipBlock.displayName = 'ClipBlock';

export default ClipBlock;

