import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Download, RotateCcw, X } from 'lucide-react';

interface AlphaRemoverToolProps {
  onClose?: () => void;
}

interface ImageData {
  file: File;
  dataUrl: string;
  width: number;
  height: number;
}

/** 棋盤格背景 CSS - 用於顯示透明區域 */
const checkerboardStyle: React.CSSProperties = {
  backgroundImage: `
    linear-gradient(45deg, #374151 25%, transparent 25%),
    linear-gradient(-45deg, #374151 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #374151 75%),
    linear-gradient(-45deg, transparent 75%, #374151 75%)
  `,
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
  backgroundColor: '#1f2937'
};

export const AlphaRemoverTool: React.FC<AlphaRemoverToolProps> = ({ onClose }) => {
  const [sourceImage, setSourceImage] = useState<ImageData | null>(null);
  const [threshold, setThreshold] = useState(10);
  const [processedDataUrl, setProcessedDataUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 處理圖片上傳
  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        setSourceImage({
          file,
          dataUrl,
          width: img.width,
          height: img.height
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }, []);

  // 處理拖放
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    e.target.value = '';
  }, [handleFileSelect]);

  // Alpha 閾值處理
  const processImage = useCallback(() => {
    if (!sourceImage || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Alpha 閾值處理：低於閾值的像素設為全透明
      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        if (alpha < threshold) {
          data[i + 3] = 0; // 設為全透明
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
      setProcessedDataUrl(canvas.toDataURL('image/png'));
    };
    img.src = sourceImage.dataUrl;
  }, [sourceImage, threshold]);

  // 當 sourceImage 或 threshold 變化時重新處理
  useEffect(() => {
    if (sourceImage) {
      processImage();
    }
  }, [sourceImage, threshold, processImage]);

  // 下載處理後的圖片
  const handleDownload = useCallback(() => {
    if (!processedDataUrl || !sourceImage) return;

    const link = document.createElement('a');
    const originalName = sourceImage.file.name.replace(/\.[^/.]+$/, '');
    link.download = `${originalName}_alpha_removed.png`;
    link.href = processedDataUrl;
    link.click();
  }, [processedDataUrl, sourceImage]);

  // 重置
  const handleReset = useCallback(() => {
    setSourceImage(null);
    setProcessedDataUrl(null);
    setThreshold(10);
  }, []);

  return (
    <div className="space-y-4">
      {/* 標題列 */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-white">Alpha 去背工具</h4>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* 隱藏的 Canvas 用於處理 */}
      <canvas ref={canvasRef} className="hidden" />

      {/* 上傳區域 */}
      {!sourceImage ? (
        <div
          className={`
            relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer
            transition-colors duration-200
            ${isDragging 
              ? 'border-blue-400 bg-blue-500/10' 
              : 'border-white/20 hover:border-white/40 hover:bg-white/5'
            }
          `}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload size={32} className="mx-auto mb-3 text-gray-400" />
          <p className="text-sm text-gray-300">拖放圖片或點擊上傳</p>
          <p className="text-xs text-gray-500 mt-1">支援 PNG、JPG、WebP 等格式</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleInputChange}
          />
        </div>
      ) : (
        <>
          {/* 圖片資訊 */}
          <div className="flex items-center justify-between text-xs text-gray-400 bg-black/30 rounded-lg px-3 py-2">
            <span className="truncate flex-1 mr-2">{sourceImage.file.name}</span>
            <span>{sourceImage.width} × {sourceImage.height}</span>
          </div>

          {/* Alpha 閾值控制 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-400 uppercase">
                Alpha 閾值
              </label>
              <span className="text-xs text-white font-mono">{threshold}</span>
            </div>
            <div className="relative h-6 flex items-center">
              <div className="absolute w-full h-2 bg-gray-600/80 rounded-full" />
              <div 
                className="absolute h-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" 
                style={{ width: `${(threshold / 255) * 100}%` }}
              />
              <input
                type="range"
                min={0}
                max={255}
                step={1}
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value))}
                className="absolute w-full h-6 cursor-pointer appearance-none bg-transparent
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer"
              />
            </div>
            <p className="text-[10px] text-gray-500">
              Alpha 值低於 {threshold} 的像素將變為全透明
            </p>
          </div>

          {/* 預覽區域 */}
          <div className="grid grid-cols-2 gap-3">
            {/* 原圖 */}
            <div className="space-y-1">
              <p className="text-[10px] text-gray-500 uppercase text-center">原圖</p>
              <div 
                className="relative rounded-lg overflow-hidden border border-white/10"
                style={checkerboardStyle}
              >
                <img 
                  src={sourceImage.dataUrl} 
                  alt="Original"
                  className="w-full h-auto object-contain"
                  style={{ maxHeight: '150px' }}
                />
              </div>
            </div>
            
            {/* 處理後 */}
            <div className="space-y-1">
              <p className="text-[10px] text-gray-500 uppercase text-center">處理後</p>
              <div 
                className="relative rounded-lg overflow-hidden border border-white/10"
                style={checkerboardStyle}
              >
                {processedDataUrl && (
                  <img 
                    src={processedDataUrl} 
                    alt="Processed"
                    className="w-full h-auto object-contain"
                    style={{ maxHeight: '150px' }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* 操作按鈕 */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                bg-white/5 hover:bg-white/10 text-gray-300 text-sm transition-colors"
            >
              <RotateCcw size={14} />
              重新選擇
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!processedDataUrl}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-400/40
                text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={14} />
              下載 PNG
            </button>
          </div>
        </>
      )}
    </div>
  );
};


