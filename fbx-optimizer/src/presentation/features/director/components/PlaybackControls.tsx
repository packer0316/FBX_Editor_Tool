/**
 * PlaybackControls - 播放控制列
 */

import React, { useCallback, memo } from 'react';
import { Play, Pause, Square, Repeat, SkipBack, SkipForward, Brackets, X } from 'lucide-react';
import { useDirectorStore } from '../../../stores/directorStore';
import { formatFrameTime } from '../../../../utils/director/directorUtils';

export const PlaybackControls: React.FC = memo(() => {
  const {
    timeline,
    play,
    pause,
    stop,
    toggleLoop,
    setCurrentFrame,
    setFps,
    setTotalFrames,
    setInPoint,
    setOutPoint,
    clearLoopRegion,
    toggleLoopRegion,
  } = useDirectorStore();

  const handlePlayPause = useCallback(() => {
    if (timeline.isPlaying) {
      pause();
    } else {
      play();
    }
  }, [timeline.isPlaying, play, pause]);

  const handleStop = useCallback(() => {
    stop();
  }, [stop]);

  const handleSkipToStart = useCallback(() => {
    // 有區間且啟用時跳到入點，否則跳到開頭
    if (timeline.loopRegion.enabled && timeline.loopRegion.inPoint !== null) {
      setCurrentFrame(timeline.loopRegion.inPoint);
    } else {
      setCurrentFrame(0);
    }
  }, [setCurrentFrame, timeline.loopRegion]);

  const handleSkipToEnd = useCallback(() => {
    // 有區間且啟用時跳到出點，否則跳到結尾
    if (timeline.loopRegion.enabled && timeline.loopRegion.outPoint !== null) {
      setCurrentFrame(timeline.loopRegion.outPoint);
    } else {
      setCurrentFrame(timeline.totalFrames);
    }
  }, [setCurrentFrame, timeline.totalFrames, timeline.loopRegion]);

  const handleFrameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value)) {
      setCurrentFrame(value);
    }
  }, [setCurrentFrame]);

  const handleFpsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value)) {
      setFps(value);
    }
  }, [setFps]);

  const handleTotalFramesChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value)) {
      setTotalFrames(value);
    }
  }, [setTotalFrames]);

  // 區間播放控制
  const handleSetInPoint = useCallback(() => {
    setInPoint(timeline.currentFrame);
  }, [setInPoint, timeline.currentFrame]);

  const handleSetOutPoint = useCallback(() => {
    setOutPoint(timeline.currentFrame);
  }, [setOutPoint, timeline.currentFrame]);

  const handleClearLoopRegion = useCallback(() => {
    clearLoopRegion();
  }, [clearLoopRegion]);

  const handleToggleLoopRegion = useCallback(() => {
    toggleLoopRegion();
  }, [toggleLoopRegion]);

  // 判斷是否有有效區間
  const hasValidLoopRegion = timeline.loopRegion.inPoint !== null && timeline.loopRegion.outPoint !== null;

  return (
    <div className="h-10 flex items-center justify-between px-4 border-t border-white/10 bg-gray-800/50">
      {/* 左側：播放控制按鈕 */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleSkipToStart}
          className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          title="跳到開頭"
        >
          <SkipBack size={16} />
        </button>

        <button
          onClick={handlePlayPause}
          className={`p-2 rounded-lg transition-colors ${
            timeline.isPlaying
              ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
              : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
          }`}
          title={timeline.isPlaying ? '暫停 (Space)' : '播放 (Space)'}
        >
          {timeline.isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>

        <button
          onClick={handleStop}
          className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          title="停止"
        >
          <Square size={16} />
        </button>

        <button
          onClick={handleSkipToEnd}
          className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          title="跳到結尾"
        >
          <SkipForward size={16} />
        </button>

        <div className="w-px h-5 bg-white/10 mx-2" />

        <button
          onClick={toggleLoop}
          className={`p-1.5 rounded transition-colors ${
            timeline.isLooping
              ? 'bg-blue-500/20 text-blue-400'
              : 'hover:bg-white/10 text-gray-400 hover:text-white'
          }`}
          title={timeline.isLooping ? '關閉循環' : '開啟循環'}
        >
          <Repeat size={16} />
        </button>

        <div className="w-px h-5 bg-white/10 mx-2" />

        {/* 區間播放控制 */}
        <button
          onClick={handleSetInPoint}
          className={`px-1.5 py-1 rounded text-xs font-mono transition-colors ${
            timeline.loopRegion.inPoint !== null
              ? 'bg-cyan-500/20 text-cyan-400'
              : 'hover:bg-white/10 text-gray-400 hover:text-white'
          }`}
          title="設定入點 (I)"
        >
          I
        </button>
        
        <button
          onClick={handleSetOutPoint}
          className={`px-1.5 py-1 rounded text-xs font-mono transition-colors ${
            timeline.loopRegion.outPoint !== null
              ? 'bg-cyan-500/20 text-cyan-400'
              : 'hover:bg-white/10 text-gray-400 hover:text-white'
          }`}
          title="設定出點 (O)"
        >
          O
        </button>

        <button
          onClick={handleToggleLoopRegion}
          disabled={!hasValidLoopRegion}
          className={`p-1.5 rounded transition-colors ${
            timeline.loopRegion.enabled && hasValidLoopRegion
              ? 'bg-cyan-500/20 text-cyan-400'
              : hasValidLoopRegion
              ? 'hover:bg-white/10 text-gray-400 hover:text-white'
              : 'text-gray-600 cursor-not-allowed'
          }`}
          title={timeline.loopRegion.enabled ? '關閉區間播放' : '開啟區間播放'}
        >
          <Brackets size={16} />
        </button>

        {(timeline.loopRegion.inPoint !== null || timeline.loopRegion.outPoint !== null) && (
          <button
            onClick={handleClearLoopRegion}
            className="p-1.5 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
            title="清除區間 (Alt+X)"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* 中間：時間顯示 */}
      <div className="flex items-center gap-3 text-sm font-mono">
        <span className="text-gray-400">
          {formatFrameTime(timeline.currentFrame, timeline.fps, true)}
        </span>
        <span className="text-gray-600">/</span>
        <span className="text-gray-500">
          {formatFrameTime(timeline.totalFrames, timeline.fps, true)}
        </span>
        
        {/* 區間顯示 */}
        {hasValidLoopRegion && (
          <span className={`text-xs px-2 py-0.5 rounded ${
            timeline.loopRegion.enabled 
              ? 'bg-cyan-500/20 text-cyan-400' 
              : 'bg-gray-700 text-gray-500'
          }`}>
            [{timeline.loopRegion.inPoint} - {timeline.loopRegion.outPoint}]
          </span>
        )}
      </div>

      {/* 右側：設定 */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Frame:</span>
          <input
            type="number"
            value={timeline.currentFrame}
            onChange={handleFrameChange}
            className="w-16 bg-black/30 border border-white/10 rounded px-2 py-1 text-gray-300 text-center focus:outline-none focus:border-blue-500"
            min={0}
            max={timeline.totalFrames}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-gray-500">FPS:</span>
          <input
            type="number"
            value={timeline.fps}
            onChange={handleFpsChange}
            className="w-12 bg-black/30 border border-white/10 rounded px-2 py-1 text-gray-300 text-center focus:outline-none focus:border-blue-500"
            min={1}
            max={120}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-gray-500">Total:</span>
          <input
            type="number"
            value={timeline.totalFrames}
            onChange={handleTotalFramesChange}
            className="w-16 bg-black/30 border border-white/10 rounded px-2 py-1 text-gray-300 text-center focus:outline-none focus:border-blue-500"
            min={1}
          />
        </div>
      </div>
    </div>
  );
});

PlaybackControls.displayName = 'PlaybackControls';

export default PlaybackControls;

