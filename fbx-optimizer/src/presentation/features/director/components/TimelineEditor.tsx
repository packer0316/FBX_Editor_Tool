/**
 * TimelineEditor - 時間軸編輯器
 */

import React, { useRef, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { useDirectorStore } from '../../../stores/directorStore';
import { TimelineRuler } from './TimelineRuler';
import { TrackRow } from './TrackRow';
import { Playhead } from './Playhead';
import { DEFAULT_PIXELS_PER_FRAME } from '../../../../domain/entities/director/director.types';

export const TimelineEditor: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { tracks, timeline, ui, addTrack, setScrollOffset } = useDirectorStore();
  
  const pixelsPerFrame = DEFAULT_PIXELS_PER_FRAME * ui.zoom;
  const timelineWidth = timeline.totalFrames * pixelsPerFrame;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setScrollOffset(target.scrollLeft, target.scrollTop);
  }, [setScrollOffset]);

  const handleAddTrack = () => {
    addTrack();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-900/50">
      {/* 時間刻度尺 */}
      <TimelineRuler
        totalFrames={timeline.totalFrames}
        fps={timeline.fps}
        pixelsPerFrame={pixelsPerFrame}
        scrollOffsetX={ui.scrollOffsetX}
      />

      {/* 軌道區域 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto relative"
        onScroll={handleScroll}
      >
        {/* 時間軸內容 */}
        <div
          className="relative"
          style={{ width: timelineWidth, minHeight: '100%' }}
        >
          {/* 軌道列表 */}
          {tracks.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                onClick={handleAddTrack}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                <Plus size={16} />
                <span>新增軌道</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col">
              {tracks.map(track => (
                <TrackRow
                  key={track.id}
                  track={track}
                  pixelsPerFrame={pixelsPerFrame}
                  timelineWidth={timelineWidth}
                />
              ))}
              
              {/* 新增軌道按鈕 */}
              <div className="h-10 flex items-center px-2 border-t border-white/5">
                <button
                  onClick={handleAddTrack}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded transition-colors"
                >
                  <Plus size={12} />
                  <span>新增軌道</span>
                </button>
              </div>
            </div>
          )}

          {/* 播放頭 */}
          <Playhead
            currentFrame={timeline.currentFrame}
            pixelsPerFrame={pixelsPerFrame}
            height={tracks.length * 48 + 40}
          />
        </div>
      </div>
    </div>
  );
};

export default TimelineEditor;

