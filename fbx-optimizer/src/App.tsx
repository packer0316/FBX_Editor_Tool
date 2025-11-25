import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { type IdentifiableClip } from './utils/clip/clipIdentifierUtils';
import SceneViewer, { type SceneViewerRef } from './presentation/features/scene-viewer/components/SceneViewer';
import SceneToolbar, { type AspectRatio } from './presentation/features/scene-viewer/components/SceneToolbar';
import MaterialShaderTool from './presentation/features/shader-panel/components/MaterialShaderTool';
import ModelInspector from './presentation/features/model-inspector/components/ModelInspector';
import AudioPanel from './presentation/features/audio-panel/components/AudioPanel';
import EffectTestPanel, { type EffectItem } from './presentation/features/effect-panel/components/EffectTestPanel';
import ModelManagerPanel from './presentation/features/model-manager/components/ModelManagerPanel';
import { optimizeAnimationClip } from './utils/optimizer';
import { AudioController } from './infrastructure/audio/WebAudioAdapter';
import { Loader2, Camera, Grid } from 'lucide-react';
import type { ShaderGroup } from './domain/value-objects/ShaderFeature';
import type { AudioTrack } from './domain/value-objects/AudioTrack';
import { CAMERA_PRESETS, type CameraPresetType } from './domain/value-objects/CameraPreset';

// Use Cases
import { LoadModelUseCase } from './application/use-cases/LoadModelUseCase';
import { CreateClipUseCase } from './application/use-cases/CreateClipUseCase';
import { PlaylistUseCase } from './application/use-cases/PlaylistUseCase';
import { AudioSyncUseCase } from './application/use-cases/AudioSyncUseCase';
import { EffectSyncUseCase } from './application/use-cases/EffectSyncUseCase';

// Hooks
import { useTheme, themeOptions } from './presentation/hooks/useTheme';
import { usePanelResize, useRightPanelResize } from './presentation/hooks/usePanelResize';
import { useFileDrop } from './presentation/hooks/useFileDrop';
import { useClickOutside } from './presentation/hooks/useClickOutside';
import { useBoneExtraction } from './presentation/hooks/useBoneExtraction';
import { useModelsManager } from './presentation/hooks/useModelsManager';

// Utils

// 向後兼容：重新導出類型
export type { AudioTrigger } from './domain/value-objects/AudioTrigger';
export type { AudioTrack } from './domain/value-objects/AudioTrack';

