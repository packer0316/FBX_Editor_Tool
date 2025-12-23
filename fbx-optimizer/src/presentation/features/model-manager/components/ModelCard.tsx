import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, Edit2, Check, X, Package, Eye, EyeOff, ChevronDown, ChevronRight, Sliders, RotateCw, Orbit, Image, Info, Move3d, Grid3x3, Focus, Bookmark, Plus } from 'lucide-react';
import * as THREE from 'three';
import { NumberInput } from '../../../../components/ui/NumberInput';
import type { ModelInstance } from '../../../../domain/value-objects/ModelInstance';
import type { ViewSnapshot } from '../../../../domain/value-objects/ViewSnapshot';
import type { TransformSnapshot } from '../../../../domain/value-objects/TransformSnapshot';
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
    showTransformGizmo?: boolean;
    showWireframe?: boolean;
    opacity?: number;
    isCameraOrbiting?: boolean;
    cameraOrbitSpeed?: number;
    isModelRotating?: boolean;
    modelRotationSpeed?: number;
  }) => void;
  /** 聚焦相機到此模型 */
  onFocusModel?: () => void;
  /** 保存視圖快照 */
  onSaveSnapshot?: (name: string) => void;
  /** 套用視圖快照 */
  onApplySnapshot?: (snapshot: ViewSnapshot) => void;
  /** 刪除視圖快照 */
  onDeleteSnapshot?: (snapshotId: string) => void;
  /** 重命名視圖快照 */
  onRenameSnapshot?: (snapshotId: string, newName: string) => void;
  /** 保存 Transform 快照 */
  onSaveTransformSnapshot?: (name: string) => void;
  /** 套用 Transform 快照 */
  onApplyTransformSnapshot?: (snapshot: TransformSnapshot) => void;
  /** 刪除 Transform 快照 */
  onDeleteTransformSnapshot?: (snapshotId: string) => void;
  /** 重命名 Transform 快照 */
  onRenameTransformSnapshot?: (snapshotId: string, newName: string) => void;
  /** 是否為導演模式 */
  isDirectorMode?: boolean;
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
  onFocusModel,
  onSaveSnapshot,
  onApplySnapshot,
  onDeleteSnapshot,
  onRenameSnapshot,
  onSaveTransformSnapshot,
  onApplyTransformSnapshot,
  onDeleteTransformSnapshot,
  onRenameTransformSnapshot,
  isDirectorMode = false,
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
  
  // 視圖快照相關狀態
  const [showSnapshotDropdown, setShowSnapshotDropdown] = useState(false);
  const [editingSnapshotId, setEditingSnapshotId] = useState<string | null>(null);
  const [editingSnapshotName, setEditingSnapshotName] = useState('');
  const snapshotDropdownRef = useRef<HTMLDivElement>(null);
  
  // Tooltip 狀態
  const [hoveredSnapshotId, setHoveredSnapshotId] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  
  // Transform 快照相關狀態
  const [showTransformDropdown, setShowTransformDropdown] = useState(false);
  const [editingTransformId, setEditingTransformId] = useState<string | null>(null);
  const [editingTransformName, setEditingTransformName] = useState('');
  const transformDropdownRef = useRef<HTMLDivElement>(null);
  
  // 點擊外部關閉下拉選單
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (snapshotDropdownRef.current && !snapshotDropdownRef.current.contains(event.target as Node)) {
        setShowSnapshotDropdown(false);
        setEditingSnapshotId(null);
        setHoveredSnapshotId(null);
        setTooltipPosition(null);
      }
    };
    
    if (showSnapshotDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSnapshotDropdown]);
  
  // 點擊外部關閉 Transform 下拉選單
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (transformDropdownRef.current && !transformDropdownRef.current.contains(event.target as Node)) {
        setShowTransformDropdown(false);
        setEditingTransformId(null);
      }
    };
    
    if (showTransformDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTransformDropdown]);
  
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
              {onFocusModel && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFocusModel();
                  }}
                  className="p-1 text-gray-400 hover:text-yellow-400 hover:bg-gray-700 rounded transition-colors"
                  title="聚焦相機到此模型"
                >
                  <Focus className="w-3 h-3" />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateTransform({ showTransformGizmo: !modelInstance.showTransformGizmo });
                }}
                className={`p-1 rounded transition-colors ${
                  isActive && modelInstance.showTransformGizmo
                    ? 'text-orange-400 hover:bg-gray-700'
                    : 'text-gray-400 hover:text-orange-400 hover:bg-gray-700'
                }`}
                title={modelInstance.showTransformGizmo ? '隱藏三軸控制器' : '顯示三軸控制器'}
              >
                <Move3d className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateTransform({ showWireframe: !modelInstance.showWireframe });
                }}
                className={`p-1 rounded transition-colors ${
                  modelInstance.showWireframe
                    ? 'text-purple-400 hover:bg-gray-700'
                    : 'text-gray-400 hover:text-purple-400 hover:bg-gray-700'
                }`}
                title={modelInstance.showWireframe ? '隱藏線框' : '顯示線框'}
              >
                <Grid3x3 className="w-3 h-3" />
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
          {/* 貼圖管理 & 視圖快照按鈕 */}
          <div className="flex justify-start gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowTextureManager(true);
              }}
              className="p-1.5 rounded transition-all bg-green-500/30 text-green-300 hover:bg-green-500/50 hover:text-white flex items-center gap-1"
              title="管理貼圖"
            >
              <Image className="w-3 h-3" />
              <span className="text-[10px]">貼圖管理</span>
            </button>
            
            {/* 視圖快照下拉選單 */}
            <div className="relative" ref={snapshotDropdownRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isDirectorMode) {
                    setShowSnapshotDropdown(!showSnapshotDropdown);
                  }
                }}
                disabled={isDirectorMode}
                className={`p-1.5 rounded transition-all flex items-center gap-1 ${
                  isDirectorMode 
                    ? 'bg-gray-500/20 text-gray-500 cursor-not-allowed' 
                    : showSnapshotDropdown
                      ? 'bg-amber-500/50 text-white'
                      : 'bg-amber-500/30 text-amber-300 hover:bg-amber-500/50 hover:text-white'
                }`}
                title={isDirectorMode ? '導演模式下無法使用視圖快照' : '視圖快照'}
              >
                <Bookmark className="w-3 h-3" />
                <span className="text-[10px]">視圖快照</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showSnapshotDropdown ? 'rotate-180' : ''}`} />
                {modelInstance.viewSnapshots.length > 0 && (
                  <span className="ml-0.5 text-[9px] bg-amber-500/50 px-1 rounded">
                    {modelInstance.viewSnapshots.length}
                  </span>
                )}
              </button>
              
              {/* 下拉選單內容 */}
              {showSnapshotDropdown && !isDirectorMode && (
                <div className={`absolute top-full left-0 mt-1 w-56 ${theme.panelBg} border ${theme.panelBorder} rounded-lg shadow-xl z-50 overflow-hidden`}>
                  {/* 新增快照按鈕 */}
                  <button
                    onClick={() => {
                      // 直接拍下快照，使用預設名稱「幀數: xxxx」
                      const frameNumber = Math.round(modelInstance.currentTime * 30);
                      onSaveSnapshot?.(`幀數: ${frameNumber}`);
                      setHoveredSnapshotId(null);
                      setTooltipPosition(null);
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-amber-300 hover:bg-amber-500/20 flex items-center gap-2 border-b border-gray-700/50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    新增快照
                  </button>
                  
                  {/* 快照列表 */}
                  <div 
                    className="max-h-48 overflow-y-auto custom-scrollbar"
                    onClick={() => {
                      // 點擊列表區域時關閉 tooltip（Info 按鈕有 stopPropagation 所以不會觸發這個）
                      setHoveredSnapshotId(null);
                      setTooltipPosition(null);
                    }}
                  >
                    {modelInstance.viewSnapshots.length === 0 ? (
                      <div className="px-3 py-4 text-center text-xs text-gray-500">
                        尚無儲存的快照
                      </div>
                    ) : (
                      modelInstance.viewSnapshots.map((snapshot) => (
                        <div
                          key={snapshot.id}
                          className="group flex items-center gap-1 px-2 py-1.5 hover:bg-gray-700/50"
                        >
                          {editingSnapshotId === snapshot.id ? (
                            // 編輯模式
                            <div className="flex-1 flex items-center gap-1">
                              <input
                                type="text"
                                value={editingSnapshotName}
                                onChange={(e) => setEditingSnapshotName(e.target.value)}
                                className="flex-1 px-2 py-0.5 text-xs bg-gray-700/50 border border-gray-600 rounded text-white focus:outline-none focus:border-amber-500"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && editingSnapshotName.trim()) {
                                    onRenameSnapshot?.(snapshot.id, editingSnapshotName.trim());
                                    setEditingSnapshotId(null);
                                  } else if (e.key === 'Escape') {
                                    setEditingSnapshotId(null);
                                  }
                                }}
                              />
                              <button
                                onClick={() => {
                                  if (editingSnapshotName.trim()) {
                                    onRenameSnapshot?.(snapshot.id, editingSnapshotName.trim());
                                    setEditingSnapshotId(null);
                                  }
                                }}
                                className="p-0.5 text-green-400 hover:text-green-300"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setEditingSnapshotId(null)}
                                className="p-0.5 text-gray-400 hover:text-gray-300"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            // 顯示模式
                            <>
                              <button
                                onClick={() => onApplySnapshot?.(snapshot)}
                                className="flex-1 text-left text-xs text-gray-200 hover:text-white truncate flex items-center gap-1.5"
                                title={`套用快照：${snapshot.name}`}
                              >
                                <Bookmark className="w-3 h-3 text-amber-400 flex-shrink-0" />
                                <span className="truncate">{snapshot.name}</span>
                              </button>
                              <button
                                className="p-1 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-400/20 rounded transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  if (hoveredSnapshotId === snapshot.id) {
                                    // 已經顯示，點擊關閉
                                    setHoveredSnapshotId(null);
                                    setTooltipPosition(null);
                                  } else {
                                    // 顯示 tooltip
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setTooltipPosition({ x: rect.left + rect.width / 2, y: rect.top });
                                    setHoveredSnapshotId(snapshot.id);
                                  }
                                }}
                                title="查看幀數資訊"
                              >
                                <Info className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingSnapshotId(snapshot.id);
                                  setEditingSnapshotName(snapshot.name);
                                }}
                                className="p-1 text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 rounded transition-colors"
                                title="重命名"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onDeleteSnapshot?.(snapshot.id)}
                                className="p-1 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                                title="刪除"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Transform 快照下拉選單 */}
            <div className="relative" ref={transformDropdownRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTransformDropdown(!showTransformDropdown);
                }}
                className={`p-1.5 rounded transition-all flex items-center gap-1 ${
                  showTransformDropdown
                    ? 'bg-cyan-500/50 text-white'
                    : 'bg-cyan-500/30 text-cyan-300 hover:bg-cyan-500/50 hover:text-white'
                }`}
                title="Transform 快照（重置/記錄）"
              >
                <RotateCw className="w-3 h-3" />
                <span className="text-[10px]">RESET</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showTransformDropdown ? 'rotate-180' : ''}`} />
                {modelInstance.transformSnapshots.filter(s => !s.isDefault).length > 0 && (
                  <span className="ml-0.5 text-[9px] bg-cyan-500/50 px-1 rounded">
                    {modelInstance.transformSnapshots.filter(s => !s.isDefault).length}
                  </span>
                )}
              </button>
              
              {/* Transform 下拉選單內容 */}
              {showTransformDropdown && (
                <div className={`absolute top-full left-0 mt-1 w-56 ${theme.panelBg} border ${theme.panelBorder} rounded-lg shadow-xl z-50 overflow-hidden`}>
                  {/* 紀錄當前狀態按鈕 */}
                  <button
                    onClick={() => {
                      const timestamp = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                      onSaveTransformSnapshot?.(`快照 ${timestamp}`);
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-cyan-300 hover:bg-cyan-500/20 flex items-center gap-2 border-b border-gray-700/50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    紀錄當前狀態
                  </button>
                  
                  {/* Transform 快照列表 */}
                  <div className="max-h-48 overflow-y-auto custom-scrollbar">
                    {modelInstance.transformSnapshots.map((snapshot) => (
                      <div
                        key={snapshot.id}
                        className="group flex items-center gap-1 px-2 py-1.5 hover:bg-gray-700/50"
                      >
                        {editingTransformId === snapshot.id ? (
                          // 編輯模式
                          <div className="flex-1 flex items-center gap-1">
                            <input
                              type="text"
                              value={editingTransformName}
                              onChange={(e) => setEditingTransformName(e.target.value)}
                              className="flex-1 px-2 py-0.5 text-xs bg-gray-700/50 border border-gray-600 rounded text-white focus:outline-none focus:border-cyan-500"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && editingTransformName.trim()) {
                                  onRenameTransformSnapshot?.(snapshot.id, editingTransformName.trim());
                                  setEditingTransformId(null);
                                } else if (e.key === 'Escape') {
                                  setEditingTransformId(null);
                                }
                              }}
                            />
                            <button
                              onClick={() => {
                                if (editingTransformName.trim()) {
                                  onRenameTransformSnapshot?.(snapshot.id, editingTransformName.trim());
                                  setEditingTransformId(null);
                                }
                              }}
                              className="p-0.5 text-green-400 hover:text-green-300"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setEditingTransformId(null)}
                              className="p-0.5 text-gray-400 hover:text-gray-300"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          // 顯示模式
                          <>
                            <button
                              onClick={() => onApplyTransformSnapshot?.(snapshot)}
                              className="flex-1 text-left text-xs text-gray-200 hover:text-white truncate flex items-center gap-1.5"
                              title={snapshot.isDefault 
                                ? '重置為初始狀態 (0,0,0 / 0,0,0 / 1.0 / 100%)' 
                                : `套用：${snapshot.name}`
                              }
                            >
                              <RotateCw className={`w-3 h-3 flex-shrink-0 ${snapshot.isDefault ? 'text-cyan-400' : 'text-gray-400'}`} />
                              <span className="truncate">{snapshot.name}</span>
                              {snapshot.isDefault && (
                                <span className="text-[9px] text-cyan-400/70">(預設)</span>
                              )}
                            </button>
                            {!snapshot.isDefault && (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingTransformId(snapshot.id);
                                    setEditingTransformName(snapshot.name);
                                  }}
                                  className="p-1 text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 rounded transition-colors"
                                  title="重命名"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => onDeleteTransformSnapshot?.(snapshot.id)}
                                  className="p-1 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                                  title="刪除"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
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
                          const value = parseFloat(val);
                          if (!isNaN(value)) {
                            const newPosition: [number, number, number] = [...modelInstance.position];
                            newPosition[idx] = value;
                            onUpdateTransform({ position: newPosition });
                          }
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
                          const value = parseFloat(val);
                          if (!isNaN(value)) {
                            const newRotation: [number, number, number] = [...modelInstance.rotation];
                            newRotation[idx] = value;
                            onUpdateTransform({ rotation: newRotation });
                          }
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

          {/* 透明度 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-400">透明度 (Opacity)</label>
              <span className="text-[10px] text-neon-blue font-mono">{Math.round(modelInstance.opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={modelInstance.opacity}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                onUpdateTransform({ opacity: value });
              }}
              className="w-full h-1 slider-blue-track appearance-none cursor-pointer rounded-full"
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

      {/* 視圖快照 Tooltip（使用 Portal 渲染到 body，完全避免被裁切） */}
      {hoveredSnapshotId && tooltipPosition && createPortal(
        <div
          className="fixed z-[99999] pointer-events-none"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y - 8,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="px-3 py-2 bg-gradient-to-br from-gray-800 to-gray-900 border border-cyan-500/40 rounded-lg shadow-xl shadow-cyan-500/20">
            {(() => {
              const snapshot = modelInstance.viewSnapshots.find(s => s.id === hoveredSnapshotId);
              if (!snapshot) return null;
              return (
                <div className="flex items-center gap-2.5 text-[11px]">
                  <span className="text-gray-400">幀數</span>
                  <span className="font-mono text-cyan-300 font-semibold text-xs">
                    {Math.round(snapshot.animationTime * 30)}
                  </span>
                  <span className="text-gray-600">|</span>
                  <span className="font-mono text-gray-300">
                    {snapshot.animationTime.toFixed(2)}s
                  </span>
                </div>
              );
            })()}
          </div>
          {/* 小箭頭 */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-gray-800" />
        </div>,
        document.body
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

