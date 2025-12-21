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
    <div className="flex flex-col gap-5 h-full">
      {/* 標題 */}
      <div className="flex items-center justify-between px-2 pt-1">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Package className={`w-5 h-5 ${theme.text} relative z-10`} />
            <div className="absolute inset-0 blur-lg bg-blue-500/20" />
          </div>
          <h2 className={`text-sm font-black tracking-[0.2em] uppercase ${theme.text}`}>
            Model Assets
          </h2>
        </div>
        <div className="flex items-center gap-2 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
          <span className="text-[10px] font-mono text-gray-400">{models.length}</span>
          <span className="text-[9px] uppercase tracking-tighter text-gray-500">Units</span>
        </div>
      </div>

      {/* 上傳按鈕 */}
      <div className="flex flex-col gap-2.5 px-1">
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
          className={`group relative flex items-center justify-between py-4 px-6 rounded-2xl cursor-pointer transition-all duration-700 overflow-hidden border-2 backdrop-blur-xl shadow-2xl ${isLoading
            ? 'bg-gray-900/40 text-gray-600 border-white/5 cursor-not-allowed'
            : 'bg-gradient-to-br from-white/[0.08] via-white/[0.03] to-transparent border-blue-500/20 hover:border-blue-400/50 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4),0_0_20px_rgba(59,130,246,0.2)] hover:-translate-y-0.5'
            }`}
        >
          {/* 背景層次與光影 */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(59,130,246,0.15),transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
          
          {/* 極細邊框高光 */}
          <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-blue-400/40 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-700" />

          {isLoading ? (
            <div className="flex items-center gap-3 relative z-10 w-full justify-center">
              <div className="relative">
                <div className="absolute inset-0 blur-md bg-blue-500/30 animate-pulse" />
                <Loader2 className="w-5 h-5 animate-spin text-blue-400 relative z-10" />
              </div>
              <span className="text-[10px] font-bold tracking-[0.4em] uppercase text-blue-400/70 animate-pulse">Synchronizing</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-5 relative z-10">
                {/* 圖示組合 */}
                <div className="relative">
                  <div className="absolute inset-0 blur-xl bg-blue-500/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="w-11 h-11 rounded-2xl border border-white/10 flex items-center justify-center bg-white/5 group-hover:border-blue-500/40 group-hover:bg-blue-500/10 transition-all duration-500">
                    <Upload className="w-5 h-5 text-gray-400 group-hover:text-blue-400 transition-all duration-500" />
                  </div>
                </div>

                {/* 文字排版 */}
                <div className="flex flex-col gap-0.5">
                  <div className="text-[12px] font-black tracking-[0.25em] uppercase text-gray-200 group-hover:text-white transition-colors duration-500">
                    Import Engine
                  </div>
                  <div className="text-[9px] font-medium tracking-[0.15em] uppercase text-gray-500 group-hover:text-blue-400/70 transition-colors duration-500">
                    FBX / Texture Pipeline
                  </div>
                </div>
              </div>

              {/* 裝飾性右側指示器 */}
              <div className="relative z-10 opacity-0 group-hover:opacity-100 transition-all duration-700 -translate-x-4 group-hover:translate-x-0">
                <div className="w-6 h-6 rounded-full border border-blue-500/30 flex items-center justify-center bg-blue-500/10">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(59,130,246,1)]" />
                </div>
              </div>
            </>
          )}

          {/* 底部亮線裝飾 */}
          <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent translate-y-1 group-hover:translate-y-0 transition-transform duration-500" />
        </label>
        <div className="flex items-center gap-1.5 px-1 opacity-60">
          <div className="w-1 h-1 rounded-full bg-blue-400/50" />
          <p className="text-[9px] text-gray-500 tracking-wider">
            Supports multi-file asset injection for FBX & associated textures
          </p>
        </div>
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