function App() {
  // 多模型管理
  const {
    models,
    activeModel,
    activeModelId,
    setActiveModelId,
    addModel,
    removeModel,
    updateModel,
  } = useModelsManager();

  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [originalClip, setOriginalClip] = useState<IdentifiableClip | null>(null);
  const [masterClip, setMasterClip] = useState<IdentifiableClip | null>(null);
  const [optimizedClip, setOptimizedClip] = useState<IdentifiableClip | null>(null);
  const [tolerance, setTolerance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // 動畫控制狀態
  const sceneViewerRef = useRef<SceneViewerRef>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [createdClips, setCreatedClips] = useState<IdentifiableClip[]>([]);
  const [isLoopEnabled, setIsLoopEnabled] = useState(true);

  // Panel Resize
  const { panelHeight, handleMouseDown } = usePanelResize(384);
  const { rightPanelWidth, handleRightPanelMouseDown } = useRightPanelResize(320);

  // 右側面板分頁
  const [activeTab, setActiveTab] = useState<'optimization' | 'shader' | 'audio' | 'effect'>('optimization');
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [effects, setEffects] = useState<EffectItem[]>([]);

  // Theme
  const { themeMode, setThemeMode, currentTheme } = useTheme('dark');

  // Shader 功能狀態
  const [shaderGroups, setShaderGroups] = useState<ShaderGroup[]>([]);
  const [meshNames, setMeshNames] = useState<string[]>([]);
  const [isShaderEnabled, setIsShaderEnabled] = useState(true);

  // Camera Settings
  const [showCameraSettings, setShowCameraSettings] = useState(false);
  const [showGroundSettings, setShowGroundSettings] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const cameraSettingsRef = useRef<HTMLDivElement>(null);
  const groundSettingsRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  const audioControllerRef = useRef<InstanceType<typeof AudioController>>(new AudioController());
  const lastAudioTimeRef = useRef<number>(0);
  const lastEffectTimeRef = useRef<number>(0);
  const lastAudioFrameRef = useRef<number>(-1);
  const lastEffectFrameRef = useRef<number>(-1);
  const [cameraSettings, setCameraSettings] = useState({
    fov: 50,
    near: 0.1,
    far: 1000
  });

  // Bone Binding State
  const bones = useBoneExtraction(model);
  const [boneSearchQuery, setBoneSearchQuery] = useState('');
  const [selectedBoneUuid, setSelectedBoneUuid] = useState<string | null>(null);
  const [isCameraBound, setIsCameraBound] = useState(false);
  const [showGroundPlane, setShowGroundPlane] = useState(false);
  const [groundPlaneColor, setGroundPlaneColor] = useState('#444444');
  const [groundPlaneOpacity, setGroundPlaneOpacity] = useState(1.0);
  const [enableShadows, setEnableShadows] = useState(false);
  const [showGrid, setShowGrid] = useState(true);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);

  // Aspect Ratio state
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('free');
  const [customWidth, setCustomWidth] = useState(1920);
  const [customHeight, setCustomHeight] = useState(1080);
  const aspectRatioContainerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Tone Mapping & Exposure Settings
  // 預設曝光調整為 1.5，作為視覺上較中性的基準亮度
  const [toneMappingExposure, setToneMappingExposure] = useState(1.5);
  const [whitePoint, setWhitePoint] = useState(1.0);
  const [selectedPreset, setSelectedPreset] = useState<CameraPresetType>('outdoor');
  const [hdriUrl, setHdriUrl] = useState<string>('');
  const [environmentIntensity, setEnvironmentIntensity] = useState(1.0);

  // Apply camera preset
  const applyPreset = (presetType: CameraPresetType) => {
    const preset = CAMERA_PRESETS[presetType];
    setToneMappingExposure(preset.toneMappingExposure);
    setWhitePoint(preset.whitePoint || 1.0);
    setSelectedPreset(presetType);
  };

  // 監聽容器尺寸變化和比例變化
  useEffect(() => {
    const updateContainerSize = () => {
      if (aspectRatioContainerRef.current) {
        const rect = aspectRatioContainerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    updateContainerSize();

    const resizeObserver = new ResizeObserver(updateContainerSize);
    if (aspectRatioContainerRef.current) {
      resizeObserver.observe(aspectRatioContainerRef.current);
    }

    // 添加窗口大小變化監聽
    window.addEventListener('resize', updateContainerSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateContainerSize);
    };
  }, [aspectRatio, customWidth, customHeight]);

  // 計算實際的預覽區域尺寸
  const viewerSize = useMemo(() => {
    if (aspectRatio === 'free') {
      return { width: containerSize.width, height: containerSize.height };
    }

    let targetRatio: number;
    if (aspectRatio === 'custom') {
      targetRatio = customWidth / customHeight;
    } else {
      const [w, h] = aspectRatio.split(':').map(Number);
      targetRatio = w / h;
    }

    const containerRatio = containerSize.width / containerSize.height;

    let finalWidth: number;
    let finalHeight: number;

    // 根據容器和目標比例，計算最合適的尺寸
    if (containerRatio > targetRatio) {
      // 容器更寬，高度受限
      finalHeight = containerSize.height;
      finalWidth = finalHeight * targetRatio;
    } else {
      // 容器更高，寬度受限
      finalWidth = containerSize.width;
      finalHeight = finalWidth / targetRatio;
    }

    console.log(`[AspectRatio] Container: ${containerSize.width}x${containerSize.height}, Target: ${aspectRatio} (${targetRatio.toFixed(2)}), Result: ${Math.round(finalWidth)}x${Math.round(finalHeight)}`);

    return { width: finalWidth, height: finalHeight };
  }, [aspectRatio, customWidth, customHeight, containerSize]);

  // 計算 aspect ratio 容器樣式
  const getAspectRatioStyle = (): React.CSSProperties => {
    if (aspectRatio === 'free' || viewerSize.width === 0) {
      return {
        width: '100%',
        height: '100%',
      };
    }

    return {
      width: `${viewerSize.width}px`,
      height: `${viewerSize.height}px`,
    };
  };

  // Reset bone binding when model changes
  useEffect(() => {
    if (model) {
      setSelectedBoneUuid(null);
      setIsCameraBound(false);
    }
  }, [model]);

  // Click outside to close popovers
  useClickOutside(
    [cameraSettingsRef as React.RefObject<HTMLElement>, groundSettingsRef as React.RefObject<HTMLElement>, themeMenuRef as React.RefObject<HTMLElement>],
    () => {
      setShowCameraSettings(false);
      setShowGroundSettings(false);
      setShowThemeMenu(false);
    },
    showCameraSettings || showGroundSettings || showThemeMenu
  );

  // 處理檔案上傳（多模型版本）
  const handleFileUpload = async (files: FileList) => {
    setIsLoading(true);
    try {
      const instance = await LoadModelUseCase.executeAndCreateInstance(files);

      // 優化動畫（如果有）
      if (instance.originalClip) {
        const optimized = optimizeAnimationClip(instance.originalClip, instance.tolerance) as IdentifiableClip;
        instance.optimizedClip = optimized;
        instance.duration = instance.originalClip.duration;
      }

      // 添加到模型列表
      addModel(instance);

      // 設為活動模型
      setActiveModelId(instance.id);

      console.log('✅ 模型載入成功:', instance.name);
    } catch (error) {
      console.error('Error loading FBX:', error);
      alert('讀取 FBX 檔案失敗，請確認檔案格式是否正確。');
    } finally {
      setIsLoading(false);
    }
  };

  // 追蹤是否正在同步，避免循環更新
  const isSyncingRef = useRef(false);

  // 同步活動模型狀態到舊狀態（向後兼容）
  useEffect(() => {
    if (activeModel && !isSyncingRef.current) {
      isSyncingRef.current = true;
      setFile(activeModel.file);
      setModel(activeModel.model);
      setMeshNames(activeModel.meshNames);
      setShaderGroups(activeModel.shaderGroups);
      setIsShaderEnabled(activeModel.isShaderEnabled);
      setOriginalClip(activeModel.originalClip);
      setMasterClip(activeModel.masterClip);
      setOptimizedClip(activeModel.optimizedClip);
      setCreatedClips(activeModel.createdClips);
      setTolerance(activeModel.tolerance);
      setAudioTracks(activeModel.audioTracks);
      setEffects(activeModel.effects);

      // 切換模型時只同步狀態，不觸發播放或暫停動作
      // 每個模型會保持自己的播放狀態和時間，不會因為切換而改變
      setIsPlaying(activeModel.isPlaying);
      setCurrentTime(activeModel.currentTime);
      setDuration(activeModel.duration);
      setIsLoopEnabled(activeModel.isLoopEnabled);

      // 不調用 seekTo，讓每個模型保持自己的時間位置
      // 每個模型的播放狀態完全獨立，切換時不會影響
      setTimeout(() => {
        isSyncingRef.current = false;
      }, 0);
    } else if (!activeModel) {
      // 沒有活動模型時重置
      setModel(null);
      setMeshNames([]);
      setShaderGroups([]);
      setOriginalClip(null);
      setMasterClip(null);
      setOptimizedClip(null);
      setCreatedClips([]);
      setAudioTracks([]);
      setEffects([]);
      setDuration(0);
      setIsPlaying(false);
      sceneViewerRef.current?.pause();
    }
  }, [activeModelId]); // 只監聽 activeModelId，避免循環

  // 當活動模型的狀態改變時，同步回 ModelInstance（只在用戶操作時）
  // 使用 useRef 來追蹤上一次的值，只在真正改變時才更新
  const prevStateRef = useRef<{
    shaderGroups: ShaderGroup[];
    isShaderEnabled: boolean;
    originalClip: IdentifiableClip | null;
    masterClip: IdentifiableClip | null;
    optimizedClip: IdentifiableClip | null;
    createdClips: IdentifiableClip[];
    tolerance: number;
    audioTracks: AudioTrack[];
    effects: EffectItem[];
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    isLoopEnabled: boolean;
  } | null>(null);

  useEffect(() => {
    if (!activeModelId || !activeModel || isSyncingRef.current) return;

    const currentState = {
      shaderGroups,
      isShaderEnabled,
      originalClip,
      masterClip,
      optimizedClip,
      createdClips,
      tolerance,
      audioTracks,
      effects,
      isPlaying,
      currentTime,
      duration,
      isLoopEnabled
    };

    // 檢查是否有實際改變
    if (prevStateRef.current) {
      const hasChanged =
        prevStateRef.current.shaderGroups !== currentState.shaderGroups ||
        prevStateRef.current.isShaderEnabled !== currentState.isShaderEnabled ||
        prevStateRef.current.originalClip !== currentState.originalClip ||
        prevStateRef.current.masterClip !== currentState.masterClip ||
        prevStateRef.current.optimizedClip !== currentState.optimizedClip ||
        prevStateRef.current.createdClips !== currentState.createdClips ||
        prevStateRef.current.tolerance !== currentState.tolerance ||
        prevStateRef.current.audioTracks !== currentState.audioTracks ||
        prevStateRef.current.effects !== currentState.effects ||
        prevStateRef.current.isPlaying !== currentState.isPlaying ||
        prevStateRef.current.currentTime !== currentState.currentTime ||
        prevStateRef.current.duration !== currentState.duration ||
        prevStateRef.current.isLoopEnabled !== currentState.isLoopEnabled;

      if (hasChanged) {
        updateModel(activeModelId, currentState);
        prevStateRef.current = currentState;
      }
    } else {
      // 第一次設置
      prevStateRef.current = currentState;
    }
  }, [
    activeModelId,
    shaderGroups,
    isShaderEnabled,
    originalClip,
    masterClip,
    optimizedClip,
    createdClips,
    tolerance,
    audioTracks,
    effects,
    isPlaying,
    currentTime,
    duration,
    isLoopEnabled,
    activeModel
  ]);

  // 當 tolerance 改變時重新優化
  useEffect(() => {
    if (originalClip) {
      // 使用 debounce 避免頻繁計算
      const timer = setTimeout(() => {
        const optimized = optimizeAnimationClip(originalClip, tolerance) as IdentifiableClip;
        setOptimizedClip(optimized);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [tolerance, originalClip]);



  // 動畫控制處理
  const handlePlayPause = () => {
    const newPlayingState = !isPlaying;
    if (newPlayingState) {
      sceneViewerRef.current?.play();
    } else {
      sceneViewerRef.current?.pause();
    }
    setIsPlaying(newPlayingState);

    // 同步到活動模型
    if (activeModelId) {
      updateModel(activeModelId, { isPlaying: newPlayingState });
    }
  };

  const handleSeek = (time: number) => {
    sceneViewerRef.current?.seekTo(time);
    setCurrentTime(time);
    // 重置觸發狀態，避免跳過觸發
    lastAudioTimeRef.current = time;
    lastEffectTimeRef.current = time;
    lastAudioFrameRef.current = -1;
    lastEffectFrameRef.current = -1;

    // 同步到活動模型
    if (activeModelId) {
      updateModel(activeModelId, { currentTime: time });
    }
  };

  const audioSyncUseCaseRef = useRef(
    new AudioSyncUseCase(audioControllerRef.current, lastAudioTimeRef, lastAudioFrameRef)
  );
  const effectSyncUseCaseRef = useRef(
    new EffectSyncUseCase(
      lastEffectTimeRef,
      lastEffectFrameRef,
      () => model,
      () => bones
    )
  );
  const lastUIUpdateRef = useRef(0);

  // 當 model 或 bones 改變時，更新 effectSyncUseCaseRef
  useEffect(() => {
    effectSyncUseCaseRef.current = new EffectSyncUseCase(
      lastEffectTimeRef,
      lastEffectFrameRef,
      () => model,
      () => bones
    );
  }, [model, bones]);

  const handleTimeUpdate = useCallback((time: number) => {
    // Throttle UI updates to ~30fps to prevent main thread blocking
    const now = performance.now();
    if (now - lastUIUpdateRef.current > 32) {
      setCurrentTime(time);
      lastUIUpdateRef.current = now;

      // 同步到活動模型（節流更新，避免過於頻繁）
      if (activeModelId) {
        updateModel(activeModelId, { currentTime: time });
      }
    }

    // 確保使用最新的 effects（避免閉包問題）
    // 優先處理特效，再處理音效；兩者使用獨立時間參考，避免互相覆蓋
    effectSyncUseCaseRef.current.handleTimeUpdate(time, isPlaying, optimizedClip, effects);
    audioSyncUseCaseRef.current.handleTimeUpdate(time, isPlaying, optimizedClip, audioTracks);
  }, [isPlaying, optimizedClip, audioTracks, effects, activeModelId, updateModel]);

  const handleSelectClip = (clip: IdentifiableClip) => {
    setOriginalClip(clip);
    setDuration(clip.duration);
    const optimized = optimizeAnimationClip(clip, tolerance) as IdentifiableClip;
    setOptimizedClip(optimized);
    // 重置觸發狀態
    lastAudioTimeRef.current = 0;
    lastEffectTimeRef.current = 0;
    lastAudioFrameRef.current = -1;
    lastEffectFrameRef.current = -1;
    handleSeek(0);
    if (!isPlaying) handlePlayPause();
  };

  // Playlist State
  const [playlist, setPlaylist] = useState<THREE.AnimationClip[]>([]);
  const [isPlaylistPlaying, setIsPlaylistPlaying] = useState(false);
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState(0);

  // Add clip to playlist
  const handleAddToPlaylist = (clip: IdentifiableClip) => {
    setPlaylist(prev => PlaylistUseCase.addToPlaylist(prev, clip));
  };

  // Remove clip from playlist
  const handleRemoveFromPlaylist = (index: number) => {
    const removalResult = PlaylistUseCase.removeFromPlaylist(playlist, index, currentPlaylistIndex);
    setPlaylist(removalResult.newPlaylist);
    setCurrentPlaylistIndex(removalResult.newCurrentIndex);
    if (removalResult.shouldStop) {
      setIsPlaylistPlaying(false);
    }
  };

  // Reorder playlist
  const handleReorderPlaylist = (fromIndex: number, toIndex: number) => {
    const reorderResult = PlaylistUseCase.reorderPlaylist(playlist, fromIndex, toIndex);
    setPlaylist(reorderResult.newPlaylist);
    if (reorderResult.shouldStop) {
      setIsPlaylistPlaying(false);
      setCurrentPlaylistIndex(0);
    }
  };

  // Play Playlist
  const handlePlayPlaylist = () => {
    if (playlist.length === 0) return;
    setIsPlaylistPlaying(true);
    setCurrentPlaylistIndex(0);
    setOptimizedClip(playlist[0]);
    setDuration(playlist[0].duration);
    setIsPlaying(true);
    sceneViewerRef.current?.play();
  };

  // Pause Playlist
  const handlePausePlaylist = () => {
    setIsPlaylistPlaying(false);
    setIsPlaying(false);
    sceneViewerRef.current?.pause();
  };

  // Handle Clip Finish (Next in Playlist)
  const handleClipFinish = () => {
    // Early return for non-playlist mode
    if (!isPlaylistPlaying) {
      setIsPlaying(false);
      return;
    }

    const nextClipResult = PlaylistUseCase.getNextClip(playlist, currentPlaylistIndex);

    // Early return if playlist ended
    if (nextClipResult.isEnd || !nextClipResult.nextClip) {
      setIsPlaylistPlaying(false);
      setIsPlaying(false);
      sceneViewerRef.current?.pause();
      return;
    }

    // Play next clip
    requestAnimationFrame(() => {
      setCurrentPlaylistIndex(nextClipResult.nextIndex);
      setOptimizedClip(nextClipResult.nextClip!);
      setDuration(nextClipResult.nextClip!.duration);
      setCurrentTime(0);
    });
  };

  const handleCreateClip = (name: string, startFrame: number, endFrame: number) => {
    const sourceClip = masterClip || originalClip;
    if (!sourceClip) return;

    try {
      // 傳入現有片段以避免名稱衝突
      const newClip = CreateClipUseCase.execute(sourceClip, name, startFrame, endFrame, 30, createdClips);
      setCreatedClips(prev => [...prev, newClip]);
      handleSelectClip(newClip);
    } catch (error) {
      alert(error instanceof Error ? error.message : '結束時間必須大於起始時間');
    }
  };

  const handleDeleteCreatedClip = (index: number) => {
    setCreatedClips(prev => {
      const newClips = prev.filter((_, i) => i !== index);

      // Early return if clips remain
      if (newClips.length > 0 || !masterClip) {
        return newClips;
      }

      // Revert to master clip when all clips are deleted
      setOriginalClip(masterClip);
      setDuration(masterClip.duration);
      const optimized = optimizeAnimationClip(masterClip, tolerance) as IdentifiableClip;
      setOptimizedClip(optimized);
      handleSeek(0);
      if (!isPlaying) handlePlayPause();

      return newClips;
    });
  };

  // File Drop
  const { isFileDragging, handleDragOver, handleDragLeave, handleDrop } = useFileDrop(handleFileUpload);

  return (
    <div
      className={`h-screen overflow-hidden ${currentTheme.bg} ${currentTheme.text} flex flex-col`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 拖放覆蓋層 */}
      {isFileDragging && (
        <div className="absolute inset-0 bg-blue-500/20 border-4 border-blue-500 border-dashed rounded-lg flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-gray-900/90 p-6 rounded-xl shadow-2xl text-center">
            <p className="text-xl font-bold text-blue-400">釋放滑鼠以上傳檔案</p>
            <p className="text-gray-400">支援 FBX 模型與貼圖檔案</p>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left Toolbar (Photoshop Style) */}
        <div className={`w-16 ${currentTheme.toolbarBg} border-r ${currentTheme.toolbarBorder} flex flex-col items-center py-4 space-y-4 z-20 shadow-lg`}>
          {/* Tool: Select / Move */}
          <div className="group relative">
            <button className={`p-3 rounded-lg transition-colors ${currentTheme.button}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" /><path d="M13 13l6 6" /></svg>
            </button>
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
              選取工具 (V)
            </div>
          </div>

          {/* Tool: Rotate */}
          <div className="group relative">
            <button disabled className={`p-3 rounded-lg opacity-30 cursor-not-allowed ${currentTheme.button}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
            </button>
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
              旋轉工具 (未實作)
            </div>
          </div>

          {/* Tool: Scale */}
          <div className="group relative">
            <button disabled className={`p-3 rounded-lg opacity-30 cursor-not-allowed ${currentTheme.button}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 3l-6 6" /><path d="M21 3v6" /><path d="M21 3h-6" /><path d="M3 21l6-6" /><path d="M3 21v-6" /><path d="M3 21h6" /><path d="M14.5 9.5L9.5 14.5" /></svg>
            </button>
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
              縮放工具 (未實作)
            </div>
          </div>

          {/* Tool: Grid Toggle */}
          <div className="group relative">
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`p-3 rounded-lg transition-colors ${showGrid ? currentTheme.activeButton : currentTheme.button}`}
            >
              <Grid size={20} />
            </button>
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
              {showGrid ? '隱藏網格' : '顯示網格'}
            </div>
          </div>

          <div className="w-8 h-px bg-gray-700 my-2"></div>

          {/* Tool: Theme Toggle */}
          <div className="group relative" ref={themeMenuRef}>
            <button
              className={`p-3 rounded-lg transition-colors ${showThemeMenu ? currentTheme.activeButton : currentTheme.button}`}
              onClick={() => setShowThemeMenu(!showThemeMenu)}
            >
              {(() => {
                const option = themeOptions.find(opt => opt.id === themeMode);
                const Icon = option?.icon || themeOptions[0].icon;
                return <Icon size={20} />;
              })()}
            </button>

            {/* Tooltip (only show when menu is closed) */}
            {!showThemeMenu && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                切換模式
              </div>
            )}

            {/* Theme Selection Menu */}
            {showThemeMenu && (
              <div className={`absolute left-full top-0 ml-4 w-48 ${currentTheme.panelBg} border ${currentTheme.panelBorder} rounded-lg shadow-xl p-2 z-50 flex flex-col gap-1`}>
                {themeOptions.map((option) => {
                  const Icon = option.icon;
                  const isActive = themeMode === option.id;
                  return (
                    <button
                      key={option.id}
                      onClick={() => {
                        setThemeMode(option.id);
                        setShowThemeMenu(false);
                      }}
                      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${isActive
                        ? currentTheme.activeButton
                        : `${currentTheme.text} hover:bg-gray-700/50`
                        }`}
                    >
                      <Icon size={16} />
                      <span className="flex-1 text-left">{option.name}</span>
                      {/* Color Preview Dot */}
                      <div
                        className="w-3 h-3 rounded-full border border-gray-500/30"
                        style={{ backgroundColor: option.color }}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tool: Camera Settings */}
          <div className="group relative" ref={cameraSettingsRef}>
            <button
              className={`p-3 rounded-lg transition-colors ${showCameraSettings
                ? currentTheme.activeButton
                : currentTheme.button
                }`}
              onClick={() => setShowCameraSettings(!showCameraSettings)}
            >
              <Camera size={20} />
            </button>
            <div className={`absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 pointer-events-none whitespace-nowrap z-50 ${!showCameraSettings ? 'group-hover:opacity-100' : ''}`}>
              相機參數
            </div>

            {/* Camera Settings Popover */}
            {showCameraSettings && (
              <div className={`absolute left-full top-0 ml-4 w-64 ${currentTheme.panelBg} border ${currentTheme.panelBorder} rounded-lg shadow-xl p-4 z-50`}>
                <h3 className={`text-sm font-semibold ${currentTheme.text} mb-4 flex items-center gap-2`}>
                  <Camera size={16} className="text-blue-400" />
                  相機參數
                </h3>

                {/* FOV Slider */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs text-gray-400">FOV (視野)</label>
                    <span className="text-xs text-blue-400 font-mono">{cameraSettings.fov}°</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="120"
                    step="1"
                    value={cameraSettings.fov}
                    onChange={(e) =>
                      setCameraSettings({ ...cameraSettings, fov: parseFloat(e.target.value) })
                    }
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* Near Plane Input */}
                <div className="mb-4">
                  <label className="text-xs text-gray-400 block mb-2">Near (近裁剪面)</label>
                  <input
                    type="number"
                    min="0.01"
                    max="10"
                    step="0.01"
                    value={cameraSettings.near}
                    onChange={(e) =>
                      setCameraSettings({ ...cameraSettings, near: parseFloat(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Far Plane Input */}
                <div className="mb-4">
                  <label className="text-xs text-gray-400 block mb-2">Far (遠裁剪面)</label>
                  <input
                    type="number"
                    min="100"
                    max="10000"
                    step="10"
                    value={cameraSettings.far}
                    onChange={(e) =>
                      setCameraSettings({ ...cameraSettings, far: parseFloat(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Reset Button */}
                <button
                  onClick={() => setCameraSettings({ fov: 50, near: 0.1, far: 1000 })}
                  className="w-full py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                >
                  重置預設值
                </button>

                {/* Tone Mapping & Exposure Section */}
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <h4 className="text-xs font-semibold text-gray-400 mb-3">Tone Mapping & 曝光</h4>

                  {/* Camera Presets */}
                  <div className="mb-3">
                    <label className="text-xs text-gray-400 block mb-2">相機預設</label>
                    <div className="grid grid-cols-3 gap-1">
                      {Object.values(CAMERA_PRESETS).map((preset) => (
                        <button
                          key={preset.type}
                          onClick={() => applyPreset(preset.type)}
                          className={`py-1.5 text-xs rounded transition-colors ${selectedPreset === preset.type
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                          title={preset.description}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tone Mapping Exposure */}
                  <div className="mb-3">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs text-gray-400">曝光 (Exposure)</label>
                      <span className="text-xs text-blue-400 font-mono">{toneMappingExposure.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="3.0"
                      step="0.1"
                      value={toneMappingExposure}
                      onChange={(e) => setToneMappingExposure(parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  {/* White Point */}
                  <div className="mb-3">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs text-gray-400">白點 (White Point)</label>
                      <span className="text-xs text-blue-400 font-mono">{whitePoint.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={whitePoint}
                      onChange={(e) => setWhitePoint(parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  {/* HDRI Environment */}
                  <div className="mb-3">
                    <label className="text-xs text-gray-400 block mb-2">HDRI 環境貼圖 (可選)</label>
                    <input
                      type="text"
                      placeholder="輸入 HDRI URL..."
                      value={hdriUrl}
                      onChange={(e) => setHdriUrl(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                    {hdriUrl && (
                      <button
                        onClick={() => setHdriUrl('')}
                        className="mt-1 w-full py-1 text-xs text-red-400 hover:text-red-300 hover:bg-gray-700 rounded transition-colors"
                      >
                        清除 HDRI
                      </button>
                    )}
                  </div>

                  {/* Environment Intensity */}
                  {hdriUrl && (
                    <div className="mb-3">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-xs text-gray-400">環境光強度</label>
                        <span className="text-xs text-blue-400 font-mono">{environmentIntensity.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="3"
                        step="0.1"
                        value={environmentIntensity}
                        onChange={(e) => setEnvironmentIntensity(parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                    </div>
                  )}
                </div>

                {/* Bone Binding Section */}
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <h4 className="text-xs font-semibold text-gray-400 mb-3">骨骼綁定</h4>

                  {/* Bone Search */}
                  <div className="mb-3">
                    <input
                      type="text"
                      placeholder="搜尋骨骼..."
                      value={boneSearchQuery}
                      onChange={(e) => setBoneSearchQuery(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Bone List */}
                  <div className="max-h-40 overflow-y-auto mb-3 bg-gray-900 rounded border border-gray-600">
                    {bones.length === 0 ? (
                      <div className="p-3 text-xs text-gray-500 text-center">
                        {model ? '此模型無骨骼' : '請先載入模型'}
                      </div>
                    ) : (
                      bones
                        .filter((bone) =>
                          bone.name.toLowerCase().includes(boneSearchQuery.toLowerCase())
                        )
                        .map((bone) => (
                          <div
                            key={bone.uuid}
                            onClick={() => setSelectedBoneUuid(bone.uuid)}
                            className={`px-3 py-2 text-xs cursor-pointer transition-colors ${selectedBoneUuid === bone.uuid
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-300 hover:bg-gray-700'
                              }`}
                          >
                            {bone.name || '未命名骨骼'}
                          </div>
                        ))
                    )}
                  </div>

                  {/* Bind/Unbind Controls */}
                  <div className="flex gap-2">
                    {!isCameraBound ? (
                      <button
                        onClick={() => {
                          if (selectedBoneUuid) {
                            setIsCameraBound(true);
                          }
                        }}
                        disabled={!selectedBoneUuid}
                        className={`flex-1 py-2 text-xs rounded transition-colors ${selectedBoneUuid
                          ? 'bg-green-600 hover:bg-green-500 text-white'
                          : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                          }`}
                      >
                        開始綁定
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setIsCameraBound(false);
                          setSelectedBoneUuid(null);
                        }}
                        className="flex-1 py-2 text-xs bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
                      >
                        取消綁定
                      </button>
                    )}
                  </div>

                  {isCameraBound && selectedBoneUuid && (
                    <div className="mt-2 p-2 bg-green-900/30 border border-green-700 rounded">
                      <p className="text-xs text-green-400">
                        ✓ 相機已綁定到: {bones.find((b) => b.uuid === selectedBoneUuid)?.name}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          {/* Tool: Ground Plane Toggle */}
          <div className="group relative" ref={groundSettingsRef}>
            <button
              className={`p-3 rounded-lg transition-colors ${showGroundPlane || showGroundSettings
                ? currentTheme.activeButton
                : currentTheme.button
                }`}
              onClick={() => setShowGroundSettings(!showGroundSettings)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>
            </button>
            <div className={`absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 pointer-events-none whitespace-nowrap z-50 ${!showGroundSettings ? 'group-hover:opacity-100' : ''}`}>
              地面設定
            </div>

            {/* Ground Settings Popover */}
            {showGroundSettings && (
              <div className={`absolute left-full top-0 ml-4 w-64 ${currentTheme.panelBg} border ${currentTheme.panelBorder} rounded-lg shadow-xl p-4 z-50`}>
                <h3 className={`text-sm font-semibold ${currentTheme.text} mb-4 flex items-center gap-2`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>
                  地面設定
                </h3>

                {/* Show Ground Plane Toggle */}
                <div className="mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showGroundPlane}
                      onChange={(e) => setShowGroundPlane(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-800"
                    />
                    <span className="text-sm text-gray-300">顯示地面</span>
                  </label>
                </div>

                {/* Color Picker */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs text-gray-400">顏色</label>
                    <span className="text-xs text-gray-500">{groundPlaneColor}</span>
                  </div>
                  <input
                    type="color"
                    value={groundPlaneColor}
                    onChange={(e) => setGroundPlaneColor(e.target.value)}
                    className="w-full h-8 rounded border border-gray-600 bg-gray-700 cursor-pointer"
                  />
                </div>

                {/* Opacity Slider */}
                <div className="mb-2">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs text-gray-400">透明度</label>
                    <span className="text-xs text-gray-500">{groundPlaneOpacity.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={groundPlaneOpacity}
                    onChange={(e) => setGroundPlaneOpacity(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>

                {/* Shadow Toggle */}
                <div className="mb-2 pt-2 border-t border-gray-700">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableShadows}
                      onChange={(e) => setEnableShadows(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-800"
                    />
                    <span className="text-sm text-gray-300">顯示陰影</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 左側：3D 預覽區 */}
        <div className="flex-1 relative flex flex-col">
          {/* 3D Canvas */}
          <div className="flex-1 relative">
            <SceneToolbar
              onResetCamera={() => {
                console.log('Toolbar reset clicked', sceneViewerRef.current);
                if (sceneViewerRef.current && typeof sceneViewerRef.current.resetCamera === 'function') {
                  sceneViewerRef.current.resetCamera();
                } else {
                  console.error('resetCamera function not found on ref');
                }
              }}
              onTakeScreenshot={() => {
                console.log('Screenshot button clicked', sceneViewerRef.current);
                if (sceneViewerRef.current && typeof sceneViewerRef.current.takeScreenshot === 'function') {
                  sceneViewerRef.current.takeScreenshot();
                } else {
                  console.error('takeScreenshot function not found on ref');
                }
              }}
              onStartRecording={() => {
                console.log('Start recording button clicked', sceneViewerRef.current);
                if (sceneViewerRef.current && typeof sceneViewerRef.current.startRecording === 'function') {
                  sceneViewerRef.current.startRecording();
                  setIsRecording(true);
                } else {
                  console.error('startRecording function not found on ref');
                }
              }}
              onStopRecording={() => {
                console.log('Stop recording button clicked', sceneViewerRef.current);
                if (sceneViewerRef.current && typeof sceneViewerRef.current.stopRecording === 'function') {
                  sceneViewerRef.current.stopRecording();
                  setIsRecording(false);
                } else {
                  console.error('stopRecording function not found on ref');
                }
              }}
              isRecording={isRecording}
              aspectRatio={aspectRatio}
              onAspectRatioChange={setAspectRatio}
              customWidth={customWidth}
              customHeight={customHeight}
              onCustomSizeChange={(width, height) => {
                setCustomWidth(width);
                setCustomHeight(height);
              }}
            />
            <div
              ref={aspectRatioContainerRef}
              className="absolute inset-0 bg-black flex items-center justify-center p-0"
            >
              <div
                style={getAspectRatioStyle()}
                className="relative"
              >
                <SceneViewer
                  ref={sceneViewerRef}
                  // 多模型模式
                  models={models.length > 0 ? models.map(m => ({
                    id: m.id, // 添加 ID 用於識別活動模型
                    model: m.model,
                    clip: m.optimizedClip || m.masterClip || m.originalClip,
                    shaderGroups: m.shaderGroups,
                    isShaderEnabled: m.isShaderEnabled,
                    position: m.position,
                    rotation: m.rotation,
                    scale: m.scale,
                    visible: m.visible,
                    isPlaying: m.isPlaying, // 傳遞播放狀態
                    currentTime: m.currentTime, // 傳遞當前時間
                    isLoopEnabled: m.isLoopEnabled // 傳遞循環設置
                  })) : undefined}
                  activeModelId={models.length > 0 ? activeModelId : undefined}
                  // 單模型模式（向後兼容）
                  model={models.length === 0 ? model : undefined}
                  playingClip={models.length === 0 ? optimizedClip : undefined}
                  onTimeUpdate={handleTimeUpdate}
                  shaderGroups={models.length === 0 ? shaderGroups : undefined}
                  isShaderEnabled={models.length === 0 ? isShaderEnabled : undefined}
                  loop={isPlaylistPlaying ? false : isLoopEnabled}
                  onFinish={handleClipFinish}
                  backgroundColor={currentTheme.sceneBg}
                  cameraSettings={cameraSettings}
                  boundBone={isCameraBound && selectedBoneUuid ? bones.find((b) => b.uuid === selectedBoneUuid) || null : null}
                  isCameraBound={isCameraBound}
                  showGroundPlane={showGroundPlane}
                  groundPlaneColor={groundPlaneColor}
                  groundPlaneOpacity={groundPlaneOpacity}
                  enableShadows={enableShadows}
                  showGrid={showGrid}
                  gridColor={currentTheme.gridColor}
                  gridCellColor={currentTheme.gridCellColor}
                  toneMappingExposure={toneMappingExposure}
                  whitePoint={whitePoint}
                  hdriUrl={hdriUrl || undefined}
                  environmentIntensity={environmentIntensity}
                />
              </div>
            </div>

            {/* 載入中遮罩 */}
            {isLoading && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-50">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-2" />
                <span className="text-blue-400 font-medium">讀取模型中...</span>
              </div>
            )}
          </div>

          {/* 底部：模型檢測與動畫工具 */}
          <div
            className={`${currentTheme.panelBg} border-t ${currentTheme.panelBorder} relative`}
            style={{ height: `${panelHeight}px` }}
          >
            {/* 拖拉調整高度的把手 */}
            <div
              className="absolute top-0 left-0 right-0 h-1 bg-gray-700 hover:bg-blue-500 cursor-ns-resize transition-colors z-10"
              onMouseDown={handleMouseDown}
            >
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-12 h-1 bg-gray-500 rounded-full"></div>
            </div>

            <ModelInspector
              model={model}
              clip={optimizedClip}
              currentTime={currentTime}
              duration={duration}
              isPlaying={isPlaying}
              onPlayPause={handlePlayPause}
              onSeek={handleSeek}
              onCreateClip={handleCreateClip}
              createdClips={createdClips}
              onSelectClip={handleSelectClip}
              onDeleteCreatedClip={handleDeleteCreatedClip}
              playlist={playlist}
              isPlaylistPlaying={isPlaylistPlaying}
              currentPlaylistIndex={currentPlaylistIndex}
              onAddToPlaylist={handleAddToPlaylist}
              onRemoveFromPlaylist={handleRemoveFromPlaylist}
              onReorderPlaylist={handleReorderPlaylist}
              onPlayPlaylist={handlePlayPlaylist}
              onPausePlaylist={handlePausePlaylist}

              isLoopEnabled={isLoopEnabled}
              onToggleLoop={() => {
                const newLoopState = !isLoopEnabled;
                setIsLoopEnabled(newLoopState);
                // 同步更新 activeModel 的循環設置
                if (activeModelId) {
                  updateModel(activeModelId, { isLoopEnabled: newLoopState });
                }
              }}
              audioTracks={audioTracks}
              effects={effects}
            />
          </div>
        </div>

        {/* 右側：控制面板 */}
        <div className={`relative ${currentTheme.panelBg} border-l ${currentTheme.panelBorder} flex flex-col`} style={{ width: `${rightPanelWidth}px` }}>
          {/* 左側調整寬度的把手 */}
          <div
            className="absolute top-0 left-0 bottom-0 w-1 bg-gray-700 hover:bg-blue-500 cursor-ew-resize transition-colors z-10"
            onMouseDown={handleRightPanelMouseDown}
          >
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-12 w-1 bg-gray-500 rounded-full"></div>
          </div>

          {/* 分頁切換 */}
          <div className={`flex border-b ${currentTheme.panelBorder} ${currentTheme.toolbarBg}/30`}>
            <button
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'optimization'
                ? `${currentTheme.panelBg} ${currentTheme.text} border-b-2 border-blue-500`
                : `${currentTheme.button}`
                }`}
              onClick={() => setActiveTab('optimization')}
            >
              模型管理
            </button>
            <button
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'shader'
                ? `${currentTheme.panelBg} ${currentTheme.text} border-b-2 border-purple-500`
                : `${currentTheme.button}`
                }`}
              onClick={() => setActiveTab('shader')}
            >
              Shader
            </button>
            <button
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'audio'
                ? `${currentTheme.panelBg} ${currentTheme.text} border-b-2 border-green-500`
                : `${currentTheme.button}`
                }`}
              onClick={() => setActiveTab('audio')}
            >
              Audio
            </button>
            <button
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'effect'
                ? `${currentTheme.panelBg} ${currentTheme.text} border-b-2 border-orange-500`
                : `${currentTheme.button}`
                }`}
              onClick={() => setActiveTab('effect')}
            >
              Efk
            </button>
          </div>

          {/* 分頁內容 */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'optimization' && (
              <ModelManagerPanel
                models={models}
                activeModelId={activeModelId}
                onSelectModel={(id) => {
                  setActiveModelId(id);
                }}
                onAddModel={handleFileUpload}
                onRemoveModel={(id) => {
                  removeModel(id);
                  // 如果刪除的是活動模型，已經在 hook 中處理了
                }}
                onRenameModel={(id, newName) => {
                  updateModel(id, { name: newName });
                }}
                onUpdateModelTransform={(id, updates) => {
                  updateModel(id, updates);
                }}
                isLoading={isLoading}
                toneMappingExposure={toneMappingExposure}
                environmentIntensity={environmentIntensity}
                hdriUrl={hdriUrl || undefined}
              />
            )}

            {activeTab === 'shader' && (
              <MaterialShaderTool
                fileName={file?.name || null}
                shaderGroups={shaderGroups}
                meshNames={meshNames}
                onGroupsChange={setShaderGroups}
                isShaderEnabled={isShaderEnabled}
                onToggleShaderEnabled={setIsShaderEnabled}
              />
            )}

            {activeTab === 'audio' && (
              <AudioPanel
                audioTracks={audioTracks}
                setAudioTracks={setAudioTracks}
                createdClips={createdClips}
                audioController={audioControllerRef.current}
              />
            )}

            {activeTab === 'effect' && (
              <EffectTestPanel model={model} bones={bones} effects={effects} setEffects={setEffects} createdClips={createdClips} />
            )}
          </div>

          {/* 底部標籤 */}
          <div className="p-4 text-center opacity-30 hover:opacity-100 transition-opacity border-t border-gray-700">
            <p className="text-[10px] text-gray-400">
              Designed for Game Developers
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
