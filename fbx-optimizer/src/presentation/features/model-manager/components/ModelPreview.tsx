import { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Environment } from '@react-three/drei';
import { Maximize2, X } from 'lucide-react';
import { useCameraSync } from '../hooks/useCameraSync';
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

// 模型渲染組件
function ModelRenderer({ 
  model, 
  position, 
  rotation, 
  scale,
  shaderGroups = [],
  isShaderEnabled = true
}: { 
  model: THREE.Group; 
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  shaderGroups?: ShaderGroup[];
  isShaderEnabled?: boolean;
}) {
  const clonedModelRef = useRef<THREE.Group | null>(null);

  // 只在第一次掛載時克隆模型
  useEffect(() => {
    if (!clonedModelRef.current) {
      clonedModelRef.current = model.clone();
    }
    return () => {
      // 清理克隆的模型
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

  if (!clonedModelRef.current) return null;

  return (
    <group position={position} rotation={rotationRad} scale={scale}>
      <primitive object={clonedModelRef.current} scale={0.01} />
    </group>
  );
}

// 相機同步組件
function CameraSync() {
  const { camera } = useThree();
  const cameraState = useCameraSync();

  useFrame(() => {
    if (camera) {
      camera.position.set(...cameraState.position);
      camera.lookAt(...cameraState.target);
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.zoom = cameraState.zoom;
        camera.updateProjectionMatrix();
      }
    }
  });

  return null;
}

// 3D 預覽內容組件（可重用於小預覽和放大預覽）
function PreviewCanvas({ 
  model, 
  position, 
  rotation, 
  scale,
  shaderGroups = [],
  isShaderEnabled = true,
  toneMappingExposure,
  environmentIntensity,
  hdriUrl
}: {
  model: THREE.Group;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  shaderGroups?: ShaderGroup[];
  isShaderEnabled?: boolean;
  toneMappingExposure?: number;
  environmentIntensity?: number;
  hdriUrl?: string;
}) {
  const cameraState = useCameraSync();

  return (
    <Canvas
      camera={{ 
        position: cameraState.position, 
        fov: 50,
        near: 0.1,
        far: 1000
      }}
      gl={{ 
        preserveDrawingBuffer: true,
        antialias: true 
      }}
      onCreated={({ gl }) => {
        // 統一輸出色彩空間為 sRGB (與主場景相同)
        gl.outputColorSpace = THREE.SRGBColorSpace;
        // 設定 ACES Filmic Tone Mapping (與主場景相同)
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        if (toneMappingExposure !== undefined) {
          gl.toneMappingExposure = toneMappingExposure;
        }
      }}
    >
      <CameraSync />
      <SceneSettings toneMappingExposure={toneMappingExposure} environmentIntensity={environmentIntensity} />
      
      {/* 環境光 (與主場景相同) */}
      {hdriUrl && <Environment files={hdriUrl} background={false} blur={0.5} />}
      <ambientLight intensity={0.8 * (environmentIntensity ?? 1.0)} />
      <hemisphereLight args={["#ffffff", "#444444", 0.6]} />
      
      {/* 方向光 (與主場景相同) */}
      <directionalLight
        position={[5, 10, 7.5]}
        intensity={1.2}
      />
      <directionalLight position={[-10, 5, -5]} intensity={0.6} />
      <directionalLight position={[0, -5, 0]} intensity={0.4} />
      
      <ModelRenderer 
        model={model} 
        position={position}
        rotation={rotation}
        scale={scale}
        shaderGroups={shaderGroups}
        isShaderEnabled={isShaderEnabled}
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
          shaderGroups={shaderGroups}
          isShaderEnabled={isShaderEnabled}
          toneMappingExposure={toneMappingExposure}
          environmentIntensity={environmentIntensity}
          hdriUrl={hdriUrl}
        />
        
        {/* 放大按鈕 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(true);
          }}
          className="absolute bottom-2 right-2 p-1.5 bg-gray-900/80 hover:bg-gray-800 text-gray-400 hover:text-white rounded border border-gray-600 hover:border-gray-500 opacity-0 group-hover:opacity-100 transition-all"
          title="放大預覽"
        >
          <Maximize2 className="w-3 h-3" />
        </button>
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
            {/* 關閉按鈕 */}
            <button
              onClick={() => setIsExpanded(false)}
              className="absolute top-4 right-4 z-10 p-2 bg-gray-900/90 hover:bg-gray-800 text-gray-400 hover:text-white rounded-lg border border-gray-600 hover:border-gray-500 transition-colors"
              title="關閉"
            >
              <X className="w-5 h-5" />
            </button>

            {/* 放大的預覽 */}
            <PreviewCanvas
              model={model}
              position={position}
              rotation={rotation}
              scale={scale}
              shaderGroups={shaderGroups}
              isShaderEnabled={isShaderEnabled}
              toneMappingExposure={toneMappingExposure}
              environmentIntensity={environmentIntensity}
              hdriUrl={hdriUrl}
            />
          </div>
        </div>
      )}
    </>
  );
}

