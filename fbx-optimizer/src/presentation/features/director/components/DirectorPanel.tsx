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
}

export const DirectorPanel: React.FC<DirectorPanelProps> = ({ 
  actionSources,
  onUpdateModelAnimation,
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
    <div className="absolute bottom-0 left-0 right-0 h-[320px] bg-gray-900/95 backdrop-blur-xl border-t border-white/10 z-[400] flex flex-col animate-slide-up">
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

