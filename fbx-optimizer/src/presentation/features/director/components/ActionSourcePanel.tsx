/**
 * ActionSourcePanel - 左側動作來源面板
 * 
 * 支援：
 * - 3D 模型動畫
 * - Spine 動畫
 */

import React, { useState, memo } from 'react';
import { ChevronRight, ChevronDown, GripVertical, Box, Bone } from 'lucide-react';
import type { ActionSource, ActionSourceItem } from '../../../../domain/entities/director/director.types';
import { formatFrameTime } from '../../../../utils/director/directorUtils';
import { useDirectorStore } from '../../../stores/directorStore';

interface ActionSourcePanelProps {
  actionSources: ActionSource[];
}

export const ActionSourcePanel: React.FC<ActionSourcePanelProps> = memo(({ actionSources }) => {
  const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set());
  const { setDragging } = useDirectorStore();

  // 分離 3D 模型和 Spine 來源
  const model3DSources = actionSources.filter(s => s.sourceType !== 'spine');
  const spineSources = actionSources.filter(s => s.sourceType === 'spine');

  const toggleModel = (modelId: string) => {
    setExpandedModels(prev => {
      const next = new Set(prev);
      if (next.has(modelId)) {
        next.delete(modelId);
      } else {
        next.add(modelId);
      }
      return next;
    });
  };

  const handleDragStart = (
    e: React.DragEvent,
    source: ActionSource,
    clip: ActionSourceItem
  ) => {
    const isSpine = source.sourceType === 'spine';
    
    const dragData = {
      type: 'new' as const,
      sourceType: source.sourceType ?? '3d-model',
      sourceModelId: source.modelId,
      sourceModelName: source.modelName,
      sourceAnimationId: clip.clipId,
      sourceAnimationName: clip.displayName,
      durationFrames: clip.durationFrames,
      color: source.modelColor,
      // Spine 特有資訊
      ...(isSpine && source.spineInfo && {
        spineInstanceId: source.spineInfo.instanceId,
        spineLayerId: source.spineInfo.layerId,
        spineElementId: source.spineInfo.elementId,
      }),
    };
    
    console.log('[ActionSourcePanel] DragStart:', dragData);
    
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData('text/plain', JSON.stringify(dragData));
    
    setDragging(true, dragData);
  };

  const handleDragEnd = () => {
    setDragging(false, null);
  };

  const renderSourceGroup = (
    sources: ActionSource[],
    title: string,
    icon: React.ReactNode,
    emptyMessage: string
  ) => (
    <div className="mb-2">
      {/* 群組標題 */}
      <div className="px-3 py-1.5 text-[10px] text-gray-500 font-medium uppercase tracking-wider flex items-center gap-1.5 bg-black/30">
        {icon}
        {title}
        <span className="text-gray-600 ml-auto">{sources.length}</span>
      </div>

      {sources.length === 0 ? (
        <div className="px-4 py-3 text-center text-gray-600 text-xs">
          {emptyMessage}
        </div>
      ) : (
        sources.map(source => (
          <div key={source.modelId} className="border-b border-white/5">
            {/* 來源標題 */}
            <button
              onClick={() => toggleModel(source.modelId)}
              className="w-full px-3 py-2 flex items-center gap-2 hover:bg-white/5 transition-colors text-left"
            >
              {expandedModels.has(source.modelId) ? (
                <ChevronDown size={14} className="text-gray-400" />
              ) : (
                <ChevronRight size={14} className="text-gray-400" />
              )}
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: source.modelColor }}
              />
              <span className="text-sm text-gray-200 truncate flex-1">
                {source.modelName}
              </span>
              <span className="text-xs text-gray-500">
                {source.clips.length}
              </span>
            </button>

            {/* 動作列表 */}
            {expandedModels.has(source.modelId) && (
              <div className="pb-1">
                {source.clips.map(clip => (
                  <div
                    key={clip.clipId}
                    draggable
                    onDragStart={(e) => handleDragStart(e, source, clip)}
                    onDragEnd={handleDragEnd}
                    className="group flex items-center gap-2 px-3 py-1.5 ml-5 mr-2 rounded hover:bg-white/10 cursor-grab active:cursor-grabbing transition-colors"
                  >
                    <GripVertical size={12} className="text-gray-600 group-hover:text-gray-400" />
                    <span className="text-sm text-gray-300 truncate flex-1">
                      {clip.displayName}
                    </span>
                    <span className="text-xs text-gray-500 font-mono">
                      {formatFrameTime(clip.durationFrames, 30, false)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="w-64 border-r border-white/10 flex flex-col bg-black/20">
      {/* 標題 */}
      <div className="px-3 py-2 border-b border-white/10 text-xs text-gray-400 font-medium uppercase tracking-wider">
        動作來源
      </div>

      {/* 動作列表 */}
      <div className="flex-1 overflow-y-auto">
        {actionSources.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            尚未載入模型或 Spine
          </div>
        ) : (
          <>
            {/* 3D 模型區塊 */}
            {renderSourceGroup(
              model3DSources,
              '3D 模型',
              <Box size={10} className="text-blue-400" />,
              '尚未載入 3D 模型'
            )}

            {/* Spine 區塊 */}
            {renderSourceGroup(
              spineSources,
              'Spine 動畫',
              <Bone size={10} className="text-purple-400" />,
              '尚未載入 Spine'
            )}
          </>
        )}
      </div>
    </div>
  );
});

ActionSourcePanel.displayName = 'ActionSourcePanel';

export default ActionSourcePanel;
