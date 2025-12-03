/**
 * Playhead - 播放頭
 */

import React, { useCallback, useRef, memo } from 'react';
import { useDirectorStore } from '../../../stores/directorStore';

interface PlayheadProps {
  currentFrame: number;
  pixelsPerFrame: number;
  height: number;
}

export const Playhead: React.FC<PlayheadProps> = memo(({
  currentFrame,
  pixelsPerFrame,
  height,
}) => {
  const { setCurrentFrame, timeline } = useDirectorStore();
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const position = currentFrame * pixelsPerFrame;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDragging.current = true;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current) return;
      
      const container = containerRef.current?.parentElement;
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      const x = moveEvent.clientX - rect.left + container.scrollLeft;
      const frame = Math.round(x / pixelsPerFrame);
      setCurrentFrame(Math.max(0, Math.min(frame, timeline.totalFrames)));
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [pixelsPerFrame, setCurrentFrame, timeline.totalFrames]);

  return (
    <div
      ref={containerRef}
      className="absolute top-0 z-20 pointer-events-none"
      style={{ left: position, height }}
    >
      {/* 播放頭線條 */}
      <div className="absolute left-1/2 -translate-x-1/2 w-px h-full bg-red-500" />
    </div>
  );
});

Playhead.displayName = 'Playhead';

export default Playhead;

