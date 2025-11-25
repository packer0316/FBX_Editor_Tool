import React from 'react';
import { Upload, FileBox } from 'lucide-react';

interface OptimizationControlsProps {
    onFileUpload: (files: FileList) => void;
    fileName: string | null;
    tolerance?: number;
    setTolerance?: (toleranceValue: number) => void;
    originalKeyframeCount?: number;
    optimizedKeyframeCount?: number;
    onExport?: () => void;
    isExporting?: boolean;
}

export default function OptimizationControls({
    onFileUpload,
    fileName
}: OptimizationControlsProps) {

    return (
        <div className="flex flex-col gap-6 w-full">
            {/* 檔案上傳 (Moved outside) */}
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
                        className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-md cursor-pointer transition-colors shadow-lg shadow-blue-900/20 font-medium"
                    >
                        <Upload className="w-4 h-4" />
                        {fileName ? '更換檔案' : '上傳 FBX + 貼圖'}
                    </label>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                    *若模型有外部貼圖，請同時選取 FBX 與貼圖檔
                </p>
                {
                    fileName && (
                        <div className="flex items-center gap-2 text-xs text-blue-300 mt-1">
                            <FileBox className="w-3 h-3" />
                            <span className="truncate">{fileName}</span>
                        </div>
                    )
                }
            </div>
        </div>
    );
}

