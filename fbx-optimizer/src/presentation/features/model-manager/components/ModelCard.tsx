import React, { useState } from 'react';
import { Trash2, Edit2, Check, X, Package, Eye, EyeOff, ChevronDown, ChevronRight } from 'lucide-react';
import type { ModelInstance } from '../../../../domain/value-objects/ModelInstance';
import ModelPreview from './ModelPreview';

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
  }) => void;
  // 場景設置參數
  toneMappingExposure?: number;
  environmentIntensity?: number;
  hdriUrl?: string;
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
  hdriUrl
}: ModelCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(modelInstance.name);
  const [isExpanded, setIsExpanded] = useState(false);

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
      className={`border rounded-lg transition-all cursor-pointer ${
        isActive
          ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20'
          : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
      }`}
      onClick={onSelect}
    >
      {/* 標題列 */}
      <div className="flex items-center gap-2 p-3 bg-gray-800/50 border-b border-gray-700">
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
              className="flex-1 px-2 py-1 text-sm bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
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
            <span className={`flex-1 text-sm font-medium truncate ${isActive ? 'text-blue-300' : 'text-gray-300'}`}>
              {modelInstance.name}
            </span>
            
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
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
                className={`p-1 rounded transition-colors ${
                  modelInstance.visible
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
            <label className="text-xs text-gray-400">模型預覽</label>
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
              {(['x', 'y', 'z'] as const).map((axis, idx) => (
                <div key={axis} className="flex flex-col">
                  <span className="text-[10px] text-gray-500 mb-1">{axis.toUpperCase()}</span>
                  <input
                    type="number"
                    value={modelInstance.position[idx].toFixed(2)}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      const newPosition: [number, number, number] = [...modelInstance.position];
                      newPosition[idx] = value;
                      onUpdateTransform({ position: newPosition });
                    }}
                    className="w-full px-2 py-1 text-xs bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                    step="0.1"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Rotation */}
          <div className="space-y-1">
            <label className="text-xs text-gray-400">旋轉 (Rotation) - 度數</label>
            <div className="grid grid-cols-3 gap-2">
              {(['x', 'y', 'z'] as const).map((axis, idx) => (
                <div key={axis} className="flex flex-col">
                  <span className="text-[10px] text-gray-500 mb-1">{axis.toUpperCase()}</span>
                  <input
                    type="number"
                    value={modelInstance.rotation[idx].toFixed(1)}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      const newRotation: [number, number, number] = [...modelInstance.rotation];
                      newRotation[idx] = value;
                      onUpdateTransform({ rotation: newRotation });
                    }}
                    className="w-full px-2 py-1 text-xs bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                    step="1"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Scale */}
          <div className="space-y-1">
            <label className="text-xs text-gray-400">縮放 (Scale) - 等比</label>
            <input
              type="number"
              value={modelInstance.scale[0].toFixed(2)}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value)) {
                  onUpdateTransform({ scale: [value, value, value] });
                }
              }}
              onWheel={(e) => {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                const newValue = Math.max(0.01, modelInstance.scale[0] + delta);
                onUpdateTransform({ scale: [newValue, newValue, newValue] });
              }}
              className="w-full px-2 py-1 text-xs bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              step="0.01"
            />
          </div>
        </div>
      )}
    </div>
  );
}

