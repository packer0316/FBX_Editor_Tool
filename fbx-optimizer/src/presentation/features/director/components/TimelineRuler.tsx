/**
 * TimelineRuler - 時間刻度尺（支援虛擬化渲染）
 * 
 * 功能：
 * - 顯示時間刻度
 * - 顯示區間播放區域（Loop Region）
 * - 支援點擊跳轉
 * - 支援拖曳調整區間
 */

import React, { useMemo, memo, useState, useCallback, useRef } from 'react';
import { useDirectorStore, useLoopRegion } from '../../../stores/directorStore';
import { formatFrameTime } from '../../../../utils/director/directorUtils';

interface TimelineRulerProps {
  totalFrames: number;
  fps: number;
  pixelsPerFrame: number;
  scrollOffsetX: number;
  containerWidth?: number;  // 可視區域寬度（用於虛擬化渲染）
}

/** 拖曳類型 */
type DragType = 'none' | 'in' | 'out' | 'region';

export const TimelineRuler: React.FC<TimelineRulerProps> = memo(({
  totalFrames,
  fps,
  pixelsPerFrame,
  scrollOffsetX,
  containerWidth = 1000,  // 預設值，向後兼容
}) => {
  const { setCurrentFrame, setInPoint, setOutPoint } = useDirectorStore();
  const loopRegion = useLoopRegion();
  
  // 拖曳狀態
  const [dragType, setDragType] = useState<DragType>('none');
  const dragStartRef = useRef<{ x: number; inPoint: number | null; outPoint: number | null }>({ 
    x: 0, 
    inPoint: null, 
    outPoint: null 
  });

  // 計算刻度間隔
  const { majorInterval, halfInterval, minorInterval } = useMemo(() => {
    // 根據縮放程度調整刻度間隔
    // majorInterval: 整秒刻度（顯示標籤）
    // halfInterval: 0.5 秒刻度（顯示淺色標籤）
    // minorInterval: 小刻度（只顯示刻度線）
    if (pixelsPerFrame >= 8) {
      return { majorInterval: fps, halfInterval: fps / 2, minorInterval: fps / 6 };
    } else if (pixelsPerFrame >= 4) {
      return { majorInterval: fps * 2, halfInterval: fps, minorInterval: fps / 2 };
    } else if (pixelsPerFrame >= 2) {
      return { majorInterval: fps * 5, halfInterval: fps * 2.5, minorInterval: fps };
    } else {
      return { majorInterval: fps * 10, halfInterval: fps * 5, minorInterval: fps * 2 };
    }
  }, [pixelsPerFrame, fps]);

  // 虛擬化渲染 - 只生成可視區域的刻度
  const visibleTicks = useMemo(() => {
    // 計算可視範圍（加 ±1 緩衝）
    const startFrame = Math.max(0, Math.floor(scrollOffsetX / pixelsPerFrame) - minorInterval);
    const endFrame = Math.min(
      totalFrames,
      Math.ceil((scrollOffsetX + containerWidth) / pixelsPerFrame) + minorInterval
    );
    
    const result: { frame: number; isMajor: boolean; isHalf: boolean; label?: string }[] = [];
    
    // 從最近的 minorInterval 倍數開始
    const firstFrame = Math.max(0, Math.floor(startFrame / minorInterval) * minorInterval);
    
    for (let frame = firstFrame; frame <= endFrame; frame += minorInterval) {
      if (frame < 0 || frame > totalFrames) continue;
      
      const isMajor = frame % majorInterval === 0;
      const isHalf = !isMajor && (frame % halfInterval === 0);
      
      // 計算時間標籤
      let label: string | undefined;
      if (isMajor) {
        label = formatFrameTime(frame, fps, false);
      } else if (isHalf) {
        // 0.5 秒標籤：如 7.5, 8.5
        const totalSeconds = frame / fps;
        if (totalSeconds >= 3600) {
          const hours = Math.floor(totalSeconds / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          const secs = totalSeconds % 60;
          label = `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toFixed(1).replace(/\.0$/, '.5')}`;
        } else if (totalSeconds >= 60) {
          const minutes = Math.floor(totalSeconds / 60);
          const secs = totalSeconds % 60;
          label = `${minutes}:${secs.toFixed(1).padStart(4, '0')}`;
        } else {
          label = totalSeconds.toFixed(1);
        }
      }
      
      result.push({
        frame,
        isMajor,
        isHalf,
        label,
      });
    }
    
    return result;
  }, [totalFrames, fps, majorInterval, halfInterval, minorInterval, scrollOffsetX, containerWidth, pixelsPerFrame]);

  // 將螢幕 X 座標轉換為幀數
  const xToFrame = useCallback((clientX: number, rect: DOMRect) => {
    const x = clientX - rect.left + scrollOffsetX;
    return Math.max(0, Math.min(Math.round(x / pixelsPerFrame), totalFrames));
  }, [scrollOffsetX, pixelsPerFrame, totalFrames]);

  const handleClick = (e: React.MouseEvent) => {
    // 如果正在拖曳，不觸發點擊
    if (dragType !== 'none') return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const frame = xToFrame(e.clientX, rect);
    setCurrentFrame(frame);
  };

  // 區間拖曳處理
  const handleRegionMouseDown = useCallback((
    e: React.MouseEvent,
    type: DragType
  ) => {
    e.stopPropagation();
    e.preventDefault();
    
    setDragType(type);
    dragStartRef.current = {
      x: e.clientX,
      inPoint: loopRegion.inPoint,
      outPoint: loopRegion.outPoint,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - dragStartRef.current.x;
      const deltaFrames = Math.round(deltaX / pixelsPerFrame);
      
      if (type === 'in' && dragStartRef.current.inPoint !== null) {
        const newIn = Math.max(0, dragStartRef.current.inPoint + deltaFrames);
        setInPoint(newIn);
      } else if (type === 'out' && dragStartRef.current.outPoint !== null) {
        const newOut = Math.min(totalFrames, dragStartRef.current.outPoint + deltaFrames);
        setOutPoint(newOut);
      } else if (type === 'region' && dragStartRef.current.inPoint !== null && dragStartRef.current.outPoint !== null) {
        const regionLength = dragStartRef.current.outPoint - dragStartRef.current.inPoint;
        let newIn = dragStartRef.current.inPoint + deltaFrames;
        let newOut = dragStartRef.current.outPoint + deltaFrames;
        
        // 邊界限制
        if (newIn < 0) {
          newIn = 0;
          newOut = regionLength;
        }
        if (newOut > totalFrames) {
          newOut = totalFrames;
          newIn = totalFrames - regionLength;
        }
        
        setInPoint(newIn);
        setOutPoint(newOut);
      }
    };

    const handleMouseUp = () => {
      setDragType('none');
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [loopRegion.inPoint, loopRegion.outPoint, pixelsPerFrame, totalFrames, setInPoint, setOutPoint]);

  // 計算區間條位置
  const regionStyle = useMemo(() => {
    if (loopRegion.inPoint === null || loopRegion.outPoint === null) return null;
    
    const left = loopRegion.inPoint * pixelsPerFrame;
    const width = (loopRegion.outPoint - loopRegion.inPoint) * pixelsPerFrame;
    
    return { left, width };
  }, [loopRegion.inPoint, loopRegion.outPoint, pixelsPerFrame]);

  return (
    <div
      className="h-full bg-gray-800/80 relative cursor-pointer select-none overflow-hidden"
      onClick={handleClick}
    >
      <div
        className="absolute top-0 left-0 h-full"
        style={{
          width: totalFrames * pixelsPerFrame,
          transform: `translateX(-${scrollOffsetX}px)`,
        }}
      >
        {/* 區間條 */}
        {regionStyle && (
          <div
            className={`absolute top-0 h-full transition-colors ${
              loopRegion.enabled 
                ? 'bg-cyan-500/20 border-t-2 border-cyan-500' 
                : 'bg-gray-500/10 border-t-2 border-gray-500'
            }`}
            style={{
              left: regionStyle.left,
              width: regionStyle.width,
              cursor: dragType === 'region' ? 'grabbing' : 'grab',
            }}
            onMouseDown={(e) => handleRegionMouseDown(e, 'region')}
          >
            {/* 入點拖曳手柄 */}
            <div
              className={`absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-cyan-400/50 transition-colors ${
                dragType === 'in' ? 'bg-cyan-400/50' : ''
              }`}
              style={{ marginLeft: -4 }}
              onMouseDown={(e) => handleRegionMouseDown(e, 'in')}
            >
              <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-4 rounded ${
                loopRegion.enabled ? 'bg-cyan-400' : 'bg-gray-500'
              }`} />
            </div>
            
            {/* 出點拖曳手柄 */}
            <div
              className={`absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-cyan-400/50 transition-colors ${
                dragType === 'out' ? 'bg-cyan-400/50' : ''
              }`}
              style={{ marginRight: -4 }}
              onMouseDown={(e) => handleRegionMouseDown(e, 'out')}
            >
              <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-4 rounded ${
                loopRegion.enabled ? 'bg-cyan-400' : 'bg-gray-500'
              }`} />
            </div>

            {/* 區間標籤 */}
            {regionStyle.width > 50 && (
              <span className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] font-mono whitespace-nowrap pointer-events-none ${
                loopRegion.enabled ? 'text-cyan-300' : 'text-gray-500'
              }`}>
                {loopRegion.outPoint! - loopRegion.inPoint!}f
              </span>
            )}
          </div>
        )}

        {/* 刻度 */}
        {visibleTicks.map(({ frame, isMajor, isHalf, label }) => (
          <div
            key={frame}
            className="absolute top-0"
            style={{ left: frame * pixelsPerFrame }}
          >
            {/* 刻度線 */}
            <div
              className={`w-px ${
                isMajor ? 'h-4 bg-gray-500' : 
                isHalf ? 'h-3 bg-gray-600' : 
                'h-2 bg-gray-700'
              }`}
              style={{ marginTop: isMajor ? 0 : isHalf ? 4 : 8 }}
            />
            {/* 標籤 */}
            {label && (
              <span className={`absolute top-1 left-1 text-[10px] font-mono whitespace-nowrap ${
                isMajor ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {label}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});

TimelineRuler.displayName = 'TimelineRuler';

export default TimelineRuler;

