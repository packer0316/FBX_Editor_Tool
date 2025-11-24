import { useMemo, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import type { AudioTrack } from '../../domain/value-objects/AudioTrack';

/**
 * 進度條狀態類型
 */
export type ProgressBarState = 'completed' | 'playing' | 'pending' | 'inactive';

/**
 * 進度條尺寸類型
 */
export type ProgressBarSize = 'sm' | 'md' | 'lg';

/**
 * 統一的進度條組件
 * 
 * 此組件統一了整個應用程式中所有進度條的樣式、顏色和行為，
 * 解決了之前三處進度條樣式不一致的問題。
 * 
 * @example
 * ```tsx
 * <ProgressBar
 *   progress={75}
 *   state="playing"
 *   size="md"
 *   audioMarkers={[
 *     { trigger: { frame: 10 }, audioTrack: { name: 'Sound1', color: '#FF0000' } }
 *   ]}
 *   clipDuration={2.0}
 * />
 * ```
 */
type ProgressBarMarkerTrack = Pick<AudioTrack, 'id' | 'name' | 'note' | 'color'>;
type AudioMarkerEntry = {
  trigger: { id: string; frame: number };
  audioTrack: ProgressBarMarkerTrack;
};

interface ProgressBarProps {
  /** 進度百分比 (0-100) */
  progress: number;
  
  /** 進度條狀態 */
  state: ProgressBarState;
  
  /** 進度條尺寸 */
  size?: ProgressBarSize;
  
  /** 是否顯示進度百分比文字 */
  showPercentage?: boolean;
  
  /** Audio Markers 資料 */
  audioMarkers?: AudioMarkerEntry[];
  
  /** 片段時長（用於計算 Audio Marker 位置，單位：秒） */
  clipDuration?: number;
  
  /** 自訂 className */
  className?: string;
}

/**
 * 統一的色彩語意定義
 */
const PROGRESS_COLORS: Record<ProgressBarState, string> = {
  completed: 'bg-green-500',   // 已完成：綠色
  playing: 'bg-blue-500',      // 播放中：藍色
  pending: 'bg-gray-600',      // 待播放：深灰色
  inactive: 'bg-gray-700',     // 未啟動：更深灰色
};

/**
 * 尺寸定義
 */
const SIZE_CLASSES: Record<ProgressBarSize, string> = {
  sm: 'h-1.5',
  md: 'h-2',
  lg: 'h-3',
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  state,
  size = 'md',
  showPercentage = false,
  audioMarkers = [],
  clipDuration = 0,
  className = '',
}) => {
  const [hoveredTooltip, setHoveredTooltip] = useState<{
    x: number;
    y: number;
    items: AudioMarkerEntry[];
  } | null>(null);

  const handleMarkerEnter = (event: MouseEvent<HTMLDivElement>, items: AudioMarkerEntry[]) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setHoveredTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top,
      items,
    });
  };

  const handleMarkerLeave = () => setHoveredTooltip(null);

  // 使用 useMemo 快取 Audio Markers 的位置計算
  const renderedMarkers = useMemo(() => {
    if (!audioMarkers.length || clipDuration === 0) return null;

    const fps = 30; // 標準幀率
    const totalFrames = clipDuration * fps;

    const markersGroupedByFrame = audioMarkers.reduce<Record<number, AudioMarkerEntry[]>>(
      (groups, marker) => {
        const key = marker.trigger.frame;
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(marker);
        return groups;
      },
      {}
    );

    return Object.entries(markersGroupedByFrame).map(([frameKey, group]) => {
      const frameNumber = Number(frameKey);
      const positionPercent = totalFrames > 0 ? (frameNumber / totalFrames) * 100 : 0;
      const clampedPosition = Math.min(Math.max(positionPercent, 0), 100);

      const sortedGroup = [...group].sort((a, b) => {
        if (a.trigger.frame !== b.trigger.frame) {
          return a.trigger.frame - b.trigger.frame;
        }
        return a.audioTrack.name.localeCompare(b.audioTrack.name);
      });

      const dominantColor = sortedGroup[0]?.audioTrack.color || '#FACC15';

      return (
        <div
          key={`marker-${frameKey}-${sortedGroup.map(item => item.trigger.id).join('-')}`}
          className="absolute top-0 bottom-0 w-1 rounded-sm hover:w-2 transition-all cursor-pointer z-10 pointer-events-auto"
          style={{
            left: `${clampedPosition}%`,
            backgroundColor: dominantColor,
          }}
          onMouseEnter={(event) => handleMarkerEnter(event, sortedGroup)}
          onMouseLeave={handleMarkerLeave}
        />
      );
    });
  }, [audioMarkers, clipDuration]);

  // 確保進度在 0-100 範圍內
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  const progressBarContent = (
    <div className={`w-full flex items-center gap-2 ${className}`}>
      {/* 進度條容器 */}
      <div className={`flex-1 relative ${SIZE_CLASSES[size]}`}>
        {/* 背景層 */}
        <div className="absolute inset-0 bg-gray-900 rounded-full" />

        {/* 進度填充層（保持裁切以符合圓角） */}
        <div className="absolute inset-0 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-transform duration-100 ease-linear ${PROGRESS_COLORS[state]}`}
            style={{
              width: '100%',
              transform: `scaleX(${clampedProgress / 100})`,
              transformOrigin: 'left',
            }}
          />
        </div>

        {/* Audio Markers 層（允許 Tooltip 溢出顯示） */}
        <div className="absolute inset-0 pointer-events-none">
          {renderedMarkers}
        </div>
      </div>

      {/* 百分比文字 */}
      {showPercentage && (
        <span className="text-xs text-gray-400 font-mono w-10 text-right">
          {Math.round(clampedProgress)}%
        </span>
      )}
    </div>
  );

  return (
    <>
      {progressBarContent}
      {hoveredTooltip &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed z-[9999] pointer-events-none"
            style={{
              left: hoveredTooltip.x,
              top: hoveredTooltip.y - 8,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="flex flex-col gap-1">
              {hoveredTooltip.items.map(({ trigger, audioTrack }) => {
                const noteText = audioTrack.note?.trim() ? audioTrack.note : '無備註';
                return (
                  <div
                    key={`${audioTrack.id || audioTrack.name}-${trigger.id}`}
                    className="bg-gray-900/95 text-white text-xs px-3 py-2 rounded-md border border-gray-700 shadow-2xl min-w-[200px]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className="font-semibold"
                        style={{ color: audioTrack.color || '#FACC15' }}
                      >
                        {audioTrack.name}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        Frame {trigger.frame}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-300 mt-1">
                      備註：{noteText}
                    </div>
                  </div>
                );
              })}
              <div className="w-3 h-3 bg-gray-900/95 transform rotate-45 self-center -mt-1 border-r border-b border-gray-700" />
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default ProgressBar;

