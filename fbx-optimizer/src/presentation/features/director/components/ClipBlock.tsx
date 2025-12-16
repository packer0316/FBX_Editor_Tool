/**
 * ClipBlock - 片段方塊（支援即時拖曳）
 */

import React, { memo, useCallback, useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Box, Bone, Trash2, Palette, Check, Copy, Clipboard } from 'lucide-react';
import { useDirectorStore } from '../../../stores/directorStore';
import { useSpineStore } from '../../../stores/spineStore';
import type { DirectorClip } from '../../../../domain/entities/director/director.types';
import { snapToGrid, snapToClipEdges } from '../../../../utils/director/directorUtils';
import type { ModelInstance } from '../../../../domain/value-objects/ModelInstance';
import type { AudioTrack } from '../../../../domain/value-objects/AudioTrack';
import type { EffectItem } from '../../../features/effect-panel/components/EffectTestPanel';
import type { EffectTrigger } from '../../../../domain/value-objects/EffectTrigger';

// Marker 類型定義
type AudioMarkerEntry = {
  trigger: { id: string; frame: number };
  audioTrack: Pick<AudioTrack, 'id' | 'name' | 'note' | 'color'>;
};

type EffectMarkerEntry = {
  trigger: { id: string; frame: number };
  effectItem: Pick<EffectItem, 'id' | 'name' | 'color' | 'boundBoneUuid'>;
};

type MarkerEntry = AudioMarkerEntry | EffectMarkerEntry;

interface ClipBlockProps {
  clip: DirectorClip;
  pixelsPerFrame: number;
  isLocked: boolean;
  /** 模型實例列表（用於查詢音效/特效綁定） */
  models?: ModelInstance[];
}

// 右鍵選單狀態類型
interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
}

