/**
 * TrackRow - 軌道元件
 */

import React, { memo, useCallback, useRef } from 'react';
import { Trash2, Lock, Unlock, Volume2, VolumeX } from 'lucide-react';
import { useDirectorStore } from '../../../stores/directorStore';
import { ClipBlock } from './ClipBlock';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import type { DirectorTrack } from '../../../../domain/entities/director/director.types';

interface TrackRowProps {
  track: DirectorTrack;
  pixelsPerFrame: number;
  timelineWidth: number;
}

export const TrackRow: React.FC<TrackRowProps> = memo(({
  track,
  pixelsPerFrame,
  timelineWidth,
}) => {
  const { removeTrack, updateTrack, ui } = useDirectorStore();
  const trackRef = useRef<HTMLDivElement>(null);
  
  const { handleTrackDragOver, handleTrackDrop } = useDragAndDrop({
    pixelsPerFrame,
    enableSnap: true,
  });

  const handleRemoveTrack = useCallback(() => {
    removeTrack(track.id);
  }, [removeTrack, track.id]);

  const handleToggleLock = useCallback(() => {
    updateTrack(track.id, { isLocked: !track.isLocked });
  }, [updateTrack, track.id, track.isLocked]);

  const handleToggleMute = useCallback(() => {
    updateTrack(track.id, { isMuted: !track.isMuted });
  }, [updateTrack, track.id, track.isMuted]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    handleTrackDragOver(e, track.id);
  }, [handleTrackDragOver, track.id]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    if (!trackRef.current) return;
    handleTrackDrop(e, track.id, trackRef.current);
  }, [handleTrackDrop, track.id]);

  return (
    <div
      className={`h-12 flex border-b border-white/5 ${
        ui.selectedTrackId === track.id ? 'bg-white/5' : ''
      } ${track.isMuted ? 'opacity-50' : ''}`}
    >
      {/* 軌道標題區（固定位置） */}
      <div className="w-32 flex-shrink-0 flex items-center gap-1 px-2 bg-gray-800/50 border-r border-white/10 sticky left-0 z-10">
        <span className="text-xs text-gray-300 truncate flex-1" title={track.name}>
          {track.name}
        </span>
        
        {/* 控制按鈕 */}
        <button
          onClick={handleToggleMute}
          className={`p-1 rounded hover:bg-white/10 ${track.isMuted ? 'text-red-400' : 'text-gray-500'}`}
          title={track.isMuted ? '取消靜音' : '靜音'}
        >
          {track.isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
        </button>
        
        <button
          onClick={handleToggleLock}
          className={`p-1 rounded hover:bg-white/10 ${track.isLocked ? 'text-amber-400' : 'text-gray-500'}`}
          title={track.isLocked ? '解鎖' : '鎖定'}
        >
          {track.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
        </button>
        
        <button
          onClick={handleRemoveTrack}
          className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-red-400"
          title="刪除軌道"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* 時間軸區域（可放置片段） */}
      <div
        ref={trackRef}
        className={`flex-1 relative ${track.isLocked ? 'cursor-not-allowed' : ''}`}
        style={{ width: timelineWidth }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* 格線背景 */}
        <div className="absolute inset-0 pointer-events-none">
          {/* 可以添加格線視覺效果 */}
        </div>

        {/* 片段 */}
        {track.clips.map(clip => (
          <ClipBlock
            key={clip.id}
            clip={clip}
            pixelsPerFrame={pixelsPerFrame}
            isLocked={track.isLocked}
          />
        ))}
      </div>
    </div>
  );
});

TrackRow.displayName = 'TrackRow';

export default TrackRow;

