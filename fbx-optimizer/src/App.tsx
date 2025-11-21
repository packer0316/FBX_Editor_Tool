import React, { useState, useEffect } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';
import { TGALoader } from 'three/examples/jsm/loaders/TGALoader';
import SceneViewer from './components/SceneViewer';
import OptimizationControls from './components/OptimizationControls';
import { optimizeAnimationClip } from './utils/optimizer';
import { Loader2 } from 'lucide-react';

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [originalClip, setOriginalClip] = useState<THREE.AnimationClip | null>(null);
  const [optimizedClip, setOptimizedClip] = useState<THREE.AnimationClip | null>(null);
  const [tolerance, setTolerance] = useState<number>(0.01);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);

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
        console.log(`[Texture Request] Original URL: ${url}`);

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

        console.log(`[Texture Request] Extracted FileName: ${fileName}`);

        // 3. 在上傳的檔案中尋找
        if (textureFiles.has(fileName)) {
          const textureFile = textureFiles.get(fileName)!;
          const blobUrl = URL.createObjectURL(textureFile);
          console.log(`[Texture Match] Found: ${fileName} -> ${blobUrl}`);
          return blobUrl;
        }

        console.warn(`[Texture Missing] Could not find: ${fileName}`);
        console.warn(`[Available Textures]:`, Array.from(textureFiles.keys()));

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

          console.log(`[Mesh: ${mesh.name}] Material:`, material);

          if (material) {
            // 1. 關閉頂點顏色 (Vertex Colors)
            // 很多 FBX 模型會帶有頂點顏色 (通常是黑色或用作遮罩)，這會導致模型在 Three.js 中變黑
            material.vertexColors = false;

            // 2. 確保有貼圖時，基礎顏色是白色的
            if (material.map) {
              console.log(`  - Has Texture: ${material.map.name || 'Unnamed'}`);
              material.color.setHex(0xffffff);

              // 確保貼圖編碼正確
              material.map.colorSpace = THREE.SRGBColorSpace;
            }

            // 3. 嘗試修復全黑問題：如果沒有貼圖，給一個預設顏色
            if (!material.map && material.color.getHex() === 0x000000) {
              console.warn(`  - Black color detected without texture. Resetting to gray.`);
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

      setModel(object);

      if (object.animations && object.animations.length > 0) {
        const clip = object.animations[0];
        setOriginalClip(clip);
        setOptimizedClip(optimizeAnimationClip(clip, tolerance));
      } else {
        setOriginalClip(null);
        setOptimizedClip(null);
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
      // 使用 setTimeout 避免卡頓 UI
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


  // 拖曳狀態
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // 只有當離開整個視窗時才取消 (簡單實作，可能會在子元素間閃爍，但通常足夠)
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  return (
    <div
      className="flex h-screen w-screen bg-gray-950 text-white overflow-hidden relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 拖曳提示遮罩 */}
      {isDragging && (
        <div className="absolute inset-0 z-[100] bg-blue-500/20 border-4 border-blue-500 border-dashed m-4 rounded-xl flex items-center justify-center backdrop-blur-sm pointer-events-none">
          <div className="text-center p-10 bg-gray-900/90 rounded-2xl shadow-2xl border border-blue-500/50">
            <div className="text-6xl mb-4">📂</div>
            <h2 className="text-3xl font-bold text-blue-400 mb-2">釋放檔案以載入</h2>
            <p className="text-gray-400">支援 FBX 模型與貼圖檔案</p>
          </div>
        </div>
      )}

      {/* 左側：3D 預覽區 */}
      <div className="flex-1 relative pointer-events-none">
        {/* 恢復 SceneViewer 的互動能力 */}
        <div className="absolute inset-0 pointer-events-auto">
          <SceneViewer
            model={model}
            playingClip={optimizedClip} // 總是播放優化後的動畫以供預覽
          />
        </div>

        {/* 載入中遮罩 */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-50">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-2" />
            <span className="text-blue-400 font-medium">讀取模型中...</span>
          </div>
        )}

        {/* 導出中遮罩 */}
        {exporting && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-50">
            <Loader2 className="w-10 h-10 text-green-500 animate-spin mb-2" />
            <span className="text-green-400 font-medium">正在導出 FBX...</span>
          </div>
        )}

        {/* 浮水印/標題 */}
        <div className="absolute top-6 left-6 pointer-events-none">
          <h1 className="text-2xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 drop-shadow-lg">
            FBX OPTIMIZER
          </h1>
          <p className="text-xs text-gray-500 font-mono mt-1">AI-POWERED KEYFRAME REDUCTION</p>
        </div>
      </div>

      {/* 右側：控制面板 */}
      <div className="w-auto h-full bg-gray-900 border-l border-gray-800 flex flex-col items-center justify-center p-4 z-10">
        <OptimizationControls
          onFileUpload={handleFileUpload}
          tolerance={tolerance}
          setTolerance={setTolerance}
          originalKeyframeCount={countKeyframes(originalClip)}
          optimizedKeyframeCount={countKeyframes(optimizedClip)}
          onExport={handleExport}
          fileName={file?.name || null}
        />

        <div className="mt-8 text-center opacity-30 hover:opacity-100 transition-opacity">
          <p className="text-[10px] text-gray-400">
            Designed for Game Developers
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
