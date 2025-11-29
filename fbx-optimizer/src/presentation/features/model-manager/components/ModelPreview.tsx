import { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { Environment } from '@react-three/drei';
import { Maximize2, X, Grid3X3, GripHorizontal, Box } from 'lucide-react';
import type { ShaderGroup } from '../../../../domain/value-objects/ShaderFeature';

interface ModelPreviewProps {
  model: THREE.Group | null;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  visible: boolean;
  shaderGroups?: ShaderGroup[];
  isShaderEnabled?: boolean;
  toneMappingExposure?: number;
  environmentIntensity?: number;
  hdriUrl?: string;
}

// Scene Settings Controller (與主場景相同)
function SceneSettings({ toneMappingExposure, environmentIntensity }: { toneMappingExposure?: number, environmentIntensity?: number }) {
  const { gl, scene } = useThree();

  useEffect(() => {
    if (toneMappingExposure !== undefined) {
      gl.toneMappingExposure = toneMappingExposure;
    }
  }, [toneMappingExposure, gl]);

  useEffect(() => {
    if (environmentIntensity !== undefined) {
      if ('environmentIntensity' in scene) {
        (scene as any).environmentIntensity = environmentIntensity;
      }
    }
  }, [environmentIntensity, scene]);

  return null;
}

// 動畫同步組件 - 監聯主場景的動畫時間並更新克隆模型的動畫
function AnimationSync({
  mixer,
  originalModel
}: {
  mixer: THREE.AnimationMixer | null;
  originalModel: THREE.Group;
}) {
  const lastTimeRef = useRef(-1);

  useFrame(() => {
    if (!mixer) return;

    // 從原始模型獲取當前動畫時間
    // 原始模型的 userData 中存儲了 animationTime（由主場景更新）
    const currentTime = (originalModel as any).userData?.animationTime ?? 0;

    // 只有時間變化時才更新（避免不必要的計算）
    if (Math.abs(currentTime - lastTimeRef.current) > 0.001) {
      // 直接設置時間，確保完全同步
      mixer.setTime(currentTime);
      lastTimeRef.current = currentTime;
    }
  });

  return null;
}

// 模型渲染組件 - 使用克隆模型但同步原始模型的動畫
function ModelRenderer({
  model,
  position,
  rotation,
  scale,
}: {
  model: THREE.Group;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}) {
  const clonedModelRef = useRef<THREE.Group | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const [isReady, setIsReady] = useState(false);

  // 克隆模型並設置動畫
  useEffect(() => {
    // 深度克隆模型（包括骨骼）
    const cloned = model.clone(true);

    // 為 SkinnedMesh 重新綁定骨骼
    const skinnedMeshes: THREE.SkinnedMesh[] = [];
    const originalSkinnedMeshes: THREE.SkinnedMesh[] = [];

    model.traverse((child) => {
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
        originalSkinnedMeshes.push(child as THREE.SkinnedMesh);
      }
    });

    cloned.traverse((child) => {
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
        skinnedMeshes.push(child as THREE.SkinnedMesh);
      }
    });

    // 綁定骨骼到克隆的 mesh
    skinnedMeshes.forEach((mesh, idx) => {
      if (originalSkinnedMeshes[idx]) {
        const originalSkeleton = originalSkinnedMeshes[idx].skeleton;
        if (originalSkeleton) {
          // 在克隆模型中找到對應的骨骼
          const bones: THREE.Bone[] = [];
          originalSkeleton.bones.forEach((bone) => {
            const clonedBone = cloned.getObjectByName(bone.name) as THREE.Bone;
            if (clonedBone) {
              bones.push(clonedBone);
            }
          });

          if (bones.length > 0) {
            mesh.skeleton = new THREE.Skeleton(bones, originalSkeleton.boneInverses.map(m => m.clone()));
            mesh.bind(mesh.skeleton, mesh.bindMatrix.clone());
          }
        }
      }
    });

    clonedModelRef.current = cloned;

    // 創建動畫 Mixer
    const mixer = new THREE.AnimationMixer(cloned);
    mixerRef.current = mixer;

    // 載入原始模型的動畫
    if (model.animations && model.animations.length > 0) {
      model.animations.forEach((clip) => {
        const action = mixer.clipAction(clip);
        action.play();
      });
    }

    setIsReady(true);

    return () => {
      // 🔧 清理 AnimationMixer 快取（避免記憶體洩漏）
      if (mixerRef.current && clonedModelRef.current) {
        mixerRef.current.stopAllAction();
        // 清理整個克隆模型的快取
        mixerRef.current.uncacheRoot(clonedModelRef.current);
      }
      
      // 清理克隆模型的資源
      if (clonedModelRef.current) {
        clonedModelRef.current.traverse((child) => {
          if ((child as any).geometry) {
            (child as any).geometry.dispose();
          }
          if ((child as any).material) {
            const material = (child as any).material;
            if (Array.isArray(material)) {
              material.forEach(m => m.dispose());
            } else {
              material.dispose();
            }
          }
        });
      }
    };
  }, [model]);

  // 將度數轉換為弧度
  const rotationRad = rotation.map(deg => (deg * Math.PI) / 180) as [number, number, number];

  if (!isReady || !clonedModelRef.current) return null;

  return (
    <>
      <AnimationSync mixer={mixerRef.current} originalModel={model} />
      <group position={position} rotation={rotationRad} scale={scale}>
        <primitive object={clonedModelRef.current} scale={0.01} />
      </group>
    </>
  );
}

