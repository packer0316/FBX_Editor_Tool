/**
 * Spine 檔案上傳組件
 * 
 * 支援拖放和點擊上傳 .skel、.atlas 和圖片檔案。
 */

import React, { useCallback, useRef, useState } from 'react';
import { Upload, FileType, AlertCircle, CheckCircle } from 'lucide-react';
import { LoadSpineUseCase } from '../../../../application/use-cases/LoadSpineUseCase';
import type { SpineInstance } from '../../../../domain/value-objects/SpineInstance';
import { toast } from '../../../components/Toast';

// ============================================================================
// 類型定義
// ============================================================================

interface SpineFileUploaderProps {
  /** 上傳成功回調 */
  onUploadSuccess: (instance: SpineInstance) => void;
  /** 上傳失敗回調 */
  onUploadError?: (error: Error) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自訂類名 */
  className?: string;
}

interface FileStatus {
  skel: File | null;
  atlas: File | null;
  images: File[];
}

// ============================================================================
// 組件
// ============================================================================

export const SpineFileUploader: React.FC<SpineFileUploaderProps> = ({
  onUploadSuccess,
  onUploadError,
  disabled = false,
  className = '',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileStatus, setFileStatus] = useState<FileStatus>({
    skel: null,
    atlas: null,
    images: [],
  });

  /**
   * 處理檔案選擇
   */
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    
    // 更新檔案狀態
    const newStatus: FileStatus = {
      skel: null,
      atlas: null,
      images: [],
    };

    for (const file of fileArray) {
      const ext = file.name.toLowerCase().split('.').pop();
      if (ext === 'skel') {
        newStatus.skel = file;
      } else if (ext === 'atlas') {
        newStatus.atlas = file;
      } else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext || '')) {
        newStatus.images.push(file);
      }
    }

    setFileStatus(newStatus);
    setError(null);

    // 檢查是否有完整的 Spine 檔案組合
    if (!newStatus.skel) {
      setError('缺少 .skel 檔案');
      return;
    }
    if (!newStatus.atlas) {
      setError('缺少 .atlas 檔案');
      return;
    }
    if (newStatus.images.length === 0) {
      setError('缺少圖片檔案 (.png / .jpg)');
      return;
    }

    // 開始載入
    setIsLoading(true);
    setError(null);

    try {
      const result = await LoadSpineUseCase.execute(fileArray);
      onUploadSuccess(result.instance);
      
      // 成功提示
      toast.success('Spine 載入成功', `已載入 ${result.instance.name}`);
      
      // 重置狀態
      setFileStatus({ skel: null, atlas: null, images: [] });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '載入失敗';
      setError(errorMessage);
      
      // 錯誤提示（根據錯誤類型顯示不同訊息）
      if (errorMessage.includes('版本') || errorMessage.includes('version')) {
        toast.error('Spine 版本不相容', '此專案僅支援 Spine 3.8.x 版本的骨架檔案');
      } else if (errorMessage.includes('圖片') || errorMessage.includes('image')) {
        toast.error('圖片載入失敗', errorMessage);
      } else if (errorMessage.includes('atlas') || errorMessage.includes('Atlas')) {
        toast.error('Atlas 格式錯誤', '請確認 .atlas 檔案格式正確');
      } else {
        toast.error('Spine 載入失敗', errorMessage);
      }
      
      onUploadError?.(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setIsLoading(false);
    }
  }, [onUploadSuccess, onUploadError]);

  /**
   * 處理拖放
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isLoading) {
      setIsDragging(true);
    }
  }, [disabled, isLoading]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || isLoading) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFiles(files);
    }
  }, [disabled, isLoading, handleFiles]);

  /**
   * 處理點擊上傳
   */
  const handleClick = useCallback(() => {
    if (!disabled && !isLoading) {
      fileInputRef.current?.click();
    }
  }, [disabled, isLoading]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
    // 重置 input 以允許重複選擇相同檔案
    e.target.value = '';
  }, [handleFiles]);

  return (
    <div className={className}>
      {/* 隱藏的 file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={LoadSpineUseCase.getAcceptString()}
        multiple
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* 拖放區域 */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative p-6 border-2 border-dashed rounded-xl cursor-pointer
          transition-all duration-200
          ${isDragging 
            ? 'border-purple-400 bg-purple-500/10' 
            : 'border-white/10 hover:border-purple-400/50 hover:bg-white/5'
          }
          ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {/* 載入中覆蓋層 */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-purple-400">載入中...</span>
            </div>
          </div>
        )}

        {/* 內容 */}
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 bg-purple-500/20 rounded-full">
            <Upload className="w-6 h-6 text-purple-400" />
          </div>
          
          <div className="text-center">
            <p className="text-sm text-gray-200">
              拖放 Spine 檔案到此處
            </p>
            <p className="text-xs text-gray-500 mt-1">
              或點擊選擇檔案
            </p>
          </div>

          {/* 檔案需求提示 */}
          <div className="flex flex-wrap gap-2 justify-center mt-2">
            <FileTypeTag 
              label=".skel" 
              hasFile={!!fileStatus.skel} 
            />
            <FileTypeTag 
              label=".atlas" 
              hasFile={!!fileStatus.atlas} 
            />
            <FileTypeTag 
              label="圖片" 
              hasFile={fileStatus.images.length > 0}
              count={fileStatus.images.length}
            />
          </div>
        </div>
      </div>

      {/* 錯誤訊息 */}
      {error && (
        <div className="mt-3 flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* 支援格式提示 */}
      <p className="mt-2 text-xs text-gray-500 text-center">
        支援格式：.skel (二進制)、.atlas、.png、.jpg
      </p>
    </div>
  );
};

// ============================================================================
// 子組件
// ============================================================================

interface FileTypeTagProps {
  label: string;
  hasFile: boolean;
  count?: number;
}

const FileTypeTag: React.FC<FileTypeTagProps> = ({ label, hasFile, count }) => (
  <span
    className={`
      inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs
      ${hasFile 
        ? 'bg-green-500/20 text-green-400' 
        : 'bg-gray-500/20 text-gray-400'
      }
    `}
  >
    {hasFile ? (
      <CheckCircle className="w-3 h-3" />
    ) : (
      <FileType className="w-3 h-3" />
    )}
    {label}
    {count !== undefined && count > 0 && (
      <span className="ml-0.5">({count})</span>
    )}
  </span>
);

export default SpineFileUploader;


