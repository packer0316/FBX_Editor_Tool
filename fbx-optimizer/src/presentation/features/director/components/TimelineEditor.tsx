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

const TRACK_HEADER_WIDTH = 120; // 左側 Track 標題區寬度

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
      {/* 頂部：時間刻度尺 */}
      <div className="flex h-6 border-b border-white/10">
        {/* 左側空白區（對應 Track Header） */}
        <div 
          className="flex-shrink-0 bg-gray-800/80 border-r border-white/10"
          style={{ width: TRACK_HEADER_WIDTH }}
        />
        {/* 時間刻度尺 */}
        <div className="flex-1 overflow-hidden">
          <TimelineRuler
            totalFrames={timeline.totalFrames}
            fps={timeline.fps}
            pixelsPerFrame={pixelsPerFrame}
            scrollOffsetX={ui.scrollOffsetX}
          />
        </div>
      </div>

      {/* 主體：Track Header + 軌道內容 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左側：Track Headers（固定寬度） */}
        <div 
          className="flex-shrink-0 bg-gray-800/50 border-r border-white/10 overflow-y-auto"
          style={{ width: TRACK_HEADER_WIDTH }}
        >
          {tracks.map(track => (
            <TrackRow
              key={track.id}
              track={track}
              pixelsPerFrame={pixelsPerFrame}
              timelineWidth={timelineWidth}
              isHeaderOnly
            />
          ))}
          {/* 新增軌道按鈕 */}
          <div className="h-10 flex items-center justify-center border-t border-white/5">
            <button
              onClick={handleAddTrack}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded transition-colors"
            >
              <Plus size={12} />
              <span>新增軌道</span>
            </button>
          </div>
        </div>

        {/* 右側：時間軸內容（可滾動） */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto relative"
          onScroll={handleScroll}
        >
          <div
            className="relative"
            style={{ width: timelineWidth, minHeight: '100%' }}
          >
            {tracks.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-gray-500 text-sm">拖曳動作到此處</span>
              </div>
            ) : (
              <div className="flex flex-col">
                {tracks.map(track => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    pixelsPerFrame={pixelsPerFrame}
                    timelineWidth={timelineWidth}
                    isHeaderOnly={false}
                  />
                ))}
              </div>
            )}

            {/* 播放頭 */}
            <Playhead
              currentFrame={timeline.currentFrame}
              pixelsPerFrame={pixelsPerFrame}
              height={Math.max(tracks.length * 48, 100)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelineEditor;

