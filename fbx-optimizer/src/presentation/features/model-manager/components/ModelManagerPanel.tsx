import React, { useRef } from 'react';
import { Upload, Package, Loader2 } from 'lucide-react';
import type { ModelInstance } from '../../../../domain/value-objects/ModelInstance';
import type { ViewSnapshot } from '../../../../domain/value-objects/ViewSnapshot';
import ModelCard from './ModelCard';
import type { ThemeStyle } from '../../../../presentation/hooks/useTheme';

interface ModelManagerPanelProps {
  models: ModelInstance[];
  activeModelId: string | null;
  onSelectModel: (id: string | null) => void;
  onAddModel: (files: FileList) => Promise<void>;
  onRemoveModel: (id: string) => void;
  onRenameModel: (id: string, newName: string) => void;
  onUpdateModelTransform: (
    id: string,
    updates: {
      position?: [number, number, number];
      rotation?: [number, number, number];
      scale?: [number, number, number];
      visible?: boolean;
      showTransformGizmo?: boolean;
      isCameraOrbiting?: boolean;
      cameraOrbitSpeed?: number;
      isModelRotating?: boolean;
      modelRotationSpeed?: number;
    }
  ) => void;
  /** 聚焦相機到指定模型 */
  onFocusModel?: (id: string) => void;
  /** 保存視圖快照 */
  onSaveSnapshot?: (modelId: string, name: string) => void;
  /** 套用視圖快照 */
  onApplySnapshot?: (modelId: string, snapshot: ViewSnapshot) => void;
  /** 刪除視圖快照 */
  onDeleteSnapshot?: (modelId: string, snapshotId: string) => void;
  /** 重命名視圖快照 */
  onRenameSnapshot?: (modelId: string, snapshotId: string, newName: string) => void;
  /** 是否為導演模式 */
  isDirectorMode?: boolean;
  isLoading?: boolean;
  // 場景設置參數
  toneMappingExposure?: number;
  environmentIntensity?: number;
  hdriUrl?: string;
  theme: ThemeStyle;
}

