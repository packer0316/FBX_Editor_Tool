import { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { Environment } from '@react-three/drei';
import { Maximize2, X, Grid3X3 } from 'lucide-react';
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
      // 清理
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
      }
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
  // 計算模型的邊界盒來設置初始相機位置
  const initialCameraPosition = useCallback((): [number, number, number] => {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) * 0.01; // scale 0.01
    const distance = maxDim * 2.5;
    return [distance * 0.7, distance * 0.5, distance * 0.7];
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
        gl.toneMapping = THREE.ACESFilmicToneMapping;
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
  const [showGrid, setShowGrid] = useState(false);

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
            className={`p-1.5 rounded border transition-all ${
              showGrid 
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
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setIsExpanded(false)}
        >
          <div 
            className="relative w-[90vw] h-[90vh] bg-gray-900 rounded-lg border border-gray-700 overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 頂部控制列 */}
            <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
              {/* 格線開關 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowGrid(!showGrid);
                }}
                className={`p-2 rounded-lg border transition-colors flex items-center gap-2 ${
                  showGrid 
                    ? 'bg-blue-500/90 text-white border-blue-400' 
                    : 'bg-gray-900/90 hover:bg-gray-800 text-gray-400 hover:text-white border-gray-600 hover:border-gray-500'
                }`}
                title={showGrid ? '隱藏格線' : '顯示格線'}
              >
                <Grid3X3 className="w-4 h-4" />
                <span className="text-xs">{showGrid ? '格線開' : '格線關'}</span>
              </button>
              
              {/* 關閉按鈕 */}
              <button
                onClick={() => setIsExpanded(false)}
                className="p-2 bg-gray-900/90 hover:bg-gray-800 text-gray-400 hover:text-white rounded-lg border border-gray-600 hover:border-gray-500 transition-colors"
                title="關閉"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 放大的預覽 */}
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
            <div className="absolute bottom-4 left-4 text-xs text-gray-500 bg-black/50 px-3 py-2 rounded">
              🖱️ 左鍵拖曳旋轉 | 右鍵拖曳平移 | 滾輪縮放
            </div>
          </div>
        </div>
      )}
    </>
  );
}
