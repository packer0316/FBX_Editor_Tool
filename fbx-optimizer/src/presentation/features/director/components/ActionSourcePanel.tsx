/**
 * ActionSourcePanel - 左側動作來源面板
 * 
 * 支援：
 * - 3D 模型動畫
 * - Spine 動畫
 * - 程式動作（Show/Hide/FadeIn/FadeOut）
 */

import React, { useState, memo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, ChevronDown, GripVertical, Box, Bone, Plus, Settings, Trash2, Sunrise, Sunset, Maximize2, Move } from 'lucide-react';
import type { ActionSource, ActionSourceItem, ProceduralAnimationType } from '../../../../domain/entities/director/director.types';
import { PROCEDURAL_ANIMATION_PRESETS } from '../../../../domain/entities/director/director.types';
import type { ProceduralAction } from '../../../../domain/value-objects/ModelInstance';
import { formatFrameTime } from '../../../../utils/director/directorUtils';
import { useDirectorStore } from '../../../stores/directorStore';

interface ActionSourcePanelProps {
  actionSources: ActionSource[];
  /** 回調：新增程式動作到模型 */
  onAddProceduralAction?: (modelId: string, type: ProceduralAnimationType) => void;
  /** 回調：刪除模型的程式動作 */
  onRemoveProceduralAction?: (modelId: string, actionId: string) => void;
  /** 模型的程式動作映射 */
  modelProceduralActions?: Map<string, ProceduralAction[]>;
}

