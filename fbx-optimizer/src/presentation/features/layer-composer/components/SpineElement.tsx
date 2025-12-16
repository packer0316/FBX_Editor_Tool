/**
 * SpineElement - Spine 動畫元素組件
 * 
 * 在 2D Layer 中渲染 Spine 骨架動畫。
 * 使用 Spine WebGL Runtime (`spine.webgl`) 進行渲染。
 */

import React, { useRef, useEffect, useCallback, useState, memo } from 'react';
import type { SpineElement2D } from '../../../../domain/value-objects/Element2D';
import { getSpineWebglRuntimeAdapter } from '../../../../infrastructure/spine-webgl/SpineWebglRuntimeAdapter';

// ============================================================================
// 類型定義
// ============================================================================

interface SpineElementProps {
  /** Spine 元素數據 */
  element: SpineElement2D;
  /** 是否選中 */
  isActive?: boolean;
  /** 容器寬度 */
  containerWidth: number;
  /** 容器高度 */
  containerHeight: number;
  /** 點擊事件 */
  onClick?: () => void;
  /** 更新元素屬性 */
  onUpdate?: (updates: Partial<SpineElement2D>) => void;
}

// ============================================================================
// 組件
// ============================================================================

export const SpineElement: React.FC<SpineElementProps> = memo(({
  element,
  isActive = false,
  containerWidth,
  containerHeight,
  onClick,
  onUpdate,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 內部播放時間（不會觸發 React 重新渲染）
  const internalTimeRef = useRef<number>(0);
  // 上次同步到 UI 的時間
  const lastUISyncRef = useRef<number>(0);
  
  // 使用 ref 保存 onUpdate，避免它導致 useEffect 重新執行
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  // 計算實際尺寸
  const actualWidth = element.size.unit === 'percent' 
    ? (element.size.width / 100) * containerWidth 
    : element.size.width;
  const actualHeight = element.size.unit === 'percent'
    ? (element.size.height / 100) * containerHeight
    : element.size.height;

  // 初始化 Canvas 和渲染器
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    try {
      const adapter = getSpineWebglRuntimeAdapter();
      if (!adapter.has(element.spineInstanceId)) {
        setError('Spine 實例未載入');
        setIsLoaded(false);
        return;
      }

      const canvas = adapter.getCanvas(element.spineInstanceId);
      if (!canvas) {
        setError('WebGL Canvas 未建立');
        setIsLoaded(false);
        return;
      }

      // 掛載 canvas 到 DOM（per-instance canvas）
      if (canvas.parentElement !== container) {
        container.innerHTML = '';
        container.appendChild(canvas);
      }

      // 設定尺寸
      const displayWidth = Math.max(actualWidth, 500);
      const displayHeight = Math.max(actualHeight, 500);
      adapter.resize(element.spineInstanceId, displayWidth, displayHeight);

      setIsLoaded(true);
      setError(null);

      // 立即渲染一幀
      requestAnimationFrame(() => {
        adapter.render(element.spineInstanceId, {
          scale: element.scale ?? 1,
          fitMode: element.fitMode ?? 'fill',
          backgroundColor: null,
        });
      });
    } catch (err) {
      console.error('[SpineElement] 初始化失敗:', err);
      setError(err instanceof Error ? err.message : '初始化失敗');
    }

    return () => {
      // canvas 由 adapter 持有，不在這裡 dispose
    };
  }, [element.spineInstanceId, actualWidth, actualHeight, element.scale, element.fitMode]);

  // 控制 Runtime 的播放/暫停狀態
  useEffect(() => {
    if (!isLoaded) return;
    
    const adapter = getSpineWebglRuntimeAdapter();
    
    if (element.isPlaying) {
      adapter.resume(element.spineInstanceId);
    } else {
      adapter.pause(element.spineInstanceId);
      // 暫停時渲染一幀
      adapter.render(element.spineInstanceId, {
        scale: element.scale ?? 1,
        fitMode: element.fitMode ?? 'fill',
        backgroundColor: null,
      });
    }
  }, [isLoaded, element.isPlaying, element.spineInstanceId, element.scale, element.fitMode]);

  // 動畫循環（獨立的 useEffect，只在播放時運行）
  useEffect(() => {
    // 只有在載入且播放時才啟動動畫循環
    if (!isLoaded || !element.isPlaying) {
      return;
    }

    const adapter = getSpineWebglRuntimeAdapter();
    lastTimeRef.current = performance.now();
    lastUISyncRef.current = performance.now();
    
    let isRunning = true;

    const animate = (now: number) => {
      if (!isRunning) {
        return;
      }
      
      const deltaTime = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      // 更新動畫（使用 element.timeScale）
      adapter.update(element.spineInstanceId, deltaTime * element.timeScale);

      // 渲染
      adapter.render(element.spineInstanceId, {
        scale: element.scale ?? 1,
        fitMode: element.fitMode ?? 'fill',
        backgroundColor: null,
      });

      // 每 33ms 同步時間到 UI（約 30fps）
      if (now - lastUISyncRef.current > 33) {
        lastUISyncRef.current = now;
        const state = adapter.getState(element.spineInstanceId);
        if (state) {
          internalTimeRef.current = state.currentTime;
          
          // 檢查動畫是否完成（非循環模式下）
          if (!element.loop && state.currentTime >= state.duration - 0.05) {
            isRunning = false;
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
              animationFrameRef.current = undefined;
            }
            // 通知父組件停止
            if (onUpdateRef.current) {
              onUpdateRef.current({ isPlaying: false, currentTime: state.duration });
            }
            return;
          }
          
          if (onUpdateRef.current) {
            onUpdateRef.current({ currentTime: state.currentTime });
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      isRunning = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
    };
  }, [isLoaded, element.isPlaying, element.spineInstanceId, element.timeScale, element.loop, element.scale, element.fitMode]);

  // 當動畫或 Skin 改變時
  useEffect(() => {
    if (!isLoaded) return;

    const adapter = getSpineWebglRuntimeAdapter();

    if (element.currentAnimation) {
      adapter.playAnimation(element.spineInstanceId, element.currentAnimation, element.loop);
    }

    if (element.currentSkin) {
      adapter.setSkin(element.spineInstanceId, element.currentSkin);
    }

    adapter.setTimeScale(element.spineInstanceId, element.timeScale);
  }, [
    isLoaded,
    element.spineInstanceId,
    element.currentAnimation,
    element.currentSkin,
    element.loop,
    element.timeScale,
  ]);

  // 處理用戶手動拖動時間軸（即時同步到 Spine 畫面）
  useEffect(() => {
    if (!isLoaded) return;
    
    // 降低閾值以支援更即時的拖動反饋（約 1 幀的差異）
    const diff = Math.abs(element.currentTime - internalTimeRef.current);
    if (diff > 0.016) {  // ~60fps 的一幀時間
      const adapter = getSpineWebglRuntimeAdapter();
      adapter.seek(element.spineInstanceId, element.currentTime);
      internalTimeRef.current = element.currentTime;
      
      // 立即渲染（暫停時拖動也能看到畫面變化）
      adapter.render(element.spineInstanceId, {
        scale: element.scale ?? 1,
        fitMode: element.fitMode ?? 'fill',
        backgroundColor: null,
      });
    }
  }, [isLoaded, element.spineInstanceId, element.currentTime, element.scale, element.fitMode]);


  // 處理點擊
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.();
  }, [onClick]);

  // 切換播放/暫停（業界標準邏輯）
  const handleTogglePlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!isLoaded) return;
    
    // 獲取當前動畫資訊
    const adapter = getSpineWebglRuntimeAdapter();
    const state = adapter.getState(element.spineInstanceId);
    
    if (!state) return;
    
    // 檢查動畫是否已播放完成（非循環模式下）
    const isAtEnd = !element.loop && state.currentTime >= state.duration - 0.05;
    
    if (isAtEnd && !element.isPlaying) {
      // 動畫已結束 + 按播放 = 從頭重播
      onUpdateRef.current?.({ 
        currentTime: 0,
        isPlaying: true 
      });
    } else {
      // 正常的播放/暫停切換
      onUpdateRef.current?.({ isPlaying: !element.isPlaying });
    }
  }, [element.isPlaying, element.loop, element.spineInstanceId, isLoaded]);

  return (
    <div
      className={`relative ${isActive ? 'ring-2 ring-purple-400 ring-offset-2 ring-offset-transparent' : ''}`}
      style={{
        width: actualWidth,
        height: actualHeight,
        opacity: element.opacity,
        transform: `rotate(${element.rotation}deg) scaleX(${element.flipX ? -1 : 1}) scaleY(${element.flipY ? -1 : 1})`,
      }}
      onClick={handleClick}
    >
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ display: isLoaded ? 'block' : 'none' }}
      />

      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-purple-900/20 border-2 border-dashed border-purple-400/50 rounded-lg">
          {error ? (
            <div className="text-center px-4">
              <div className="text-red-400 text-sm mb-1">⚠️</div>
              <div className="text-xs text-red-300">{error}</div>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <div className="text-xs text-purple-300">載入 Spine...</div>
            </div>
          )}
        </div>
      )}

      {isActive && isLoaded && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
          <button
            onClick={handleTogglePlay}
            className="px-2 py-1 bg-purple-600/80 hover:bg-purple-500 text-white text-xs rounded backdrop-blur-sm"
          >
            {element.isPlaying ? '⏸' : '▶'}
          </button>
        </div>
      )}

      {isActive && (
        <div className="absolute -top-6 left-0 text-xs text-purple-300 bg-purple-900/80 px-2 py-0.5 rounded">
          🦴 {element.name}
        </div>
      )}
    </div>
  );
});

SpineElement.displayName = 'SpineElement';

export default SpineElement;
