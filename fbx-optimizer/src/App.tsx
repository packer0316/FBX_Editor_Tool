import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';
import { TGALoader } from 'three/examples/jsm/loaders/TGALoader';
import SceneViewer, { type SceneViewerRef } from './components/SceneViewer';
import OptimizationControls from './components/OptimizationControls';
import MaterialShaderTool from './components/MaterialShaderTool';
import ModelInspector from './components/ModelInspector';
import { optimizeAnimationClip } from './utils/optimizer';
import { Loader2 } from 'lucide-react';
import type { ShaderFeature, ShaderGroup } from './types/shaderTypes';

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

  // 面板高度控制
  const [panelHeight, setPanelHeight] = useState(384); // 預設 384px (h-96)
  const [isDragging, setIsDragging] = useState(false);

  // 右側面板寬度控制
  const [rightPanelWidth, setRightPanelWidth] = useState(320); // 預設 320px (w-80)
  const [isResizingRight, setIsResizingRight] = useState(false);

  // 右側面板分頁
  const [activeTab, setActiveTab] = useState<'optimization' | 'shader'>('optimization');

  // Theme Mode
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');

  // Shader 功能狀態
  const [shaderGroups, setShaderGroups] = useState<ShaderGroup[]>([]);
  const [meshNames, setMeshNames] = useState<string[]>([]);

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

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

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
    setPlaylist(prev => [...prev, clip]);
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
      className="min-h-screen bg-gray-900 text-white flex flex-col"
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

          {/* Tool: Placeholder 1 */}
          <div className="group relative">
            <button className="p-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
              <div className="w-5 h-5 border-2 border-dashed border-gray-500 rounded"></div>
            </button>
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
              預留工具 1
            </div>
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
                loop={!isPlaylistPlaying}
                onFinish={handleClipFinish}
                backgroundColor={themeMode === 'dark' ? '#111827' : '#F5F5F5'}
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
