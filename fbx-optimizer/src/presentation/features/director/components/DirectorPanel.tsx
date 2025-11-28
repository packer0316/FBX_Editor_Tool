/**
 * DirectorPanel - 導演模式主面板
 */

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useDirectorStore } from '../../../stores/directorStore';
import { ActionSourcePanel } from './ActionSourcePanel';
import { TimelineEditor } from './TimelineEditor';
import { PlaybackControls } from './PlaybackControls';
import { useTimelinePlayback } from '../hooks/useTimelinePlayback';
import type { ActionSource } from '../../../../domain/entities/director/director.types';

interface DirectorPanelProps {
  /** 動作來源列表（從模型中收集） */
  actionSources: ActionSource[];
  /** 更新模型動畫的回調 */
  onUpdateModelAnimation?: (modelId: string, animationId: string, localTime: number) => void;
  /** 調整高度把手的 mouseDown 處理 */
  onResizeHandleMouseDown?: (e: React.MouseEvent) => void;
}

export const DirectorPanel: React.FC<DirectorPanelProps> = ({ 
  actionSources,
  onUpdateModelAnimation,
  onResizeHandleMouseDown,
}) => {
  const { isDirectorMode, exitDirectorMode } = useDirectorStore();

  // 使用播放控制 Hook
  const { activeClips } = useTimelinePlayback({
    callbacks: {
      onUpdateModelAnimation: onUpdateModelAnimation ?? (() => {}),
    },
  });

  // ESC 鍵關閉
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDirectorMode) {
        exitDirectorMode();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDirectorMode, exitDirectorMode]);

  if (!isDirectorMode) return null;

  return (
    <div className="absolute inset-0 bg-gray-900/95 backdrop-blur-xl flex flex-col">
      {/* 拖曳調整高度的把手 */}
      {onResizeHandleMouseDown && (
        <div
          className="absolute top-0 left-0 right-0 h-1 bg-gray-700 hover:bg-amber-400 cursor-ns-resize transition-colors z-50"
          onMouseDown={onResizeHandleMouseDown}
        >
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-12 h-1 bg-amber-500 rounded-full"></div>
        </div>
      )}
      
      {/* 標題列 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-black/30">
        <div className="flex items-center gap-3">
          <span className="text-amber-400 font-semibold text-sm tracking-wide">
            🎬 Director Mode
          </span>
        </div>
        <button
          onClick={exitDirectorMode}
          className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          title="關閉導演模式 (ESC)"
        >
          <X size={18} />
        </button>
      </div>

      {/* 主內容區 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左側：動作來源面板 */}
        <ActionSourcePanel actionSources={actionSources} />

        {/* 右側：時間軸編輯器 */}
        <TimelineEditor />
      </div>

      {/* 底部：播放控制列 */}
      <PlaybackControls />
    </div>
  );
};

export default DirectorPanel;

