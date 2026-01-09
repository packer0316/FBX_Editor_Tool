import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import html2canvas from 'html2canvas';

// 版本號（由 Vite 在構建時注入）
declare const __APP_VERSION__: string;

import { type IdentifiableClip } from './utils/clip/clipIdentifierUtils';
import SceneViewer, { type SceneViewerRef } from './presentation/features/scene-viewer/components/SceneViewer';
import SceneToolbar, { type AspectRatio } from './presentation/features/scene-viewer/components/SceneToolbar';
import MaterialShaderTool from './presentation/features/shader-panel/components/MaterialShaderTool';
import ModelInspector from './presentation/features/model-inspector/components/ModelInspector';
import AudioPanel from './presentation/features/audio-panel/components/AudioPanel';
import EffectTestPanel, { type EffectItem } from './presentation/features/effect-panel/components/EffectTestPanel';
import ModelManagerPanel from './presentation/features/model-manager/components/ModelManagerPanel';
import { DirectorPanel } from './presentation/features/director';
import { useIsDirectorMode, useDirectorStore } from './presentation/stores/directorStore';
import { useSpineStore } from './presentation/stores/spineStore';
import { useDirectorAudioTrigger } from './presentation/features/director/hooks/useDirectorAudioTrigger';
import { useDirectorEffectTrigger } from './presentation/features/director/hooks/useDirectorEffectTrigger';
import { useDirectorSpineTrigger } from './presentation/features/director/hooks/useDirectorSpineTrigger';
import { useDirectorProceduralTrigger } from './presentation/features/director/hooks/useDirectorProceduralTrigger';
import type { ActionSource } from './domain/entities/director/director.types';
import { getClipId, getClipDisplayName } from './utils/clip/clipIdentifierUtils';
import { AudioController } from './infrastructure/audio/WebAudioAdapter';
import { Loader2, Layers, Box, Wand2, Music, Sparkles } from 'lucide-react';
import type { ShaderGroup } from './domain/value-objects/ShaderFeature';
import type { AudioTrack } from './domain/value-objects/AudioTrack';
import { CAMERA_PRESETS, type CameraPresetType } from './domain/value-objects/CameraPreset';
import { createViewSnapshot, type ViewSnapshot } from './domain/value-objects/ViewSnapshot';
import { createTransformSnapshot, type TransformSnapshot } from './domain/value-objects/TransformSnapshot';
import LeftToolbar from './presentation/features/scene-viewer/components/LeftToolbar';
import type { Layer } from './domain/value-objects/Layer';
import type { Element2D, SpineElement2D } from './domain/value-objects/Element2D';
import type { SpineInstance } from './domain/value-objects/SpineInstance';

// Use Cases
import { LoadModelUseCase } from './application/use-cases/LoadModelUseCase';
import { CreateClipUseCase } from './application/use-cases/CreateClipUseCase';
import { PlaylistUseCase } from './application/use-cases/PlaylistUseCase';
import { AudioSyncUseCase } from './application/use-cases/AudioSyncUseCase';
import { EffectSyncUseCase } from './application/use-cases/EffectSyncUseCase';
import { PlayEffectUseCase } from './application/use-cases/PlayEffectUseCase';
import { getEffekseerRuntimeAdapter } from './application/use-cases/effectRuntimeStore';
import { InitializeLayerStackUseCase } from './application/use-cases/InitializeLayerStackUseCase';
import { CreateLayerUseCase } from './application/use-cases/CreateLayerUseCase';
import { UpdateLayerUseCase } from './application/use-cases/UpdateLayerUseCase';
import { DeleteLayerUseCase } from './application/use-cases/DeleteLayerUseCase';
import { ReorderLayersUseCase } from './application/use-cases/ReorderLayersUseCase';
import { UpdateLayerPriorityUseCase } from './application/use-cases/UpdateLayerPriorityUseCase';
import { AddElement2DUseCase } from './application/use-cases/AddElement2DUseCase';
import { UpdateElement2DUseCase } from './application/use-cases/UpdateElement2DUseCase';
import { RemoveElement2DUseCase } from './application/use-cases/RemoveElement2DUseCase';
import { ReorderElement2DUseCase } from './application/use-cases/ReorderElement2DUseCase';
import { ExportProjectUseCase } from './application/use-cases/ExportProjectUseCase';
import { LoadProjectUseCase } from './application/use-cases/LoadProjectUseCase';
import ProjectIOPanel from './presentation/features/project-io/ProjectIOPanel';
import type { ExportOptions } from './domain/value-objects/ProjectState';

// Hooks
import { useTheme } from './presentation/hooks/useTheme';
import { usePanelResize, useRightPanelResize } from './presentation/hooks/usePanelResize';
import { useFileDrop } from './presentation/hooks/useFileDrop';
import { useClickOutside } from './presentation/hooks/useClickOutside';
import { useBoneExtraction } from './presentation/hooks/useBoneExtraction';
import { useModelsManager } from './presentation/hooks/useModelsManager';
import { useClipOptimizer } from './presentation/hooks/useClipOptimizer';

// Utils
import { sortLayersByPriority } from './utils/layer/layerUtils';
import { disposeModel } from './utils/three/disposeUtils';

// Layer Composer
import { LayerManagerPanel } from './presentation/features/layer-composer/components/LayerManagerPanel';
import { PreviewModeToggle } from './presentation/features/layer-composer/components/PreviewModeToggle';
import { Layer2DRenderer } from './presentation/features/layer-composer/components/Layer2DRenderer';

// Performance Monitor
import { PerformanceMonitor, type RendererInfo } from './presentation/features/performance-monitor';

// Spine Panel
import { SpineInspectorPanel } from './presentation/features/spine-panel';
import { isSpineElement } from './domain/value-objects/Element2D';

// Toast 通知
import { ToastContainer } from './presentation/components/Toast';
import { VersionModal } from './presentation/components/VersionModal';

// 向後兼容：重新導出類型
export type { AudioTrigger } from './domain/value-objects/AudioTrigger';
export type { AudioTrack } from './domain/value-objects/AudioTrack';

const BASE_LAYER_ID = 'layer_3d_base';

