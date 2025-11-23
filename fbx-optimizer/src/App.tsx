import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';
import { TGALoader } from 'three/examples/jsm/loaders/TGALoader';
import SceneViewer, { type SceneViewerRef } from './components/SceneViewer';
import OptimizationControls from './components/OptimizationControls';
import MaterialShaderTool from './components/MaterialShaderTool';
import ModelInspector from './components/ModelInspector';
import AudioPanel from './components/AudioPanel';
import { optimizeAnimationClip } from './utils/optimizer';
import { AudioController } from './utils/AudioController';
import { Loader2, Camera } from 'lucide-react';
import type { ShaderFeature, ShaderGroup } from './types/shaderTypes';

export interface AudioTrigger {
  id: string;
  clipUuid: string; // Keep for backward compatibility, but will use clipName for matching
  clipName: string; // Use name for matching since UUID changes after optimization
  frame: number;
}

export interface AudioTrack {
  id: string;
  name: string;
  url: string;
  file: File;
  note: string;
  triggers: AudioTrigger[];
  color: string;
  playbackRate: number;
  volume: number;
  // Advanced Audio Features
  pitch: number; // detune in cents
  echo: number; // mix 0-1
  eqLow: number; // gain dB
  eqMid: number; // gain dB
  eqHigh: number; // gain dB
  lowpass: number; // frequency Hz
  highpass: number; // frequency Hz
}

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [originalClip, setOriginalClip] = useState<THREE.AnimationClip | null>(null);
  const [masterClip, setMasterClip] = useState<THREE.AnimationClip | null>(null);
  const [optimizedClip, setOptimizedClip] = useState<THREE.AnimationClip | null>(null);
  const [tolerance, setTolerance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);

  // 動畫控制狀態
  const sceneViewerRef = useRef<SceneViewerRef>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [createdClips, setCreatedClips] = useState<THREE.AnimationClip[]>([]);
  const [isLoopEnabled, setIsLoopEnabled] = useState(true);

  // 面板高度控制
  const [panelHeight, setPanelHeight] = useState(384); // 預設 384px (h-96)
  const [isDragging, setIsDragging] = useState(false);

  // 右側面板寬度控制
  const [rightPanelWidth, setRightPanelWidth] = useState(320); // 預設 320px (w-80)
  const [isResizingRight, setIsResizingRight] = useState(false);

  // 右側面板分頁
  const [activeTab, setActiveTab] = useState<'optimization' | 'shader' | 'audio'>('optimization');
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);

  // Theme Mode
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');

  // Shader 功能狀態
  const [shaderGroups, setShaderGroups] = useState<ShaderGroup[]>([]);
  const [meshNames, setMeshNames] = useState<string[]>([]);

  // Camera Settings
  const [showCameraSettings, setShowCameraSettings] = useState(false);
  const [showGroundSettings, setShowGroundSettings] = useState(false);
  const cameraSettingsRef = useRef<HTMLDivElement>(null);
  const groundSettingsRef = useRef<HTMLDivElement>(null);
  const audioControllerRef = useRef<AudioController>(new AudioController());
  const lastAudioFrameRef = useRef<number>(-1);
  const lastTimeRef = useRef<number>(0);
  const [cameraSettings, setCameraSettings] = useState({
    fov: 50,
    near: 0.1,
    far: 1000
  });

  // Bone Binding State
  const [bones, setBones] = useState<THREE.Bone[]>([]);
  const [boneSearchQuery, setBoneSearchQuery] = useState('');
  const [selectedBoneUuid, setSelectedBoneUuid] = useState<string | null>(null);
  const [isCameraBound, setIsCameraBound] = useState(false);
  const [showGroundPlane, setShowGroundPlane] = useState(false);
  const [groundPlaneColor, setGroundPlaneColor] = useState('#444444');
  const [groundPlaneOpacity, setGroundPlaneOpacity] = useState(1.0);
  const [enableShadows, setEnableShadows] = useState(false);

  // Extract bones from model
  useEffect(() => {
    if (model) {
      const foundBones: THREE.Object3D[] = [];
      model.traverse((child) => {
        // Include all Object3D that could be part of skeleton hierarchy
        // This includes Bone, Object3D, and Group nodes that are part of the armature
        if (child.type === 'Bone' ||
          child.type === 'Object3D' ||
          child.parent?.type === 'Bone' ||
          child.name.toLowerCase().includes('bone') ||
          child.name.toLowerCase().includes('root') ||
          child.name.toLowerCase().includes('bip') ||
          child.name.toLowerCase().includes('dummy')) {
          // Exclude the model root itself and meshes
          if (child !== model && !child.isMesh && !child.isSkinnedMesh) {
            foundBones.push(child);
          }
        }
      });
      setBones(foundBones as THREE.Bone[]);
      // Reset binding state when model changes
      setSelectedBoneUuid(null);
      setIsCameraBound(false);
    } else {
      setBones([]);
    }
  }, [model]);

  // Click outside to close camera settings
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cameraSettingsRef.current && !cameraSettingsRef.current.contains(event.target as Node)) {
        setShowCameraSettings(false);
      }
      if (groundSettingsRef.current && !groundSettingsRef.current.contains(event.target as Node)) {
        setShowGroundSettings(false);
      }
    };

    if (showCameraSettings || showGroundSettings) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCameraSettings, showGroundSettings]);

  // 處理檔案上傳
  const handleFileUpload = async (files: FileList) => {
    setIsLoading(true);

    // 分類檔案
    let fbxFile: File | null = null;
    const textureFiles = new Map<string, File>();

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.name.toLowerCase().endsWith('.fbx')) {
        fbxFile = f;
      } else {
        // 儲存貼圖檔案 (使用小寫檔名作為 Key)
        textureFiles.set(f.name.toLowerCase(), f);
      }
    }

    if (!fbxFile) {
      alert('請至少選擇一個 FBX 檔案！');
      setIsLoading(false);
      return;
    }

    setFile(fbxFile);

    try {
      // 讀取 FBX 為 ArrayBuffer
      const fbxArrayBuffer = await fbxFile.arrayBuffer();

      // 設定 LoadingManager 來攔截貼圖請求
      const manager = new THREE.LoadingManager();

      // 註冊 TGA Loader
      manager.addHandler(/\.tga$/i, new TGALoader(manager));

      manager.setURLModifier((url) => {
        console.log(`[Texture Request] Original URL: ${url} `);

        // 1. 如果是 data URI 或 blob URI，直接回傳
        if (url.startsWith('data:') || url.startsWith('blob:')) {
          return url;
        }

        // 2. 提取檔名 (處理各種路徑格式)
        let fileName = url;

        // 移除可能的協議前綴
        fileName = fileName.replace(/^(http:\/\/|https:\/\/|file:\/\/\/)/, '');

        // 處理 Windows 路徑
        fileName = fileName.replace(/\\/g, '/');

        // 取得最後一段 (檔名)
        fileName = fileName.split('/').pop() || '';
        fileName = fileName.toLowerCase();

        console.log(`[Texture Request] Extracted FileName: ${fileName} `);

        // 3. 在上傳的檔案中尋找
        if (textureFiles.has(fileName)) {
          const textureFile = textureFiles.get(fileName)!;
          const blobUrl = URL.createObjectURL(textureFile);
          console.log(`[Texture Match]Found: ${fileName} -> ${blobUrl} `);
          return blobUrl;
        }

        console.warn(`[Texture Missing] Could not find: ${fileName} `);
        console.warn(`[Available Textures]: `, Array.from(textureFiles.keys()));

        // 回傳一個假的 URL (會載入失敗，但不會中斷整個流程)
        return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      });

      const loader = new FBXLoader(manager);

      // 使用 parse 而非 loadAsync，這樣我們可以完全控制路徑解析
      const object = loader.parse(fbxArrayBuffer, '');

      console.log('[FBX Loaded]', object);

      // 遍歷模型，檢查並修復材質
      object.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const material = mesh.material as THREE.MeshStandardMaterial | THREE.MeshPhongMaterial;

          console.log(`[Mesh: ${mesh.name}]Material: `, material);

          if (material) {
            // 1. 關閉頂點顏色 (Vertex Colors)
            // 很多 FBX 模型會帶有頂點顏色 (通常是黑色或用作遮罩)，這會導致模型在 Three.js 中變黑
            material.vertexColors = false;

            // 2. 確保有貼圖時，基礎顏色是白色的
            if (material.map) {
              console.log(`  - Has Texture: ${material.map.name || 'Unnamed'} `);
              material.color.setHex(0xffffff);

              // 確保貼圖編碼正確
              material.map.colorSpace = THREE.SRGBColorSpace;
            }

            // 3. 嘗試修復全黑問題：如果沒有貼圖，給一個預設顏色
            if (!material.map && material.color.getHex() === 0x000000) {
              console.warn(`  - Black color detected without texture.Resetting to gray.`);
              material.color.setHex(0x888888);
            }

            // 4. 重置一些可能導致變黑的 PBR 參數
            if ((material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
              const stdMat = material as THREE.MeshStandardMaterial;
              stdMat.roughness = 0.7; // 避免過度光滑導致全黑反射
              stdMat.metalness = 0.1; // 避免全金屬導致全黑 (如果沒有環境貼圖)
            }

            // 5. 雙面渲染 (避免法線反轉導致看不見)
            material.side = THREE.DoubleSide;

            // 6. 確保材質更新
            material.needsUpdate = true;
          }
        }
      });

      console.log('[Animations]', object.animations);

      // 提取所有 mesh 名稱
      const meshes: string[] = [];
      object.traverse((child) => {
        if (child.type === 'SkinnedMesh' || child.type === 'Mesh') {
          meshes.push(child.name);
        }
      });
      console.log('[Meshes]', meshes);
      setMeshNames(meshes);

      // 初始化第一組 shader 配置（包含所有 mesh）
      if (meshes.length > 0) {
        const defaultGroup: ShaderGroup = {
          id: `group_${Date.now()}`,
          name: '組合 1',
          features: [],
          selectedMeshes: meshes, // 預設選擇所有 mesh
          expanded: true,
        };
        setShaderGroups([defaultGroup]);
      }

      setModel(object);

      if (object.animations && object.animations.length > 0) {
        const clip = object.animations[0];
        setMasterClip(clip);
        setOriginalClip(clip);
        setDuration(clip.duration);
        setOptimizedClip(optimizeAnimationClip(clip, tolerance));
        setCreatedClips([]); // Clear created clips when a new model is loaded
      } else {
        setMasterClip(null);
        setOriginalClip(null);
        setOptimizedClip(null);
        setDuration(0);
        setCreatedClips([]);
      }
    } catch (error) {
      console.error('Error loading FBX:', error);
      alert('讀取 FBX 檔案失敗，請確認檔案格式是否正確。');
    } finally {
      setIsLoading(false);
    }
  };

  // 當 tolerance 改變時重新優化
  useEffect(() => {
    if (originalClip) {
      // 使用 debounce 避免頻繁計算
      const timer = setTimeout(() => {
        const optimized = optimizeAnimationClip(originalClip, tolerance);
        setOptimizedClip(optimized);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [tolerance, originalClip]);

  // 導出功能
  const handleExport = () => {
    if (!model || !optimizedClip) return;
    setExporting(true);

    setTimeout(async () => {
      try {
        // 複製模型以避免修改原始物件
        const exportModel = model.clone();

        // 替換動畫
        exportModel.animations = [optimizedClip];

        // 導出為 GLB
        const exporter = new GLTFExporter();
        exporter.parse(
          exportModel,
          (result: ArrayBuffer) => {
            const blob = new Blob([result], { type: 'application/octet-stream' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `optimized_${file?.name.replace('.fbx', '') || 'model'}.glb`;
            link.click();
          },
          (error: Error) => {
            console.error('Export failed:', error);
            alert('導出失敗');
          },
          { binary: true }
        );
      } catch (error) {
        console.error('Export failed:', error);
        alert('導出失敗');
      } finally {
        setExporting(false);
      }
    }, 100);
  };

  // 計算關鍵幀總數
  const countKeyframes = (clip: THREE.AnimationClip | null) => {
    if (!clip) return 0;
    return clip.tracks.reduce((acc, track) => acc + track.times.length, 0);
  };

  // 動畫控制處理
  const handlePlayPause = () => {
    if (isPlaying) {
      sceneViewerRef.current?.pause();
    } else {
      sceneViewerRef.current?.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (time: number) => {
    sceneViewerRef.current?.seekTo(time);
    setCurrentTime(time);
  };

  const lastUIUpdateRef = useRef(0);

  const handleTimeUpdate = useCallback((time: number) => {
    // Throttle UI updates to ~30fps to prevent main thread blocking
    const now = performance.now();
    if (now - lastUIUpdateRef.current > 32) {
      setCurrentTime(time);
      lastUIUpdateRef.current = now;
    }

    if (!isPlaying || !optimizedClip) {
      return;
    }

    // Detect loop or seek (if time goes backward)
    if (time < lastTimeRef.current) {
      lastAudioFrameRef.current = -1;
      lastTimeRef.current = time;
      return;
    }

    const fps = 30;
    const previousTime = lastTimeRef.current;

    audioTracks.forEach(track => {
      track.triggers.forEach(trigger => {
        const clipName = trigger.clipName || '';

        // Match by clip name instead of UUID (since UUID changes after optimization)
        if (clipName === optimizedClip.name) {
          const triggerTime = trigger.frame / fps;

          if (triggerTime > previousTime && triggerTime <= time) {
            console.log(`[Audio Trigger] ✓ Playing: ${track.name} at frame ${trigger.frame}`);
            audioControllerRef.current.play(track);
          }
        }
      });
    });

    lastTimeRef.current = time;
  }, [isPlaying, optimizedClip, audioTracks]);

  const handleSelectClip = (clip: THREE.AnimationClip) => {
    setOriginalClip(clip);
    setDuration(clip.duration);
    setOptimizedClip(optimizeAnimationClip(clip, tolerance));
    handleSeek(0);
    if (!isPlaying) handlePlayPause();
  };

  // Playlist State
  const [playlist, setPlaylist] = useState<THREE.AnimationClip[]>([]);
  const [isPlaylistPlaying, setIsPlaylistPlaying] = useState(false);
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState(0);

  // Add clip to playlist
  const handleAddToPlaylist = (clip: THREE.AnimationClip) => {
    // Clone the clip to ensure each playlist item has a unique reference
    // This fixes the issue where adding the same clip multiple times causes playback problems
    const clonedClip = clip.clone();
    // Preserve frame metadata if it exists
    if ((clip as any).startFrame !== undefined) {
      (clonedClip as any).startFrame = (clip as any).startFrame;
    }
    if ((clip as any).endFrame !== undefined) {
      (clonedClip as any).endFrame = (clip as any).endFrame;
    }
    setPlaylist(prev => [...prev, clonedClip]);
  };

  // Remove clip from playlist
  const handleRemoveFromPlaylist = (index: number) => {
    setPlaylist(prev => prev.filter((_, i) => i !== index));
    // Adjust current index if needed
    if (index < currentPlaylistIndex) {
      setCurrentPlaylistIndex(prev => prev - 1);
    } else if (index === currentPlaylistIndex && isPlaylistPlaying) {
      // If removing currently playing clip, stop or move to next?
      // For simplicity, let's just stop playlist playback if current is removed
      setIsPlaylistPlaying(false);
      setCurrentPlaylistIndex(0);
    }
  };

  // Reorder playlist
  const handleReorderPlaylist = (fromIndex: number, toIndex: number) => {
    setPlaylist(prev => {
      const newPlaylist = [...prev];
      const [movedItem] = newPlaylist.splice(fromIndex, 1);
      newPlaylist.splice(toIndex, 0, movedItem);
      return newPlaylist;
    });

    // Adjust current index if needed (complex, maybe just stop playback for safety)
    if (isPlaylistPlaying) {
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
    if (isPlaylistPlaying) {
      const nextIndex = currentPlaylistIndex + 1;
      if (nextIndex < playlist.length) {
        // Use requestAnimationFrame to make the transition smoother
        requestAnimationFrame(() => {
          setCurrentPlaylistIndex(nextIndex);
          setOptimizedClip(playlist[nextIndex]);
          setDuration(playlist[nextIndex].duration);
          setCurrentTime(0); // Reset time to avoid progress bar glitch
          // SceneViewer will automatically play the new clip via useEffect
        });
      } else {
        // End of playlist - keep currentPlaylistIndex at the last item
        // so that all items show as completed
        setIsPlaylistPlaying(false);
        setIsPlaying(false);
        sceneViewerRef.current?.pause();
      }
    } else {
      // Single clip playback finished (when loop is disabled)
      setIsPlaying(false);
      // We don't need to pause SceneViewer here because it auto-pauses on finish when loop is false
      // But we need to update the UI state to reflect that it stopped
    }
  };

  const handleCreateClip = (name: string, startFrame: number, endFrame: number) => {
    const sourceClip = masterClip || originalClip;
    if (!sourceClip) return;

    const fps = 30; // 假設 30fps，理想情況下應該從 clip 讀取或讓使用者設定
    const startTime = startFrame / fps;
    const endTime = endFrame / fps;
    const duration = endTime - startTime;

    if (duration <= 0) {
      alert('結束時間必須大於起始時間');
      return;
    }

    // 創建新的 AnimationClip
    // 這裡使用 AnimationUtils.subclip 會比較方便，但 Three.js 核心沒有直接暴露，我們手動切
    const newTracks: THREE.KeyframeTrack[] = [];

    sourceClip.tracks.forEach(track => {
      const times: number[] = [];
      const values: number[] = [];
      const itemSize = track.getValueSize();

      for (let i = 0; i < track.times.length; i++) {
        const t = track.times[i];
        if (t >= startTime && t <= endTime) {
          times.push(t - startTime); // 重置時間從 0 開始

          // 複製對應的值
          for (let k = 0; k < itemSize; k++) {
            values.push(track.values[i * itemSize + k]);
          }
        }
      }

      if (times.length > 0) {
        // 根據 track 類型創建新 track
        const TrackConstructor = track.constructor as any;
        newTracks.push(new TrackConstructor(track.name, times, values));
      }
    });

    const newClip = new THREE.AnimationClip(name, duration, newTracks);

    // Store frame metadata on the clip for display purposes
    (newClip as any).startFrame = startFrame;
    (newClip as any).endFrame = endFrame;

    // 新增到列表
    setCreatedClips(prev => [...prev, newClip]);

    // 自動播放新片段
    handleSelectClip(newClip);

    // alert(`已建立新片段: ${ name } `); // 移除 alert，避免打斷體驗
  };

  const handleDeleteCreatedClip = (index: number) => {
    setCreatedClips(prev => {
      const newClips = prev.filter((_, i) => i !== index);

      // If all clips are deleted, revert to master clip
      if (newClips.length === 0 && masterClip) {
        setOriginalClip(masterClip);
        setDuration(masterClip.duration);
        setOptimizedClip(optimizeAnimationClip(masterClip, tolerance));
        handleSeek(0);
        if (!isPlaying) handlePlayPause();
      }

      return newClips;
    });
  };

  // 拖放處理
  const [isFileDragging, setIsFileDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsFileDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsFileDragging(false);
  };

  // 面板拖拉調整高度
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true); // 這裡的 isDragging 用於控制面板拖拉
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const newHeight = window.innerHeight - e.clientY;
      // 限制最小和最大高度
      const clampedHeight = Math.max(200, Math.min(newHeight, window.innerHeight - 100));
      setPanelHeight(clampedHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // 右側面板拖拉調整寬度
  const handleRightPanelMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingRight(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRight) return;

      const newWidth = window.innerWidth - e.clientX;
      // 限制最小和最大寬度
      const clampedWidth = Math.max(280, Math.min(newWidth, 600));
      setRightPanelWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizingRight(false);
    };

    if (isResizingRight) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingRight]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsFileDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  return (
    <div
      className="h-screen overflow-hidden bg-gray-900 text-white flex flex-col"
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
        <div className="w-16 bg-gray-900 border-r border-gray-700 flex flex-col items-center py-4 space-y-4 z-20 shadow-lg">
          {/* Tool: Select / Move */}
          <div className="group relative">
            <button className="p-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" /><path d="M13 13l6 6" /></svg>
            </button>
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
              選取工具 (V)
            </div>
          </div>

          {/* Tool: Rotate */}
          <div className="group relative">
            <button className="p-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
            </button>
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
              旋轉工具 (R)
            </div>
          </div>

          {/* Tool: Scale */}
          <div className="group relative">
            <button className="p-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 3l-6 6" /><path d="M21 3v6" /><path d="M21 3h-6" /><path d="M3 21l6-6" /><path d="M3 21v-6" /><path d="M3 21h6" /><path d="M14.5 9.5L9.5 14.5" /></svg>
            </button>
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
              縮放工具 (S)
            </div>
          </div>

          <div className="w-8 h-px bg-gray-700 my-2"></div>

          {/* Tool: Theme Toggle */}
          <div className="group relative">
            <button
              className={`p-3 rounded-lg transition-colors ${themeMode === 'light' ? 'text-yellow-400 hover:bg-gray-800' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
              onClick={() => setThemeMode(prev => prev === 'dark' ? 'light' : 'dark')}
            >
              {themeMode === 'dark' ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><path d="M12 1v2" /><path d="M12 21v2" /><path d="M4.22 4.22l1.42 1.42" /><path d="M18.36 18.36l1.42 1.42" /><path d="M1 12h2" /><path d="M21 12h2" /><path d="M4.22 19.78l1.42-1.42" /><path d="M18.36 5.64l1.42-1.42" /></svg>
              )}
            </button>
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
              切換模式 ({themeMode === 'dark' ? '深色' : '亮色'})
            </div>
          </div>

          {/* Tool: Camera Settings */}
          <div className="group relative" ref={cameraSettingsRef}>
            <button
              className={`p-3 rounded-lg transition-colors ${showCameraSettings
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
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
              <div className="absolute left-full top-0 ml-4 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-4 z-50">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
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
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
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
              <div className="absolute left-full top-0 ml-4 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-4 z-50">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
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
            <div className="absolute inset-0">
              <SceneViewer
                ref={sceneViewerRef}
                model={model}
                playingClip={optimizedClip}
                onTimeUpdate={handleTimeUpdate}
                shaderGroups={shaderGroups}
                loop={isPlaylistPlaying ? false : isLoopEnabled}
                onFinish={handleClipFinish}
                backgroundColor={themeMode === 'dark' ? '#111827' : '#F5F5F5'}
                cameraSettings={cameraSettings}
                boundBone={isCameraBound && selectedBoneUuid ? bones.find((b) => b.uuid === selectedBoneUuid) || null : null}
                isCameraBound={isCameraBound}
                showGroundPlane={showGroundPlane}
                groundPlaneColor={groundPlaneColor}
                groundPlaneOpacity={groundPlaneOpacity}
                enableShadows={enableShadows}
              />
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
            className="bg-gray-800 border-t border-gray-700 relative"
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
              onToggleLoop={() => setIsLoopEnabled(!isLoopEnabled)}
              audioTracks={audioTracks}
            />
          </div>
        </div>

        {/* 右側：控制面板 */}
        <div className="relative bg-gray-800 border-l border-gray-700 flex flex-col" style={{ width: `${rightPanelWidth}px` }}>
          {/* 左側調整寬度的把手 */}
          <div
            className="absolute top-0 left-0 bottom-0 w-1 bg-gray-700 hover:bg-blue-500 cursor-ew-resize transition-colors z-10"
            onMouseDown={handleRightPanelMouseDown}
          >
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-12 w-1 bg-gray-500 rounded-full"></div>
          </div>

          {/* 分頁切換 */}
          <div className="flex border-b border-gray-700 bg-gray-900/30">
            <button
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'optimization'
                ? 'bg-gray-800 text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              onClick={() => setActiveTab('optimization')}
            >
              關鍵幀優化
            </button>
            <button
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'shader'
                ? 'bg-gray-800 text-white border-b-2 border-purple-500'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              onClick={() => setActiveTab('shader')}
            >
              Material Shader
            </button>
            <button
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'audio'
                ? 'bg-gray-800 text-white border-b-2 border-green-500'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              onClick={() => setActiveTab('audio')}
            >
              Audio
            </button>
          </div>

          {/* 分頁內容 */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'optimization' && (
              <OptimizationControls
                fileName={file?.name || null}
                onFileUpload={handleFileUpload}
                tolerance={tolerance}
                setTolerance={setTolerance}
                originalKeyframeCount={countKeyframes(originalClip)}
                optimizedKeyframeCount={countKeyframes(optimizedClip)}
                onExport={handleExport}
                isExporting={exporting}
              />
            )}

            {activeTab === 'shader' && (
              <MaterialShaderTool
                fileName={file?.name || null}
                shaderGroups={shaderGroups}
                meshNames={meshNames}
                onGroupsChange={setShaderGroups}
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
