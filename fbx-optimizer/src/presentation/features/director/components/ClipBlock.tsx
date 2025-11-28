/**
 * ClipBlock - 片段方塊
 */

import React, { memo, useCallback } from 'react';
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
  const { ui, selectClip, removeClip, setDragging, moveClip } = useDirectorStore();
  
  const isSelected = ui.selectedClipId === clip.id;
  const width = clip.sourceAnimationDuration * pixelsPerFrame;
  const left = clip.startFrame * pixelsPerFrame;

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    selectClip(clip.id);
  }, [selectClip, clip.id]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // 可以打開編輯對話框
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      removeClip(clip.id);
    }
  }, [removeClip, clip.id]);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (isLocked) {
      e.preventDefault();
      return;
    }
    
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'existing',
      clipId: clip.id,
      sourceModelId: clip.sourceModelId,
      sourceAnimationId: clip.sourceAnimationId,
      sourceAnimationName: clip.sourceAnimationName,
      durationFrames: clip.sourceAnimationDuration,
    }));
    
    setDragging(true, {
      type: 'existing',
      clipId: clip.id,
      sourceModelId: clip.sourceModelId,
      sourceAnimationId: clip.sourceAnimationId,
      sourceAnimationName: clip.sourceAnimationName,
      durationFrames: clip.sourceAnimationDuration,
    });
  }, [clip, isLocked, setDragging]);

  const handleDragEnd = useCallback(() => {
    setDragging(false, null);
  }, [setDragging]);

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={!isLocked}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`absolute top-1 bottom-1 rounded px-2 flex items-center overflow-hidden cursor-pointer
        ${isSelected ? 'ring-2 ring-white/50' : ''}
        ${isLocked ? 'cursor-not-allowed opacity-70' : 'hover:brightness-110'}
        transition-all duration-100`}
      style={{
        left,
        width: Math.max(width, 20),
        backgroundColor: clip.color,
      }}
    >
      <span className="text-xs text-white font-medium truncate drop-shadow-sm">
        {clip.sourceAnimationName}
      </span>
      
      {/* 片段時長顯示 */}
      {width > 60 && (
        <span className="ml-auto text-[10px] text-white/70 font-mono">
          {clip.sourceAnimationDuration}f
        </span>
      )}
    </div>
  );
});

ClipBlock.displayName = 'ClipBlock';

export default ClipBlock;

