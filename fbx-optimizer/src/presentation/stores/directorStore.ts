/**
 * Director Mode Zustand Store
 * 
 * 管理導演模式的所有狀態，包括：
 * - 模式切換
 * - 時間軸資料
 * - 軌道與片段
 * - UI 狀態
 * - 播放控制
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  DirectorTrack,
  DirectorClip,
  TimelineState,
  DirectorUIState,
  CreateClipParams,
  MoveClipParams,
  DraggingClipData,
  ProceduralAnimationType,
} from '../../domain/entities/director/director.types';
import {
  DEFAULT_FPS,
  DEFAULT_TOTAL_FRAMES,
  PROCEDURAL_ANIMATION_PRESETS,
} from '../../domain/entities/director/director.types';
import { useDirectorHistoryStore, type HistoryState } from './directorHistoryStore';

// ============================================================================
// 工具函數
// ============================================================================

/**
 * 生成唯一 ID
 */
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * 生成軌道顏色
 */
const TRACK_COLORS = [
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#06B6D4', // cyan-500
  '#84CC16', // lime-500
];

let colorIndex = 0;
const getNextColor = (): string => {
  const color = TRACK_COLORS[colorIndex % TRACK_COLORS.length];
  colorIndex++;
  return color;
};

/**
 * 記錄歷史狀態的輔助函數
 * 在執行編輯操作前調用，保存操作前的狀態
 */
const recordHistory = (actionName: string, getState: () => DirectorState) => {
  const historyStore = useDirectorHistoryStore.getState();
  const state = getState();
  
  const editableState: HistoryState = {
    tracks: JSON.parse(JSON.stringify(state.tracks)),
    timeline: {
      totalFrames: state.timeline.totalFrames,
      fps: state.timeline.fps,
      loopRegion: { ...state.timeline.loopRegion },
    },
  };
  
  historyStore.pushState(editableState, actionName);
};

// ============================================================================
// Store 類型定義
// ============================================================================

interface DirectorState {
  // 模式狀態
  isDirectorMode: boolean;
  
  // 時間軸狀態
  timeline: TimelineState;
  
  // 軌道列表
  tracks: DirectorTrack[];
  
  // UI 狀態
  ui: DirectorUIState;
  
  // 剪貼簿（複製的 Clip）
  clipboardClip: DirectorClip | null;
}

interface DirectorActions {
  // 模式控制
  toggleDirectorMode: () => void;
  enterDirectorMode: () => void;
  exitDirectorMode: () => void;
  
  // 軌道操作
  addTrack: (name?: string) => DirectorTrack;
  removeTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<Pick<DirectorTrack, 'name' | 'isLocked' | 'isMuted'>>) => void;
  reorderTracks: (trackIds: string[]) => void;
  
  // 片段操作
  addClip: (params: CreateClipParams) => DirectorClip | null;
  moveClip: (params: MoveClipParams) => boolean;
  removeClip: (clipId: string) => void;
  updateClip: (clipId: string, updates: Partial<Pick<DirectorClip, 'speed' | 'loop' | 'blendIn' | 'blendOut' | 'spineSkin' | 'trimStart' | 'trimEnd' | 'proceduralConfig'>>) => void;
  trimClip: (clipId: string, side: 'start' | 'end', frameDelta: number) => void;
  copyClip: (clipId: string) => void;
  pasteClip: (trackId: string, startFrame: number) => DirectorClip | null;
  
  // 播放控制
  play: () => void;
  pause: () => void;
  stop: () => void;
  toggleLoop: () => void;
  setCurrentFrame: (frame: number) => void;
  setFps: (fps: number) => void;
  setTotalFrames: (frames: number) => void;
  
  // 區間播放控制
  /** 設定入點，skipHistory=true 時不記錄歷史（用於拖拉過程） */
  setInPoint: (frame: number | null, skipHistory?: boolean) => void;
  /** 設定出點，skipHistory=true 時不記錄歷史（用於拖拉過程） */
  setOutPoint: (frame: number | null, skipHistory?: boolean) => void;
  clearLoopRegion: () => void;
  toggleLoopRegion: () => void;
  
  // UI 控制
  setZoom: (zoom: number) => void;
  setScrollOffset: (x: number, y: number) => void;
  /** 合併更新 zoom 和 scrollOffset，避免雙重渲染導致閃爍 */
  setZoomWithScroll: (zoom: number, scrollX: number, scrollY: number) => void;
  selectClip: (clipId: string | null) => void;
  selectTrack: (trackId: string | null) => void;
  setDragging: (isDragging: boolean, data?: DraggingClipData | null) => void;
  toggleClipSnapping: () => void;
  
  // 工具方法
  getClipById: (clipId: string) => DirectorClip | null;
  getTrackById: (trackId: string) => DirectorTrack | null;
  getActiveClipsAtFrame: (frame: number) => DirectorClip[];
  calculateTotalDuration: () => number;
  
  // 資源清理
  removeClipsByModelId: (modelId: string) => void;
  
  // 重置
  reset: () => void;
  
  // ========================================
  // 歷史記錄（Undo/Redo）
  // ========================================
  
  /** 取得當前可編輯狀態（用於歷史記錄） */
  getEditableState: () => HistoryState;
  
  /** 套用歷史狀態（用於 Undo/Redo） */
  applyHistoryState: (historyState: HistoryState) => void;
  
  /** 執行 Undo */
  undo: () => void;
  
  /** 執行 Redo */
  redo: () => void;
  
  /**
   * 開始拖拉操作
   * 在 mousedown 時調用，記錄當前狀態
   * 拖拉過程中的操作（如 trimClip）不會記錄歷史
   */
  beginDragOperation: (actionName: string) => void;
}

