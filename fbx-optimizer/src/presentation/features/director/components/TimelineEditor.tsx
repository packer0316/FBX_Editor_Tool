/**
 * TimelineEditor - 時間軸編輯器
 */

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { Plus, ZoomIn, ZoomOut } from 'lucide-react';
import { useDirectorStore } from '../../../stores/directorStore';
import { TimelineRuler } from './TimelineRuler';
import { TrackRow } from './TrackRow';
import { Playhead } from './Playhead';
import { DEFAULT_PIXELS_PER_FRAME, MIN_ZOOM, MAX_ZOOM } from '../../../../domain/entities/director/director.types';

const DEFAULT_HEADER_WIDTH = 140; // 預設 Track 標題區寬度
const MIN_HEADER_WIDTH = 80;
const MAX_HEADER_WIDTH = 300;
const ZOOM_STEP = 0.1; // 每次縮放步進

export const TimelineEditor: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { tracks, timeline, ui, addTrack, setScrollOffset, setZoom } = useDirectorStore();
  
  // 軌道名稱欄位寬度狀態
  const [headerWidth, setHeaderWidth] = useState(DEFAULT_HEADER_WIDTH);
  const [isResizingHeader, setIsResizingHeader] = useState(false);
  
  const pixelsPerFrame = DEFAULT_PIXELS_PER_FRAME * ui.zoom;
  const timelineWidth = timeline.totalFrames * pixelsPerFrame;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setScrollOffset(target.scrollLeft, target.scrollTop);
  }, [setScrollOffset]);

  // 滑鼠滾輪縮放
  const handleWheel = useCallback((e: WheelEvent) => {
    // 直接使用滾輪縮放時間軸
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, ui.zoom + delta));
    
    // 以滑鼠位置為中心縮放
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left + ui.scrollOffsetX;
      const frameAtMouse = mouseX / pixelsPerFrame;
      
      // 更新 zoom
      setZoom(newZoom);
      
      // 調整滾動位置以保持滑鼠位置不變
      const newPixelsPerFrame = DEFAULT_PIXELS_PER_FRAME * newZoom;
      const newScrollX = frameAtMouse * newPixelsPerFrame - (e.clientX - rect.left);
      setScrollOffset(Math.max(0, newScrollX), ui.scrollOffsetY);
    } else {
      setZoom(newZoom);
    }
  }, [ui.zoom, ui.scrollOffsetX, ui.scrollOffsetY, pixelsPerFrame, setZoom, setScrollOffset]);

  // 綁定滾輪事件（需要 passive: false 來阻止默認行為）
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // 縮放按鈕處理
  const handleZoomIn = useCallback(() => {
    setZoom(Math.min(MAX_ZOOM, ui.zoom + ZOOM_STEP));
  }, [ui.zoom, setZoom]);

  const handleZoomOut = useCallback(() => {
    setZoom(Math.max(MIN_ZOOM, ui.zoom - ZOOM_STEP));
  }, [ui.zoom, setZoom]);

  // Header 寬度調整
  const handleHeaderResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingHeader(true);
  }, []);

  useEffect(() => {
    if (!isResizingHeader) return;

    const handleMouseMove = (e: MouseEvent) => {
      const timelineRect = containerRef.current?.parentElement?.getBoundingClientRect();
      if (!timelineRect) return;
      
      const newWidth = e.clientX - timelineRect.left;
      setHeaderWidth(Math.max(MIN_HEADER_WIDTH, Math.min(MAX_HEADER_WIDTH, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizingHeader(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingHeader]);

  const handleAddTrack = () => {
    addTrack();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-900/50">
      {/* 頂部：時間刻度尺 */}
      <div className="flex h-6 border-b border-white/10">
        {/* 左側：縮放控制 */}
        <div 
          className="flex-shrink-0 bg-gray-800/80 flex items-center justify-center gap-1 px-1 relative"
          style={{ width: headerWidth }}
        >
          <button
            onClick={handleZoomOut}
            className="p-0.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title="縮小"
            disabled={ui.zoom <= MIN_ZOOM}
          >
            <ZoomOut size={14} />
          </button>
          <span className="text-[10px] text-gray-500 w-8 text-center font-mono" title="滾輪縮放">
            {Math.round(ui.zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-0.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title="放大"
            disabled={ui.zoom >= MAX_ZOOM}
          >
            <ZoomIn size={14} />
          </button>
          {/* 調整寬度把手 */}
          <div
            className="absolute right-0 top-0 bottom-0 w-1 bg-white/10 hover:bg-amber-400 cursor-ew-resize transition-colors"
            onMouseDown={handleHeaderResizeStart}
          />
        </div>
        {/* 時間刻度尺 */}
        <div className="flex-1 overflow-hidden border-l border-white/10">
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
        {/* 左側：Track Headers（可調整寬度） */}
        <div 
          className="flex-shrink-0 bg-gray-800/50 overflow-y-auto relative"
          style={{ width: headerWidth }}
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
          
          {/* 調整寬度把手 */}
          <div
            className={`absolute right-0 top-0 bottom-0 w-1 hover:bg-amber-400 cursor-ew-resize transition-colors ${
              isResizingHeader ? 'bg-amber-400' : 'bg-white/10'
            }`}
            onMouseDown={handleHeaderResizeStart}
          />
        </div>

        {/* 右側：時間軸內容（可滾動） */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto relative border-l border-white/10"
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