// 獨立相機控制組件
function IndependentCameraControls() {
  const controlsRef = useRef<any>(null);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={0.5}
      maxDistance={100}
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
    />
  );
}

// 格線組件
function PreviewGrid({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <Grid
      args={[20, 20]}
      cellSize={0.5}
      cellThickness={0.5}
      cellColor="#444444"
      sectionSize={2}
      sectionThickness={1}
      sectionColor="#666666"
      fadeDistance={30}
      fadeStrength={1}
      followCamera={false}
      infiniteGrid={false}
    />
  );
}

// 3D 預覽內容組件
function PreviewCanvas({
  model,
  position,
  rotation,
  scale,
  toneMappingExposure,
  environmentIntensity,
  hdriUrl,
  showGrid
}: {
  model: THREE.Group;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  toneMappingExposure?: number;
  environmentIntensity?: number;
  hdriUrl?: string;
  showGrid: boolean;
}) {
  // 計算模型的邊界盒來設置初始相機位置（正前方 45 度俯角）
  const initialCameraPosition = useCallback((): [number, number, number] => {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) * 0.01; // scale 0.01
    const distance = maxDim * 80; // 距離更遠

    // 相機位置：正前方 45 度俯角
    // 45 度俯角：Y 和 Z 相等時就是 45 度
    const height = distance * Math.sin(Math.PI / 4); // 45 度的高度
    const depth = distance * Math.cos(Math.PI / 4);  // 45 度的深度
    return [0, height, depth]; // 正前方 45 度俯角
  }, [model]);

  return (
    <Canvas
      camera={{
        position: initialCameraPosition(),
        fov: 50,
        near: 0.01,
        far: 1000
      }}
      gl={{
        preserveDrawingBuffer: true,
        antialias: true
      }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.LinearToneMapping;
        if (toneMappingExposure !== undefined) {
          gl.toneMappingExposure = toneMappingExposure;
        }
      }}
    >
      <IndependentCameraControls />
      <SceneSettings toneMappingExposure={toneMappingExposure} environmentIntensity={environmentIntensity} />

      {/* 環境光 */}
      {hdriUrl && <Environment files={hdriUrl} background={false} blur={0.5} />}
      <ambientLight intensity={0.8 * (environmentIntensity ?? 1.0)} />
      <hemisphereLight args={["#ffffff", "#444444", 0.6]} />

      {/* 方向光 */}
      <directionalLight position={[5, 10, 7.5]} intensity={1.2} />
      <directionalLight position={[-10, 5, -5]} intensity={0.6} />
      <directionalLight position={[0, -5, 0]} intensity={0.4} />

      {/* 格線 */}
      <PreviewGrid visible={showGrid} />

      <ModelRenderer
        model={model}
        position={position}
        rotation={rotation}
        scale={scale}
      />
    </Canvas>
  );
}