type DirectorStore = DirectorState & DirectorActions;

// ============================================================================
// 初始狀態
// ============================================================================

const initialTimelineState: TimelineState = {
  totalFrames: DEFAULT_TOTAL_FRAMES,
  fps: DEFAULT_FPS,
  currentFrame: 0,
  isPlaying: false,
  isLooping: false,
  loopRegion: {
    inPoint: null,
    outPoint: null,
    enabled: false,
  },
};

const initialUIState: DirectorUIState = {
  zoom: 1,
  scrollOffsetX: 0,
  scrollOffsetY: 0,
  selectedClipId: null,
  selectedTrackId: null,
  isDragging: false,
  draggingClipData: null,
  clipSnapping: true,  // 預設開啟片段吸附
};

const initialState: DirectorState = {
  isDirectorMode: false,
  timeline: initialTimelineState,
  tracks: [],
  ui: initialUIState,
  clipboardClip: null,
};

// ============================================================================
// Store 實作
// ============================================================================

export const useDirectorStore = create<DirectorStore>()(
  devtools(
    (set, get) => ({
      // 初始狀態
      ...initialState,
      
      // ========================================
      // 模式控制
      // ========================================
      
      toggleDirectorMode: () => {
        const { isDirectorMode } = get();
        if (isDirectorMode) {
          get().exitDirectorMode();
        } else {
          get().enterDirectorMode();
        }
      },
      
      enterDirectorMode: () => {
        const { tracks } = get();
        
        // 如果沒有 track，自動創建 4 個預設 track
        let newTracks = tracks;
        if (tracks.length === 0) {
          // 清空歷史記錄，確保預設 track 不會被 Undo
          // 這樣用戶無法 Undo 到沒有 track 的狀態
          useDirectorHistoryStore.getState().clear();
          
          newTracks = Array.from({ length: 4 }, (_, i) => ({
            id: generateId(),
            name: `Track ${i + 1}`,
            order: i,
            isLocked: false,
            isMuted: false,
            clips: [],
          }));
        }
        
        set(
          { 
            isDirectorMode: true,
            tracks: newTracks,
          },
          undefined,
          'enterDirectorMode'
        );
      },
      
      exitDirectorMode: () => {
        set(
          {
            isDirectorMode: false,
            timeline: { ...get().timeline, isPlaying: false },
          },
          undefined,
          'exitDirectorMode'
        );
      },
      
      // ========================================
      // 軌道操作
      // ========================================
      
      addTrack: (name?: string) => {
        // 記錄歷史
        recordHistory('addTrack', get);
        
        const { tracks } = get();
        const newTrack: DirectorTrack = {
          id: generateId(),
          name: name ?? `Track ${tracks.length + 1}`,
          order: tracks.length,
          isLocked: false,
          isMuted: false,
          clips: [],
        };
        
        set(
          { tracks: [...tracks, newTrack] },
          undefined,
          'addTrack'
        );
        
        return newTrack;
      },
      
      removeTrack: (trackId: string) => {
        // 記錄歷史
        recordHistory('removeTrack', get);
        
        set(
          (state) => ({
            tracks: state.tracks
              .filter((t) => t.id !== trackId)
              .map((t, index) => ({ ...t, order: index })),
            ui: {
              ...state.ui,
              selectedTrackId: state.ui.selectedTrackId === trackId ? null : state.ui.selectedTrackId,
            },
          }),
          undefined,
          'removeTrack'
        );
      },
      
      updateTrack: (trackId, updates) => {
        // 記錄歷史
        recordHistory('updateTrack', get);
        
        set(
          (state) => ({
            tracks: state.tracks.map((t) =>
              t.id === trackId ? { ...t, ...updates } : t
            ),
          }),
          undefined,
          'updateTrack'
        );
      },
      
      reorderTracks: (trackIds: string[]) => {
        // 記錄歷史
        recordHistory('reorderTracks', get);
        
        set(
          (state) => {
            const trackMap = new Map(state.tracks.map((t) => [t.id, t]));
            const reorderedTracks = trackIds
              .map((id, index) => {
                const track = trackMap.get(id);
                return track ? { ...track, order: index } : null;
              })
              .filter((t): t is DirectorTrack => t !== null);
            
            return { tracks: reorderedTracks };
          },
          undefined,
          'reorderTracks'
        );
      },
      
      // ========================================
      // 片段操作
      // ========================================
      
      addClip: (params: CreateClipParams) => {
        const { tracks, timeline } = get();
        const track = tracks.find((t) => t.id === params.trackId);
        
        if (!track || track.isLocked) {
          return null;
        }
        
        // 記錄歷史
        recordHistory('addClip', get);
        
        const newClip: DirectorClip = {
          id: generateId(),
          trackId: params.trackId,
          sourceType: params.sourceType ?? '3d-model',
          sourceModelId: params.sourceModelId,
          sourceModelName: params.sourceModelName,
          sourceAnimationId: params.sourceAnimationId,
          sourceAnimationName: params.sourceAnimationName,
          sourceAnimationDuration: params.sourceAnimationDuration,
          startFrame: params.startFrame,
          endFrame: params.startFrame + params.sourceAnimationDuration - 1,
          trimStart: 0,
          trimEnd: params.sourceAnimationDuration - 1,
          speed: 1.0,
          loop: false,
          blendIn: 0,
          blendOut: 0,
          color: params.color ?? getNextColor(),
          // Spine 特有屬性
          ...(params.sourceType === 'spine' && {
            spineInstanceId: params.spineInstanceId,
            spineLayerId: params.spineLayerId,
            spineElementId: params.spineElementId,
          }),
          // 程式化動畫特有屬性
          ...(params.sourceType === 'procedural' && params.proceduralType && {
            proceduralType: params.proceduralType,
            proceduralConfig: {
              type: params.proceduralType,
            },
          }),
        };
        
        // 自動擴展時間軸（留 10% 緩衝空間）
        const newEndFrame = newClip.endFrame;
        const minTotalFrames = Math.ceil(newEndFrame * 1.1);
        const newTotalFrames = Math.max(timeline.totalFrames, minTotalFrames);
        
        set(
          (state) => ({
            tracks: state.tracks.map((t) =>
              t.id === params.trackId
                ? { ...t, clips: [...t.clips, newClip] }
                : t
            ),
            timeline: {
              ...state.timeline,
              totalFrames: newTotalFrames,
            },
          }),
          undefined,
          'addClip'
        );
        
        return newClip;
      },
      
      moveClip: (params: MoveClipParams) => {
        const { tracks, timeline } = get();
        const { clipId, newTrackId, newStartFrame } = params;
        
        // 找到片段
        let sourceClip: DirectorClip | null = null;
        let sourceTrackId: string | null = null;
        
        for (const track of tracks) {
          const clip = track.clips.find((c) => c.id === clipId);
          if (clip) {
            sourceClip = clip;
            sourceTrackId = track.id;
            break;
          }
        }
        
        if (!sourceClip || !sourceTrackId) {
          return false;
        }
        
        const newTrack = tracks.find((t) => t.id === newTrackId);
        if (!newTrack || newTrack.isLocked) {
          return false;
        }
        
        // 記錄歷史
        recordHistory('moveClip', get);
        
        // 計算有效時長（考慮 trim）
        const effectiveDuration = (sourceClip.trimEnd ?? sourceClip.sourceAnimationDuration - 1) 
          - (sourceClip.trimStart ?? 0) + 1;
        
        const updatedClip: DirectorClip = {
          ...sourceClip,
          trackId: newTrackId,
          startFrame: newStartFrame,
          endFrame: newStartFrame + effectiveDuration - 1,
        };
        
        // 自動擴展時間軸（留 10% 緩衝空間）
        const newEndFrame = updatedClip.endFrame;
        const minTotalFrames = Math.ceil(newEndFrame * 1.1);
        const newTotalFrames = Math.max(timeline.totalFrames, minTotalFrames);
        
        // 同軌道移動 vs 跨軌道移動
        const isSameTrack = sourceTrackId === newTrackId;
        
        set(
          (state) => ({
            tracks: state.tracks.map((t) => {
              if (isSameTrack && t.id === sourceTrackId) {
                // 同一軌道內移動：直接更新片段位置
                return {
                  ...t,
                  clips: t.clips.map((c) =>
                    c.id === clipId ? updatedClip : c
                  ),
                };
              }
              
              if (!isSameTrack) {
                if (t.id === sourceTrackId) {
                  // 從來源軌道移除
                  return { ...t, clips: t.clips.filter((c) => c.id !== clipId) };
                }
                if (t.id === newTrackId) {
                  // 添加到目標軌道
                  return { ...t, clips: [...t.clips, updatedClip] };
                }
              }
              
              return t;
            }),
            timeline: {
              ...state.timeline,
              totalFrames: newTotalFrames,
            },
          }),
          undefined,
          'moveClip'
        );
        
        return true;
      },
      
      removeClip: (clipId: string) => {
        // 記錄歷史
        recordHistory('removeClip', get);
        
        set(
          (state) => ({
            tracks: state.tracks.map((t) => ({
              ...t,
              clips: t.clips.filter((c) => c.id !== clipId),
            })),
            ui: {
              ...state.ui,
              selectedClipId: state.ui.selectedClipId === clipId ? null : state.ui.selectedClipId,
            },
          }),
          undefined,
          'removeClip'
        );
      },
      
      updateClip: (clipId, updates) => {
        // 記錄歷史
        recordHistory('updateClip', get);
        
        set(
          (state) => ({
            tracks: state.tracks.map((t) => ({
              ...t,
              clips: t.clips.map((c) =>
                c.id === clipId ? { ...c, ...updates } : c
              ),
            })),
          }),
          undefined,
          'updateClip'
        );
      },
      
      trimClip: (clipId: string, side: 'start' | 'end', frameDelta: number) => {
        const { tracks } = get();
        
        // 找到要剪裁的 clip
        let targetClip: DirectorClip | null = null;
        for (const track of tracks) {
          const clip = track.clips.find((c) => c.id === clipId);
          if (clip) {
            targetClip = clip;
            break;
          }
        }
        
        if (!targetClip) return;
        
        // 注意：trimClip 不記錄歷史
        // 歷史記錄由 UI 層在 mousedown 時調用 beginDragOperation 處理
        // 這樣拖拉過程中的中間狀態不會被記錄
        
        // 程式化動畫的特殊處理：直接調整時長（所有程式動作都可調整）
        if (targetClip.sourceType === 'procedural') {
          let newDuration = targetClip.sourceAnimationDuration;
          let newStartFrame = targetClip.startFrame;
          let newEndFrame = targetClip.endFrame;
          
          if (side === 'start') {
            // 從左邊調整：移動起點，縮短/延長時長
            const newStart = Math.max(0, targetClip.startFrame + frameDelta);
            const oldDuration = targetClip.endFrame - targetClip.startFrame + 1;
            newDuration = Math.max(2, oldDuration - (newStart - targetClip.startFrame));
            newStartFrame = newStart;
            newEndFrame = newStartFrame + newDuration - 1;
          } else {
            // 從右邊調整：延長/縮短結束點
            newDuration = Math.max(2, targetClip.sourceAnimationDuration + frameDelta);
            newEndFrame = targetClip.startFrame + newDuration - 1;
          }
          
          set(
            (state) => ({
              tracks: state.tracks.map((t) => ({
                ...t,
                clips: t.clips.map((c) =>
                  c.id === clipId
                    ? {
                        ...c,
                        sourceAnimationDuration: newDuration,
                        startFrame: newStartFrame,
                        endFrame: newEndFrame,
                        trimStart: 0,
                        trimEnd: newDuration - 1,
                      }
                    : c
                ),
              })),
            }),
            undefined,
            'trimClip-procedural'
          );
          return;
        }
        
        // 一般動畫的剪裁邏輯
        let newTrimStart = targetClip.trimStart;
        let newTrimEnd = targetClip.trimEnd;
        let newStartFrame = targetClip.startFrame;
        let newEndFrame = targetClip.endFrame;
        
        if (side === 'start') {
          // 剪裁入點：調整 trimStart 和 startFrame
          newTrimStart = Math.max(0, Math.min(targetClip.trimStart + frameDelta, targetClip.trimEnd - 1));
          const trimDelta = newTrimStart - targetClip.trimStart;
          newStartFrame = targetClip.startFrame + trimDelta;
          // endFrame 不變，因為是從左邊剪裁
        } else {
          // 剪裁出點：調整 trimEnd 和 endFrame
          newTrimEnd = Math.max(targetClip.trimStart + 1, Math.min(targetClip.trimEnd + frameDelta, targetClip.sourceAnimationDuration - 1));
          const trimDelta = newTrimEnd - targetClip.trimEnd;
          newEndFrame = targetClip.endFrame + trimDelta;
        }
        
        // 確保 startFrame 不會小於 0
        if (newStartFrame < 0) {
          const offset = -newStartFrame;
          newStartFrame = 0;
          newTrimStart = targetClip.trimStart + offset;
        }
        
        set(
          (state) => ({
            tracks: state.tracks.map((t) => ({
              ...t,
              clips: t.clips.map((c) =>
                c.id === clipId
                  ? {
                      ...c,
                      trimStart: newTrimStart,
                      trimEnd: newTrimEnd,
                      startFrame: newStartFrame,
                      endFrame: newEndFrame,
                    }
                  : c
              ),
            })),
          }),
          undefined,
          'trimClip'
        );
      },
      
      copyClip: (clipId: string) => {
        const clip = get().getClipById(clipId);
        if (clip) {
          set(
            { clipboardClip: { ...clip } },
            undefined,
            'copyClip'
          );
        }
      },
      
      pasteClip: (trackId: string, startFrame: number) => {
        const { clipboardClip, tracks, timeline } = get();
        if (!clipboardClip) return null;
        
        const track = tracks.find((t) => t.id === trackId);
        if (!track || track.isLocked) return null;
        
        // 記錄歷史
        recordHistory('pasteClip', get);
        
        // 計算剪裁後的有效長度
        const effectiveDuration = (clipboardClip.trimEnd ?? clipboardClip.sourceAnimationDuration - 1) - (clipboardClip.trimStart ?? 0) + 1;
        
        // 建立新的 clip（複製所有屬性，生成新 ID）
        const newClip: DirectorClip = {
          ...clipboardClip,
          id: generateId(),
          trackId,
          startFrame,
          endFrame: startFrame + effectiveDuration - 1,
        };
        
        // 自動擴展時間軸（留 10% 緩衝空間）
        const newEndFrame = newClip.endFrame;
        const minTotalFrames = Math.ceil(newEndFrame * 1.1);
        const newTotalFrames = Math.max(timeline.totalFrames, minTotalFrames);
        
        set(
          (state) => ({
            tracks: state.tracks.map((t) =>
              t.id === trackId
                ? { ...t, clips: [...t.clips, newClip] }
                : t
            ),
            timeline: {
              ...state.timeline,
              totalFrames: newTotalFrames,
            },
            ui: {
              ...state.ui,
              selectedClipId: newClip.id,
            },
          }),
          undefined,
          'pasteClip'
        );
        
        return newClip;
      },
      
      // ========================================
      // 播放控制
      // ========================================
      
      play: () => {
        const { timeline } = get();
        const { loopRegion, currentFrame } = timeline;
        
        // 如果有有效區間且播放頭在區間外，跳到入點
        let newFrame = currentFrame;
        if (loopRegion.enabled && loopRegion.inPoint !== null && loopRegion.outPoint !== null) {
          if (currentFrame < loopRegion.inPoint || currentFrame >= loopRegion.outPoint) {
            newFrame = loopRegion.inPoint;
          }
        }
        
        set(
          (state) => ({
            timeline: { 
              ...state.timeline, 
              isPlaying: true,
              currentFrame: newFrame,
            },
          }),
          undefined,
          'play'
        );
      },
      
      pause: () => {
        set(
          (state) => ({
            timeline: { ...state.timeline, isPlaying: false },
          }),
          undefined,
          'pause'
        );
      },
      
      stop: () => {
        const { timeline } = get();
        const { loopRegion } = timeline;
        
        // 有區間且啟用時跳到入點，否則跳到開頭
        const targetFrame = (loopRegion.enabled && loopRegion.inPoint !== null) 
          ? loopRegion.inPoint 
          : 0;
        
        set(
          (state) => ({
            timeline: { ...state.timeline, isPlaying: false, currentFrame: targetFrame },
          }),
          undefined,
          'stop'
        );
      },
      
      toggleLoop: () => {
        set(
          (state) => ({
            timeline: { ...state.timeline, isLooping: !state.timeline.isLooping },
          }),
          undefined,
          'toggleLoop'
        );
      },
      
      setCurrentFrame: (frame: number) => {
        const { timeline } = get();
        const clampedFrame = Math.max(0, Math.min(frame, timeline.totalFrames));
        
        set(
          (state) => ({
            timeline: { ...state.timeline, currentFrame: clampedFrame },
          }),
          undefined,
          'setCurrentFrame'
        );
      },
      
      setFps: (fps: number) => {
        // 記錄歷史
        recordHistory('setFps', get);
        
        const clampedFps = Math.max(1, Math.min(fps, 120));
        
        set(
          (state) => ({
            timeline: { ...state.timeline, fps: clampedFps },
          }),
          undefined,
          'setFps'
        );
      },
      
      setTotalFrames: (frames: number) => {
        // 記錄歷史
        recordHistory('setTotalFrames', get);
        
        const clampedFrames = Math.max(1, frames);
        
        set(
          (state) => ({
            timeline: {
              ...state.timeline,
              totalFrames: clampedFrames,
              currentFrame: Math.min(state.timeline.currentFrame, clampedFrames),
            },
          }),
          undefined,
          'setTotalFrames'
        );
      },
      
      // ========================================
      // 區間播放控制
      // ========================================
      
      setInPoint: (frame: number | null, skipHistory = false) => {
        // 記錄歷史（拖拉過程中跳過）
        if (!skipHistory) {
          recordHistory('setInPoint', get);
        }
        
        const { timeline } = get();
        let inPoint = frame;
        
        // 邊界處理
        if (inPoint !== null) {
          inPoint = Math.max(0, Math.min(inPoint, timeline.totalFrames));
          // 如果 inPoint > outPoint，交換
          if (timeline.loopRegion.outPoint !== null && inPoint > timeline.loopRegion.outPoint) {
            set(
              (state) => ({
                timeline: {
                  ...state.timeline,
                  loopRegion: {
                    ...state.timeline.loopRegion,
                    inPoint: state.timeline.loopRegion.outPoint,
                    outPoint: inPoint,
                    enabled: true,
                  },
                },
              }),
              undefined,
              'setInPoint'
            );
            return;
          }
        }
        
        set(
          (state) => ({
            timeline: {
              ...state.timeline,
              loopRegion: {
                ...state.timeline.loopRegion,
                inPoint,
                enabled: inPoint !== null || state.timeline.loopRegion.outPoint !== null,
              },
            },
          }),
          undefined,
          'setInPoint'
        );
      },
      
      setOutPoint: (frame: number | null, skipHistory = false) => {
        // 記錄歷史（拖拉過程中跳過）
        if (!skipHistory) {
          recordHistory('setOutPoint', get);
        }
        
        const { timeline } = get();
        let outPoint = frame;
        
        // 邊界處理
        if (outPoint !== null) {
          outPoint = Math.max(0, Math.min(outPoint, timeline.totalFrames));
          // 如果 outPoint < inPoint，交換
          if (timeline.loopRegion.inPoint !== null && outPoint < timeline.loopRegion.inPoint) {
            set(
              (state) => ({
                timeline: {
                  ...state.timeline,
                  loopRegion: {
                    ...state.timeline.loopRegion,
                    inPoint: outPoint,
                    outPoint: state.timeline.loopRegion.inPoint,
                    enabled: true,
                  },
                },
              }),
              undefined,
              'setOutPoint'
            );
            return;
          }
        }
        
        set(
          (state) => ({
            timeline: {
              ...state.timeline,
              loopRegion: {
                ...state.timeline.loopRegion,
                outPoint,
                enabled: state.timeline.loopRegion.inPoint !== null || outPoint !== null,
              },
            },
          }),
          undefined,
          'setOutPoint'
        );
      },
      
      clearLoopRegion: () => {
        // 記錄歷史
        recordHistory('clearLoopRegion', get);
        
        set(
          (state) => ({
            timeline: {
              ...state.timeline,
              loopRegion: {
                inPoint: null,
                outPoint: null,
                enabled: false,
              },
            },
          }),
          undefined,
          'clearLoopRegion'
        );
      },
      
      toggleLoopRegion: () => {
        // 記錄歷史
        recordHistory('toggleLoopRegion', get);
        
        set(
          (state) => ({
            timeline: {
              ...state.timeline,
              loopRegion: {
                ...state.timeline.loopRegion,
                enabled: !state.timeline.loopRegion.enabled,
              },
            },
          }),
          undefined,
          'toggleLoopRegion'
        );
      },
      
      // ========================================
      // UI 控制
      // ========================================
      
      setZoom: (zoom: number) => {
        const clampedZoom = Math.max(0.25, Math.min(zoom, 4));
        
        set(
          (state) => ({
            ui: { ...state.ui, zoom: clampedZoom },
          }),
          undefined,
          'setZoom'
        );
      },
      
      setScrollOffset: (x: number, y: number) => {
        set(
          (state) => ({
            ui: { ...state.ui, scrollOffsetX: x, scrollOffsetY: y },
          }),
          undefined,
          'setScrollOffset'
        );
      },
      
      /**
       * 合併更新 zoom 和 scrollOffset
       * 在縮放時間軸時使用，避免分開呼叫 setZoom 和 setScrollOffset 造成雙重渲染
       */
      setZoomWithScroll: (zoom: number, scrollX: number, scrollY: number) => {
        const clampedZoom = Math.max(0.25, Math.min(zoom, 4));
        const clampedScrollX = Math.max(0, scrollX);
        const clampedScrollY = Math.max(0, scrollY);
        
        set(
          (state) => ({
            ui: { 
              ...state.ui, 
              zoom: clampedZoom,
              scrollOffsetX: clampedScrollX,
              scrollOffsetY: clampedScrollY,
            },
          }),
          undefined,
          'setZoomWithScroll'
        );
      },
      
      selectClip: (clipId: string | null) => {
        set(
          (state) => ({
            ui: { ...state.ui, selectedClipId: clipId },
          }),
          undefined,
          'selectClip'
        );
      },
      
      selectTrack: (trackId: string | null) => {
        set(
          (state) => ({
            ui: { ...state.ui, selectedTrackId: trackId },
          }),
          undefined,
          'selectTrack'
        );
      },
      
      setDragging: (isDragging: boolean, data: DraggingClipData | null = null) => {
        set(
          (state) => ({
            ui: { ...state.ui, isDragging, draggingClipData: data },
          }),
          undefined,
          'setDragging'
        );
      },
      
      toggleClipSnapping: () => {
        set(
          (state) => ({
            ui: { ...state.ui, clipSnapping: !state.ui.clipSnapping },
          }),
          undefined,
          'toggleClipSnapping'
        );
      },
      
      // ========================================
      // 工具方法
      // ========================================
      
      getClipById: (clipId: string) => {
        const { tracks } = get();
        for (const track of tracks) {
          const clip = track.clips.find((c) => c.id === clipId);
          if (clip) return clip;
        }
        return null;
      },
      
      getTrackById: (trackId: string) => {
        const { tracks } = get();
        return tracks.find((t) => t.id === trackId) ?? null;
      },
      
      getActiveClipsAtFrame: (frame: number) => {
        const { tracks } = get();
        const activeClips: DirectorClip[] = [];
        
        for (const track of tracks) {
          if (track.isMuted) continue;
          
          for (const clip of track.clips) {
            if (frame >= clip.startFrame && frame <= clip.endFrame) {
              activeClips.push(clip);
            }
          }
        }
        
        return activeClips;
      },
      
      calculateTotalDuration: () => {
        const { tracks } = get();
        let maxEndFrame = 0;
        
        for (const track of tracks) {
          for (const clip of track.clips) {
            if (clip.endFrame > maxEndFrame) {
              maxEndFrame = clip.endFrame;
            }
          }
        }
        
        return maxEndFrame;
      },
      
      // ========================================
      // 資源清理
      // ========================================
      
      /**
       * 移除指定模型的所有 Clips
       * 當模型被刪除時呼叫，清理該模型在時間軸上的所有片段
       */
      removeClipsByModelId: (modelId: string) => {
        // 記錄歷史
        recordHistory('removeClipsByModelId', get);
        
        const { tracks } = get();
        const newTracks = tracks.map(track => ({
          ...track,
          clips: track.clips.filter(clip => clip.sourceModelId !== modelId)
        }));
        
        set({ tracks: newTracks }, undefined, 'removeClipsByModelId');
      },
      
      // ========================================
      // 重置
      // ========================================
      
      reset: () => {
        colorIndex = 0;
        // 清空歷史記錄
        useDirectorHistoryStore.getState().clear();
        set(initialState, undefined, 'reset');
      },
      
      // ========================================
      // 歷史記錄（Undo/Redo）
      // ========================================
      
      getEditableState: () => {
        const state = get();
        return {
          tracks: JSON.parse(JSON.stringify(state.tracks)),
          timeline: {
            totalFrames: state.timeline.totalFrames,
            fps: state.timeline.fps,
            loopRegion: { ...state.timeline.loopRegion },
          },
        };
      },
      
      applyHistoryState: (historyState: HistoryState) => {
        set(
          (state) => ({
            tracks: historyState.tracks,
            timeline: {
              ...state.timeline,
              totalFrames: historyState.timeline.totalFrames,
              fps: historyState.timeline.fps,
              loopRegion: historyState.timeline.loopRegion,
            },
          }),
          undefined,
          'applyHistoryState'
        );
      },
      
      undo: () => {
        const historyStore = useDirectorHistoryStore.getState();
        if (!historyStore.canUndo()) return;
        
        // 設定旗標避免遞迴記錄
        historyStore.setIsUndoRedoing(true);
        
        const currentState = get().getEditableState();
        const previousState = historyStore.undo(currentState);
        
        if (previousState) {
          get().applyHistoryState(previousState);
        }
        
        historyStore.setIsUndoRedoing(false);
      },
      
      redo: () => {
        const historyStore = useDirectorHistoryStore.getState();
        if (!historyStore.canRedo()) return;
        
        // 設定旗標避免遞迴記錄
        historyStore.setIsUndoRedoing(true);
        
        const currentState = get().getEditableState();
        const nextState = historyStore.redo(currentState);
        
        if (nextState) {
          get().applyHistoryState(nextState);
        }
        
        historyStore.setIsUndoRedoing(false);
      },
      
      beginDragOperation: (actionName: string) => {
        // 在拖拉開始時記錄當前狀態
        // 這樣拖拉過程中的中間狀態不會被記錄
        // 只有 mousedown 時的狀態會被記錄
        recordHistory(actionName, get);
      },
    }),
    { name: 'director-store' }
  )
);

// ============================================================================
// Selector Hooks（效能優化）
// ============================================================================

export const useIsDirectorMode = () => useDirectorStore((state) => state.isDirectorMode);
export const useTimeline = () => useDirectorStore((state) => state.timeline);
export const useTracks = () => useDirectorStore((state) => state.tracks);
export const useDirectorUI = () => useDirectorStore((state) => state.ui);
export const useCurrentFrame = () => useDirectorStore((state) => state.timeline.currentFrame);
export const useIsPlaying = () => useDirectorStore((state) => state.timeline.isPlaying);
export const useLoopRegion = () => useDirectorStore((state) => state.timeline.loopRegion);