export const ClipBlock: React.FC<ClipBlockProps> = memo(({
  clip,
  pixelsPerFrame,
  isLocked,
  models = [],
}) => {
  const { ui, selectClip, removeClip, moveClip, tracks, updateClip, timeline, copyClip, pasteClip, clipboardClip, trimClip } = useDirectorStore();
  const spineInstances = useSpineStore((state) => state.instances);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartX = useRef(0);
  const originalStartFrame = useRef(clip.startFrame);
  
  // 剪裁狀態
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimSide, setTrimSide] = useState<'start' | 'end' | null>(null);
  const trimStartX = useRef(0);
  const originalTrimStart = useRef(clip.trimStart ?? 0);
  const originalTrimEnd = useRef(clip.trimEnd ?? clip.sourceAnimationDuration - 1);
  
  // 右鍵選單狀態
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0 });
  const [showSkinSubmenu, setShowSkinSubmenu] = useState(false);
  
  // 取得 Spine 實例的 skins 列表
  const spineSkins = useMemo(() => {
    if (clip.sourceType !== 'spine' || !clip.spineInstanceId) return [];
    const instance = spineInstances.get(clip.spineInstanceId);
    return instance?.skeletonInfo.skins ?? [];
  }, [clip.sourceType, clip.spineInstanceId, spineInstances]);
  
  // 計算 hover tooltip 文字
  const tooltipText = useMemo(() => {
    const trimStart = clip.trimStart ?? 0;
    const trimEnd = clip.trimEnd ?? clip.sourceAnimationDuration - 1;
    const effectiveLen = trimEnd - trimStart + 1;
    const durationSeconds = (effectiveLen / timeline.fps).toFixed(2);
    let text = `${clip.sourceModelName} - ${clip.sourceAnimationName}\n時長：${effectiveLen} 幀 (${durationSeconds} 秒)`;
    
    // 如果有剪裁，顯示剪裁範圍
    if (trimStart > 0 || trimEnd < clip.sourceAnimationDuration - 1) {
      text += `\n剪裁：${trimStart} - ${trimEnd} (原始 ${clip.sourceAnimationDuration} 幀)`;
    }
    
    if (clip.sourceType === 'spine' && clip.spineSkin) {
      text += `\nSkin：${clip.spineSkin}`;
    }
    
    return text;
  }, [clip.sourceModelName, clip.sourceAnimationName, clip.sourceAnimationDuration, clip.sourceType, clip.spineSkin, clip.trimStart, clip.trimEnd, timeline.fps]);
  
  // Marker hover tooltip 狀態
  const [hoveredTooltip, setHoveredTooltip] = useState<{
    x: number;
    y: number;
    items: MarkerEntry[];
  } | null>(null);
  
  const isSelected = ui.selectedClipId === clip.id;
  
  // 計算剪裁後的有效長度
  const effectiveDuration = (clip.trimEnd ?? clip.sourceAnimationDuration - 1) - (clip.trimStart ?? 0) + 1;
  const width = effectiveDuration * pixelsPerFrame;
  
  // 計算音效和特效 markers
  const { audioMarkers, effectMarkers } = useMemo(() => {
    // 只處理 3D 模型類型（Spine 暫不支援）
    if (clip.sourceType !== '3d-model' || models.length === 0) {
      return { audioMarkers: [], effectMarkers: [] };
    }
    
    // 找到對應的模型實例
    const modelInstance = models.find(m => m.id === clip.sourceModelId);
    if (!modelInstance) {
      return { audioMarkers: [], effectMarkers: [] };
    }
    
    // 計算 Audio Markers
    const audioMarkers: AudioMarkerEntry[] = modelInstance.audioTracks.flatMap(audioTrack =>
      audioTrack.triggers
        .filter(trigger => trigger.clipId === clip.sourceAnimationId)
        .map(trigger => ({
          trigger: { id: trigger.id, frame: trigger.frame },
          audioTrack: { id: audioTrack.id, name: audioTrack.name, note: audioTrack.note, color: audioTrack.color }
        }))
    );
    
    // 計算 Effect Markers
    const effectMarkers: EffectMarkerEntry[] = modelInstance.effects.flatMap(effect =>
      effect.triggers
        .filter((trigger: EffectTrigger) => trigger.clipId === clip.sourceAnimationId)
        .map((trigger: EffectTrigger) => ({
          trigger: { id: trigger.id, frame: trigger.frame },
          effectItem: { id: effect.id, name: effect.name, color: effect.color, boundBoneUuid: effect.boundBoneUuid }
        }))
    );
    
    return { audioMarkers, effectMarkers };
  }, [clip.sourceType, clip.sourceModelId, clip.sourceAnimationId, models]);
  
  // Marker hover handlers（必須在 renderedMarkers 之前定義）
  const handleMarkerEnter = useCallback((event: React.MouseEvent<HTMLDivElement>, items: MarkerEntry[]) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setHoveredTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top,
      items,
    });
  }, []);
  
  const handleMarkerLeave = useCallback(() => {
    setHoveredTooltip(null);
  }, []);
  
  // 渲染 markers（考慮剪裁範圍）
  const renderedMarkers = useMemo(() => {
    const allMarkers: MarkerEntry[] = [...audioMarkers, ...effectMarkers];
    if (allMarkers.length === 0 || effectiveDuration === 0) return null;
    
    const trimStart = clip.trimStart ?? 0;
    const trimEnd = clip.trimEnd ?? clip.sourceAnimationDuration - 1;
    
    // 過濾掉不在剪裁範圍內的 markers
    const visibleMarkers = allMarkers.filter(marker => {
      const frame = marker.trigger.frame;
      return frame >= trimStart && frame <= trimEnd;
    });
    
    if (visibleMarkers.length === 0) return null;
    
    // 根據幀分組 markers
    const markersGroupedByFrame = visibleMarkers.reduce<Record<number, MarkerEntry[]>>(
      (groups, marker) => {
        const key = marker.trigger.frame;
        if (!groups[key]) groups[key] = [];
        groups[key].push(marker);
        return groups;
      },
      {}
    );
    
    return Object.entries(markersGroupedByFrame).map(([frameKey, group]) => {
      const frameNumber = Number(frameKey);
      // 計算相對位置（考慮 trimStart 偏移）
      const frameInClip = frameNumber - trimStart;
      const positionPixels = (frameInClip / effectiveDuration) * width;
      
      // 排序：Audio 在前，Effect 在後
      const sortedGroup = [...group].sort((a, b) => {
        const aType = 'audioTrack' in a ? 0 : 1;
        const bType = 'audioTrack' in b ? 0 : 1;
        return aType - bType;
      });
      
      // 主要顏色
      const firstItem = sortedGroup[0];
      const dominantColor = 'audioTrack' in firstItem
        ? (firstItem.audioTrack.color || '#FACC15')
        : (firstItem.effectItem.color || '#9333EA');
      
      return (
        <div
          key={`marker-${frameKey}`}
          className="absolute top-0 bottom-0 w-1 rounded-sm hover:w-1.5 transition-all cursor-pointer z-10"
          style={{
            left: positionPixels,
            backgroundColor: dominantColor,
            boxShadow: '0 0 2px rgba(0,0,0,0.5)',
          }}
          onMouseEnter={(e) => handleMarkerEnter(e, sortedGroup)}
          onMouseLeave={handleMarkerLeave}
        />
      );
    });
  }, [audioMarkers, effectMarkers, clip.trimStart, clip.trimEnd, clip.sourceAnimationDuration, effectiveDuration, width, handleMarkerEnter, handleMarkerLeave]);
  
  // 使用 useMemo 計算顯示位置和吸附狀態
  const { displayFrame, showSnapIndicator } = useMemo(() => {
    let frame = isDragging 
      ? Math.max(0, originalStartFrame.current + Math.round(dragOffset / pixelsPerFrame))
      : clip.startFrame;
    
    let isSnapped = false;
    
    // 拖曳時應用吸附（只有開啟吸附功能時才生效）
    if (isDragging && ui.clipSnapping) {
      const snapThreshold = 5; // 5 幀內吸附
      const snappedFrame = snapToClipEdges(frame, tracks, snapThreshold, clip.id);
      if (snappedFrame !== frame) {
        frame = snappedFrame;
        isSnapped = true;
      } else {
        frame = snapToGrid(frame, 1);
        isSnapped = false;
      }
    }
    
    return { displayFrame: frame, showSnapIndicator: isSnapped };
  }, [isDragging, dragOffset, pixelsPerFrame, clip.startFrame, clip.id, tracks, ui.clipSnapping]);
  
  const left = displayFrame * pixelsPerFrame;

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    selectClip(clip.id);
  }, [selectClip, clip.id]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      removeClip(clip.id);
    }
    
    // Ctrl+C 或 Cmd+C：複製 clip
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      e.preventDefault();
      copyClip(clip.id);
    }
    
    // Ctrl+V 或 Cmd+V：貼上 clip（緊接在原片段後方）
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      e.preventDefault();
      if (clipboardClip) {
        const pasteFrame = clip.endFrame + 1;
        pasteClip(clip.trackId, pasteFrame);
      }
    }
  }, [removeClip, clip.id, copyClip, clipboardClip, pasteClip, clip.trackId, clip.endFrame]);

  // 右鍵選單處理
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    selectClip(clip.id);
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY });
    setShowSkinSubmenu(false);
  }, [selectClip, clip.id]);
  
  const closeContextMenu = useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0 });
    setShowSkinSubmenu(false);
  }, []);
  
  const handleSelectSkin = useCallback((skinName: string) => {
    updateClip(clip.id, { spineSkin: skinName });
    closeContextMenu();
  }, [updateClip, clip.id, closeContextMenu]);
  
  const handleDeleteClip = useCallback(() => {
    removeClip(clip.id);
    closeContextMenu();
  }, [removeClip, clip.id, closeContextMenu]);
  
  const handleCopyClip = useCallback(() => {
    copyClip(clip.id);
    closeContextMenu();
  }, [copyClip, clip.id, closeContextMenu]);
  
  const handlePasteClipAtMouse = useCallback(() => {
    if (!clipboardClip) return;
    // 計算滑鼠右鍵位置對應的幀數
    const mouseFrame = Math.round(contextMenu.x / pixelsPerFrame);
    pasteClip(clip.trackId, mouseFrame);
    closeContextMenu();
  }, [clipboardClip, contextMenu.x, pixelsPerFrame, pasteClip, clip.trackId, closeContextMenu]);

  // 剪裁邊緣拖曳處理
  const handleTrimStart = useCallback((e: React.MouseEvent, side: 'start' | 'end') => {
    if (isLocked || e.button !== 0) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    trimStartX.current = e.clientX;
    originalTrimStart.current = clip.trimStart ?? 0;
    originalTrimEnd.current = clip.trimEnd ?? clip.sourceAnimationDuration - 1;
    setIsTrimming(true);
    setTrimSide(side);
    selectClip(clip.id);
  }, [isLocked, clip.trimStart, clip.trimEnd, clip.sourceAnimationDuration, clip.id, selectClip]);
  
  // 剪裁拖曳 effect
  useEffect(() => {
    if (!isTrimming || !trimSide) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - trimStartX.current;
      const frameDelta = Math.round(delta / pixelsPerFrame);
      
      if (trimSide === 'start') {
        // 左邊緣剪裁：增加 trimStart（向右拖）= 減少有效長度
        const newTrimStart = Math.max(0, Math.min(
          originalTrimStart.current + frameDelta,
          originalTrimEnd.current - 1
        ));
        const actualDelta = newTrimStart - (clip.trimStart ?? 0);
        if (actualDelta !== 0) {
          trimClip(clip.id, 'start', actualDelta);
        }
      } else {
        // 右邊緣剪裁：增加 trimEnd（向右拖）= 增加有效長度
        const newTrimEnd = Math.max(
          originalTrimStart.current + 1,
          Math.min(originalTrimEnd.current + frameDelta, clip.sourceAnimationDuration - 1)
        );
        const actualDelta = newTrimEnd - (clip.trimEnd ?? clip.sourceAnimationDuration - 1);
        if (actualDelta !== 0) {
          trimClip(clip.id, 'end', actualDelta);
        }
      }
    };
    
    const handleMouseUp = () => {
      setIsTrimming(false);
      setTrimSide(null);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isTrimming, trimSide, pixelsPerFrame, clip.id, clip.trimStart, clip.trimEnd, clip.sourceAnimationDuration, trimClip]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isLocked || e.button !== 0) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    dragStartX.current = e.clientX;
    originalStartFrame.current = clip.startFrame;
    setIsDragging(true);
    setDragOffset(0);
    selectClip(clip.id);
  }, [isLocked, clip.startFrame, clip.id, selectClip]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - dragStartX.current;
      setDragOffset(delta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      
      // 計算最終位置
      const rawFrame = Math.max(0, originalStartFrame.current + Math.round(dragOffset / pixelsPerFrame));
      let finalFrame = rawFrame;
      
      // 只有開啟吸附功能時才應用吸附
      if (ui.clipSnapping) {
        const snapThreshold = 5;
        finalFrame = snapToClipEdges(rawFrame, tracks, snapThreshold, clip.id);
        if (finalFrame === rawFrame) {
          finalFrame = snapToGrid(rawFrame, 1);
        }
      }
      
      // 只有位置改變才更新
      if (finalFrame !== clip.startFrame) {
        moveClip({
          clipId: clip.id,
          newTrackId: clip.trackId,
          newStartFrame: finalFrame,
        });
      }
      
      setDragOffset(0);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, pixelsPerFrame, clip.id, clip.trackId, clip.startFrame, moveClip, tracks, ui.clipSnapping]);

  return (
    <>
      {/* 吸附指示線 */}
      {isDragging && showSnapIndicator && (
        <>
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-40 pointer-events-none"
            style={{ left }}
          />
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-40 pointer-events-none"
            style={{ left: left + width }}
          />
        </>
      )}
      
      <div
        role="button"
        tabIndex={0}
        title={tooltipText}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
        className={`absolute top-1 bottom-1 rounded flex flex-col justify-center overflow-hidden select-none
          ${isSelected ? 'ring-2 ring-white/50' : ''}
          ${isLocked ? 'cursor-not-allowed opacity-70' : 'cursor-grab'}
          ${isDragging ? 'cursor-grabbing opacity-90 z-50' : 'hover:brightness-110'}
          ${isTrimming ? 'z-50' : ''}
          ${showSnapIndicator ? 'ring-1 ring-amber-400' : ''}
          transition-colors duration-100`}
        style={{
          left,
          width: Math.max(width, 20),
          backgroundColor: clip.color,
          transition: isDragging || isTrimming ? 'none' : undefined,
        }}
      >
        {/* 左邊緣剪裁手柄 */}
        {!isLocked && (
          <div
            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize z-10 group"
            onMouseDown={(e) => handleTrimStart(e, 'start')}
          >
            <div className={`absolute inset-y-1 left-0 w-1 rounded-l transition-colors ${
              isTrimming && trimSide === 'start' ? 'bg-white/60' : 'bg-transparent group-hover:bg-white/40'
            }`} />
          </div>
        )}
        
        {/* 右邊緣剪裁手柄 */}
        {!isLocked && (
          <div
            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize z-10 group"
            onMouseDown={(e) => handleTrimStart(e, 'end')}
          >
            <div className={`absolute inset-y-1 right-0 w-1 rounded-r transition-colors ${
              isTrimming && trimSide === 'end' ? 'bg-white/60' : 'bg-transparent group-hover:bg-white/40'
            }`} />
          </div>
        )}
        
        {/* 上方：資訊列 */}
        <div className="flex items-center px-2">
          {/* 來源類型圖標 */}
          {clip.sourceType === 'spine' ? (
            <Bone size={12} className="flex-shrink-0 text-white/80 mr-1.5 pointer-events-none" />
          ) : (
            <Box size={12} className="flex-shrink-0 text-white/80 mr-1.5 pointer-events-none" />
          )}
          
          <span className="text-xs text-white font-medium truncate drop-shadow-sm pointer-events-none">
            {clip.sourceModelName} - {clip.sourceAnimationName}
          </span>
          
          {/* 片段時長顯示（剪裁後的有效長度） */}
          {width > 80 && (
            <span className="ml-auto text-[10px] text-white/70 font-mono pointer-events-none">
              {effectiveDuration}f
            </span>
          )}
        </div>
        
        {/* 下方：音效/特效 Markers 層 */}
        {renderedMarkers && renderedMarkers.length > 0 && (
          <div className="relative h-2 mt-1 bg-black/20 rounded-sm overflow-visible">
            {renderedMarkers}
          </div>
        )}
      </div>
      
      {/* Marker Tooltip（使用 Portal 渲染到 body） */}
      {hoveredTooltip && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            left: hoveredTooltip.x,
            top: hoveredTooltip.y - 8,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="flex flex-col gap-1">
            {hoveredTooltip.items.map((item) => {
              const isAudio = 'audioTrack' in item;
              const trigger = item.trigger;
              
              if (isAudio) {
                const { audioTrack } = item;
                const noteText = audioTrack.note?.trim() ? audioTrack.note : '無備註';
                return (
                  <div
                    key={`audio-${audioTrack.id}-${trigger.id}`}
                    className="bg-gray-900/95 text-white text-xs px-3 py-2 rounded-md border border-gray-700 shadow-2xl min-w-[180px]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className="font-semibold"
                        style={{ color: audioTrack.color || '#FACC15' }}
                      >
                        🔊 {audioTrack.name}
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
              } else {
                const { effectItem } = item;
                const boneInfo = effectItem.boundBoneUuid ? '綁定到 Bone' : '世界座標';
                return (
                  <div
                    key={`effect-${effectItem.id}-${trigger.id}`}
                    className="bg-gray-900/95 text-white text-xs px-3 py-2 rounded-md border border-gray-700 shadow-2xl min-w-[180px]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className="font-semibold"
                        style={{ color: effectItem.color || '#9333EA' }}
                      >
                        ✨ {effectItem.name}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        Frame {trigger.frame}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-300 mt-1">
                      位置：{boneInfo}
                    </div>
                  </div>
                );
              }
            })}
            {/* 小三角指示器 */}
            <div className="w-3 h-3 bg-gray-900/95 transform rotate-45 self-center -mt-1 border-r border-b border-gray-700" />
          </div>
        </div>,
        document.body
      )}
      
      {/* 右鍵選單（使用 Portal 渲染到 body） */}
      {contextMenu.visible && createPortal(
        <>
          {/* 背景遮罩 */}
          <div 
            className="fixed inset-0 z-[500]" 
            onClick={closeContextMenu}
            onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}
          />
          {/* 選單 */}
          <div
            className="fixed bg-gray-800/95 backdrop-blur-lg border border-white/10 rounded-lg shadow-xl py-1 z-[501] min-w-[160px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {/* Spine Skin 選擇（僅 Spine 類型顯示） */}
            {clip.sourceType === 'spine' && spineSkins.length > 0 && (
              <>
                <div
                  className="relative"
                  onMouseEnter={() => setShowSkinSubmenu(true)}
                  onMouseLeave={() => setShowSkinSubmenu(false)}
                >
                  <button
                    className="w-full px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-white/10 flex items-center gap-2 justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Palette size={12} />
                      <span>選擇 Skin</span>
                    </div>
                    <span className="text-gray-500">▶</span>
                  </button>
                  
                  {/* Skin 子選單 */}
                  {showSkinSubmenu && (
                    <div
                      className="absolute left-full top-0 ml-1 bg-gray-800/95 backdrop-blur-lg border border-white/10 rounded-lg shadow-xl py-1 min-w-[140px] max-h-[300px] overflow-y-auto"
                    >
                      {spineSkins.map((skin) => (
                        <button
                          key={skin.name}
                          onClick={() => handleSelectSkin(skin.name)}
                          className={`w-full px-3 py-1.5 text-left text-xs hover:bg-white/10 flex items-center gap-2 ${
                            clip.spineSkin === skin.name ? 'text-amber-400' : 'text-gray-300'
                          }`}
                        >
                          {clip.spineSkin === skin.name && <Check size={12} />}
                          <span className={clip.spineSkin === skin.name ? '' : 'ml-5'}>{skin.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="h-px bg-white/10 my-1" />
              </>
            )}
            
            {/* 複製片段 */}
            <button
              onClick={handleCopyClip}
              className="w-full px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-white/10 flex items-center gap-2"
            >
              <Copy size={12} />
              <span>複製動畫</span>
              <span className="ml-auto text-gray-500 text-[10px]">Ctrl+C</span>
            </button>
            
            {/* 貼上片段 */}
            <button
              onClick={handlePasteClipAtMouse}
              disabled={!clipboardClip}
              className={`w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 ${
                clipboardClip 
                  ? 'text-gray-300 hover:bg-white/10' 
                  : 'text-gray-600 cursor-not-allowed'
              }`}
            >
              <Clipboard size={12} />
              <span>貼上動畫</span>
              <span className="ml-auto text-gray-500 text-[10px]">Ctrl+V</span>
            </button>
            
            <div className="h-px bg-white/10 my-1" />
            
            {/* 刪除片段 */}
            <button
              onClick={handleDeleteClip}
              className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2"
            >
              <Trash2 size={12} />
              <span>刪除動畫</span>
            </button>
          </div>
        </>,
        document.body
      )}
    </>
  );
});

ClipBlock.displayName = 'ClipBlock';

export default ClipBlock;

