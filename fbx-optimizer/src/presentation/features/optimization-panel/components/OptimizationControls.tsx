
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
            {/* 檔案上傳 */}
            <div className="flex flex-col gap-3">
                <label className="text-sm text-gray-400 font-medium">模型與貼圖檔案 (可多選)</label>
                <div className="relative group">
                    <input
                        type="file"
                        accept=".fbx,.png,.jpg,.jpeg,.tga,.ini"
                        multiple
                        onChange={(e) => e.target.files && onFileUpload(e.target.files)}
                        className="hidden"
                        id="file-upload"
                    />
                    <label
                        htmlFor="file-upload"
                        className="flex items-center justify-center gap-2 w-full py-4 px-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl cursor-pointer transition-all duration-300 shadow-lg shadow-blue-900/20 hover:shadow-blue-500/30 hover:scale-[1.02] font-medium border border-blue-400/20"
                    >
                        <Upload className="w-5 h-5" />
                        {fileName ? '更換檔案' : '上傳 FBX + 貼圖'}
                    </label>

                    {/* Glow effect */}
                    <div className="absolute inset-0 rounded-xl bg-blue-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10"></div>
                </div>

                <p className="text-[11px] text-gray-500 flex items-center gap-1.5 px-1">
                    <span className="w-1 h-1 rounded-full bg-blue-500"></span>
                    若模型有外部貼圖，請同時選取 FBX 與貼圖檔
                </p>

                {fileName && (
                    <div className="mt-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-3 animate-fade-in">
                        <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                            <FileBox className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-xs text-blue-300 font-medium mb-0.5">已載入模型</div>
                            <div className="text-sm text-white truncate">{fileName}</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

