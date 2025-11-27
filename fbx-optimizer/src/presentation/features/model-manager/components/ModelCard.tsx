import { useState, useMemo } from 'react';
import { Trash2, Edit2, Check, X, Package, Eye, EyeOff, ChevronDown, ChevronRight, Sliders, RotateCw, Orbit, Image, Info } from 'lucide-react';
import * as THREE from 'three';
import { NumberInput } from '../../../../components/ui/NumberInput';
import type { ModelInstance } from '../../../../domain/value-objects/ModelInstance';
import ModelPreview from './ModelPreview';
import TextureManagerModal from './TextureManagerModal';
import type { ThemeStyle } from '../../../../presentation/hooks/useTheme';

/**
 * 計算模型資訊
 * 注意：Polys 無法準確計算，因為 FBX 導入後所有多邊形都轉換成三角面
 */
function calculateModelInfo(model: THREE.Group | null) {
  if (!model) {
    return { boneCount: 0, triangleCount: 0, vertexCount: 0, drawCallCount: 0 };
  }

  const boneSet = new Set<THREE.Bone>();
  let triangleCount = 0;
  let drawCallCount = 0;
  
  // 使用 Set 來收集唯一頂點位置
  const uniqueVertices = new Set<string>();

  model.traverse((child) => {
    // 計算骨骼（從兩個來源）
    if (child.type === 'Bone' || (child as any).isBone) {
      boneSet.add(child as THREE.Bone);
    }
    if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
      const skinnedMesh = child as THREE.SkinnedMesh;
      if (skinnedMesh.skeleton && skinnedMesh.skeleton.bones) {
        skinnedMesh.skeleton.bones.forEach((bone) => {
          boneSet.add(bone);
        });
      }
    }

    // 計算三角面和頂點
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      const geometry = mesh.geometry;
      
      if (geometry) {
        const positions = geometry.attributes.position;
        if (positions) {
          // 計算唯一頂點位置
          const posArray = positions.array;
          for (let i = 0; i < positions.count; i++) {
            const idx = i * 3;
            uniqueVertices.add(`${posArray[idx]}|${posArray[idx + 1]}|${posArray[idx + 2]}`);
          }
        }
        
        // 三角面數量
        if (geometry.index) {
          triangleCount += geometry.index.count / 3;
        } else if (geometry.attributes.position) {
          triangleCount += geometry.attributes.position.count / 3;
        }
      }
      
      // DrawCall 計算
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      drawCallCount += materials.length;
    }
  });

  return {
    boneCount: boneSet.size,
    triangleCount: Math.floor(triangleCount),
    vertexCount: uniqueVertices.size,
    drawCallCount
  };
}

interface ModelCardProps {
  modelInstance: ModelInstance;
  isActive: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onRename: (newName: string) => void;
  onUpdateTransform: (updates: {
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: [number, number, number];
    visible?: boolean;
    isCameraOrbiting?: boolean;
    cameraOrbitSpeed?: number;
    isModelRotating?: boolean;
    modelRotationSpeed?: number;
  }) => void;
  // 場景設置參數
  toneMappingExposure?: number;
  environmentIntensity?: number;
  hdriUrl?: string;
  theme: ThemeStyle;
}

