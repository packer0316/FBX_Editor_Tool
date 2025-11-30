/**
 * TimelineRuler - 時間刻度尺（支援虛擬化渲染）
 * 
 * TODO-5 & TODO-6: 只渲染可視區域的刻度，提升效能
 */

import React, { useMemo, memo } from 'react';
import { useDirectorStore } from '../../../stores/directorStore';

interface TimelineRulerProps {
  totalFrames: number;
  fps: number;
  pixelsPerFrame: number;
  scrollOffsetX: number;
  containerWidth?: number;  // 可視區域寬度（用於虛擬化渲染）
}

export const TimelineRuler: React.FC<TimelineRulerProps> = memo(({
  totalFrames,
  fps,
  pixelsPerFrame,
  scrollOffsetX,
  containerWidth = 1000,  // 預設值，向後兼容
}) => {
  const { setCurrentFrame } = useDirectorStore();

  // 計算刻度間隔
  const { majorInterval, minorInterval } = useMemo(() => {
    // 根據縮放程度調整刻度間隔
    if (pixelsPerFrame >= 8) {
      return { majorInterval: fps, minorInterval: fps / 6 }; // 每秒一個大刻度
    } else if (pixelsPerFrame >= 4) {
      return { majorInterval: fps * 2, minorInterval: fps / 2 };
    } else if (pixelsPerFrame >= 2) {
      return { majorInterval: fps * 5, minorInterval: fps };
    } else {
      return { majorInterval: fps * 10, minorInterval: fps * 2 };
    }
  }, [pixelsPerFrame, fps]);

  // TODO-6: 虛擬化渲染 - 只生成可視區域的刻度
  const visibleTicks = useMemo(() => {
    // 計算可視範圍（加 ±1 緩衝）
    const startFrame = Math.max(0, Math.floor(scrollOffsetX / pixelsPerFrame) - minorInterval);
    const endFrame = Math.min(
      totalFrames,
      Math.ceil((scrollOffsetX + containerWidth) / pixelsPerFrame) + minorInterval
    );
    
    const result: { frame: number; isMajor: boolean; label?: string }[] = [];
    
    // 從最近的 minorInterval 倍數開始
    const firstFrame = Math.max(0, Math.floor(startFrame / minorInterval) * minorInterval);
    
    for (let frame = firstFrame; frame <= endFrame; frame += minorInterval) {
      if (frame < 0 || frame > totalFrames) continue;
      
      const isMajor = frame % majorInterval === 0;
      const seconds = Math.floor(frame / fps);
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      
      result.push({
        frame,
        isMajor,
        label: isMajor ? `${minutes}:${secs.toString().padStart(2, '0')}` : undefined,
      });
    }
    
    return result;
  }, [totalFrames, fps, majorInterval, minorInterval, scrollOffsetX, containerWidth, pixelsPerFrame]);

  const handleClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollOffsetX;
    const frame = Math.round(x / pixelsPerFrame);
    setCurrentFrame(Math.max(0, Math.min(frame, totalFrames)));
  };

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
        {visibleTicks.map(({ frame, isMajor, label }) => (
          <div
            key={frame}
            className="absolute top-0"
            style={{ left: frame * pixelsPerFrame }}
          >
            {/* 刻度線 */}
            <div
              className={`w-px ${isMajor ? 'h-4 bg-gray-500' : 'h-2 bg-gray-600'}`}
              style={{ marginTop: isMajor ? 0 : 8 }}
            />
            {/* 標籤 */}
            {label && (
              <span className="absolute top-1 left-1 text-[10px] text-gray-400 font-mono whitespace-nowrap">
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