// 放大預覽 Modal 組件
function ExpandedPreviewModal({
  model,
  position,
  rotation,
  scale,
  toneMappingExposure,
  environmentIntensity,
  hdriUrl,
  showGrid,
  setShowGrid,
  onClose
}: {
  model: THREE.Group;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  toneMappingExposure?: number;
  environmentIntensity?: number;
  hdriUrl?: string;
  showGrid: boolean;
  setShowGrid: (v: boolean) => void;
  onClose: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);

  // 計算初始大小和位置（在主場景區域，避開右側工具列約 400px）
  const getInitialSize = useCallback(() => {
    const rightPanelWidth = 420; // 右側工具列寬度
    const availableWidth = window.innerWidth - rightPanelWidth;
    const width = Math.min(availableWidth * 0.85, 1200);
    const height = Math.min(window.innerHeight * 0.8, 800);
    return { width, height };
  }, []);

  // 視窗大小狀態
  const [modalSize, setModalSize] = useState(getInitialSize);


  // 拖動功能 - 使用 ref 直接操作 DOM 避免重新渲染
  const dragStateRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    rafId: 0
  });

  // 調整大小功能
  const resizeStateRef = useRef({
    isResizing: false,
    startX: 0,
    startY: 0,
    startWidth: modalSize.width,
    startHeight: modalSize.height
  });

  const updateModalPosition = useCallback(() => {
    if (modalRef.current) {
      modalRef.current.style.transform = `translate(calc(-50% + ${dragStateRef.current.currentX}px), calc(-50% + ${dragStateRef.current.currentY}px))`;
    }
  }, []);

  // 初始化位置
  useEffect(() => {
    updateModalPosition();
  }, [updateModalPosition]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStateRef.current.isDragging = true;
    dragStateRef.current.startX = e.clientX - dragStateRef.current.currentX;
    dragStateRef.current.startY = e.clientY - dragStateRef.current.currentY;

    if (modalRef.current) {
      modalRef.current.style.cursor = 'grabbing';
    }
  }, []);

  // 開始調整大小
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeStateRef.current.isResizing = true;
    resizeStateRef.current.startX = e.clientX;
    resizeStateRef.current.startY = e.clientY;
    resizeStateRef.current.startWidth = modalSize.width;
    resizeStateRef.current.startHeight = modalSize.height;
  }, [modalSize]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // 處理拖動
      if (dragStateRef.current.isDragging) {
        dragStateRef.current.currentX = e.clientX - dragStateRef.current.startX;
        dragStateRef.current.currentY = e.clientY - dragStateRef.current.startY;

        if (dragStateRef.current.rafId) {
          cancelAnimationFrame(dragStateRef.current.rafId);
        }
        dragStateRef.current.rafId = requestAnimationFrame(updateModalPosition);
      }

      // 處理調整大小
      if (resizeStateRef.current.isResizing) {
        const deltaX = e.clientX - resizeStateRef.current.startX;
        const deltaY = e.clientY - resizeStateRef.current.startY;

        // 同時調整寬度和高度，設置合理的最小和最大值
        setModalSize({
          width: Math.max(400, Math.min(window.innerWidth * 0.95, resizeStateRef.current.startWidth + deltaX)),
          height: Math.max(300, Math.min(window.innerHeight * 0.95, resizeStateRef.current.startHeight + deltaY))
        });
      }
    };

    const handleMouseUp = () => {
      dragStateRef.current.isDragging = false;
      resizeStateRef.current.isResizing = false;
      if (modalRef.current) {
        modalRef.current.style.cursor = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (dragStateRef.current.rafId) {
        cancelAnimationFrame(dragStateRef.current.rafId);
      }
    };
  }, [updateModalPosition]);

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] bg-black/40 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="fixed bg-gray-900 rounded-2xl border border-gray-600 overflow-hidden shadow-2xl will-change-transform flex flex-col"
        style={{
          width: modalSize.width,
          height: modalSize.height,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 標題列 - 可拖動 */}
        <div
          className="flex items-center justify-between px-4 py-3 bg-gray-800/90 border-b border-gray-700 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-3">
            <GripHorizontal className="w-4 h-4 text-gray-500" />
            <Box className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-bold text-white">模型預覽</h2>
          </div>

          <div className="flex items-center gap-2">
            {/* 格線開關 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowGrid(!showGrid);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className={`px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-2 text-xs ${showGrid
                ? 'bg-blue-500/90 text-white border-blue-400'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300 border-gray-600'
                }`}
              title={showGrid ? '隱藏格線' : '顯示格線'}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              {showGrid ? '格線開' : '格線關'}
            </button>

            {/* 關閉按鈕 */}
            <button
              onClick={onClose}
              onMouseDown={(e) => e.stopPropagation()}
              className="p-2 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors"
              title="關閉"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 3D 預覽區域 */}
        <div className="flex-1 relative">
          <PreviewCanvas
            model={model}
            position={position}
            rotation={rotation}
            scale={scale}
            toneMappingExposure={toneMappingExposure}
            environmentIntensity={environmentIntensity}
            hdriUrl={hdriUrl}
            showGrid={showGrid}
          />

          {/* 操作提示 */}
          <div className="absolute bottom-4 left-4 text-xs text-gray-400 bg-black/60 px-3 py-2 rounded-lg">
            🖱️ 左鍵旋轉 | 右鍵平移 | 滾輪縮放
          </div>

          {/* 視窗大小顯示 */}
          <div className="absolute bottom-4 right-16 text-[10px] text-gray-500 bg-black/40 px-2 py-1 rounded">
            {modalSize.width} × {modalSize.height}
          </div>
        </div>

        {/* 調整大小拖把 - 右下角 */}
        <div
          className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize group"
          onMouseDown={handleResizeStart}
        >
          <svg
            className="w-full h-full text-gray-500 group-hover:text-blue-400 transition-colors"
            viewBox="0 0 24 24"
          >
            <path fill="currentColor" d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM22 14H20V12H22V14ZM18 18H16V16H18V18ZM14 22H12V20H14V22Z" />
          </svg>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function ModelPreview({
  model,
  position,
  rotation,
  scale,
  visible,
  shaderGroups = [],
  isShaderEnabled = true,
  toneMappingExposure,
  environmentIntensity,
  hdriUrl
}: ModelPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showGrid, setShowGrid] = useState(true); // 預設顯示格線

  if (!model || !visible) {
    return (
      <div className="w-full h-32 bg-gray-900 rounded border border-gray-700 flex items-center justify-center">
        <span className="text-xs text-gray-500">
          {!visible ? '模型已隱藏' : '無預覽'}
        </span>
      </div>
    );
  }

  return (
    <>
      {/* 小預覽框 */}
      <div className="relative w-full h-32 bg-gray-900 rounded border border-gray-700 overflow-hidden group">
        <PreviewCanvas
          model={model}
          position={position}
          rotation={rotation}
          scale={scale}
          toneMappingExposure={toneMappingExposure}
          environmentIntensity={environmentIntensity}
          hdriUrl={hdriUrl}
          showGrid={showGrid}
        />

        {/* 右下角控制按鈕 */}
        <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
          {/* 格線開關 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowGrid(!showGrid);
            }}
            className={`p-1.5 rounded border transition-all ${showGrid
              ? 'bg-blue-500/80 text-white border-blue-400'
              : 'bg-gray-900/80 hover:bg-gray-800 text-gray-400 hover:text-white border-gray-600 hover:border-gray-500'
              }`}
            title={showGrid ? '隱藏格線' : '顯示格線'}
          >
            <Grid3X3 className="w-3 h-3" />
          </button>

          {/* 放大按鈕 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(true);
            }}
            className="p-1.5 bg-gray-900/80 hover:bg-gray-800 text-gray-400 hover:text-white rounded border border-gray-600 hover:border-gray-500 transition-all"
            title="放大預覽"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* 放大預覽 Modal */}
      {isExpanded && (
        <ExpandedPreviewModal
          model={model}
          position={position}
          rotation={rotation}
          scale={scale}
          toneMappingExposure={toneMappingExposure}
          environmentIntensity={environmentIntensity}
          hdriUrl={hdriUrl}
          showGrid={showGrid}
          setShowGrid={setShowGrid}
          onClose={() => setIsExpanded(false)}
        />
      )}
    </>
  );
}