export default function ModelCard({
  modelInstance,
  isActive,
  onSelect,
  onRemove,
  onRename,
  onUpdateTransform,
  toneMappingExposure,
  environmentIntensity,
  hdriUrl,
  theme
}: ModelCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(modelInstance.name);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTextureManager, setShowTextureManager] = useState(false);
  const [showModelInfo, setShowModelInfo] = useState(false);
  
  // 計算模型資訊
  const modelInfo = useMemo(() => calculateModelInfo(modelInstance.model), [modelInstance.model]);
  
  // 滑動條顯示狀態：position-x, position-y, position-z, rotation-x, rotation-y, rotation-z
  const [showSlider, setShowSlider] = useState<{
    positionX: boolean;
    positionY: boolean;
    positionZ: boolean;
    rotationX: boolean;
    rotationY: boolean;
    rotationZ: boolean;
  }>({
    positionX: false,
    positionY: false,
    positionZ: false,
    rotationX: false,
    rotationY: false,
    rotationZ: false,
  });

  const handleRename = () => {
    if (editName.trim() && editName !== modelInstance.name) {
      onRename(editName.trim());
    } else {
      setEditName(modelInstance.name);
    }
    setIsEditing(false);
  };

  const handleCancelRename = () => {
    setEditName(modelInstance.name);
    setIsEditing(false);
  };

  return (
    <div
      className={`rounded-xl transition-all cursor-pointer overflow-hidden ${isActive
        ? 'border-2 border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/30'
        : `${theme.panelBg} border ${theme.panelBorder} hover:border-gray-500`
        }`}
      onClick={onSelect}
    >
      {/* 標題列 */}
      <div className={`flex items-center gap-2 p-3 ${theme.toolbarBg} border-b ${theme.toolbarBorder}`}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
        >
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        <Package className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-400' : 'text-gray-400'}`} />

        {isEditing ? (
          <div className="flex-1 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') handleCancelRename();
              }}
              className="flex-1 px-2 py-1 text-sm bg-black/40 text-gray-100 rounded border border-white/15 focus:border-blue-500 focus:outline-none"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRename();
              }}
              className="p-1 text-green-400 hover:bg-gray-700 rounded"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCancelRename();
              }}
              className="p-1 text-red-400 hover:bg-gray-700 rounded"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <>
            <span className={`flex-1 text-sm font-medium truncate ${isActive ? 'text-blue-300' : theme.text}`}>
              {modelInstance.name}
            </span>

            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowModelInfo(true);
                }}
                className="p-1 text-gray-400 hover:text-cyan-400 hover:bg-gray-700 rounded transition-colors"
                title="模型資訊"
              >
                <Info className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                className="p-1 text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded transition-colors"
                title="重新命名"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateTransform({ visible: !modelInstance.visible });
                }}
                className={`p-1 rounded transition-colors ${modelInstance.visible
                  ? 'text-green-400 hover:bg-gray-700'
                  : 'text-gray-500 hover:text-red-400 hover:bg-gray-700'
                  }`}
                title={modelInstance.visible ? '隱藏' : '顯示'}
              >
                {modelInstance.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`確定要刪除模型「${modelInstance.name}」嗎？`)) {
                    onRemove();
                  }
                }}
                className="p-1 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
                title="刪除模型"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Transform 控制面板（展開時顯示） */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
          {/* 3D 預覽 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-400">模型預覽</label>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTextureManager(true);
                }}
                className="p-1.5 rounded transition-all bg-green-500/30 text-green-300 hover:bg-green-500/50 hover:text-white flex items-center gap-1"
                title="管理貼圖"
              >
                <Image className="w-3 h-3" />
                <span className="text-[10px]">貼圖</span>
              </button>
            </div>
            <ModelPreview
              model={modelInstance.model}
              position={modelInstance.position}
              rotation={modelInstance.rotation}
              scale={modelInstance.scale}
              visible={modelInstance.visible}
              shaderGroups={modelInstance.shaderGroups}
              isShaderEnabled={modelInstance.isShaderEnabled}
              toneMappingExposure={toneMappingExposure}
              environmentIntensity={environmentIntensity}
              hdriUrl={hdriUrl}
            />
          </div>



          {/* Position */}
          <div className="space-y-1">
            <label className="text-xs text-gray-400">位置 (Position)</label>
            <div className="grid grid-cols-3 gap-2">
              {(['x', 'y', 'z'] as const).map((axis, idx) => {
                const sliderKey = `position${axis.toUpperCase()}` as keyof typeof showSlider;
                const isSliderVisible = showSlider[sliderKey];
                
                return (
                  <div key={axis} className="flex flex-col">
                    <span className="text-[10px] text-gray-500 mb-1">{axis.toUpperCase()}</span>
                    <div className="flex items-center gap-1">
                      <NumberInput
                        value={modelInstance.position[idx].toFixed(2)}
                        onChange={(val) => {
                          const value = parseFloat(val) || 0;
                          const newPosition: [number, number, number] = [...modelInstance.position];
                          newPosition[idx] = value;
                          onUpdateTransform({ position: newPosition });
                        }}
                        className="flex-1 bg-black/40 rounded border border-white/15 focus-within:border-blue-500"
                        step={0.1}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowSlider(prev => ({ ...prev, [sliderKey]: !prev[sliderKey] }));
                        }}
                        className={`p-1.5 rounded transition-all ${
                          isSliderVisible 
                            ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' 
                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
                        title="使用滑動條調整"
                      >
                        <Sliders className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Position Sliders - 跨越整行 */}
            {(['x', 'y', 'z'] as const).map((axis, idx) => {
              const sliderKey = `position${axis.toUpperCase()}` as keyof typeof showSlider;
              const isSliderVisible = showSlider[sliderKey];
              
              return isSliderVisible && (
                <div key={`slider-${axis}`} className="pt-1" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[10px] text-gray-400 font-mono w-3">{axis.toUpperCase()}</span>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      step="0.05"
                      value={modelInstance.position[idx]}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        const newPosition: [number, number, number] = [...modelInstance.position];
                        newPosition[idx] = value;
                        onUpdateTransform({ position: newPosition });
                      }}
                      className="flex-1 h-1 slider-blue-track appearance-none cursor-pointer rounded-full"
                    />
                    <span className="text-[10px] text-neon-blue font-mono w-12 text-right">{modelInstance.position[idx].toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rotation */}
          <div className="space-y-1">
            <label className="text-xs text-gray-400">旋轉 (Rotation) - 度數</label>
            <div className="grid grid-cols-3 gap-2">
              {(['x', 'y', 'z'] as const).map((axis, idx) => {
                const sliderKey = `rotation${axis.toUpperCase()}` as keyof typeof showSlider;
                const isSliderVisible = showSlider[sliderKey];
                
                return (
                  <div key={axis} className="flex flex-col">
                    <span className="text-[10px] text-gray-500 mb-1">{axis.toUpperCase()}</span>
                    <div className="flex items-center gap-1">
                      <NumberInput
                        value={modelInstance.rotation[idx].toFixed(1)}
                        onChange={(val) => {
                          const value = parseFloat(val) || 0;
                          const newRotation: [number, number, number] = [...modelInstance.rotation];
                          newRotation[idx] = value;
                          onUpdateTransform({ rotation: newRotation });
                        }}
                        className="flex-1 bg-black/40 rounded border border-white/15 focus-within:border-blue-500"
                        step={1}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowSlider(prev => ({ ...prev, [sliderKey]: !prev[sliderKey] }));
                        }}
                        className={`p-1.5 rounded transition-all ${
                          isSliderVisible 
                            ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' 
                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
                        title="使用滑動條調整"
                      >
                        <Sliders className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Rotation Sliders - 跨越整行 */}
            {(['x', 'y', 'z'] as const).map((axis, idx) => {
              const sliderKey = `rotation${axis.toUpperCase()}` as keyof typeof showSlider;
              const isSliderVisible = showSlider[sliderKey];
              
              return isSliderVisible && (
                <div key={`slider-${axis}`} className="pt-1" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[10px] text-gray-400 font-mono w-3">{axis.toUpperCase()}</span>
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      step="0.5"
                      value={modelInstance.rotation[idx]}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        const newRotation: [number, number, number] = [...modelInstance.rotation];
                        newRotation[idx] = value;
                        onUpdateTransform({ rotation: newRotation });
                      }}
                      className="flex-1 h-1 slider-blue-track appearance-none cursor-pointer rounded-full"
                    />
                    <span className="text-[10px] text-neon-blue font-mono w-12 text-right">{modelInstance.rotation[idx].toFixed(1)}°</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scale */}
          <div className="space-y-1">
            <label className="text-xs text-gray-400">縮放 (Scale) - 等比</label>
            <NumberInput
              value={modelInstance.scale[0].toFixed(2)}
              onChange={(val) => {
                const value = parseFloat(val);
                if (!isNaN(value)) {
                  onUpdateTransform({ scale: [value, value, value] });
                }
              }}
              className="w-full bg-black/40 rounded border border-white/15 focus-within:border-blue-500"
              step={0.01}
              min={0.01}
            />
          </div>

          {/* 相機公轉 */}
          <div className="space-y-1 pt-2 border-t border-white/5">
            <label className="text-xs text-gray-400">相機公轉 (Camera Orbit)</label>
            <div className="flex items-center gap-2">
              <NumberInput
                value={modelInstance.cameraOrbitSpeed.toFixed(0)}
                onChange={(val) => {
                  const value = parseFloat(val);
                  if (!isNaN(value)) {
                    onUpdateTransform({ cameraOrbitSpeed: value });
                  }
                }}
                className="flex-1 bg-black/40 rounded border border-white/15 focus-within:border-blue-500"
                step={5}
                min={0}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateTransform({ isCameraOrbiting: !modelInstance.isCameraOrbiting });
                }}
                className={`px-3 py-2 rounded transition-all flex items-center gap-1 text-xs font-medium ${
                  modelInstance.isCameraOrbiting
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30 animate-pulse'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
                title={modelInstance.isCameraOrbiting ? '停止公轉' : '開始公轉'}
              >
                <Orbit className={`w-3.5 h-3.5 ${modelInstance.isCameraOrbiting ? 'animate-spin' : ''}`} />
                {modelInstance.isCameraOrbiting ? '運行中' : '公轉'}
              </button>
            </div>
            <div className="text-[10px] text-gray-500">速度：{modelInstance.cameraOrbitSpeed}°/秒</div>
          </div>

          {/* 模型自轉 */}
          <div className="space-y-1 pt-2 border-t border-white/5">
            <label className="text-xs text-gray-400">模型自轉 (Model Rotation)</label>
            <div className="flex items-center gap-2">
              <NumberInput
                value={modelInstance.modelRotationSpeed.toFixed(0)}
                onChange={(val) => {
                  const value = parseFloat(val);
                  if (!isNaN(value)) {
                    onUpdateTransform({ modelRotationSpeed: value });
                  }
                }}
                className="flex-1 bg-black/40 rounded border border-white/15 focus-within:border-blue-500"
                step={5}
                min={0}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateTransform({ isModelRotating: !modelInstance.isModelRotating });
                }}
                className={`px-3 py-2 rounded transition-all flex items-center gap-1 text-xs font-medium ${
                  modelInstance.isModelRotating
                    ? 'bg-green-500 text-white shadow-lg shadow-green-500/30 animate-pulse'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
                title={modelInstance.isModelRotating ? '停止自轉' : '開始自轉'}
              >
                <RotateCw className={`w-3.5 h-3.5 ${modelInstance.isModelRotating ? 'animate-spin' : ''}`} />
                {modelInstance.isModelRotating ? '運行中' : '自轉'}
              </button>
            </div>
            <div className="text-[10px] text-gray-500">速度：{modelInstance.modelRotationSpeed}°/秒</div>
          </div>
        </div>
      )}

      {/* 貼圖管理彈出視窗 */}
      {showTextureManager && (
        <TextureManagerModal
          model={modelInstance.model}
          onClose={() => setShowTextureManager(false)}
          theme={theme}
        />
      )}

      {/* 模型資訊彈出視窗 */}
      {showModelInfo && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowModelInfo(false)}
        >
          <div
            className={`relative w-[320px] ${theme.panelBg} border ${theme.panelBorder} rounded-2xl shadow-2xl overflow-hidden`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 標題列 */}
            <div className={`flex items-center justify-between px-5 py-4 border-b ${theme.panelBorder} ${theme.toolbarBg}`}>
              <div className="flex items-center gap-3">
                <Info className="w-5 h-5 text-cyan-400" />
                <h2 className={`text-base font-bold ${theme.text}`}>模型資訊</h2>
              </div>
              <button
                onClick={() => setShowModelInfo(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                title="關閉"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* 資訊內容 */}
            <div className="p-5 space-y-4">
              {/* 模型名稱 */}
              <div className="text-center pb-3 border-b border-white/10">
                <div className="text-xs text-gray-400 mb-1">模型名稱</div>
                <div className={`text-lg font-semibold ${theme.text}`}>{modelInstance.name}</div>
              </div>

              {/* 幾何資訊 - Tris / Verts */}
              <div className="space-y-2">
                <div className="text-xs text-gray-400 uppercase tracking-wider">Geometry</div>
                <div className="bg-black/30 rounded-xl p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Tris</span>
                    <span className="text-lg font-bold text-blue-300">{modelInfo.triangleCount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Verts</span>
                    <span className="text-lg font-bold text-green-300">{modelInfo.vertexCount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* 骨骼與渲染資訊 */}
              <div className="grid grid-cols-2 gap-3">
                {/* 骨骼數量 */}
                <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-purple-300">{modelInfo.boneCount.toLocaleString()}</div>
                  <div className="text-xs text-purple-400 mt-1">Bones</div>
                </div>

                {/* DrawCall */}
                <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-orange-300">{modelInfo.drawCallCount.toLocaleString()}</div>
                  <div className="text-xs text-orange-400 mt-1">DrawCall</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

