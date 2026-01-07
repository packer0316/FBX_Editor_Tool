/**
 * TimelineEditor - 時間軸編輯器
 */

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { Plus, ZoomIn, ZoomOut } from 'lucide-react';
import { useDirectorStore, useLoopRegion } from '../../../stores/directorStore';
import { directorEventBus } from '../../../../infrastructure/events';
import { TimelineRuler } from './TimelineRuler';
import { TrackRow } from './TrackRow';
import { DEFAULT_PIXELS_PER_FRAME, MIN_ZOOM, MAX_ZOOM } from '../../../../domain/entities/director/director.types';
import type { ModelInstance } from '../../../../domain/value-objects/ModelInstance';

const DEFAULT_HEADER_WIDTH = 140; // 預設 Track 標題區寬度
const MIN_HEADER_WIDTH = 80;
const MAX_HEADER_WIDTH = 300;

// TODO-4: 指數縮放相關常數
const ZOOM_SENSITIVITY = 0.002;  // 滾輪縮放靈敏度
const ZOOM_BUTTON_FACTOR = 1.25; // 按鈕縮放倍率（放大/縮小 25%）

interface TimelineEditorProps {
  /** 模型實例列表（用於查詢音效/特效綁定） */
  models?: ModelInstance[];
}

export const TimelineEditor: React.FC<TimelineEditorProps> = ({ models = [] }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const headerContainerRef = useRef<HTMLDivElement>(null);
  const { tracks, timeline, ui, addTrack, setScrollOffset, setZoom, setZoomWithScroll, setCurrentFrame, copyClip, pasteClip, clipboardClips, removeClip, getClipById, selectClips, clearSelection } = useDirectorStore();
  const loopRegion = useLoopRegion();
  
  // 軌道名稱欄位寬度狀態
  const [headerWidth, setHeaderWidth] = useState(DEFAULT_HEADER_WIDTH);
  const [isResizingHeader, setIsResizingHeader] = useState(false);
  
  // TODO-5 & TODO-6: 追踪容器寬度，用於虛擬化渲染
  const [containerWidth, setContainerWidth] = useState(1000);
  
  // TODO-8: 縮放動畫過渡
  const [isZooming, setIsZooming] = useState(false);
  const zoomTimeoutRef = useRef<number>();
  
  // TODO-9: 縮放視覺回饋
  const [showZoomToast, setShowZoomToast] = useState(false);
  const toastTimeoutRef = useRef<number>();
  
  // 框選功能狀態
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null);
  const [marqueeEnd, setMarqueeEnd] = useState<{ x: number; y: number } | null>(null);
  const trackContentRef = useRef<HTMLDivElement>(null);
  
  // ============================================
  // TODO-2: 防止 Store ↔ DOM 無限循環的 Ref
  // ============================================
  const isInternalScrollRef = useRef(false);
  const lastScrollXRef = useRef(0);
  const lastScrollYRef = useRef(0);
  
  const pixelsPerFrame = DEFAULT_PIXELS_PER_FRAME * ui.zoom;
  const timelineWidth = timeline.totalFrames * pixelsPerFrame;

  // 處理使用者滾動，忽略程式觸發的滾動
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    
    // 若是程式觸發的滾動，且值接近預期，則忽略
    if (isInternalScrollRef.current) {
      const isExpectedX = Math.abs(target.scrollLeft - lastScrollXRef.current) < 2;
      const isExpectedY = Math.abs(target.scrollTop - lastScrollYRef.current) < 2;
      
      if (isExpectedX && isExpectedY) {
        isInternalScrollRef.current = false;
        return;  // 忽略程式觸發的 scroll 事件
      }
    }
    
    // 使用者滾動，更新 Store
    setScrollOffset(target.scrollLeft, target.scrollTop);
    
    // 同步左側 Track Headers 的垂直滾動
    if (headerContainerRef.current) {
      headerContainerRef.current.scrollTop = target.scrollTop;
    }
  }, [setScrollOffset]);
  
  // 同步 Store scrollOffset → DOM scrollLeft/Top
  useEffect(() => {
    const container = containerRef.current;
    const headerContainer = headerContainerRef.current;
    if (!container) return;
    
    const needUpdateX = Math.abs(container.scrollLeft - ui.scrollOffsetX) > 1;
    const needUpdateY = Math.abs(container.scrollTop - ui.scrollOffsetY) > 1;
    
    if (needUpdateX || needUpdateY) {
      // 標記為程式觸發的滾動
      isInternalScrollRef.current = true;
      lastScrollXRef.current = ui.scrollOffsetX;
      lastScrollYRef.current = ui.scrollOffsetY;
      
      // 同步到 DOM
      if (needUpdateX) container.scrollLeft = ui.scrollOffsetX;
      if (needUpdateY) {
        container.scrollTop = ui.scrollOffsetY;
        // 同步左側 Track Headers
        if (headerContainer) headerContainer.scrollTop = ui.scrollOffsetY;
      }
    }
  }, [ui.scrollOffsetX, ui.scrollOffsetY]);

  // 滑鼠滾輪縮放（使用合併更新避免閃爍 + 指數縮放）
  const handleWheel = useCallback((e: WheelEvent) => {
    // 直接使用滾輪縮放時間軸
    e.preventDefault();
    
    // TODO-8: 標記正在縮放（禁用動畫）
    setIsZooming(true);
    if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
    zoomTimeoutRef.current = window.setTimeout(() => setIsZooming(false), 150);
    
    // TODO-9: 顯示縮放百分比 toast
    setShowZoomToast(true);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => setShowZoomToast(false), 1000);
    
    // TODO-4: 指數縮放 - 根據 deltaY 計算縮放因子
    // deltaY 正值 = 向下滾動 = 縮小，deltaY 負值 = 向上滾動 = 放大
    const zoomFactor = Math.pow(1 + ZOOM_SENSITIVITY, -e.deltaY);
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, ui.zoom * zoomFactor));
    
    // 以滑鼠位置為中心縮放
    if (containerRef.current) {
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const currentContainerWidth = rect.width;
      
      // 計算滑鼠指向的幀位置
      const mouseX = e.clientX - rect.left + ui.scrollOffsetX;
      const frameAtMouse = mouseX / pixelsPerFrame;
      
      // 計算新的時間軸寬度和最大滾動值
      const newPixelsPerFrame = DEFAULT_PIXELS_PER_FRAME * newZoom;
      const newTimelineWidth = timeline.totalFrames * newPixelsPerFrame;
      const maxScrollX = Math.max(0, newTimelineWidth - currentContainerWidth);
      
      // 計算新的滾動位置（保持滑鼠位置不變）
      const rawScrollX = frameAtMouse * newPixelsPerFrame - (e.clientX - rect.left);
      
      // 邊界限制：左邊界 0，右邊界 maxScrollX
      const newScrollX = Math.max(0, Math.min(rawScrollX, maxScrollX));
      
      // 使用合併更新（單次 set() 避免雙重渲染）
      setZoomWithScroll(newZoom, newScrollX, ui.scrollOffsetY);
    } else {
      setZoom(newZoom);
    }
  }, [ui.zoom, ui.scrollOffsetX, ui.scrollOffsetY, pixelsPerFrame, timeline.totalFrames, setZoom, setZoomWithScroll]);

  // 綁定滾輪事件（需要 passive: false 來阻止默認行為）
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);
  
  // TODO-5 & TODO-6: 監聽容器大小變化
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    // 初始化寬度
    setContainerWidth(container.clientWidth);
    
    // 使用 ResizeObserver 監聽大小變化
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === container) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    
    resizeObserver.observe(container);
    
    return () => resizeObserver.disconnect();
  }, []);
  
  // TODO-8 & TODO-9: 清理 timeout（防止 Memory Leak）
  useEffect(() => {
    return () => {
      if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);
  
  // 全域鍵盤快捷鍵（Ctrl+C/V、Delete）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果焦點在輸入框內，不處理快捷鍵
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        return;
      }
      
      // Ctrl+C / Cmd+C：複製選中的 clip（暫時只複製第一個）
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (ui.selectedClipIds.length > 0) {
          e.preventDefault();
          copyClip(ui.selectedClipIds[0]);
        }
      }
      
      // Ctrl+V / Cmd+V：貼上 clip（緊接在原片段後方）
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (clipboardClips.length > 0 && ui.selectedClipIds.length > 0) {
          e.preventDefault();
          const selectedClip = getClipById(ui.selectedClipIds[0]);
          if (selectedClip) {
            const pasteFrame = selectedClip.endFrame + 1;
            pasteClip(selectedClip.trackId, pasteFrame);
          }
        }
      }
      
      // Delete / Backspace：刪除選中的 clips
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (ui.selectedClipIds.length > 0) {
          e.preventDefault();
          // 刪除所有選中的 clips
          ui.selectedClipIds.forEach((clipId) => removeClip(clipId));
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [ui.selectedClipIds, clipboardClips, copyClip, pasteClip, removeClip, getClipById]);

  // 縮放按鈕處理（TODO-4: 使用固定倍率縮放）
  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(MAX_ZOOM, ui.zoom * ZOOM_BUTTON_FACTOR);
    setZoom(newZoom);
  }, [ui.zoom, setZoom]);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(MIN_ZOOM, ui.zoom / ZOOM_BUTTON_FACTOR);
    setZoom(newZoom);
  }, [ui.zoom, setZoom]);

  // ============================================
  // 框選功能
  // ============================================
  
  const TRACK_HEIGHT = 48; // Track 高度（與 TrackRow 一致）
  
  const handleMarqueeMouseDown = useCallback((e: React.MouseEvent) => {
    // 只有在空白區域點擊時才開始框選（不是在 clip 上）
    const target = e.target as HTMLElement;
    if (target.closest('[role="button"]') || e.button !== 0) return;
    
    const rect = trackContentRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left + ui.scrollOffsetX;
    const y = e.clientY - rect.top;
    
    setIsMarqueeSelecting(true);
    setMarqueeStart({ x, y });
    setMarqueeEnd({ x, y });
    
    // 如果沒有按 Ctrl 鍵，清空現有選取
    if (!e.ctrlKey && !e.metaKey) {
      clearSelection();
    }
  }, [ui.scrollOffsetX, clearSelection]);
  
  useEffect(() => {
    if (!isMarqueeSelecting) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const rect = trackContentRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const x = e.clientX - rect.left + ui.scrollOffsetX;
      const y = e.clientY - rect.top;
      
      setMarqueeEnd({ x, y });
    };
    
    const handleMouseUp = () => {
      if (marqueeStart && marqueeEnd) {
        // 計算框選範圍
        const left = Math.min(marqueeStart.x, marqueeEnd.x);
        const right = Math.max(marqueeStart.x, marqueeEnd.x);
        const top = Math.min(marqueeStart.y, marqueeEnd.y);
        const bottom = Math.max(marqueeStart.y, marqueeEnd.y);
        
        // 找出與框選範圍相交的 clips
        const selectedIds: string[] = [];
        
        tracks.forEach((track, trackIndex) => {
          const trackTop = trackIndex * TRACK_HEIGHT;
          const trackBottom = trackTop + TRACK_HEIGHT;
          
          // 檢查 track 是否與框選範圍在 Y 軸上相交
          if (trackBottom > top && trackTop < bottom) {
            track.clips.forEach((clip) => {
              const clipLeft = clip.startFrame * pixelsPerFrame;
              const clipRight = clip.endFrame * pixelsPerFrame;
              
              // 檢查 clip 是否與框選範圍在 X 軸上相交
              if (clipRight > left && clipLeft < right) {
                selectedIds.push(clip.id);
              }
            });
          }
        });
        
        if (selectedIds.length > 0) {
          selectClips(selectedIds);
        }
      }
      
      setIsMarqueeSelecting(false);
      setMarqueeStart(null);
      setMarqueeEnd(null);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isMarqueeSelecting, marqueeStart, marqueeEnd, tracks, pixelsPerFrame, ui.scrollOffsetX, selectClips]);
  
  // 計算框選矩形的顯示位置
  const marqueeRect = isMarqueeSelecting && marqueeStart && marqueeEnd ? {
    left: Math.min(marqueeStart.x, marqueeEnd.x) - ui.scrollOffsetX,
    top: Math.min(marqueeStart.y, marqueeEnd.y),
    width: Math.abs(marqueeEnd.x - marqueeStart.x),
    height: Math.abs(marqueeEnd.y - marqueeStart.y),
  } : null;

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

  // 播放頭位置（相對於時間軸區域左邊界）
  const playheadPosition = timeline.currentFrame * pixelsPerFrame - ui.scrollOffsetX + headerWidth;
  const isPlayheadVisible = playheadPosition >= headerWidth && playheadPosition <= headerWidth + containerWidth;

  // 播放頭拖曳處理
  const handlePlayheadDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = moveEvent.clientX - rect.left + ui.scrollOffsetX;
      const frame = Math.max(0, Math.min(Math.round(x / pixelsPerFrame), timeline.totalFrames));
      setCurrentFrame(frame);
      // 發送 seek 事件，讓播放邏輯重置播放起始時間
      directorEventBus.emitSeek({ frame });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [pixelsPerFrame, setCurrentFrame, timeline.totalFrames, ui.scrollOffsetX]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-900/50 relative">
      {/* 全局播放頭（跨越時間刻度尺和軌道區域） */}
      {isPlayheadVisible && (
        <div
          className="absolute top-0 bottom-0 z-30 pointer-events-none"
          style={{ left: playheadPosition }}
        >
          {/* 頭部手柄 */}
          <div
            className="absolute left-1/2 -translate-x-1/2 w-4 cursor-ew-resize pointer-events-auto group"
            style={{ top: 0, height: 24 }}
            onMouseDown={handlePlayheadDrag}
          >
            {/* 倒三角形頭部 */}
            <div 
              className="w-full h-full bg-red-500/80 group-hover:bg-red-500 transition-colors"
              style={{
                clipPath: 'polygon(0 0, 100% 0, 100% 65%, 50% 100%, 0 65%)',
              }}
            />
          </div>
          {/* 垂直線條 */}
          <div 
            className="absolute left-1/2 -translate-x-1/2 w-px bg-red-500"
            style={{ top: 24, bottom: 0 }}
          />
        </div>
      )}

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
            containerWidth={containerWidth}
          />
        </div>
      </div>

      {/* 主體：Track Header + 軌道內容 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左側：Track Headers（可調整寬度，與右側同步垂直滾動） */}
        <div 
          ref={headerContainerRef}
          className="flex-shrink-0 bg-gray-800/50 overflow-y-scroll overflow-x-hidden relative scrollbar-hide"
          style={{ 
            width: headerWidth,
            // 隱藏滾動條但保持滾動功能
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
          onScroll={(e) => {
            // 當左側被滾動時，同步右側
            const target = e.target as HTMLDivElement;
            if (containerRef.current && Math.abs(containerRef.current.scrollTop - target.scrollTop) > 1) {
              containerRef.current.scrollTop = target.scrollTop;
            }
          }}
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
          {/* TODO-9: 縮放百分比 Toast */}
          {showZoomToast && (
            <div className="absolute top-2 right-2 bg-black/80 text-white px-2 py-1 rounded text-xs font-mono z-50 pointer-events-none">
              {Math.round(ui.zoom * 100)}%
            </div>
          )}
          
          <div
            ref={trackContentRef}
            className="relative"
            style={{ 
              width: timelineWidth, 
              minHeight: '100%',
              // TODO-8: 縮放時禁用動畫，停止後平滑過渡
              transition: isZooming ? 'none' : 'width 0.15s ease-out',
            }}
            onMouseDown={handleMarqueeMouseDown}
          >
            {/* 框選矩形 */}
            {marqueeRect && (
              <div
                className="absolute bg-blue-500/20 border border-blue-500/50 pointer-events-none z-50"
                style={{
                  left: marqueeRect.left,
                  top: marqueeRect.top,
                  width: marqueeRect.width,
                  height: marqueeRect.height,
                }}
              />
            )}
            
            {/* 區間播放背景區域 */}
            {loopRegion.inPoint !== null && loopRegion.outPoint !== null && (
              <div
                className={`absolute top-0 bottom-0 pointer-events-none ${
                  loopRegion.enabled 
                    ? 'bg-cyan-500/10' 
                    : 'bg-gray-500/5'
                }`}
                style={{
                  left: loopRegion.inPoint * pixelsPerFrame,
                  width: (loopRegion.outPoint - loopRegion.inPoint) * pixelsPerFrame,
                }}
              />
            )}
            
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
                    scrollOffsetX={ui.scrollOffsetX}
                    containerWidth={containerWidth}
                    models={models}
                  />
                ))}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelineEditor;

