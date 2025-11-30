/**
 * SpineAnimationTab - 動畫分頁
 * 
 * 管理 Spine 動畫的選擇、播放控制、速度調整等。
 */

import React, { useCallback, useState, useEffect } from 'react';
import { Play, Repeat } from 'lucide-react';
import type { SpineElement2D } from '../../../../domain/value-objects/Element2D';
import type { SpineInstance } from '../../../../domain/value-objects/SpineInstance';

// ============================================================================
// 類型定義
// ============================================================================

interface SpineAnimationTabProps {
  element: SpineElement2D;
  spineInstance: SpineInstance;
  onUpdateElement: (updates: Partial<SpineElement2D>) => void;
}

// ============================================================================
// 主組件
// ============================================================================

export const SpineAnimationTab: React.FC<SpineAnimationTabProps> = ({
  element,
  spineInstance,
  onUpdateElement,
}) => {
  const animations = spineInstance.skeletonInfo.animations;

  // 本地滑桿狀態（類似 3D 的 sliderValue）
  const [timeSliderValue, setTimeSliderValue] = useState(element.currentTime);
  const [speedSliderValue, setSpeedSliderValue] = useState(element.timeScale);
  const [isDraggingTime, setIsDraggingTime] = useState(false);
  const [isDraggingSpeed, setIsDraggingSpeed] = useState(false);

  // 非拖動時，同步外部時間到滑桿
  useEffect(() => {
    if (!isDraggingTime) {
      setTimeSliderValue(element.currentTime);
    }
  }, [element.currentTime, isDraggingTime]);

  // 非拖動時，同步外部速度到滑桿
  useEffect(() => {
    if (!isDraggingSpeed) {
      setSpeedSliderValue(element.timeScale);
    }
  }, [element.timeScale, isDraggingSpeed]);

  // 選擇動畫
  const handleSelectAnimation = useCallback((animationName: string) => {
    onUpdateElement({
      currentAnimation: animationName,
      currentTime: 0,
      isPlaying: true,
    });
  }, [onUpdateElement]);

  // 切換循環
  const handleToggleLoop = useCallback(() => {
    onUpdateElement({ loop: !element.loop });
  }, [element.loop, onUpdateElement]);

  // 時間滑桿改變（拖動時 - 即時更新以支援暫停時的畫面同步）
  const handleTimeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setTimeSliderValue(val);
    
    // 直接更新，不節流，讓拖動時畫面即時同步
    onUpdateElement({ currentTime: Math.max(0, val) });
  }, [onUpdateElement]);

  // 速度滑桿改變
  const handleSpeedChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setSpeedSliderValue(val);
    onUpdateElement({ timeScale: val });
  }, [onUpdateElement]);

  // 取得當前動畫資訊
  const currentAnimationInfo = animations.find(a => a.name === element.currentAnimation);
  const duration = currentAnimationInfo?.duration ?? 1;

  // 播放/暫停切換（業界標準邏輯：動畫結束後再按播放 = 從頭重播）
  const handleTogglePlay = useCallback(() => {
    if (!currentAnimationInfo) {
      onUpdateElement({ isPlaying: !element.isPlaying });
      return;
    }
    
    // 檢查動畫是否已播放完成（非循環模式下）
    const isAtEnd = !element.loop && element.currentTime >= duration - 0.05;
    
    if (isAtEnd && !element.isPlaying) {
      // 動畫已結束 + 按播放 = 從頭重播
      onUpdateElement({ currentTime: 0, isPlaying: true });
    } else {
      // 正常的播放/暫停切換
      onUpdateElement({ isPlaying: !element.isPlaying });
    }
  }, [element.isPlaying, element.loop, element.currentTime, duration, currentAnimationInfo, onUpdateElement]);

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* 頂部控制欄 - 緊湊橫向佈局 */}
      <div className="flex items-center gap-2 bg-[#2a2d36]/50 rounded-lg p-2">
        {/* 左側：播放控制按鈕 */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleTogglePlay}
            className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-purple-400"
            title={element.isPlaying ? '暫停' : '播放'}
          >
            {element.isPlaying ? <Play size={16} className="fill-current" /> : <Play size={16} />}
          </button>
          <button
            onClick={() => onUpdateElement({ isPlaying: false, currentTime: 0 })}
            className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-gray-400"
            title="停止"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="4" y="4" width="8" height="8" rx="1" />
            </svg>
          </button>
          <button
            onClick={handleToggleLoop}
            className={`p-1.5 rounded-md transition-colors ${element.loop ? 'text-purple-400 bg-purple-500/20' : 'text-gray-400 hover:bg-white/10'}`}
            title="循環播放"
          >
            <Repeat size={16} />
          </button>
        </div>

        {/* 中間：時間顯示 */}
        <div className="flex items-center gap-1.5 text-xs px-2 py-1 bg-black/20 rounded">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-gray-500">
            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1" />
            <path d="M6 3V6L8 8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          </svg>
          <span className="text-purple-300 font-mono tabular-nums">{timeSliderValue.toFixed(2)}s</span>
          <span className="text-gray-600">/</span>
          <span className="text-gray-400 font-mono tabular-nums">{duration.toFixed(2)}s</span>
        </div>

        {/* 右側：速度控制 */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[10px] text-gray-500 uppercase">Speed</span>
          <div className="relative w-20 h-4 flex items-center">
            {/* 速度滑桿底色 */}
            <div className="absolute w-full h-1.5 bg-gray-700 rounded-full" />
            {/* 速度進度 */}
            <div 
              className="absolute h-1.5 bg-purple-500/60 rounded-full" 
              style={{ width: `${((speedSliderValue - 0.1) / 1.9) * 100}%` }}
            />
            <input
              type="range"
              min={0.1}
              max={2.0}
              step={0.1}
              value={speedSliderValue}
              onChange={handleSpeedChange}
              onMouseDown={() => setIsDraggingSpeed(true)}
              onMouseUp={() => setIsDraggingSpeed(false)}
              className="absolute w-full h-4 cursor-pointer appearance-none bg-transparent
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg
                [&::-moz-range-thumb]:bg-purple-400 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full"
            />
          </div>
          <span className="text-xs text-purple-300 font-semibold w-9 text-right tabular-nums">
            {speedSliderValue.toFixed(1)}x
          </span>
        </div>
      </div>

      {/* 時間軸滑桿 - 大型視覺設計 */}
      <div className="relative h-8 flex items-center px-1">
        {/* 背景軌道 */}
        <div className="absolute inset-0 h-2 top-3 bg-gradient-to-r from-gray-800 to-gray-700 rounded-full overflow-hidden pointer-events-none">
          <div className="h-full bg-gradient-to-r from-purple-600/20 to-purple-500/20" />
        </div>
        {/* 進度條 */}
        <div
          className="absolute h-2 top-3 bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all duration-75 shadow-lg shadow-purple-500/30 pointer-events-none"
          style={{ width: `${duration > 0 ? (timeSliderValue / duration) * 100 : 0}%` }}
        />
        {/* 滑桿（只有這個，移除自定義播放頭以避免殘影） */}
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.01}
          value={timeSliderValue}
          onChange={handleTimeChange}
          onMouseDown={() => setIsDraggingTime(true)}
          onMouseUp={() => setIsDraggingTime(false)}
          onTouchStart={() => setIsDraggingTime(true)}
          onTouchEnd={() => setIsDraggingTime(false)}
          className="absolute w-full h-8 spine-timeline-slider z-10"
        />
      </div>

      {/* 動畫列表 - 自動填滿剩餘空間 */}
      <div className="flex-1 space-y-1 overflow-y-auto pr-1 custom-scrollbar min-h-0">
        {animations.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-4">
            沒有可用的動畫
          </div>
        ) : (
          animations.map((animation) => {
            const isActive = animation.name === element.currentAnimation;
            return (
              <button
                key={animation.name}
                onClick={() => handleSelectAnimation(animation.name)}
                className={`
                  w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all
                  ${isActive 
                    ? 'bg-purple-500/25 text-purple-200 border border-purple-400/40 shadow-sm' 
                    : 'bg-[#2a2d36]/30 text-gray-400 hover:bg-[#2a2d36]/60 hover:text-gray-300 border border-transparent'
                  }
                `}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Play size={12} className={isActive ? 'text-purple-400' : 'text-gray-600'} />
                  <span className="truncate">{animation.name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs tabular-nums">
                  <span className={isActive ? 'text-purple-300' : 'text-gray-500'}>
                    {animation.duration.toFixed(2)}s
                  </span>
                  <span className="text-gray-600">{animation.frameCount}f</span>
                </div>
              </button>
            );
          })
        )}
      </div>

    </div>
  );
};

export default SpineAnimationTab;
