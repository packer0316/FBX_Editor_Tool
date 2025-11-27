import { useState, useRef } from 'react';
import { FolderOpen, File, Upload, X, CheckCircle2, AlertCircle, Layers } from 'lucide-react';

interface UploadedEffect {
    id: string;
    name: string;
    files: File[];
    efkFile: File;
    blobUrls: Map<string, string>;
}

interface EffectFileUploaderProps {
    onUpload: (effect: UploadedEffect) => void;
    onBatchUpload?: (effects: UploadedEffect[]) => void; // 批次上傳
    disabled?: boolean;
}

/**
 * 特效檔案上傳元件
 * 
 * 支援兩種上傳模式：
 * 1. 資料夾上傳（批次）：選擇包含 .efk 和所有資源的資料夾
 * 2. 多檔上傳（單傳）：選擇 .efk 和需要的資源檔案
 */
export function EffectFileUploader({ onUpload, onBatchUpload, disabled = false }: EffectFileUploaderProps) {
    const [uploadMode, setUploadMode] = useState<'folder' | 'files'>('folder');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [selectedEfkIndex, setSelectedEfkIndex] = useState<number>(0); // 選擇的 .efk 索引
    
    const folderInputRef = useRef<HTMLInputElement>(null);
    const filesInputRef = useRef<HTMLInputElement>(null);

    // 取得所有 .efk 檔案
    const efkFiles = selectedFiles.filter(f => f.name.match(/\.(efk|efkefc|efkp)$/i));

    // 處理資料夾選擇
    const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        setSelectedFiles(files);
        setError(null);
        setSelectedEfkIndex(0);

        // 檢查是否有 .efk 檔案
        const efkFile = files.find(f => f.name.match(/\.(efk|efkefc|efkp)$/i));
        if (!efkFile) {
            setError('找不到 .efk / .efkefc / .efkp 檔案');
        }
    };

    // 處理多檔選擇
    const handleFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        setSelectedFiles(prev => [...prev, ...files]);
        setError(null);

        // 檢查是否有 .efk 檔案
        const allFiles = [...selectedFiles, ...files];
        const efkFile = allFiles.find(f => f.name.match(/\.(efk|efkefc|efkp)$/i));
        if (!efkFile) {
            setError('請確保已選擇 .efk / .efkefc / .efkp 檔案');
        }
    };

    // 移除檔案
    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    // 清除所有
    const clearAll = () => {
        setSelectedFiles([]);
        setError(null);
        if (folderInputRef.current) folderInputRef.current.value = '';
        if (filesInputRef.current) filesInputRef.current.value = '';
    };

    // 建立資源映射表
    const buildBlobUrls = (): Map<string, string> => {
        const blobUrls = new Map<string, string>();

        for (const file of selectedFiles) {
            const blobUrl = URL.createObjectURL(file);
            
            // 取得相對路徑（如果有 webkitRelativePath）
            const relativePath = (file as any).webkitRelativePath || file.name;
            
            // 正規化路徑（統一使用 / 分隔符）
            const normalizedPath = relativePath.replace(/\\/g, '/');
            
            // 同時註冊多種路徑格式，確保 Effekseer 能找到資源
            blobUrls.set(normalizedPath, blobUrl);
            blobUrls.set(file.name, blobUrl);
            
            // 純檔名（不含路徑）
            const fileName = file.name;
            blobUrls.set(fileName, blobUrl);
            
            // 如果有資料夾結構，也註冊各種可能的路徑格式
            const parts = normalizedPath.split('/');
            if (parts.length > 1) {
                // 去掉根資料夾（例如 "Boss/Texture/a.png" -> "Texture/a.png"）
                const withoutRoot = parts.slice(1).join('/');
                blobUrls.set(withoutRoot, blobUrl);
                
                // 去掉前兩層資料夾（例如 "Boss/Texture/a.png" -> "a.png"）
                if (parts.length > 2) {
                    const withoutTwoLevels = parts.slice(2).join('/');
                    blobUrls.set(withoutTwoLevels, blobUrl);
                }
                
                // 帶 ./ 前綴的版本
                blobUrls.set(`./${fileName}`, blobUrl);
                blobUrls.set(`./${withoutRoot}`, blobUrl);
            }
        }
        
        console.log(`[EffectFileUploader] 總共建立 ${blobUrls.size} 個資源映射`);
        return blobUrls;
    };

    // 確認上傳（單一特效）
    const handleConfirmUpload = () => {
        if (efkFiles.length === 0) {
            setError('找不到主特效檔（.efk / .efkefc / .efkp）');
            return;
        }

        const efkFile = efkFiles[selectedEfkIndex] || efkFiles[0];
        const blobUrls = buildBlobUrls();
        const effectName = efkFile.name.replace(/\.(efk|efkefc|efkp)$/i, '');
        
        const uploadedEffect: UploadedEffect = {
            id: `effect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: effectName,
            files: selectedFiles,
            efkFile,
            blobUrls
        };

        onUpload(uploadedEffect);
        clearAll();
    };

    // 批次上傳（所有特效）
    const handleBatchUpload = () => {
        if (efkFiles.length === 0) {
            setError('找不到特效檔（.efk / .efkefc / .efkp）');
            return;
        }

        const blobUrls = buildBlobUrls();
        const effects: UploadedEffect[] = efkFiles.map((efkFile, index) => {
            const effectName = efkFile.name.replace(/\.(efk|efkefc|efkp)$/i, '');
            return {
                id: `effect_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
                name: effectName,
                files: selectedFiles,
                efkFile,
                blobUrls
            };
        });

        if (onBatchUpload) {
            onBatchUpload(effects);
        } else {
            // 如果沒有 onBatchUpload，逐一呼叫 onUpload
            effects.forEach(effect => onUpload(effect));
        }
        clearAll();
    };

    // 取得檔案類型統計
    const getFileStats = () => {
        const stats: Record<string, number> = {};
        for (const file of selectedFiles) {
            const ext = file.name.split('.').pop()?.toLowerCase() || 'unknown';
            stats[ext] = (stats[ext] || 0) + 1;
        }
        return stats;
    };

    const fileStats = getFileStats();
    const hasEfkFile = selectedFiles.some(f => f.name.match(/\.(efk|efkefc|efkp)$/i));

    return (
        <div className="space-y-3 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
            {/* 模式切換 */}
            <div className="flex gap-2">
                <button
                    onClick={() => { setUploadMode('folder'); clearAll(); }}
                    disabled={disabled}
                    className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-2
                        ${uploadMode === 'folder'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >
                    <FolderOpen className="w-4 h-4" />
                    資料夾上傳
                </button>
                <button
                    onClick={() => { setUploadMode('files'); clearAll(); }}
                    disabled={disabled}
                    className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-2
                        ${uploadMode === 'files'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >
                    <File className="w-4 h-4" />
                    多檔上傳
                </button>
            </div>

            {/* 上傳區域 */}
            <div className="relative">
                {uploadMode === 'folder' ? (
                    <>
                        <input
                            ref={folderInputRef}
                            type="file"
                            // @ts-ignore - webkitdirectory 是非標準屬性
                            webkitdirectory="true"
                            directory=""
                            multiple
                            onChange={handleFolderSelect}
                            disabled={disabled}
                            className="hidden"
                            id="folder-upload"
                        />
                        <label
                            htmlFor="folder-upload"
                            className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors
                                ${disabled 
                                    ? 'border-gray-700 bg-gray-800/50 cursor-not-allowed' 
                                    : 'border-gray-600 hover:border-blue-500 hover:bg-gray-800/50'}`}
                        >
                            <FolderOpen className="w-8 h-8 text-gray-500 mb-2" />
                            <span className="text-xs text-gray-400">點擊選擇資料夾</span>
                            <span className="text-[10px] text-gray-500 mt-1">包含 .efk 和所有資源檔案</span>
                        </label>
                    </>
                ) : (
                    <>
                        <input
                            ref={filesInputRef}
                            type="file"
                            multiple
                            accept=".efk,.efkefc,.efkp,.png,.jpg,.jpeg,.tga,.efkmat,.efkmodel,.wav,.ogg,.mp3"
                            onChange={handleFilesSelect}
                            disabled={disabled}
                            className="hidden"
                            id="files-upload"
                        />
                        <label
                            htmlFor="files-upload"
                            className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors
                                ${disabled 
                                    ? 'border-gray-700 bg-gray-800/50 cursor-not-allowed' 
                                    : 'border-gray-600 hover:border-blue-500 hover:bg-gray-800/50'}`}
                        >
                            <Upload className="w-8 h-8 text-gray-500 mb-2" />
                            <span className="text-xs text-gray-400">點擊選擇檔案</span>
                            <span className="text-[10px] text-gray-500 mt-1">.efk + .png + .efkmat 等</span>
                        </label>
                    </>
                )}
            </div>

            {/* 已選擇檔案統計 */}
            {selectedFiles.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">
                            已選擇 {selectedFiles.length} 個檔案
                        </span>
                        <button
                            onClick={clearAll}
                            className="text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                            清除全部
                        </button>
                    </div>

                    {/* 檔案類型統計 */}
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(fileStats).map(([ext, count]) => (
                            <span
                                key={ext}
                                className={`px-2 py-0.5 rounded text-[10px] font-mono
                                    ${ext.match(/^(efk|efkefc|efkp)$/) 
                                        ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50' 
                                        : 'bg-gray-700 text-gray-400'}`}
                            >
                                .{ext} × {count}
                            </span>
                        ))}
                    </div>

                    {/* 檔案列表（可展開） */}
                    {uploadMode === 'files' && (
                        <div className="max-h-32 overflow-y-auto space-y-1 bg-gray-800/50 rounded p-2">
                            {selectedFiles.map((file, index) => (
                                <div key={index} className="flex items-center justify-between text-xs">
                                    <span className="text-gray-400 truncate flex-1 mr-2">
                                        {file.name}
                                    </span>
                                    <button
                                        onClick={() => removeFile(index)}
                                        className="text-gray-500 hover:text-red-400 transition-colors p-0.5"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 錯誤訊息 */}
            {error && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-900/20 rounded p-2 border border-red-800/50">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* 特效選擇器（多個 .efk 時顯示） */}
            {efkFiles.length > 1 && (
                <div className="space-y-2 p-3 bg-purple-900/20 border border-purple-700/50 rounded">
                    <div className="flex items-center gap-2 text-xs text-purple-300">
                        <Layers className="w-4 h-4" />
                        <span>找到 {efkFiles.length} 個特效檔案</span>
                    </div>
                    <select
                        value={selectedEfkIndex}
                        onChange={(e) => setSelectedEfkIndex(parseInt(e.target.value))}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-purple-500"
                    >
                        {efkFiles.map((file, index) => (
                            <option key={index} value={index}>
                                {file.name}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* 確認按鈕 */}
            {selectedFiles.length > 0 && hasEfkFile && !error && (
                <div className="flex gap-2">
                    <button
                        onClick={handleConfirmUpload}
                        disabled={disabled}
                        className="flex-1 py-2 bg-green-600 hover:bg-green-500 text-white rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        載入選擇的特效
                    </button>
                    {efkFiles.length > 1 && (
                        <button
                            onClick={handleBatchUpload}
                            disabled={disabled}
                            className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Layers className="w-4 h-4" />
                            載入全部 ({efkFiles.length})
                        </button>
                    )}
                </div>
            )}

            {/* 使用說明 */}
            <div className="text-[10px] text-gray-500 space-y-1">
                <p>💡 <strong>資料夾上傳</strong>：選擇包含 .efk 和所有關聯資源的資料夾</p>
                <p>💡 <strong>多檔上傳</strong>：逐一選擇 .efk 和需要的 .png / .efkmat 等檔案</p>
            </div>

            {/* Runtime 未初始化警告 */}
            {disabled && (
                <div className="flex items-center gap-2 p-2 bg-yellow-900/30 border border-yellow-700/50 rounded text-xs text-yellow-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>請先確保 3D 場景已載入（切換到 Scene 面板查看模型），Effekseer Runtime 才會初始化。</span>
                </div>
            )}
        </div>
    );
}

export type { UploadedEffect };

