import React, { useRef } from 'react';
import { Upload, Package, Loader2 } from 'lucide-react';
import type { ModelInstance } from '../../../../domain/value-objects/ModelInstance';
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
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl cursor-pointer transition-all shadow-lg font-medium border-2 border-dashed ${isLoading
            ? 'bg-gray-600 text-gray-400 cursor-not-allowed border-gray-600'
            : `${theme.activeButton} border-blue-500/50 hover:border-blue-400 hover:shadow-blue-500/30`
            }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              載入中...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              新增模型
            </>
          )}
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

