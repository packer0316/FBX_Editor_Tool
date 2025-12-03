/**
 * DirectorPanel - 導演模式主面板
 */

import React, { useState } from 'react';
import { X, Keyboard, Magnet, AlertCircle } from 'lucide-react';
import { useDirectorStore } from '../../../stores/directorStore';
import { ActionSourcePanel } from './ActionSourcePanel';
import { TimelineEditor } from './TimelineEditor';
import { PlaybackControls } from './PlaybackControls';
import { useTimelinePlayback } from '../hooks/useTimelinePlayback';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import type { ActionSource } from '../../../../domain/entities/director/director.types';
import type { ModelInstance } from '../../../../domain/value-objects/ModelInstance';

// 提示按鈕組件
const HintButton: React.FC = () => {
  const [showHint, setShowHint] = useState(false);
  
  return (
    <div className="relative">
      <button
        onClick={() => setShowHint(!showHint)}
        className={`p-1.5 rounded-lg transition-colors ${
          showHint
            ? 'bg-orange-500/20 text-orange-400'
            : 'hover:bg-white/10 text-gray-400 hover:text-white'
        }`}
        title="使用提示"
      >
        <AlertCircle size={16} />
      </button>
      
      {/* 提示內容 */}
      {showHint && (
        <>
          {/* 背景遮罩 */}
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setShowHint(false)}
          />
          {/* 提示框 */}
          <div className="absolute right-0 top-full mt-2 w-72 bg-gray-800/95 backdrop-blur-lg border border-orange-500/30 rounded-lg shadow-xl p-4 z-50">
            <div className="flex items-start gap-2">
              <AlertCircle size={18} className="text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm text-orange-400 font-medium mb-2">使用提示</div>
                <p className="text-xs text-gray-300 leading-relaxed">
                  若 Spine 兩個動作緊貼，可能造成播放發生錯誤。若有錯誤，請在動作之間保留 <span className="text-orange-400 font-semibold">1 空白幀</span>。
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowHint(false)}
              className="mt-3 w-full py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 text-xs rounded transition-colors"
            >
              知道了
            </button>
          </div>
        </>
      )}
    </div>
  );
};

interface DirectorPanelProps {
  /** 動作來源列表（從模型中收集） */
  actionSources: ActionSource[];
  /** 模型實例列表（用於查詢音效/特效綁定） */
  models?: ModelInstance[];
  /** 更新模型動畫的回調（向後兼容，建議改用 EventBus 訂閱） */
  onUpdateModelAnimation?: (modelId: string, animationId: string, localTime: number, localFrame: number) => void;
  /** 調整高度把手的 mouseDown 處理 */
  onResizeHandleMouseDown?: (e: React.MouseEvent) => void;
}

export const DirectorPanel: React.FC<DirectorPanelProps> = ({ 
  actionSources,
  models = [],
  onUpdateModelAnimation,
  onResizeHandleMouseDown,
}) => {
  const { isDirectorMode, exitDirectorMode, ui, toggleClipSnapping } = useDirectorStore();

  // 使用播放控制 Hook（透過 EventBus 發送事件，同時保持向後兼容 callback）
  const { activeClips } = useTimelinePlayback({
    callbacks: {
      onUpdateModelAnimation,
    },
  });

  // 鍵盤快捷鍵
  const { shortcuts } = useKeyboardShortcuts({ enabled: isDirectorMode });

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
        <div className="flex items-center gap-2">
          {/* 片段吸附開關 */}
          <button
            onClick={toggleClipSnapping}
            className={`p-1.5 rounded-lg transition-colors ${
              ui.clipSnapping
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-400'
            }`}
            title={ui.clipSnapping ? '關閉片段吸附' : '開啟片段吸附'}
          >
            <Magnet size={16} />
          </button>
          
          {/* 提示按鈕 */}
          <HintButton />
          
          {/* 快捷鍵提示 */}
          <div className="group relative">
            <button
              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              title="快捷鍵"
            >
              <Keyboard size={16} />
            </button>
            {/* Tooltip */}
            <div className="absolute right-0 top-full mt-2 w-52 bg-gray-800/95 backdrop-blur-lg border border-white/10 rounded-lg shadow-xl p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <div className="text-xs text-gray-400 mb-2 font-medium">快捷鍵</div>
              <div className="space-y-1.5 text-xs">
                {shortcuts.map((s, i) => (
                  <div key={i} className="flex justify-between text-gray-300">
                    <span className="text-gray-500">{s.key}</span>
                    <span>{s.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <button
            onClick={exitDirectorMode}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title="關閉導演模式 (ESC)"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* 主內容區 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左側：動作來源面板 */}
        <ActionSourcePanel actionSources={actionSources} />

        {/* 右側：時間軸編輯器 */}
        <TimelineEditor models={models} />
      </div>

      {/* 底部：播放控制列 */}
      <PlaybackControls />
    </div>
  );
};

export default DirectorPanel;

