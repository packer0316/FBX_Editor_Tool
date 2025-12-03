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
} from '../../domain/entities/director/director.types';
import {
  DEFAULT_FPS,
  DEFAULT_TOTAL_FRAMES,
} from '../../domain/entities/director/director.types';

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
  updateClip: (clipId: string, updates: Partial<Pick<DirectorClip, 'speed' | 'loop' | 'blendIn' | 'blendOut'>>) => void;
  
  // 播放控制
  play: () => void;
  pause: () => void;
  stop: () => void;
  toggleLoop: () => void;
  setCurrentFrame: (frame: number) => void;
  setFps: (fps: number) => void;
  setTotalFrames: (frames: number) => void;
  
  // 區間播放控制
  setInPoint: (frame: number | null) => void;
  setOutPoint: (frame: number | null) => void;
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
        
        // 如果沒有 track，自動創建一個預設 track
        let newTracks = tracks;
        if (tracks.length === 0) {
          const defaultTrack: DirectorTrack = {
            id: generateId(),
            name: 'Track 1',
            order: 0,
            isLocked: false,
            isMuted: false,
            clips: [],
          };
          newTracks = [defaultTrack];
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
        
        const updatedClip: DirectorClip = {
          ...sourceClip,
          trackId: newTrackId,
          startFrame: newStartFrame,
          endFrame: newStartFrame + sourceClip.sourceAnimationDuration - 1,
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
      
      setInPoint: (frame: number | null) => {
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
      
      setOutPoint: (frame: number | null) => {
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
        set(initialState, undefined, 'reset');
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