export default function ModelManagerPanel({
  models,
  activeModelId,
  onSelectModel,
  onAddModel,
  onRemoveModel,
  onRenameModel,
  onUpdateModelTransform,
  onFocusModel,
  onSaveSnapshot,
  onApplySnapshot,
  onDeleteSnapshot,
  onRenameSnapshot,
  isDirectorMode = false,
  isLoading = false,
  toneMappingExposure,
  environmentIntensity,
  hdriUrl,
  theme
}: ModelManagerPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await onAddModel(e.target.files);
      // 重置 input，允許再次選擇相同檔案
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* 標題 */}
      <div className="flex items-center justify-between px-1">
        <h2 className={`text-lg font-bold ${theme.text} flex items-center gap-2`}>
          <Package className="w-5 h-5" />
          模型管理
        </h2>
        <span className="text-xs text-gray-400">{models.length} 個模型</span>
      </div>

      {/* 上傳按鈕 */}
      <div className="flex flex-col gap-2 px-1">
        <input
          ref={fileInputRef}
          type="file"
          accept=".fbx,.png,.jpg,.jpeg,.tga"
          multiple
          onChange={handleFileUpload}
          className="hidden"
          id="model-file-upload"
        />
        <label
          htmlFor="model-file-upload"
          className={`group relative flex items-center justify-between py-3.5 px-5 rounded-2xl cursor-pointer transition-all duration-700 overflow-hidden border border-white/10 ${isLoading
            ? 'bg-gray-900/40 text-gray-600 cursor-not-allowed'
            : 'bg-gradient-to-r from-white/[0.08] to-transparent hover:from-white/[0.12] hover:to-white/[0.02] hover:shadow-[0_15px_30px_rgba(0,0,0,0.3),0_0_15px_rgba(59,130,246,0.1)] hover:-translate-y-0.5'
            }`}
        >
          {/* 背景層次與光影 - 調整為橫向漸變 */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(59,130,246,0.1),transparent_60%)] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
          
          {/* 極細邊框高光 */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-700" />

          {isLoading ? (
            <div className="flex items-center gap-3 relative z-10 w-full justify-center">
              <div className="relative">
                <div className="absolute inset-0 blur-md bg-blue-500/20 animate-pulse" />
                <Loader2 className="w-5 h-5 animate-spin text-blue-400 relative z-10" />
              </div>
              <span className="text-[9px] font-medium tracking-[0.3em] uppercase text-blue-400/60 animate-pulse">Initializing System</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 relative z-10">
                {/* 圖示組合 - 縮小尺寸 */}
                <div className="relative">
                  <div className="absolute inset-0 blur-lg bg-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="w-9 h-9 rounded-xl border border-white/10 flex items-center justify-center bg-white/5 group-hover:border-blue-500/30 group-hover:bg-blue-500/5 transition-all duration-500">
                    <Upload className="w-4 h-4 text-gray-400 group-hover:text-blue-400 transition-colors duration-500" />
                  </div>
                </div>

                {/* 文字排版 - 橫向對齊 */}
                <div className="flex flex-col">
                  <div className="text-[11px] font-black tracking-[0.3em] uppercase text-gray-200 group-hover:text-white transition-colors duration-500">
                    Import Model
                  </div>
                  <div className="text-[8px] font-medium tracking-[0.1em] uppercase text-gray-500 group-hover:text-blue-400/60 transition-colors duration-500">
                    FBX & Textures
                  </div>
                </div>
              </div>

              {/* 裝飾性右側箭頭或裝飾 */}
              <div className="relative z-10 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-2 group-hover:translate-x-0">
                <div className="w-5 h-5 rounded-full border border-blue-500/20 flex items-center justify-center bg-blue-500/5">
                  <div className="w-1 h-1 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                </div>
              </div>
            </>
          )}

          {/* 底部裝飾線 */}
          <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-blue-500/10 to-transparent translate-y-1 group-hover:translate-y-0 transition-transform duration-500" />
        </label>
        <p className="text-[10px] text-gray-500">
          *若模型有外部貼圖，請同時選取 FBX 與貼圖檔
        </p>
      </div>

      {/* 模型列表 */}
      <div 
        className="flex-1 overflow-y-auto space-y-2 px-1 custom-scrollbar"
        onClick={(e) => {
          // 點擊空白區域時取消選中
          if (e.target === e.currentTarget) {
            onSelectModel(null);
          }
        }}
      >
        {models.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <Package className="w-12 h-12 mb-2 opacity-50" />
            <p className="text-sm">尚無模型</p>
            <p className="text-xs mt-1">點擊上方按鈕新增模型</p>
          </div>
        ) : (
          models.map((modelInstance) => (
            <ModelCard
              key={modelInstance.id}
              modelInstance={modelInstance}
              isActive={modelInstance.id === activeModelId}
              onSelect={() => {
                // Toggle 行為：如果已選中，則取消選中；否則選中
                if (modelInstance.id === activeModelId) {
                  onSelectModel(null);
                } else {
                  onSelectModel(modelInstance.id);
                }
              }}
              onRemove={() => onRemoveModel(modelInstance.id)}
              onRename={(newName) => onRenameModel(modelInstance.id, newName)}
              onUpdateTransform={(updates) => onUpdateModelTransform(modelInstance.id, updates)}
              onFocusModel={onFocusModel ? () => onFocusModel(modelInstance.id) : undefined}
              onSaveSnapshot={onSaveSnapshot ? (name) => onSaveSnapshot(modelInstance.id, name) : undefined}
              onApplySnapshot={onApplySnapshot ? (snapshot) => onApplySnapshot(modelInstance.id, snapshot) : undefined}
              onDeleteSnapshot={onDeleteSnapshot ? (snapshotId) => onDeleteSnapshot(modelInstance.id, snapshotId) : undefined}
              onRenameSnapshot={onRenameSnapshot ? (snapshotId, newName) => onRenameSnapshot(modelInstance.id, snapshotId, newName) : undefined}
              isDirectorMode={isDirectorMode}
              toneMappingExposure={toneMappingExposure}
              environmentIntensity={environmentIntensity}
              hdriUrl={hdriUrl}
              theme={theme}
            />
          ))
        )}
      </div>
    </div>
  );
}