function App() {
  // Director Mode
  const isDirectorMode = useIsDirectorMode();

  // 多模型管理
  const {
    models,
    activeModel,
    activeModelId,
    setActiveModelId,
    addModel,
    removeModel,
    updateModel,
    getModel,
  } = useModelsManager();

  // 🔧 Clip 優化 Hook（帶快取，避免重複計算）
  const { optimize: optimizeClip } = useClipOptimizer();

  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [originalClip, setOriginalClip] = useState<IdentifiableClip | null>(null);
  const [masterClip, setMasterClip] = useState<IdentifiableClip | null>(null);
  const [optimizedClip, setOptimizedClip] = useState<IdentifiableClip | null>(null);
  const [tolerance, setTolerance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Project IO 狀態
  const [isProjectIOOpen, setIsProjectIOOpen] = useState(false);
  const [isProjectProcessing, setIsProjectProcessing] = useState(false);
  const [projectProgress, setProjectProgress] = useState(0);
  const [projectProgressMessage, setProjectProgressMessage] = useState('');

  // 動畫控制狀態
  const sceneViewerRef = useRef<SceneViewerRef>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [createdClips, setCreatedClips] = useState<IdentifiableClip[]>([]);
  const [isLoopEnabled, setIsLoopEnabled] = useState(true);
  
  // 進度條即時更新 ref（繞過 React 渲染，實現 60fps 更新）
  const progressTimeRef = useRef<number>(0);

  // 進入 Director Mode 時暫停原本的播放並禁用 LOOP
  const savedLoopStatesRef = useRef<Map<string, boolean>>(new Map());
  
  useEffect(() => {
    if (isDirectorMode) {
      // 進入 Director Mode
      sceneViewerRef.current?.pause();
      setIsPlaying(false);
      
      // 保存並禁用所有模型的 LOOP 設置
      models.forEach(model => {
        savedLoopStatesRef.current.set(model.id, model.isLoopEnabled);
        updateModel(model.id, { isLoopEnabled: false });
      });
      
      return () => {
        // 退出 Director Mode 時恢復 LOOP 設置
        models.forEach(model => {
          const savedLoop = savedLoopStatesRef.current.get(model.id);
          if (savedLoop !== undefined) {
            updateModel(model.id, { isLoopEnabled: savedLoop });
          }
        });
        savedLoopStatesRef.current.clear();
      };
    }
  }, [isDirectorMode]); // 只依賴 isDirectorMode，避免頻繁執行

  // 鍵盤相機控制狀態
  const [keyboardControlsEnabled, setKeyboardControlsEnabled] = useState(true);
  const [cameraMoveSpeed, setCameraMoveSpeed] = useState(5.0);

  // Panel Resize
  const { panelHeight, handleMouseDown } = usePanelResize(384);
  const { panelHeight: directorPanelHeight, handleMouseDown: handleDirectorMouseDown } = usePanelResize(400, 250, window.innerHeight - 150);
  const { rightPanelWidth, handleRightPanelMouseDown } = useRightPanelResize(
    320,
    280,
    typeof window !== 'undefined' ? Math.min(600, window.innerWidth - 64) : 600
  );

  // 右側面板分頁
  const [activeTab, setActiveTab] = useState<'layer' | 'optimization' | 'shader' | 'audio' | 'effect'>('layer');
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [effects, setEffects] = useState<EffectItem[]>([]);

  // Theme
  const { themeMode, setThemeMode, currentTheme } = useTheme('dark');

  // Shader 功能狀態
  const [shaderGroups, setShaderGroups] = useState<ShaderGroup[]>([]);
  const [meshNames, setMeshNames] = useState<string[]>([]);
  const [isShaderEnabled, setIsShaderEnabled] = useState(true);

  // Camera Settings
  type SidebarPanel = 'none' | 'theme' | 'camera' | 'ground';
  const [activeSidebarPanel, setActiveSidebarPanel] = useState<SidebarPanel>('none');
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);

  const cameraSettingsRef = useRef<HTMLDivElement>(null);
  const groundSettingsRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  const toggleSidebarPanel = (panel: SidebarPanel) => {
    setActiveSidebarPanel(prev => prev === panel ? 'none' : panel);
  };

  const audioControllerRef = useRef<InstanceType<typeof AudioController>>(new AudioController());
  const lastAudioTimeRef = useRef<number>(0);
  const lastEffectTimeRef = useRef<number>(0);
  const lastAudioFrameRef = useRef<number>(-1);
  const lastEffectFrameRef = useRef<number>(-1);

  // Director Mode: 音效觸發
  useDirectorAudioTrigger({
    enabled: isDirectorMode,
    models: models.map(m => ({
      id: m.id,
      audioTracks: m.audioTracks,
    })),
    audioController: audioControllerRef.current,
  });

  // Director Mode: 特效觸發
  useDirectorEffectTrigger({
    enabled: isDirectorMode,
    models: models.map(m => ({
      id: m.id,
      model: m.model,
      bones: m.bones,
      effects: m.effects,
    })),
  });

  const [cameraSettings, setCameraSettings] = useState({
    fov: 50,
    near: 0.1,
    far: 1000
  });

  // 相機類型：透視 vs 正交
  const [isOrthographic, setIsOrthographic] = useState(false);
  const [orthoZoom, setOrthoZoom] = useState(50); // 正交相機縮放（1-100）

  // Bone Binding State
  const bones = useBoneExtraction(model);
  const [boneSearchQuery, setBoneSearchQuery] = useState('');
  const [selectedBoneUuid, setSelectedBoneUuid] = useState<string | null>(null);
  const [isCameraBound, setIsCameraBound] = useState(false);
  const [showGroundPlane, setShowGroundPlane] = useState(false);
  const [groundPlaneColor, setGroundPlaneColor] = useState('#444444');
  const [groundPlaneOpacity, setGroundPlaneOpacity] = useState(1.0);
  const [enableShadows, setEnableShadows] = useState(false);
  const [customSceneBgColor, setCustomSceneBgColor] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);

  // Performance Monitor
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(false);
  const [rendererInfo, setRendererInfo] = useState<RendererInfo | null>(null);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);

  // UI 顯示/隱藏狀態
  const [isUIHidden, setIsUIHidden] = useState(false);

  // Performance Monitor: 定期獲取 renderer info
  useEffect(() => {
    if (!showPerformanceMonitor) {
      setRendererInfo(null);
      return;
    }

    const updateRendererInfo = () => {
      if (sceneViewerRef.current) {
        const info = sceneViewerRef.current.getRendererInfo();
        setRendererInfo(info);
      }
    };

    // 每 100ms 更新一次（比 requestAnimationFrame 更輕量）
    const intervalId = setInterval(updateRendererInfo, 100);

    return () => clearInterval(intervalId);
  }, [showPerformanceMonitor]);

  // Layer Composer state
  const [layers, setLayers] = useState<Layer[]>(() => InitializeLayerStackUseCase.execute());
  const [activeLayerId, setActiveLayerId] = useState<string>(BASE_LAYER_ID);
  const [activeElementId, setActiveElementId] = useState<string | null>(null);
  const [is2DFrontEnabled, setIs2DFrontEnabled] = useState(true);
  const [is2DBackEnabled, setIs2DBackEnabled] = useState(true);
  const [is3DEnabled, setIs3DEnabled] = useState(true);

  // Spine 實例管理（使用 Zustand Store）
  const spineInstances = useSpineStore((state) => state.instances);
  const addSpineInstance = useSpineStore((state) => state.addInstance);
  const removeSpineInstance = useSpineStore((state) => state.removeInstance);
  const cleanupAllSpineInstances = useSpineStore((state) => state.cleanupAll);

  // Spine 資源清理（應用關閉時）
  useEffect(() => {
    return () => {
      console.log('[App] 清理所有 Spine 資源...');
      cleanupAllSpineInstances();
    };
  }, [cleanupAllSpineInstances]);

  // Director Mode: Spine 動畫觸發
  useDirectorSpineTrigger({
    enabled: isDirectorMode,
    layers,
    onUpdateSpineElement: (layerId, elementId, updates) => {
      setLayers(prev => prev.map(layer => {
        if (layer.id !== layerId) return layer;
        return {
          ...layer,
          children: layer.children.map(el => 
            el.id === elementId ? { ...el, ...updates } as typeof el : el
          ),
        };
      }));
    },
  });

  // Director Mode: 程式化動畫觸發（Show/Hide/FadeIn/FadeOut）
  useDirectorProceduralTrigger({
    enabled: isDirectorMode,
    models,
    onUpdateModel: updateModel,
  });

  // Director Mode: 收集所有模型和 Spine 的動作來源
  const MODEL_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];
  const SPINE_COLORS = ['#9333EA', '#A855F7', '#C084FC', '#D8B4FE', '#7C3AED', '#8B5CF6'];
  
  const actionSources = useMemo<ActionSource[]>(() => {
    // 3D 模型動作來源
    const modelSources: ActionSource[] = models.map((m, index) => {
      // 收集所有 clips 並去重（避免 originalClip 和 masterClip 重複）
      const allClips = [
        m.originalClip,
        m.masterClip,
        ...(m.createdClips || []),
      ].filter((c): c is IdentifiableClip => c != null);

      // 用 clipId 去重
      const seenIds = new Set<string>();
      const uniqueClips = allClips.filter(c => {
        const id = getClipId(c);
        if (seenIds.has(id)) return false;
        seenIds.add(id);
        return true;
      });

      return {
        sourceType: '3d-model' as const,
        modelId: m.id,
        modelName: m.name || `Model ${index + 1}`,
        modelColor: MODEL_COLORS[index % MODEL_COLORS.length],
        clips: uniqueClips.map(c => ({
          clipId: getClipId(c),
          displayName: getClipDisplayName(c),
          durationFrames: Math.round(c.duration * 30),
          durationSeconds: c.duration,
        })),
      };
    });

    // Spine 動作來源
    const spineSources: ActionSource[] = [];
    let spineIndex = 0;
    
    layers.forEach(layer => {
      layer.children.forEach(element => {
        if (isSpineElement(element)) {
          const spineInstance = spineInstances.get(element.spineInstanceId);
          if (spineInstance) {
            spineSources.push({
              sourceType: 'spine' as const,
              modelId: element.spineInstanceId,
              modelName: spineInstance.name || element.name,
              modelColor: SPINE_COLORS[spineIndex % SPINE_COLORS.length],
              clips: spineInstance.skeletonInfo.animations.map(anim => ({
                clipId: anim.name,
                displayName: anim.name,
                durationFrames: anim.frameCount,
                durationSeconds: anim.duration,
              })),
              spineInfo: {
                layerId: layer.id,
                elementId: element.id,
                instanceId: element.spineInstanceId,
              },
            });
            spineIndex++;
          }
        }
      });
    });

    return [...modelSources, ...spineSources];
  }, [models, layers, spineInstances]);

  // Aspect Ratio state
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('free');
  const [customWidth, setCustomWidth] = useState(1920);
  const [customHeight, setCustomHeight] = useState(1080);
  const aspectRatioContainerRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Tone Mapping & Exposure Settings
  // 預設曝光調整為 1.2（提高亮度以匹配 Cocos Creator）
  const [toneMappingExposure, setToneMappingExposure] = useState(1.2);
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

  // 根據比例計算精確的截圖尺寸
  const screenshotSize = useMemo(() => {
    // 預設比例對應的精確像素尺寸
    const presetSizes: Record<string, { width: number; height: number }> = {
      '2.5:1': { width: 1600, height: 640 },
      '16:9': { width: 1920, height: 1080 },
      '16:10': { width: 1728, height: 1080 },
      '21:9': { width: 2560, height: 1080 },
      '32:9': { width: 3840, height: 1080 },
    };

    if (aspectRatio === 'free') {
      // 自由比例：不指定尺寸，使用當前 canvas 尺寸
      return { width: undefined, height: undefined };
    }

    if (aspectRatio === 'custom') {
      // 自訂尺寸：使用用戶指定的精確尺寸
      return { width: customWidth, height: customHeight };
    }

    // 預設比例：使用對應的精確像素尺寸
    const preset = presetSizes[aspectRatio];
    if (preset) {
      return { width: preset.width, height: preset.height };
    }

    // 未知比例：使用當前 canvas 尺寸
    return { width: undefined, height: undefined };
  }, [aspectRatio, customWidth, customHeight]);

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

  useEffect(() => {
    const nextName = activeModel?.name ? `${activeModel.name} | 3D Scene` : '3D Scene';
    setLayers(prev => {
      const layer = prev.find(item => item.id === BASE_LAYER_ID);
      if (!layer || layer.name === nextName) {
        return prev;
      }
      return UpdateLayerUseCase.execute(prev, {
        layerId: BASE_LAYER_ID,
        updates: { name: nextName }
      });
    });
  }, [activeModel?.name]);

  // Click outside to close popovers
  useClickOutside(
    [cameraSettingsRef, groundSettingsRef, themeMenuRef] as React.RefObject<HTMLElement>[],
    () => {
      setActiveSidebarPanel('none');
    },
    activeSidebarPanel !== 'none'
  );

  // 處理檔案上傳（多模型版本，支援 .jr3d 專案檔案）
  const handleFileUpload = async (files: FileList) => {
    // 檢查是否有 .jr3d 專案檔案
    const jr3dFile = Array.from(files).find(file => file.name.toLowerCase().endsWith('.jr3d'));
    if (jr3dFile) {
      // 如果是專案檔案，調用載入專案邏輯
      await handleLoadProject(jr3dFile);
      return;
    }

    setIsLoading(true);
    try {
      const { instance, iniResult } = await LoadModelUseCase.executeAndCreateInstance(files);

      // 優化動畫（如果有）
      if (instance.originalClip) {
        const optimized = optimizeClip(instance.originalClip, instance.tolerance);
        instance.optimizedClip = optimized ?? undefined;
        instance.duration = instance.originalClip.duration;
      }

      // 自動啟用 Shader 並添加 Normal Map 功能（預設不上傳貼圖，不影響渲染）
      instance.isShaderEnabled = true;
      instance.shaderGroups = [
        {
          id: `default_${Date.now()}`,
          name: '預設組合',
          features: [
            {
              id: `normal_map_feature_${Date.now()}`,
              type: 'normal_map',
              name: 'Normal Map',
              description: '法線貼圖 - 增加表面細節',
              icon: '🗺️',
              expanded: false,
              enabled: true,
              params: {
                texture: null,
                strength: 1.0,
                nonColor: true,   // Non-Color 模式（與 Blender 相同）
                useUV2: false,    // 使用第二層 UV
              },
            },
          ],
          selectedMeshes: instance.meshNames, // 應用到所有 mesh
          expanded: true,
          enabled: true,
        },
      ];

      // 如果有 INI 檔案，自動創建動畫片段
      if (iniResult && iniResult.clips.length > 0 && instance.originalClip) {
        const sourceClip = instance.originalClip;
        const fps = iniResult.fps || 30;
        const createdClipsFromIni: IdentifiableClip[] = [];
        
        for (const clipInfo of iniResult.clips) {
          if (!clipInfo.enabled) continue;
          
          try {
            const newClip = CreateClipUseCase.execute(
              sourceClip,
              clipInfo.name,
              clipInfo.startFrame,
              clipInfo.endFrame,
              fps,
              createdClipsFromIni // 傳入已創建的片段避免名稱衝突
            );
            createdClipsFromIni.push(newClip);
          } catch (error) {
            console.warn(`[App] 創建片段 "${clipInfo.name}" 失敗:`, error);
          }
        }
        
        if (createdClipsFromIni.length > 0) {
          instance.createdClips = createdClipsFromIni;
          console.log(`✅ 從 INI 自動創建 ${createdClipsFromIni.length} 個動畫片段`);
        }
      }

      // 添加到模型列表
      addModel(instance);

      // 設為活動模型
      setActiveModelId(instance.id);
      
      // 互斥邏輯：選中 3D 模型時，取消 2D 元素選中
      setActiveElementId(null);

      console.log('✅ 模型載入成功:', instance.name);
    } catch (error) {
      console.error('Error loading FBX:', error);
      alert('讀取 FBX 檔案失敗，請確認檔案格式是否正確。');
    } finally {
      setIsLoading(false);
    }
  };

  // Project IO: 匯出專案
  const handleExportProject = useCallback(async (exportOptions: ExportOptions, projectName: string): Promise<boolean> => {
    setIsProjectProcessing(true);
    setProjectProgress(0);
    setProjectProgressMessage('正在準備匯出...');

    try {
      const directorStore = useDirectorStore.getState();
      
      const result = await ExportProjectUseCase.exportAndDownload({
        projectName,
        exportOptions,
        models,
        directorTracks: directorStore.tracks,
        directorTimeline: {
          totalFrames: directorStore.timeline.totalFrames,
          fps: directorStore.timeline.fps,
          loopRegion: directorStore.timeline.loopRegion,
        },
        globalSettings: {
          cameraFov: cameraSettings.fov,
          cameraNear: cameraSettings.near,
          cameraFar: cameraSettings.far,
          showGrid,
        },
        // 2D 圖層和 Spine 實例
        layers,
        spineInstances,
      });

      if (result) {
        setProjectProgress(100);
        setProjectProgressMessage('匯出完成！');
      }
      
      return result;
    } catch (error) {
      console.error('匯出專案失敗:', error);
      alert(`匯出失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
      return false;
    } finally {
      setIsProjectProcessing(false);
    }
  }, [models, cameraSettings, showGrid, layers, spineInstances]);

  // Project IO: 載入專案
  const handleLoadProject = useCallback(async (file: File): Promise<boolean> => {
    setIsProjectProcessing(true);
    setProjectProgress(0);
    setProjectProgressMessage('正在載入專案...');

    try {
      const directorStore = useDirectorStore.getState();

      const result = await LoadProjectUseCase.execute(
        file,
        {
          addModel,
          updateModel,
          getModel,
          clearModels: () => {
            // 清空現有模型
            models.forEach(m => removeModel(m.id));
          },
          onProgress: (progress, message) => {
            setProjectProgress(progress);
            setProjectProgressMessage(message);
          },
          // 2D 圖層回調
          setLayers,
          // Spine 實例回調
          addSpineInstance,
          clearSpineInstances: cleanupAllSpineInstances,
        },
        {
          reset: directorStore.reset,
          setFps: directorStore.setFps,
          setTotalFrames: directorStore.setTotalFrames,
          setInPoint: directorStore.setInPoint,
          setOutPoint: directorStore.setOutPoint,
          toggleLoopRegion: directorStore.toggleLoopRegion,
          addTrack: directorStore.addTrack,
          updateTrack: directorStore.updateTrack,
          addClip: directorStore.addClip as any,
          updateClip: directorStore.updateClip,
        }
      );

      if (result.success) {
        setProjectProgress(100);
        setProjectProgressMessage('載入完成！');
        
        // 設定第一個模型為活動模型
        // 使用 setTimeout 確保所有 updateModel 的狀態更新都已完成
        // 這樣同步 useEffect 執行時，activeModel 會包含最新的 shaderGroups 和 createdClips
        if (result.modelIdMap && result.modelIdMap.size > 0) {
          const firstNewModelId = result.modelIdMap.values().next().value;
          if (firstNewModelId) {
            // 先重置 activeModelId，強制同步 ref 也重置
            setActiveModelId(null);
            // 使用 requestAnimationFrame + setTimeout 確保 React 完成所有狀態更新
            requestAnimationFrame(() => {
              setTimeout(() => {
                setActiveModelId(firstNewModelId);
              }, 0);
            });
          }
        }
      } else {
        alert(`載入失敗: ${result.error}`);
        return false;
      }

      return result.success;
    } catch (error) {
      console.error('載入專案失敗:', error);
      alert(`載入失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
      return false;
    } finally {
      setIsProjectProcessing(false);
    }
  }, [models, addModel, updateModel, getModel, removeModel, setActiveModelId, setLayers, addSpineInstance, cleanupAllSpineInstances]);

  // 追蹤是否正在同步，避免循環更新
  const isSyncingRef = useRef(false);

  // 追蹤上一次的 activeModelId，用於判斷是否真正切換了模型
  const prevActiveModelIdForSyncRef = useRef<string | null>(null);
  
  // 同步活動模型狀態到舊狀態（只在切換模型時觸發，不在 activeModel 內容變化時觸發）
  useEffect(() => {
    // 只在 activeModelId 真正改變時才同步（切換模型或取消選中）
    if (prevActiveModelIdForSyncRef.current === activeModelId) {
      return; // activeModelId 沒變，跳過
    }
    
    prevActiveModelIdForSyncRef.current = activeModelId;
    
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
      setCreatedClips(activeModel.createdClips || []);
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
      // 沒有活動模型時重置（包括取消選中模型）
      isSyncingRef.current = true;
      setFile(null);
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
      setCurrentTime(0);
      sceneViewerRef.current?.pause();
      setTimeout(() => {
        isSyncingRef.current = false;
      }, 0);
    }
  }, [activeModelId, activeModel]); // 依賴保留 activeModel 以獲取最新值，但用 ref 防止重複同步
  
  // 當取消選中模型時，同步暫停狀態到模型實例
  const prevActiveModelIdRef = useRef<string | null>(null);
  useEffect(() => {
    // 如果之前有選中的模型，現在取消選中了
    if (prevActiveModelIdRef.current && !activeModelId) {
      // 更新之前選中模型的 isPlaying 狀態為 false
      updateModel(prevActiveModelIdRef.current, { isPlaying: false });
    }
    prevActiveModelIdRef.current = activeModelId;
  }, [activeModelId, updateModel]);

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
      const updates: Partial<typeof currentState> = {};
      let hasChanged = false;

      // 只更新實際改變的屬性，而不是整個對象
      if (prevStateRef.current.shaderGroups !== currentState.shaderGroups) {
        updates.shaderGroups = currentState.shaderGroups;
        hasChanged = true;
      }
      if (prevStateRef.current.isShaderEnabled !== currentState.isShaderEnabled) {
        updates.isShaderEnabled = currentState.isShaderEnabled;
        hasChanged = true;
      }
      if (prevStateRef.current.originalClip !== currentState.originalClip) {
        updates.originalClip = currentState.originalClip;
        hasChanged = true;
      }
      if (prevStateRef.current.masterClip !== currentState.masterClip) {
        updates.masterClip = currentState.masterClip;
        hasChanged = true;
      }
      if (prevStateRef.current.optimizedClip !== currentState.optimizedClip) {
        updates.optimizedClip = currentState.optimizedClip;
        hasChanged = true;
      }
      if (prevStateRef.current.createdClips !== currentState.createdClips) {
        updates.createdClips = currentState.createdClips;
        hasChanged = true;
      }
      if (prevStateRef.current.tolerance !== currentState.tolerance) {
        updates.tolerance = currentState.tolerance;
        hasChanged = true;
      }
      if (prevStateRef.current.audioTracks !== currentState.audioTracks) {
        updates.audioTracks = currentState.audioTracks;
        hasChanged = true;
      }
      if (prevStateRef.current.effects !== currentState.effects) {
        updates.effects = currentState.effects;
        hasChanged = true;
      }
      if (prevStateRef.current.isPlaying !== currentState.isPlaying) {
        updates.isPlaying = currentState.isPlaying;
        hasChanged = true;
      }
      if (prevStateRef.current.currentTime !== currentState.currentTime) {
        updates.currentTime = currentState.currentTime;
        hasChanged = true;
      }
      if (prevStateRef.current.duration !== currentState.duration) {
        updates.duration = currentState.duration;
        hasChanged = true;
      }
      if (prevStateRef.current.isLoopEnabled !== currentState.isLoopEnabled) {
        updates.isLoopEnabled = currentState.isLoopEnabled;
        hasChanged = true;
      }

      if (hasChanged) {
        updateModel(activeModelId, updates);
        prevStateRef.current = currentState;
      }
    } else {
      // 第一次設置 - 只更新需要同步的屬性，不覆蓋其他屬性（如 showTransformGizmo, position 等）
      updateModel(activeModelId, currentState);
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

  // 🔧 當 tolerance 改變時重新優化（使用帶快取的 Hook）
  useEffect(() => {
    if (originalClip) {
      // 使用 debounce 避免頻繁計算
      const timer = setTimeout(() => {
        const optimized = optimizeClip(originalClip, tolerance);
        if (optimized) {
          setOptimizedClip(optimized);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [tolerance, originalClip, optimizeClip]);



  // 動畫控制處理
  const handlePlayPause = () => {
    // 沒有模型時不執行任何操作
    if (!model || !optimizedClip) {
      return;
    }

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
    // 沒有模型時不執行任何操作
    if (!model || !optimizedClip) {
      return;
    }

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
    const now = performance.now();
    
    // 🔥 進度條：每幀都更新（透過 ref，不觸發 React 渲染）
    progressTimeRef.current = time;
    
    // 🐢 其他 UI 狀態：節流更新（約 10fps，減少主線程負擔）
    if (now - lastUIUpdateRef.current > 300) {
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
    // 🔥 使用帶快取的 optimizeClip，避免同一次點擊造成「先算一次、50ms 後又算一次」而觸發重複切換
    const optimized = optimizeClip(clip, tolerance);
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
      const optimized = optimizeClip(masterClip, tolerance);
      setOptimizedClip(optimized);
      handleSeek(0);
      if (!isPlaying) handlePlayPause();

      return newClips;
    });
  };

  const visibleFrontLayers = useMemo(
    () => sortLayersByPriority(layers.filter(layer => layer.type === '2d' && layer.priority > 0 && layer.visible)),
    [layers]
  );

  const visibleBackLayers = useMemo(
    () => sortLayersByPriority(layers.filter(layer => layer.type === '2d' && layer.priority < 0 && layer.visible)),
    [layers]
  );

  const hasBackContent = useMemo(
    () => visibleBackLayers.some(layer => layer.children.some(element => element.visible)),
    [visibleBackLayers]
  );

  const viewerBackgroundColor = is2DBackEnabled && hasBackContent 
    ? 'transparent' 
    : (customSceneBgColor ?? currentTheme.sceneBg);
  const isPointerEditing = activeTab === 'layer';

  // 切換分頁時，如果離開 layer 分頁，取消選定的 2D 元素
  const handleTabChange = useCallback((tab: typeof activeTab) => {
    setActiveTab(tab);
    if (tab !== 'layer') {
      setActiveElementId(null);
    }
  }, []);

  const handleSelectLayer = useCallback((layerId: string) => {
    setActiveLayerId(layerId);
    setActiveElementId(null);
  }, []);

  const handleCreateLayer = useCallback((direction: 'front' | 'back') => {
    let createdLayerId: string | null = null;
    setLayers(prev => {
      const next = CreateLayerUseCase.execute(prev, { type: '2d', direction });
      const newLayer = next.find(layer => !prev.some(item => item.id === layer.id));
      if (newLayer) {
        createdLayerId = newLayer.id;
      }
      return next;
    });
    if (createdLayerId) {
      setActiveLayerId(createdLayerId);
      setActiveElementId(null);
    }
  }, []);

  const handleDeleteLayer = useCallback((layerId: string) => {
    if (layerId === BASE_LAYER_ID) return;
    setLayers(prev => {
      const next = DeleteLayerUseCase.execute(prev, layerId);
      if (activeLayerId === layerId) {
        setActiveLayerId(BASE_LAYER_ID);
        setActiveElementId(null);
      }
      return next;
    });
  }, [activeLayerId]);

  const toggleLayerProperty = useCallback((layerId: string, key: keyof Layer) => {
    setLayers(prev => {
      const target = prev.find(layer => layer.id === layerId);
      if (!target) return prev;

      const updates: Partial<Layer> = {};
      if (key === 'visible') {
        updates.visible = !target.visible;
      } else if (key === 'locked') {
        updates.locked = !target.locked;
      } else if (key === 'expanded') {
        updates.expanded = !target.expanded;
      }

      return UpdateLayerUseCase.execute(prev, { layerId, updates });
    });
  }, []);

  const handleRenameLayer = useCallback((layerId: string, name: string) => {
    setLayers(prev => UpdateLayerUseCase.execute(prev, { layerId, updates: { name } }));
  }, []);

  const handleToggleLayerVisibility = useCallback((layerId: string) => {
    toggleLayerProperty(layerId, 'visible');
  }, [toggleLayerProperty]);

  const handleToggleLayerLock = useCallback((layerId: string) => {
    toggleLayerProperty(layerId, 'locked');
  }, [toggleLayerProperty]);

  const handleToggleLayerExpand = useCallback((layerId: string) => {
    toggleLayerProperty(layerId, 'expanded');
  }, [toggleLayerProperty]);

  const handleUpdateLayerPriority = useCallback((layerId: string, priority: number) => {
    setLayers(prev => UpdateLayerPriorityUseCase.execute(prev, { layerId, priority }));
  }, []);

  const handleUpdateLayerOpacity = useCallback((layerId: string, opacity: number) => {
    setLayers(prev => UpdateLayerUseCase.execute(prev, { layerId, updates: { opacity } }));
  }, []);

  const handleReorderLayer = useCallback((direction: 'front' | 'back', fromIndex: number, toIndex: number) => {
    setLayers(prev => ReorderLayersUseCase.execute(prev, { direction, fromIndex, toIndex }));
  }, []);

  const handleAddTextElement = useCallback((layerId: string) => {
    let newElementId: string | null = null;
    setLayers(prev => {
      const target = prev.find(layer => layer.id === layerId && layer.type === '2d');
      if (!target) return prev;
      const next = AddElement2DUseCase.execute(prev, { layerId, mode: { kind: 'text' } });
      const layerAfter = next.find(layer => layer.id === layerId);
      const latestElement = layerAfter?.children[layerAfter.children.length - 1];
      if (latestElement) {
        newElementId = latestElement.id;
      }
      return next;
    });
    if (newElementId) {
      setActiveLayerId(layerId);
      setActiveElementId(newElementId);
      // 互斥邏輯：選中 2D 元素時，取消 3D 模型選中
      setActiveModelId(null);
    }
  }, [setActiveModelId]);

  const handleAddImageElement = useCallback((layerId: string, dataUrl: string) => {
    let newElementId: string | null = null;
    setLayers(prev => {
      const target = prev.find(layer => layer.id === layerId && layer.type === '2d');
      if (!target) return prev;
      const next = AddElement2DUseCase.execute(prev, { layerId, mode: { kind: 'image', dataUrl } });
      const layerAfter = next.find(layer => layer.id === layerId);
      const latestElement = layerAfter?.children[layerAfter.children.length - 1];
      if (latestElement) {
        newElementId = latestElement.id;
      }
      return next;
    });
    if (newElementId) {
      setActiveLayerId(layerId);
      setActiveElementId(newElementId);
      // 互斥邏輯：選中 2D 元素時，取消 3D 模型選中
      setActiveModelId(null);
    }
  }, [setActiveModelId]);

  const handleSelectElement = useCallback((layerId: string, elementId: string) => {
    setActiveLayerId(layerId);
    // 空字串表示取消選取
    const newElementId = elementId || null;
    setActiveElementId(newElementId);
    
    // 互斥邏輯：選中 2D 元素時，取消 3D 模型選中
    if (newElementId) {
      setActiveModelId(null);
    }
  }, [setActiveModelId]);

  const handleReorderElement = useCallback((layerId: string, fromIndex: number, toIndex: number) => {
    setLayers(prev => ReorderElement2DUseCase.execute(prev, { layerId, fromIndex, toIndex }));
  }, []);

  /** 新增 Spine 元素到 2D Layer */
  const handleAddSpineElement = useCallback((layerId: string, spineInstance: SpineInstance) => {
    // 儲存 Spine 實例到 Store
    addSpineInstance(spineInstance);

    let newElementId: string | null = null;
    setLayers(prev => {
      const target = prev.find(layer => layer.id === layerId && layer.type === '2d');
      if (!target) return prev;
      
      // 建立 Spine 元素
      const now = Date.now();
      const spineElement: SpineElement2D = {
        id: `spine_element_${now}_${Math.random().toString(36).substr(2, 9)}`,
        name: spineInstance.name,
        type: 'spine',
        visible: true,
        locked: false,
        opacity: 1,
        zIndex: target.children.length,
        position: { x: 50, y: 50, unit: 'percent' },
        size: { 
          width: 1920, 
          height: 1080, 
          unit: 'px' 
        },
        rotation: 0,
        createdAt: now,
        updatedAt: now,
        // Spine 特有屬性
        spineInstanceId: spineInstance.id,
        currentAnimation: spineInstance.currentAnimation,
        loop: true,
        timeScale: 1.0,
        currentSkin: spineInstance.currentSkin,
        scale: 1.0,
        fitMode: 'none',
        flipX: false,
        flipY: false,
        isPlaying: false,
        currentTime: 0,
      };
      
      newElementId = spineElement.id;
      
      return prev.map(layer => {
        if (layer.id === layerId) {
          return {
            ...layer,
            children: [...layer.children, spineElement],
            updatedAt: now,
          };
        }
        return layer;
      });
    });
    
    if (newElementId) {
      setActiveLayerId(layerId);
      setActiveElementId(newElementId);
      // 互斥邏輯：選中 2D 元素時，取消 3D 模型選中
      setActiveModelId(null);
    }
    
    console.log(`[App] 新增 Spine 元素: ${spineInstance.name}, 尺寸: ${Math.min(viewerSize.width, viewerSize.height)}px`);
  }, [addSpineInstance, setActiveModelId, viewerSize.width, viewerSize.height]);

  /** 透過 layerId 和 elementId 更新元素（供 LayerManagerPanel 內嵌編輯使用） */
  const handleUpdateElementById = useCallback((layerId: string, elementId: string, updates: Partial<Element2D>) => {
    setLayers(prev => {
      const layer = prev.find(l => l.id === layerId);
      const element = layer?.children.find(e => e.id === elementId);
      if (!layer || !element) return prev;
      
      // 允許鎖定/解鎖操作，但鎖定時阻止其他更新
      const isLockToggle = 'locked' in updates;
      if (element.locked && !isLockToggle) return prev;
      
      return UpdateElement2DUseCase.execute(prev, { layerId, elementId, updates });
    });
  }, []);

  /** 透過 layerId 和 elementId 移除元素（供 LayerManagerPanel 內嵌編輯使用） */
  const handleRemoveElementById = useCallback((layerId: string, elementId: string) => {
    // 先找到要移除的元素（用於清理 Spine）
    const layer = layers.find(l => l.id === layerId);
    const element = layer?.children.find(e => e.id === elementId);
    
    if (!layer || !element || element.locked) return;
    
    // 如果是 Spine 元素，清理 Spine 實例和 Director clips
    if (isSpineElement(element) && element.spineInstanceId) {
      removeSpineInstance(element.spineInstanceId);
      // 清理 Director Mode 中該 Spine 的所有 Clips
      useDirectorStore.getState().removeClipsByModelId(element.spineInstanceId);
    }
    
    // 移除元素
    setLayers(prev => RemoveElement2DUseCase.execute(prev, { layerId, elementId }));
    
    // 如果移除的是當前選中的元素，清除選擇
    if (activeElementId === elementId) {
      setActiveElementId(null);
    }
  }, [layers, activeElementId, removeSpineInstance]);

  const handleToggle2DFront = useCallback(() => setIs2DFrontEnabled(prev => !prev), []);
  const handleToggle2DBack = useCallback(() => setIs2DBackEnabled(prev => !prev), []);
  const handleToggle3D = useCallback(() => setIs3DEnabled(prev => !prev), []);

  // File Drop
  const { isFileDragging, handleDragOver, handleDragLeave, handleDrop } = useFileDrop(handleFileUpload);

  return (
    <div
      className={`h-screen overflow-hidden ${currentTheme.bg} ${currentTheme.text} flex flex-col`}
    >
      {/* 專案載入進度遮罩層（全域，阻擋所有互動） */}
      {isProjectProcessing && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[999999] flex items-center justify-center">
          <div className="bg-gray-900/95 border border-white/10 rounded-2xl p-8 w-[400px] shadow-2xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white text-lg font-bold">載入專案中</h3>
                <p className="text-gray-400 text-sm">{projectProgressMessage || '請稍候...'}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">進度</span>
                <span className="text-white font-mono">{Math.round(projectProgress)}%</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-300 ease-out"
                  style={{ width: `${projectProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FBX 拖放覆蓋層已移至預覽區內 */}

      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Toolbar (Floating Glass) - 可隱藏 */}
        {!isUIHidden && <LeftToolbar
          currentTheme={currentTheme}
          showGrid={showGrid}
          setShowGrid={setShowGrid}
          themeMode={themeMode}
          setThemeMode={setThemeMode}
          activeSidebarPanel={activeSidebarPanel}
          toggleSidebarPanel={toggleSidebarPanel}
          cameraSettings={cameraSettings}
          setCameraSettings={setCameraSettings}
          applyPreset={applyPreset}
          selectedPreset={selectedPreset}
          toneMappingExposure={toneMappingExposure}
          setToneMappingExposure={setToneMappingExposure}
          whitePoint={whitePoint}
          setWhitePoint={setWhitePoint}
          hdriUrl={hdriUrl}
          setHdriUrl={setHdriUrl}
          environmentIntensity={environmentIntensity}
          setEnvironmentIntensity={setEnvironmentIntensity}
          bones={bones}
          boneSearchQuery={boneSearchQuery}
          setBoneSearchQuery={setBoneSearchQuery}
          selectedBoneUuid={selectedBoneUuid}
          setSelectedBoneUuid={setSelectedBoneUuid}
          isCameraBound={isCameraBound}
          setIsCameraBound={setIsCameraBound}
          showGroundPlane={showGroundPlane}
          setShowGroundPlane={setShowGroundPlane}
          groundPlaneColor={groundPlaneColor}
          setGroundPlaneColor={setGroundPlaneColor}
          groundPlaneOpacity={groundPlaneOpacity}
          setGroundPlaneOpacity={setGroundPlaneOpacity}
          enableShadows={enableShadows}
          setEnableShadows={setEnableShadows}
          keyboardControlsEnabled={keyboardControlsEnabled}
          setKeyboardControlsEnabled={setKeyboardControlsEnabled}
          cameraMoveSpeed={cameraMoveSpeed}
          setCameraMoveSpeed={setCameraMoveSpeed}
          showPerformanceMonitor={showPerformanceMonitor}
          setShowPerformanceMonitor={setShowPerformanceMonitor}
          isOrthographic={isOrthographic}
          setIsOrthographic={setIsOrthographic}
          orthoZoom={orthoZoom}
          setOrthoZoom={setOrthoZoom}
          sceneBgColor={customSceneBgColor ?? currentTheme.sceneBg}
          setSceneBgColor={setCustomSceneBgColor}
          defaultSceneBgColor={currentTheme.sceneBg}
          onOpenProjectIO={() => setIsProjectIOOpen(true)}
        />}

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
              onTakeScreenshot={async () => {
                console.log('Screenshot button clicked');
                if (!previewContainerRef.current) {
                  console.error('Preview container not available');
                  alert('預覽容器未就緒，請稍後再試');
                  return;
                }

                try {
                  // 檢查是否有 2D layers
                  const layerContainers = previewContainerRef.current.querySelectorAll('[data-layer-id]');
                  const has2DLayers = Array.from(layerContainers).some(container => 
                    container.querySelector('[data-element-id]')
                  );

                  // 如果沒有 2D layers，直接使用 SceneViewer 的截圖（透明背景）
                  if (!has2DLayers && sceneViewerRef.current) {
                    sceneViewerRef.current.takeScreenshot();
                    return;
                  }

                  // 有 2D layers，需要合成
                  const webglCanvas = previewContainerRef.current.querySelector('canvas') as HTMLCanvasElement;
                  if (!webglCanvas) {
                    throw new Error('WebGL canvas not found');
                  }

                  // 獲取預覽容器的實際內容尺寸（不包含 border）
                  const containerRect = previewContainerRef.current.getBoundingClientRect();
                  const width = webglCanvas.width;
                  const height = webglCanvas.height;

                  console.log('Canvas dimensions:', width, 'x', height);

                  // 創建離屏 canvas 用於合成（透明背景）
                  const offscreenCanvas = document.createElement('canvas');
                  offscreenCanvas.width = width;
                  offscreenCanvas.height = height;
                  const ctx = offscreenCanvas.getContext('2d', { alpha: true });
                  
                  if (!ctx) {
                    throw new Error('Failed to get 2d context');
                  }

                  // 清空為透明
                  ctx.clearRect(0, 0, width, height);

                  // 1. 繪製 WebGL canvas（3D 內容）
                  ctx.drawImage(webglCanvas, 0, 0, width, height);

                  // 2. 繪製 2D layers（前景和背景）
                  if (layerContainers.length > 0) {
                    // 使用 html2canvas 捕獲 2D layers
                    const layers2DCanvas = await html2canvas(previewContainerRef.current, {
                      useCORS: true,
                      allowTaint: true,
                      backgroundColor: null, // 透明背景
                      scale: 1, // 使用 1:1 比例（因為我們已經有正確的尺寸）
                      logging: false,
                      width: containerRect.width,
                      height: containerRect.height,
                      onclone: (_clonedDoc, element) => {
                        // 隱藏 WebGL canvas（我們已經手動繪製了）
                        const clonedWebglCanvas = element.querySelector('canvas');
                        if (clonedWebglCanvas) {
                          (clonedWebglCanvas as HTMLCanvasElement).style.display = 'none';
                        }

                        // 隱藏編輯輔助 UI（選取框、XY 軸指示器）
                        element.querySelectorAll('[style*="outline"]').forEach((el) => {
                          (el as HTMLElement).style.outline = 'none';
                        });
                        
                        // 隱藏 XY 軸指示器（SVG）
                        element.querySelectorAll('svg').forEach((svg) => {
                          if (svg.querySelector('circle') && svg.querySelector('line')) {
                            (svg as SVGElement).style.display = 'none';
                          }
                        });

                        // 隱藏 Performance Monitor
                        const perfMonitor = element.querySelector('[class*="PerformanceMonitor"]');
                        if (perfMonitor) {
                          (perfMonitor as HTMLElement).style.display = 'none';
                        }
                      }
                    });

                    // 將 2D layers 繪製到離屏 canvas（縮放到正確尺寸）
                    ctx.drawImage(layers2DCanvas, 0, 0, containerRect.width, containerRect.height, 0, 0, width, height);
                  }

                  // 創建下載連結
                  const dataURL = offscreenCanvas.toDataURL('image/png', 1.0);
                  const link = document.createElement('a');
                  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                  link.download = `screenshot_${timestamp}.png`;
                  link.href = dataURL;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);

                  console.log('Screenshot saved successfully:', link.download);
                } catch (error) {
                  console.error('Failed to take screenshot:', error);
                  alert(`截圖失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
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
              theme={currentTheme}
              isUIHidden={isUIHidden}
              onToggleUIVisibility={() => setIsUIHidden(!isUIHidden)}
            />
            <div
              ref={aspectRatioContainerRef}
              className="absolute inset-0 bg-black flex items-center justify-center p-0 z-0"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {/* FBX 拖放覆蓋層 - 僅覆蓋預覽區 */}
              {isFileDragging && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center animate-fade-in">
                  <div className="bg-gray-900/90 border-2 border-neon-blue border-dashed rounded-2xl p-12 shadow-[0_0_50px_rgba(59,130,246,0.3)] text-center transform transition-all duration-300 scale-100">
                    <div className="mb-6 flex justify-center">
                      <div className="w-20 h-20 rounded-full bg-neon-blue/20 flex items-center justify-center animate-pulse-slow">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-neon-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">釋放滑鼠以上傳檔案</h3>
                    <p className="text-gray-400">支援 FBX 模型、貼圖檔案與 .jr3d 專案檔</p>
                  </div>
                </div>
              )}
              <div
                style={getAspectRatioStyle()}
                className="relative z-[10]"
              >
                {/* 2D/3D 切換按鈕 - 可隱藏 */}
                {!isUIHidden && (
                  <PreviewModeToggle
                    show2DFront={is2DFrontEnabled}
                    show2DBack={is2DBackEnabled}
                    show3D={is3DEnabled}
                    onToggle2DFront={handleToggle2DFront}
                    onToggle2DBack={handleToggle2DBack}
                    onToggle3D={handleToggle3D}
                    theme={currentTheme}
                  />
                )}
                <div
                  ref={previewContainerRef}
                  className="relative w-full h-full rounded-2xl overflow-hidden border border-white/10 bg-black/80"
                  onClick={() => {
                    // 點擊預覽區空白處時，取消選定的 2D 元素
                    if (isPointerEditing && activeElementId) {
                      setActiveElementId(null);
                    }
                  }}
                >
                  {is2DBackEnabled && visibleBackLayers.map((layer, index) => (
                    <Layer2DRenderer
                      key={layer.id}
                      layer={layer}
                      zIndex={20 + index}
                      isActiveLayer={layer.id === activeLayerId}
                      activeElementId={activeElementId}
                      onSelectElement={isPointerEditing ? handleSelectElement : undefined}
                      onUpdateElement={(isPointerEditing || isDirectorMode) ? handleUpdateElementById : undefined}
                      pointerEnabled={isPointerEditing}
                    />
                  ))}
                  {/* Performance Monitor - 顯示在預覽框左下角 */}
                  <PerformanceMonitor
                    visible={showPerformanceMonitor}
                    rendererInfo={rendererInfo}
                    currentTheme={currentTheme}
                  />

                  {/* 3D SceneViewer - 始終渲染，使用 CSS 控制顯示/隱藏，避免條件渲染導致的 DOM 錯誤 */}
                  <div 
                    className={`absolute inset-0 z-[100] ${is3DEnabled ? '' : 'invisible pointer-events-none'}`}
                  >
                    <SceneViewer
                      ref={sceneViewerRef}
                      models={models.length > 0 ? models.map(m => ({
                        id: m.id,
                        model: m.model,
                        clip: m.optimizedClip || m.masterClip || m.originalClip,
                        // 🔥 Director Mode：傳遞所有可用動畫片段（用於動態切換）
                        allClips: [
                          m.originalClip,
                          m.masterClip,
                          ...(m.createdClips || []),
                        ].filter((c): c is NonNullable<typeof c> => c != null),
                        shaderGroups: m.shaderGroups,
                        isShaderEnabled: m.isShaderEnabled,
                        position: m.position,
                        rotation: m.rotation,
                        scale: m.scale,
                        visible: m.visible,
                        showWireframe: m.showWireframe,
                        opacity: m.opacity,
                        isPlaying: m.isPlaying,
                        currentTime: m.currentTime,
                        isLoopEnabled: m.isLoopEnabled,
                        isCameraOrbiting: m.isCameraOrbiting,
                        cameraOrbitSpeed: m.cameraOrbitSpeed,
                        isModelRotating: m.isModelRotating,
                        modelRotationSpeed: m.modelRotationSpeed
                      })) : undefined}
                      activeModelId={models.length > 0 ? activeModelId : undefined}
                      model={models.length === 0 ? model : undefined}
                      playingClip={models.length === 0 ? optimizedClip : undefined}
                      onTimeUpdate={handleTimeUpdate}
                      shaderGroups={models.length === 0 ? shaderGroups : undefined}
                      isShaderEnabled={models.length === 0 ? isShaderEnabled : undefined}
                      loop={isPlaylistPlaying ? false : isLoopEnabled}
                      onFinish={handleClipFinish}
                      backgroundColor={viewerBackgroundColor}
                      cameraSettings={cameraSettings}
                      isOrthographic={isOrthographic}
                      orthoZoom={orthoZoom}
                      boundBone={isCameraBound && selectedBoneUuid ? bones.find((b) => b.uuid === selectedBoneUuid) || null : null}
                      isCameraBound={isCameraBound}
                      keyboardControlsEnabled={keyboardControlsEnabled}
                      cameraMoveSpeed={cameraMoveSpeed}
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
                      isDirectorMode={isDirectorMode}
                      showTransformGizmo={!!activeModel && !isDirectorMode && activeModel.showTransformGizmo}
                      onModelPositionChange={(modelId, position) => {
                        updateModel(modelId, { position });
                      }}
                      screenshotWidth={screenshotSize.width}
                      screenshotHeight={screenshotSize.height}
                    />
                  </div>
                  {/* 3D 預覽關閉提示 */}
                  {!is3DEnabled && (
                    <div className="absolute inset-0 z-[90] flex items-center justify-center text-sm text-gray-400 bg-black/70">
                      3D 預覽已關閉
                    </div>
                  )}
                  {is2DFrontEnabled && visibleFrontLayers.map((layer, index) => (
                    <Layer2DRenderer
                      key={layer.id}
                      layer={layer}
                      zIndex={200 + index}
                      isActiveLayer={layer.id === activeLayerId}
                      activeElementId={activeElementId}
                      onSelectElement={isPointerEditing ? handleSelectElement : undefined}
                      onUpdateElement={(isPointerEditing || isDirectorMode) ? handleUpdateElementById : undefined}
                      pointerEnabled={isPointerEditing}
                    />
                  ))}
                  {!is2DFrontEnabled && !is2DBackEnabled && !is3DEnabled && (
                    <div className="absolute inset-0 z-[150] flex items-center justify-center text-sm text-gray-300 bg-black/70">
                      請開啟 2D 或 3D 預覽
                    </div>
                  )}
                </div>
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
            className={`${currentTheme.panelBg} border-t ${currentTheme.panelBorder} relative flex flex-col`}
            style={{ height: isDirectorMode ? `${directorPanelHeight}px` : `${panelHeight}px` }}
          >
            {/* Director Mode Panel */}
            {isDirectorMode ? (
              <DirectorPanel 
                actionSources={actionSources}
                models={models}
                onResizeHandleMouseDown={handleDirectorMouseDown}
                onUpdateModel={updateModel}
              />
            ) : (
              <>
                {/* 拖拉調整高度的把手 */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1 bg-gray-700/30 hover:${currentTheme.accent.replace('bg-', 'bg-')} cursor-ns-resize transition-colors z-10`}
                  onMouseDown={handleMouseDown}
                >
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-12 h-1 bg-gray-500/50 rounded-full"></div>
                </div>
                
                {/* 根據選中的元素類型顯示不同的面板 */}
                {(() => {
                  // 檢查是否選中了 Spine 元素
                  const activeLayer = layers.find(l => l.id === activeLayerId);
                  const activeElement = activeLayer?.children.find(e => e.id === activeElementId);
                  
                  if (activeElement && isSpineElement(activeElement)) {
                    const spineInstance = spineInstances.get(activeElement.spineInstanceId);
                    return (
                      <div className="p-4 overflow-y-auto flex-1">
                        <SpineInspectorPanel
                          element={activeElement}
                          spineInstance={spineInstance ?? null}
                          onUpdateElement={(updates) => {
                            handleUpdateElementById(activeLayerId, activeElement.id, updates);
                          }}
                        />
                      </div>
                    );
                  }

                  // 預設顯示 ModelInspector
                  return (
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
                      progressTimeRef={progressTimeRef}
                      isLoopEnabled={isLoopEnabled}
                      onToggleLoop={() => {
                        // 沒有模型時不執行任何操作
                        if (!model || !optimizedClip) {
                          return;
                        }
                        const newLoopState = !isLoopEnabled;
                        setIsLoopEnabled(newLoopState);
                        // 同步更新 activeModel 的循環設置
                        if (activeModelId) {
                          updateModel(activeModelId, { isLoopEnabled: newLoopState });
                        }
                      }}
                      audioTracks={audioTracks}
                      effects={effects}
                      theme={currentTheme}
                    />
                  );
                })()}
              </>
            )}
          </div>
        </div>

        {/* 右側：控制面板 */}
        <div
          className={`relative ${currentTheme.panelBg} border-l ${currentTheme.panelBorder} flex flex-col`}
          style={{ width: `${rightPanelWidth}px`, minWidth: '280px', maxWidth: 'calc(100vw - 4rem)' }}
          onDragOver={(e) => e.stopPropagation()}
          onDragLeave={(e) => e.stopPropagation()}
          onDrop={(e) => e.stopPropagation()}
        >
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
              className={`flex-1 py-2 text-xs font-medium transition-all flex flex-col items-center justify-center gap-1 ${activeTab === 'layer'
                ? `${currentTheme.panelBg} ${currentTheme.text} border-b-2 border-cyan-400`
                : `${currentTheme.button} text-gray-400 hover:text-gray-200`
                }`}
              onClick={() => handleTabChange('layer')}
              title="2D Layers"
            >
              <Layers size={18} className={activeTab === 'layer' ? 'text-cyan-400 tab-icon-breathe-cyan' : ''} />
              <span>2D</span>
            </button>
            <button
              className={`flex-1 py-2 text-xs font-medium transition-all flex flex-col items-center justify-center gap-1 ${activeTab === 'optimization'
                ? `${currentTheme.panelBg} ${currentTheme.text} border-b-2 border-blue-500`
                : `${currentTheme.button} text-gray-400 hover:text-gray-200`
                }`}
              onClick={() => handleTabChange('optimization')}
              title="Model Manager"
            >
              <Box size={18} className={activeTab === 'optimization' ? 'text-blue-400 tab-icon-breathe-blue' : ''} />
              <span>Model</span>
            </button>
            <button
              className={`flex-1 py-2 text-xs font-medium transition-all flex flex-col items-center justify-center gap-1 ${activeTab === 'shader'
                ? `${currentTheme.panelBg} ${currentTheme.text} border-b-2 border-purple-500`
                : `${currentTheme.button} text-gray-400 hover:text-gray-200`
                }`}
              onClick={() => handleTabChange('shader')}
              title="Shader Tools"
            >
              <Wand2 size={18} className={activeTab === 'shader' ? 'text-purple-400 tab-icon-breathe-purple' : ''} />
              <span>Shader</span>
            </button>
            <button
              className={`flex-1 py-2 text-xs font-medium transition-all flex flex-col items-center justify-center gap-1 ${activeTab === 'audio'
                ? `${currentTheme.panelBg} ${currentTheme.text} border-b-2 border-green-500`
                : `${currentTheme.button} text-gray-400 hover:text-gray-200`
                }`}
              onClick={() => handleTabChange('audio')}
              title="Audio Settings"
            >
              <Music size={18} className={activeTab === 'audio' ? 'text-green-400 tab-icon-breathe-green' : ''} />
              <span>Audio</span>
            </button>
            <button
              className={`flex-1 py-2 text-xs font-medium transition-all flex flex-col items-center justify-center gap-1 ${activeTab === 'effect'
                ? `${currentTheme.panelBg} ${currentTheme.text} border-b-2 border-orange-500`
                : `${currentTheme.button} text-gray-400 hover:text-gray-200`
                }`}
              onClick={() => handleTabChange('effect')}
              title="Visual Effects"
            >
              <Sparkles size={18} className={activeTab === 'effect' ? 'text-orange-400 tab-icon-breathe-orange' : ''} />
              <span>Efk</span>
            </button>
          </div>

          {/* 分頁內容 */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'layer' && (
              <div className="space-y-8">
                <LayerManagerPanel
                  layers={layers}
                  activeLayerId={activeLayerId}
                  activeElementId={activeElementId}
                  onSelectLayer={handleSelectLayer}
                  onSelectElement={handleSelectElement}
                  onCreateLayer={handleCreateLayer}
                  onDeleteLayer={handleDeleteLayer}
                  onToggleLayerVisibility={handleToggleLayerVisibility}
                  onToggleLayerLock={handleToggleLayerLock}
                  onRenameLayer={handleRenameLayer}
                  onToggleExpand={handleToggleLayerExpand}
                  onUpdateLayerPriority={handleUpdateLayerPriority}
                  onUpdateLayerOpacity={handleUpdateLayerOpacity}
                  onReorderLayer={handleReorderLayer}
                  onAddTextElement={handleAddTextElement}
                  onAddImageElement={handleAddImageElement}
                  onAddSpineElement={handleAddSpineElement}
                  onReorderElement={handleReorderElement}
                  onUpdateElement={handleUpdateElementById}
                  onRemoveElement={handleRemoveElementById}
                  currentTheme={currentTheme}
                  themeMode={themeMode}
                />
              </div>
            )}

            {activeTab === 'optimization' && (
              <ModelManagerPanel
                models={models}
                activeModelId={activeModelId}
                onSelectModel={(id) => {
                  // 支援取消選中（id 為 null）
                  setActiveModelId(id);
                  
                  // 互斥邏輯：選中 3D 模型時，取消 2D 元素選中
                  if (id) {
                    setActiveElementId(null);
                  }
                }}
                onAddModel={handleFileUpload}
                onRemoveModel={(id) => {
                  // 獲取要刪除的模型
                  const modelToRemove = models.find(m => m.id === id);
                  
                  if (modelToRemove) {
                    // 1. 清理 Three.js 模型資源（Geometry, Material, Texture）
                    disposeModel(modelToRemove.model);
                    
                    // 2. 清理音效資源
                    modelToRemove.audioTracks?.forEach((track) => {
                      audioControllerRef.current.cleanup(track.id);
                    });
                    
                    // 3. 清理特效資源
                    modelToRemove.effects?.forEach((effect) => {
                      const effekseerAdapter = getEffekseerRuntimeAdapter();
                      effekseerAdapter.cleanup(effect.id);
                    });
                    
                    // 4. 清理 Director Mode 中該模型的所有 Clips
                    useDirectorStore.getState().removeClipsByModelId(id);
                  }
                  
                  // 5. 移除模型
                  removeModel(id);
                  // 如果刪除的是活動模型，已經在 hook 中處理了
                }}
                onRenameModel={(id, newName) => {
                  updateModel(id, { name: newName });
                }}
                onUpdateModelTransform={(id, updates) => {
                  updateModel(id, updates);
                }}
                onFocusModel={(id) => {
                  sceneViewerRef.current?.focusOnModel(id);
                }}
                onSaveSnapshot={(modelId, name) => {
                  const model = models.find(m => m.id === modelId);
                  if (!model) return;
                  
                  const cameraState = sceneViewerRef.current?.getCameraState();
                  if (!cameraState) {
                    console.warn('無法獲取相機狀態');
                    return;
                  }
                  
                  const snapshot = createViewSnapshot(
                    name,
                    {
                      position: cameraState.position,
                      target: cameraState.target,
                      fov: cameraState.fov,
                      isOrthographic: cameraState.isOrthographic,
                      orthoZoom: cameraState.orthoZoom,
                    },
                    {
                      position: model.position,
                      rotation: model.rotation,
                      scale: model.scale,
                      animationTime: model.currentTime,
                    }
                  );
                  
                  updateModel(modelId, {
                    viewSnapshots: [...model.viewSnapshots, snapshot],
                  });
                  
                  console.log('已保存視圖快照:', snapshot.name);
                }}
                onApplySnapshot={(modelId, snapshot) => {
                  // 1. 更新相機設定（isOrthographic 和 orthoZoom 透過 state 更新，會觸發 CameraController 切換相機）
                  setIsOrthographic(snapshot.cameraIsOrthographic);
                  setOrthoZoom(snapshot.cameraOrthoZoom);
                  setCameraSettings(prev => ({ ...prev, fov: snapshot.cameraFov }));
                  
                  // 2. 設置模型狀態並暫停播放
                  updateModel(modelId, {
                    position: snapshot.modelPosition,
                    rotation: snapshot.modelRotation,
                    scale: snapshot.modelScale,
                    currentTime: snapshot.animationTime,
                    isPlaying: false, // 暫停動畫
                  });
                  
                  // 3. 跳轉動畫時間
                  sceneViewerRef.current?.seekTo(snapshot.animationTime);
                  
                  // 4. 延遲設置相機位置，等待相機類型切換完成（如果需要切換的話）
                  // 使用 requestAnimationFrame 確保在下一幀設置，此時 CameraController 已完成相機切換
                  requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                      sceneViewerRef.current?.setCameraState({
                        position: snapshot.cameraPosition,
                        target: snapshot.cameraTarget,
                        fov: snapshot.cameraFov,
                        isOrthographic: snapshot.cameraIsOrthographic,
                        orthoZoom: snapshot.cameraOrthoZoom,
                      });
                    });
                  });
                  
                  console.log('已套用視圖快照:', snapshot.name);
                }}
                onDeleteSnapshot={(modelId, snapshotId) => {
                  const model = models.find(m => m.id === modelId);
                  if (!model) return;
                  
                  updateModel(modelId, {
                    viewSnapshots: model.viewSnapshots.filter(s => s.id !== snapshotId),
                  });
                }}
                onRenameSnapshot={(modelId, snapshotId, newName) => {
                  const model = models.find(m => m.id === modelId);
                  if (!model) return;
                  
                  updateModel(modelId, {
                    viewSnapshots: model.viewSnapshots.map(s => 
                      s.id === snapshotId ? { ...s, name: newName } : s
                    ),
                  });
                }}
                onSaveTransformSnapshot={(modelId, name) => {
                  const model = models.find(m => m.id === modelId);
                  if (!model) return;
                  
                  const snapshot = createTransformSnapshot(name, {
                    position: model.position,
                    rotation: model.rotation,
                    scale: model.scale[0], // 使用等比縮放值
                    opacity: model.opacity,
                  });
                  
                  updateModel(modelId, {
                    transformSnapshots: [...model.transformSnapshots, snapshot],
                  });
                  
                  console.log('已保存 Transform 快照:', snapshot.name);
                }}
                onApplyTransformSnapshot={(modelId, snapshot) => {
                  updateModel(modelId, {
                    position: snapshot.position,
                    rotation: snapshot.rotation,
                    scale: [snapshot.scale, snapshot.scale, snapshot.scale],
                    opacity: snapshot.opacity,
                  });
                  
                  console.log('已套用 Transform 快照:', snapshot.name);
                }}
                onDeleteTransformSnapshot={(modelId, snapshotId) => {
                  const model = models.find(m => m.id === modelId);
                  if (!model) return;
                  
                  updateModel(modelId, {
                    transformSnapshots: model.transformSnapshots.filter(s => s.id !== snapshotId),
                  });
                }}
                onRenameTransformSnapshot={(modelId, snapshotId, newName) => {
                  const model = models.find(m => m.id === modelId);
                  if (!model) return;
                  
                  updateModel(modelId, {
                    transformSnapshots: model.transformSnapshots.map(s => 
                      s.id === snapshotId ? { ...s, name: newName } : s
                    ),
                  });
                }}
                isDirectorMode={isDirectorMode}
                isLoading={isLoading}
                toneMappingExposure={toneMappingExposure}
                environmentIntensity={environmentIntensity}
                hdriUrl={hdriUrl || undefined}
                theme={currentTheme}
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
                theme={currentTheme}
              />
            )}

            {activeTab === 'audio' && (
              <AudioPanel
                audioTracks={audioTracks}
                setAudioTracks={setAudioTracks}
                createdClips={createdClips}
                audioController={audioControllerRef.current}
                theme={currentTheme}
                modelName={activeModel?.name}
              />
            )}

            {/* Effect 面板不卸載，用 CSS 隱藏（保持特效 handle 引用） */}
            <div className={activeTab === 'effect' ? '' : 'hidden'}>
              <EffectTestPanel
                model={model}
                bones={bones}
                effects={effects}
                setEffects={setEffects}
                createdClips={createdClips}
                theme={currentTheme}
                duration={duration}
                fps={30}
                onClearAllModelsEffects={() => {
                  // 清除所有模型的特效狀態（因為 Effekseer 快取是全域共用的）
                  models.forEach(m => {
                    updateModel(m.id, {
                      effects: m.effects.map(effect => ({
                        ...effect,
                        isLoaded: false,
                        resourceStatus: undefined
                      }))
                    });
                  });
                  // 同時清除當前活動模型的 effects 狀態
                  setEffects(prev => prev.map(effect => ({
                    ...effect,
                    isLoaded: false,
                    resourceStatus: undefined
                  })));
                }}
              />
            </div>

          </div>

          {/* 底部標籤 */}
          <div className={`p-4 text-center group transition-all border-t ${currentTheme.dividerBorder} relative`}>
            <div className="flex flex-col items-center justify-center gap-2">
              <p className={`text-[10px] ${currentTheme.text} opacity-40 group-hover:opacity-70 transition-opacity`}>
                Designed for Game Developers · <span className="opacity-50 font-mono">v{__APP_VERSION__}</span>
              </p>
              
              <button
                onClick={() => setIsVersionModalOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-medium transition-all duration-200 
                  ${currentTheme.button} border border-transparent hover:border-blue-500/30 hover:shadow-[0_0_12px_rgba(59,130,246,0.15)] 
                  group-hover:translate-y-[-2px] opacity-40 group-hover:opacity-100`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                <span>What's New</span>
              </button>
            </div>
          </div>
        </div>
      </div >
      
      {/* 版本更新 Modal */}
      <VersionModal 
        isOpen={isVersionModalOpen} 
        onClose={() => setIsVersionModalOpen(false)} 
        theme={currentTheme}
      />

      {/* Toast 通知容器 */}
      <ToastContainer />

      {/* 專案匯出/載入面板 */}
      <ProjectIOPanel
        isOpen={isProjectIOOpen}
        onClose={() => setIsProjectIOOpen(false)}
        onExport={handleExportProject}
        onLoad={handleLoadProject}
        hasModels={models.length > 0}
        theme={currentTheme}
        isProcessing={isProjectProcessing}
        progress={projectProgress}
        progressMessage={projectProgressMessage}
      />
    </div >
  );
}

export default App;
