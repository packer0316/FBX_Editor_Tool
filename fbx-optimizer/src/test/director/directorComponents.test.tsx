/**
 * Director Components 單元測試
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDirectorStore } from '../../presentation/stores/directorStore';
import { DirectorPanel } from '../../presentation/features/director/components/DirectorPanel';
import { PlaybackControls } from '../../presentation/features/director/components/PlaybackControls';
import { ActionSourcePanel } from '../../presentation/features/director/components/ActionSourcePanel';
import type { ActionSource } from '../../domain/entities/director/director.types';

// Mock ActionSource 資料
const mockActionSources: ActionSource[] = [
  {
    modelId: 'model-1',
    modelName: 'Character A',
    modelColor: '#3B82F6',
    clips: [
      { clipId: 'clip-1', displayName: 'walk', durationFrames: 60, durationSeconds: 2 },
      { clipId: 'clip-2', displayName: 'run', durationFrames: 45, durationSeconds: 1.5 },
    ],
  },
  {
    modelId: 'model-2',
    modelName: 'Character B',
    modelColor: '#10B981',
    clips: [
      { clipId: 'clip-3', displayName: 'attack', durationFrames: 30, durationSeconds: 1 },
    ],
  },
];

describe('Director Components', () => {
  beforeEach(() => {
    useDirectorStore.getState().reset();
  });

  describe('DirectorPanel', () => {
    it('非導演模式時不應該渲染', () => {
      const { container } = render(<DirectorPanel actionSources={mockActionSources} />);
      expect(container.firstChild).toBeNull();
    });

    it('導演模式時應該渲染面板', () => {
      useDirectorStore.getState().enterDirectorMode();
      render(<DirectorPanel actionSources={mockActionSources} />);
      
      expect(screen.getByText('🎬 Director Mode')).toBeInTheDocument();
    });

    it('點擊關閉按鈕應該退出導演模式', () => {
      useDirectorStore.getState().enterDirectorMode();
      render(<DirectorPanel actionSources={mockActionSources} />);
      
      const closeButton = screen.getByTitle('關閉導演模式 (ESC)');
      fireEvent.click(closeButton);
      
      expect(useDirectorStore.getState().isDirectorMode).toBe(false);
    });
  });

  describe('ActionSourcePanel', () => {
    it('應該顯示模型列表', () => {
      render(<ActionSourcePanel actionSources={mockActionSources} />);
      
      expect(screen.getByText('Character A')).toBeInTheDocument();
      expect(screen.getByText('Character B')).toBeInTheDocument();
    });

    it('點擊模型應該展開動作列表', () => {
      render(<ActionSourcePanel actionSources={mockActionSources} />);
      
      // 初始狀態：動作不可見
      expect(screen.queryByText('walk')).not.toBeInTheDocument();
      
      // 點擊展開
      fireEvent.click(screen.getByText('Character A'));
      
      // 展開後：動作可見
      expect(screen.getByText('walk')).toBeInTheDocument();
      expect(screen.getByText('run')).toBeInTheDocument();
    });

    it('空列表時應該顯示提示', () => {
      render(<ActionSourcePanel actionSources={[]} />);
      
      expect(screen.getByText('尚未載入模型')).toBeInTheDocument();
    });
  });

  describe('PlaybackControls', () => {
    it('應該渲染播放控制按鈕', () => {
      render(<PlaybackControls />);
      
      expect(screen.getByTitle('播放 (Space)')).toBeInTheDocument();
      expect(screen.getByTitle('停止')).toBeInTheDocument();
      expect(screen.getByTitle('跳到開頭')).toBeInTheDocument();
      expect(screen.getByTitle('跳到結尾')).toBeInTheDocument();
    });

    it('點擊播放應該開始播放', () => {
      render(<PlaybackControls />);
      
      const playButton = screen.getByTitle('播放 (Space)');
      fireEvent.click(playButton);
      
      expect(useDirectorStore.getState().timeline.isPlaying).toBe(true);
    });

    it('播放中點擊應該暫停', () => {
      useDirectorStore.getState().play();
      render(<PlaybackControls />);
      
      const pauseButton = screen.getByTitle('暫停 (Space)');
      fireEvent.click(pauseButton);
      
      expect(useDirectorStore.getState().timeline.isPlaying).toBe(false);
    });

    it('點擊停止應該重置到第 0 幀', () => {
      const store = useDirectorStore.getState();
      store.play();
      store.setCurrentFrame(100);
      
      render(<PlaybackControls />);
      
      const stopButton = screen.getByTitle('停止');
      fireEvent.click(stopButton);
      
      const { timeline } = useDirectorStore.getState();
      expect(timeline.isPlaying).toBe(false);
      expect(timeline.currentFrame).toBe(0);
    });

    it('點擊循環應該切換循環模式', () => {
      render(<PlaybackControls />);
      
      const loopButton = screen.getByTitle('開啟循環');
      fireEvent.click(loopButton);
      
      expect(useDirectorStore.getState().timeline.isLooping).toBe(true);
    });

    it('修改 FPS 輸入應該更新設定', () => {
      render(<PlaybackControls />);
      
      const fpsInput = screen.getByDisplayValue('30');
      fireEvent.change(fpsInput, { target: { value: '60' } });
      
      expect(useDirectorStore.getState().timeline.fps).toBe(60);
    });
  });
});

