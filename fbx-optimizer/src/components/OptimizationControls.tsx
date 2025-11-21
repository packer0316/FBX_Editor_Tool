import React from 'react';
import { Upload, Download, Settings, FileBox } from 'lucide-react';

interface OptimizationControlsProps {
    onFileUpload: (files: FileList) => void;
    tolerance: number;
    setTolerance: (val: number) => void;
    originalKeyframeCount: number;
    optimizedKeyframeCount: number;
    onExport: () => void;
    fileName: string | null;
    isExporting?: boolean;
}

export default function OptimizationControls({
    onFileUpload,
    tolerance,
    setTolerance,
    originalKeyframeCount,
    optimizedKeyframeCount,
    onExport,
    fileName,
    isExporting = false
}: OptimizationControlsProps) {

    const reductionPercentage = originalKeyframeCount > 0
        ? Math.round(((originalKeyframeCount - optimizedKeyframeCount) / originalKeyframeCount) * 100)
        : 0;

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700 w-80 flex flex-col gap-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-400" />
                優化設定
            </h2>

            {/* 檔案上傳 */}
            <div className="flex flex-col gap-2">
                <label className="text-sm text-gray-400">模型與貼圖檔案 (可多選)</label>
                <div className="relative">
                    <input
                        type="file"
                        accept=".fbx,.png,.jpg,.jpeg,.tga"
                        multiple
                        onChange={(e) => e.target.files && onFileUpload(e.target.files)}
                        className="hidden"
                        id="file-upload"
                    />
                    <label
                        htmlFor="file-upload"
                        className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-md cursor-pointer transition-colors border border-gray-600 border-dashed"
                    >
                        <Upload className="w-4 h-4" />
                        {fileName ? '更換檔案' : '上傳 FBX + 貼圖'}
                    </label>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                    *若模型有外部貼圖，請同時選取 FBX 與貼圖檔
                </p>
                {fileName && (
                    <div className="flex items-center gap-2 text-xs text-blue-300 mt-1">
                        <FileBox className="w-3 h-3" />
                        <span className="truncate">{fileName}</span>
                    </div>
                )}
            </div>

            {/* 優化滑桿 */}
            <div className="flex flex-col gap-2">
                <div className="flex justify-between">
                    <label className="text-sm text-gray-400">減幀強度 (誤差容忍度)</label>
                    <span className="text-sm text-blue-400 font-mono">{tolerance.toFixed(3)}</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="0.1"
                    step="0.001"
                    value={tolerance}
                    onChange={(e) => setTolerance(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <p className="text-xs text-gray-500">
                    數值越大，刪除的關鍵幀越多，但動作可能越不精確。
                </p>
            </div>

            {/* 數據統計 */}
            <div className="bg-gray-900/50 p-4 rounded-md border border-gray-700/50">
                <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">優化數據</h3>
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-400">原始關鍵幀:</span>
                        <span className="text-white font-mono">{originalKeyframeCount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-400">優化後:</span>
                        <span className="text-green-400 font-mono">{optimizedKeyframeCount.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-px bg-gray-700 my-2"></div>
                    <div className="flex justify-between text-sm font-bold">
                        <span className="text-gray-300">減少幅度:</span>
                        <span className="text-blue-400">{reductionPercentage}%</span>
                    </div>
                </div>
            </div>

            {/* 導出按鈕 */}
            <button
                onClick={onExport}
                disabled={!fileName || isExporting}
                className={`flex items-center justify-center gap-2 w-full py-3 px-4 rounded-md font-medium transition-colors ${fileName && !isExporting
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
            >
                <Download className="w-4 h-4" />
                {isExporting ? '導出中...' : '導出優化後的 GLB (推薦)'}
            </button>
            <p className="text-[10px] text-gray-500 text-center mt-1">
                *Three.js 不支援 FBX 導出，已自動轉為更高效的 GLB 格式
            </p>
        </div>
    );
}
