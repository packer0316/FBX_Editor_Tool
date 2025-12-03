/**
 * TrackRow - 軌道元件（支援虛擬化渲染）
 * 
 * TODO-7: 只渲染可視區域的 ClipBlock
 */

import React, { memo, useCallback, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, Lock, Unlock, Eye, EyeOff, Edit3, Copy, ArrowUp, ArrowDown } from 'lucide-react';
import { useDirectorStore } from '../../../stores/directorStore';
import { ClipBlock } from './ClipBlock';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import type { DirectorTrack } from '../../../../domain/entities/director/director.types';
import type { ModelInstance } from '../../../../domain/value-objects/ModelInstance';

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
}

interface TrackRowProps {
  track: DirectorTrack;
  pixelsPerFrame: number;
  timelineWidth: number;
  isHeaderOnly?: boolean;
  scrollOffsetX?: number;     // TODO-7: 用於虛擬化渲染
  containerWidth?: number;    // TODO-7: 用於虛擬化渲染
  /** 模型實例列表（用於查詢音效/特效綁定） */
  models?: ModelInstance[];
}

export const TrackRow: React.FC<TrackRowProps> = memo(({
  track,
  pixelsPerFrame,
  timelineWidth,
  isHeaderOnly = false,
  scrollOffsetX,
  containerWidth,
  models = [],
}) => {
  const { tracks, removeTrack, updateTrack, reorderTracks, removeClip, ui } = useDirectorStore();
  
  // TODO-7: 虛擬化渲染 - 只渲染可視區域的 Clips
  const visibleClips = useMemo(() => {
    // 如果沒有提供 scrollOffsetX 或 containerWidth，則渲染所有 clips（向後兼容）
    if (scrollOffsetX === undefined || containerWidth === undefined) {
      return track.clips;
    }
    
    // 計算可視範圍（以幀為單位）
    const visibleStart = scrollOffsetX / pixelsPerFrame;
    const visibleEnd = (scrollOffsetX + containerWidth) / pixelsPerFrame;
    
    // 過濾：Clip 與可視區域有交集
    return track.clips.filter(clip => {
      return clip.endFrame >= visibleStart && clip.startFrame <= visibleEnd;
    });
  }, [track.clips, scrollOffsetX, containerWidth, pixelsPerFrame]);
  const trackRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0 });
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(track.name);
  
  const { handleTrackDragOver, handleTrackDrop } = useDragAndDrop({
    pixelsPerFrame,
  });

  const handleRemoveTrack = useCallback(() => {
    removeTrack(track.id);
  }, [removeTrack, track.id]);

  const handleToggleLock = useCallback(() => {
    updateTrack(track.id, { isLocked: !track.isLocked });
  }, [updateTrack, track.id, track.isLocked]);

  const handleToggleMute = useCallback(() => {
    updateTrack(track.id, { isMuted: !track.isMuted });
  }, [updateTrack, track.id, track.isMuted]);

  // 右鍵選單
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0 });
  }, []);

  // 重命名
  const handleStartRename = useCallback(() => {
    setNewName(track.name);
    setIsRenaming(true);
    closeContextMenu();
  }, [track.name, closeContextMenu]);

  const handleConfirmRename = useCallback(() => {
    if (newName.trim()) {
      updateTrack(track.id, { name: newName.trim() });
    }
    setIsRenaming(false);
  }, [updateTrack, track.id, newName]);

  const handleCancelRename = useCallback(() => {
    setIsRenaming(false);
    setNewName(track.name);
  }, [track.name]);

  // 移動軌道
  const handleMoveUp = useCallback(() => {
    const currentIndex = tracks.findIndex(t => t.id === track.id);
    if (currentIndex > 0) {
      const newOrder = [...tracks.map(t => t.id)];
      [newOrder[currentIndex - 1], newOrder[currentIndex]] = [newOrder[currentIndex], newOrder[currentIndex - 1]];
      reorderTracks(newOrder);
    }
    closeContextMenu();
  }, [tracks, track.id, reorderTracks, closeContextMenu]);

  const handleMoveDown = useCallback(() => {
    const currentIndex = tracks.findIndex(t => t.id === track.id);
    if (currentIndex < tracks.length - 1) {
      const newOrder = [...tracks.map(t => t.id)];
      [newOrder[currentIndex], newOrder[currentIndex + 1]] = [newOrder[currentIndex + 1], newOrder[currentIndex]];
      reorderTracks(newOrder);
    }
    closeContextMenu();
  }, [tracks, track.id, reorderTracks, closeContextMenu]);

  // 複製軌道
  const handleDuplicate = useCallback(() => {
    // TODO: 實現複製軌道功能
    closeContextMenu();
  }, [closeContextMenu]);

  // 刪除選中的片段
  const handleDeleteSelectedClip = useCallback(() => {
    if (ui.selectedClipId) {
      removeClip(ui.selectedClipId);
    }
    closeContextMenu();
  }, [ui.selectedClipId, removeClip, closeContextMenu]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    handleTrackDragOver(e, track.id);
  }, [handleTrackDragOver, track.id]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    if (!trackRef.current) return;
    handleTrackDrop(e, track.id, trackRef.current);
  }, [handleTrackDrop, track.id]);

  // 渲染 Header（左側固定區域）
  if (isHeaderOnly) {
    const trackIndex = tracks.findIndex(t => t.id === track.id);
    const canMoveUp = trackIndex > 0;
    const canMoveDown = trackIndex < tracks.length - 1;

    return (
      <>
        <div
          className={`h-12 flex items-center gap-1 px-2 border-b border-white/5 ${
            track.isMuted ? 'opacity-50' : ''
          }`}
          onContextMenu={handleContextMenu}
        >
          {/* 名稱（可重命名） */}
          {isRenaming ? (
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={handleConfirmRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmRename();
                if (e.key === 'Escape') handleCancelRename();
              }}
              className="flex-1 bg-white/10 border border-white/20 rounded px-1 text-xs text-white outline-none focus:border-amber-400"
              autoFocus
            />
          ) : (
            <span 
              className="text-xs text-gray-300 truncate flex-1 cursor-pointer hover:text-white" 
              title={track.name}
              onDoubleClick={handleStartRename}
            >
              {track.name}
            </span>
          )}
          
          {/* 控制按鈕 */}
          <button
            onClick={handleToggleMute}
            className={`p-1 rounded hover:bg-white/10 ${track.isMuted ? 'text-gray-600' : 'text-gray-500'}`}
            title={track.isMuted ? '顯示軌道' : '隱藏軌道'}
          >
            {track.isMuted ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
          
          <button
            onClick={handleToggleLock}
            className={`p-1 rounded hover:bg-white/10 ${track.isLocked ? 'text-amber-400' : 'text-gray-500'}`}
            title={track.isLocked ? '解鎖' : '鎖定'}
          >
            {track.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
          </button>
          
          <button
            onClick={handleRemoveTrack}
            className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-red-400"
            title="刪除軌道"
          >
            <Trash2 size={12} />
          </button>
        </div>

        {/* 右鍵選單（使用 Portal 渲染到 body） */}
        {contextMenu.visible && createPortal(
          <>
            {/* 背景遮罩 */}
            <div 
              className="fixed inset-0 z-[500]" 
              onClick={closeContextMenu}
            />
            {/* 選單 */}
            <div
              className="fixed bg-gray-800/95 backdrop-blur-lg border border-white/10 rounded-lg shadow-xl py-1 z-[501] min-w-[140px]"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              <button
                onClick={handleStartRename}
                className="w-full px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-white/10 flex items-center gap-2"
              >
                <Edit3 size={12} />
                <span>重新命名</span>
              </button>
              <button
                onClick={handleDuplicate}
                className="w-full px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-white/10 flex items-center gap-2"
              >
                <Copy size={12} />
                <span>複製軌道</span>
              </button>
              <div className="h-px bg-white/10 my-1" />
              <button
                onClick={handleMoveUp}
                disabled={!canMoveUp}
                className={`w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 ${
                  canMoveUp ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 cursor-not-allowed'
                }`}
              >
                <ArrowUp size={12} />
                <span>上移</span>
              </button>
              <button
                onClick={handleMoveDown}
                disabled={!canMoveDown}
                className={`w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 ${
                  canMoveDown ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 cursor-not-allowed'
                }`}
              >
                <ArrowDown size={12} />
                <span>下移</span>
              </button>
              <div className="h-px bg-white/10 my-1" />
              <button
                onClick={handleToggleMute}
                className="w-full px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-white/10 flex items-center gap-2"
              >
                {track.isMuted ? <Eye size={12} /> : <EyeOff size={12} />}
                <span>{track.isMuted ? '顯示軌道' : '隱藏軌道'}</span>
              </button>
              <button
                onClick={handleToggleLock}
                className="w-full px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-white/10 flex items-center gap-2"
              >
                {track.isLocked ? <Unlock size={12} /> : <Lock size={12} />}
                <span>{track.isLocked ? '解鎖' : '鎖定'}</span>
              </button>
              <div className="h-px bg-white/10 my-1" />
              <button
                onClick={() => { handleRemoveTrack(); closeContextMenu(); }}
                className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2"
              >
                <Trash2 size={12} />
                <span>刪除軌道</span>
              </button>
            </div>
          </>,
          document.body
        )}
      </>
    );
  }

  // 渲染時間軸內容（右側可滾動區域）
  const trackIndex = tracks.findIndex(t => t.id === track.id);
  const canMoveUp = trackIndex > 0;
  const canMoveDown = trackIndex < tracks.length - 1;

  return (
    <>
      <div
        ref={trackRef}
        className={`h-12 relative border-b border-white/5 ${
          ui.selectedTrackId === track.id ? 'bg-white/5' : ''
        } ${track.isMuted ? 'opacity-50' : ''} ${track.isLocked ? 'cursor-not-allowed' : ''}`}
        style={{ width: timelineWidth }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onContextMenu={handleContextMenu}
      >
        {/* 片段（TODO-7: 使用虛擬化渲染） */}
        {visibleClips.map(clip => (
          <ClipBlock
            key={clip.id}
            clip={clip}
            pixelsPerFrame={pixelsPerFrame}
            isLocked={track.isLocked}
            models={models}
          />
        ))}
      </div>

      {/* 右鍵選單（時間軸區域，使用 Portal 渲染到 body） */}
      {contextMenu.visible && createPortal(
        <>
          <div 
            className="fixed inset-0 z-[500]" 
            onClick={closeContextMenu}
            onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}
          />
          <div
            className="fixed bg-gray-800/95 backdrop-blur-lg border border-white/10 rounded-lg shadow-xl py-1 z-[501] min-w-[140px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={handleMoveUp}
              disabled={!canMoveUp}
              className={`w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 ${
                canMoveUp ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 cursor-not-allowed'
              }`}
            >
              <ArrowUp size={12} />
              <span>上移</span>
            </button>
            <button
              onClick={handleMoveDown}
              disabled={!canMoveDown}
              className={`w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 ${
                canMoveDown ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 cursor-not-allowed'
              }`}
            >
              <ArrowDown size={12} />
              <span>下移</span>
            </button>
            <div className="h-px bg-white/10 my-1" />
            <button
              onClick={() => { handleToggleMute(); closeContextMenu(); }}
              className="w-full px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-white/10 flex items-center gap-2"
            >
              {track.isMuted ? <Eye size={12} /> : <EyeOff size={12} />}
              <span>{track.isMuted ? '顯示軌道' : '隱藏軌道'}</span>
            </button>
            <button
              onClick={() => { handleToggleLock(); closeContextMenu(); }}
              className="w-full px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-white/10 flex items-center gap-2"
            >
              {track.isLocked ? <Unlock size={12} /> : <Lock size={12} />}
              <span>{track.isLocked ? '解鎖' : '鎖定'}</span>
            </button>
            <div className="h-px bg-white/10 my-1" />
            <button
              onClick={handleDeleteSelectedClip}
              disabled={!ui.selectedClipId}
              className={`w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 ${
                ui.selectedClipId ? 'text-red-400 hover:bg-red-500/10' : 'text-gray-600 cursor-not-allowed'
              }`}
              title={!ui.selectedClipId ? '請先選擇一個動畫片段' : ''}
            >
              <Trash2 size={12} />
              <span>刪除動畫</span>
            </button>
            <button
              onClick={() => { handleRemoveTrack(); closeContextMenu(); }}
              className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2"
            >
              <Trash2 size={12} />
              <span>刪除軌道</span>
            </button>
          </div>
        </>,
        document.body
      )}
    </>
  );
});

TrackRow.displayName = 'TrackRow';

export default TrackRow;