export const ActionSourcePanel: React.FC<ActionSourcePanelProps> = memo(({ 
  actionSources,
  onAddProceduralAction,
  onRemoveProceduralAction,
  modelProceduralActions = new Map(),
}) => {
  const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set());
  const { setDragging } = useDirectorStore();
  
  // 程式動作選項面板狀態
  const [proceduralMenuState, setProceduralMenuState] = useState<{
    visible: boolean;
    modelId: string;
    x: number;
    y: number;
  } | null>(null);
  
  // 程式動作右鍵選單狀態
  const [actionContextMenu, setActionContextMenu] = useState<{
    visible: boolean;
    modelId: string;
    actionId: string;
    x: number;
    y: number;
  } | null>(null);

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

  // 處理程式動作拖曳
  const handleProceduralDragStart = (
    e: React.DragEvent,
    source: ActionSource,
    action: ProceduralAction
  ) => {
    const dragData = {
      type: 'new' as const,
      sourceType: 'procedural' as const,
      sourceModelId: source.modelId,
      sourceModelName: source.modelName,
      sourceAnimationId: action.id,
      sourceAnimationName: action.displayName,
      durationFrames: action.durationFrames,
      color: source.modelColor,  // 使用模型的顏色，不是固定的程式動作顏色
      proceduralType: action.type,
    };
    
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData('text/plain', JSON.stringify(dragData));
    
    setDragging(true, dragData);
  };

  // 顯示程式動作選項面板
  const handleShowProceduralMenu = useCallback((e: React.MouseEvent, modelId: string) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setProceduralMenuState({
      visible: true,
      modelId,
      x: rect.right + 8,
      y: rect.top,
    });
  }, []);

  // 選擇程式動作類型
  const handleSelectProceduralType = useCallback((type: ProceduralAnimationType) => {
    if (proceduralMenuState && onAddProceduralAction) {
      onAddProceduralAction(proceduralMenuState.modelId, type);
    }
    setProceduralMenuState(null);
  }, [proceduralMenuState, onAddProceduralAction]);

  // 關閉選項面板
  const handleCloseProceduralMenu = useCallback(() => {
    setProceduralMenuState(null);
  }, []);

  // 程式動作右鍵選單
  const handleActionContextMenu = useCallback((
    e: React.MouseEvent,
    modelId: string,
    actionId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setActionContextMenu({
      visible: true,
      modelId,
      actionId,
      x: e.clientX,
      y: e.clientY,
    });
  }, []);

  // 刪除程式動作
  const handleDeleteAction = useCallback(() => {
    if (actionContextMenu && onRemoveProceduralAction) {
      onRemoveProceduralAction(actionContextMenu.modelId, actionContextMenu.actionId);
    }
    setActionContextMenu(null);
  }, [actionContextMenu, onRemoveProceduralAction]);

  // 關閉右鍵選單
  const handleCloseActionContextMenu = useCallback(() => {
    setActionContextMenu(null);
  }, []);

  // 取得程式動作圖示
  const getProceduralIcon = (type: ProceduralAnimationType) => {
    switch (type) {
      case 'fadeIn': return <Sunrise size={12} className="text-green-300" />;
      case 'fadeOut': return <Sunset size={12} className="text-red-300" />;
      case 'scaleTo': return <Maximize2 size={12} className="text-blue-300" />;
      case 'moveBy': return <Move size={12} className="text-purple-300" />;
    }
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
                {/* 原生動畫 */}
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
                      {formatFrameTime(clip.durationFrames, 30, true)}
                    </span>
                  </div>
                ))}
                
                {/* 程式動作區塊（僅 3D 模型） */}
                {source.sourceType !== 'spine' && (
                  <>
                    {/* 已加入的程式動作 */}
                    {(modelProceduralActions.get(source.modelId) || []).length > 0 && (
                      <>
                        <div className="mx-5 my-1 border-t border-white/10" />
                        {(modelProceduralActions.get(source.modelId) || []).map((action: ProceduralAction) => (
                          <div
                            key={action.id}
                            draggable
                            onDragStart={(e) => handleProceduralDragStart(e, source, action)}
                            onDragEnd={handleDragEnd}
                            onContextMenu={(e) => handleActionContextMenu(e, source.modelId, action.id)}
                            className="group flex items-center gap-2 px-3 py-1.5 ml-5 mr-2 rounded hover:bg-white/10 cursor-grab active:cursor-grabbing transition-colors"
                          >
                            {getProceduralIcon(action.type)}
                            <span className="text-sm text-gray-300 truncate flex-1">
                              {action.displayName}
                            </span>
                            <button
                              onClick={(e) => handleActionContextMenu(e, source.modelId, action.id)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/10 rounded transition-opacity"
                              title="設定"
                            >
                              <Settings size={12} className="text-gray-400" />
                            </button>
                            <span className="text-xs text-gray-500 font-mono">
                              {action.durationFrames}f
                            </span>
                          </div>
                        ))}
                      </>
                    )}
                    
                    {/* + 程式動作 按鈕 */}
                    <button
                      onClick={(e) => handleShowProceduralMenu(e, source.modelId)}
                      className="flex items-center gap-2 px-3 py-1.5 ml-5 mr-2 mt-1 rounded text-xs text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors w-[calc(100%-1.75rem)]"
                    >
                      <Plus size={12} />
                      <span>程式動作</span>
                    </button>
                  </>
                )}
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

      {/* 程式動作選項面板（Portal） */}
      {proceduralMenuState?.visible && createPortal(
        <>
          {/* 背景遮罩 */}
          <div 
            className="fixed inset-0 z-50"
            onClick={handleCloseProceduralMenu}
          />
          {/* 選項面板 - 自動調整位置避免超出視窗 */}
          <div
            ref={(el) => {
              if (el) {
                // 計算選單高度並調整位置
                const rect = el.getBoundingClientRect();
                const viewportHeight = window.innerHeight;
                const viewportWidth = window.innerWidth;
                
                // 如果超出底部，向上移動
                if (rect.bottom > viewportHeight - 10) {
                  el.style.top = `${Math.max(10, viewportHeight - rect.height - 10)}px`;
                }
                // 如果超出右側，向左移動
                if (rect.right > viewportWidth - 10) {
                  el.style.left = `${Math.max(10, viewportWidth - rect.width - 10)}px`;
                }
              }
            }}
            className="fixed z-50 bg-gray-900 border border-white/20 rounded-lg shadow-xl py-1 min-w-[180px]"
            style={{ left: proceduralMenuState.x, top: proceduralMenuState.y }}
          >
            <div className="px-3 py-1.5 text-xs text-gray-500 font-medium border-b border-white/10">
              選擇程式動作
            </div>
            {(Object.entries(PROCEDURAL_ANIMATION_PRESETS) as [ProceduralAnimationType, typeof PROCEDURAL_ANIMATION_PRESETS['fadeIn']][]).map(([type, preset]) => (
              <button
                key={type}
                onClick={() => handleSelectProceduralType(type)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/10 transition-colors text-left"
              >
                {getProceduralIcon(type)}
                <span className="text-sm text-gray-200 flex-1">{preset.displayName}</span>
                <span className="text-xs text-gray-500">{preset.defaultDuration}f</span>
              </button>
            ))}
          </div>
        </>,
        document.body
      )}

      {/* 程式動作右鍵選單（Portal） */}
      {actionContextMenu?.visible && createPortal(
        <>
          {/* 背景遮罩 */}
          <div 
            className="fixed inset-0 z-50"
            onClick={handleCloseActionContextMenu}
          />
          {/* 選單 */}
          <div
            className="fixed z-50 bg-gray-900 border border-white/20 rounded-lg shadow-xl py-1 min-w-[120px]"
            style={{ left: actionContextMenu.x, top: actionContextMenu.y }}
          >
            <button
              onClick={handleDeleteAction}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-500/20 transition-colors text-left text-red-400"
            >
              <Trash2 size={14} />
              <span className="text-sm">刪除</span>
            </button>
          </div>
        </>,
        document.body
      )}
    </div>
  );
});

ActionSourcePanel.displayName = 'ActionSourcePanel';

export default ActionSourcePanel;
