import React, { useState, useRef, useEffect } from 'react';
import { RotateCcw, Camera, Video, Square, Monitor, X } from 'lucide-react';

export type AspectRatio = '16:9' | '16:10' | '21:9' | '32:9' | 'custom' | 'free';

interface SceneToolbarProps {
    onResetCamera: () => void;
    onTakeScreenshot: () => void;
    onStartRecording: () => void;
    onStopRecording: () => void;
    isRecording: boolean;
    aspectRatio: AspectRatio;
    onAspectRatioChange: (ratio: AspectRatio) => void;
    customWidth?: number;
    customHeight?: number;
    onCustomSizeChange?: (width: number, height: number) => void;
}

const SceneToolbar: React.FC<SceneToolbarProps> = ({ 
    onResetCamera, 
    onTakeScreenshot, 
    onStartRecording, 
    onStopRecording, 
    isRecording,
    aspectRatio,
    onAspectRatioChange,
    customWidth = 1920,
    customHeight = 1080,
    onCustomSizeChange
}) => {
    const [showAspectMenu, setShowAspectMenu] = useState(false);
    const [showCustomDialog, setShowCustomDialog] = useState(false);
    const [tempWidth, setTempWidth] = useState(customWidth.toString());
    const [tempHeight, setTempHeight] = useState(customHeight.toString());
    const aspectMenuRef = useRef<HTMLDivElement>(null);

    // 點擊外部關閉選單
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (aspectMenuRef.current && !aspectMenuRef.current.contains(event.target as Node)) {
                setShowAspectMenu(false);
            }
        };

        if (showAspectMenu) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showAspectMenu]);

    const aspectRatioOptions: { value: AspectRatio; label: string }[] = [
        { value: 'free', label: '自由比例' },
        { value: '16:9', label: '16:9' },
        { value: '16:10', label: '16:10' },
        { value: '21:9', label: '21:9' },
        { value: '32:9', label: '32:9' },
        { value: 'custom', label: '自訂尺寸...' },
    ];

    const handleAspectRatioSelect = (ratio: AspectRatio) => {
        if (ratio === 'custom') {
            setShowCustomDialog(true);
            setShowAspectMenu(false);
        } else {
            onAspectRatioChange(ratio);
            setShowAspectMenu(false);
        }
    };

    const handleCustomSizeApply = () => {
        const width = parseInt(tempWidth, 10);
        const height = parseInt(tempHeight, 10);
        if (width > 0 && height > 0 && onCustomSizeChange) {
            onCustomSizeChange(width, height);
            onAspectRatioChange('custom');
            setShowCustomDialog(false);
        }
    };

    const getAspectRatioLabel = () => {
        if (aspectRatio === 'custom') {
            return `${customWidth}x${customHeight}`;
        }
        if (aspectRatio === 'free') {
            return '自由';
        }
        // 顯示比例的數值
        const [w, h] = aspectRatio.split(':').map(Number);
        const ratio = w / h;
        // 使用更精確的顯示（保留適當的小數位數）
        const ratioDisplay = ratio.toFixed(2).replace(/\.?0+$/, ''); // 移除尾部的零
        return `${aspectRatio} (${ratioDisplay})`;
    };

    return (
        <div className="absolute top-4 left-4 flex gap-2 z-10">
            <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-lg p-1 flex items-center gap-1 shadow-lg">
                <button
                    onClick={onResetCamera}
                    className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors group relative"
                    title="Reset Camera"
                >
                    <RotateCcw size={20} />
                    <span className="sr-only">Reset Camera</span>

                    {/* Tooltip */}
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                        重置相機
                    </div>
                </button>

                {/* 分隔線 */}
                <div className="w-px h-6 bg-gray-700"></div>

                <button
                    onClick={onTakeScreenshot}
                    className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors group relative"
                    title="Take Screenshot"
                >
                    <Camera size={20} />
                    <span className="sr-only">Take Screenshot</span>

                    {/* Tooltip */}
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                        拍照下載
                    </div>
                </button>

                {/* 分隔線 */}
                <div className="w-px h-6 bg-gray-700"></div>

                <button
                    onClick={isRecording ? onStopRecording : onStartRecording}
                    className={`p-2 rounded-md transition-colors group relative ${
                        isRecording 
                            ? 'text-red-500 hover:text-red-400 hover:bg-gray-700 animate-pulse' 
                            : 'text-gray-300 hover:text-white hover:bg-gray-700'
                    }`}
                    title={isRecording ? "Stop Recording" : "Start Recording"}
                >
                    {isRecording ? <Square size={20} /> : <Video size={20} />}
                    <span className="sr-only">{isRecording ? 'Stop Recording' : 'Start Recording'}</span>

                    {/* Tooltip */}
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                        {isRecording ? '停止錄影' : '開始錄影'}
                    </div>
                </button>

                {/* 分隔線 */}
                <div className="w-px h-6 bg-gray-700"></div>

                {/* 比例選擇器 */}
                <div className="relative" ref={aspectMenuRef}>
                    <button
                        onClick={() => setShowAspectMenu(!showAspectMenu)}
                        className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors group relative"
                        title="調整比例"
                    >
                        <Monitor size={20} />

                        {/* Tooltip */}
                        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                            {getAspectRatioLabel()}
                        </div>
                    </button>

                    {/* 比例選單 */}
                    {showAspectMenu && (
                        <div className="absolute top-full left-0 mt-2 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[140px]">
                            {aspectRatioOptions.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => handleAspectRatioSelect(option.value)}
                                    className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                                        aspectRatio === option.value
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-300 hover:bg-gray-700'
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* 自訂尺寸對話框 */}
            {showCustomDialog && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-6 w-[320px]">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-white font-semibold">自訂尺寸</h3>
                            <button
                                onClick={() => setShowCustomDialog(false)}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">寬度 (Width)</label>
                                <input
                                    type="number"
                                    value={tempWidth}
                                    onChange={(e) => setTempWidth(e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                                    placeholder="1920"
                                    min="1"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-1">高度 (Height)</label>
                                <input
                                    type="number"
                                    value={tempHeight}
                                    onChange={(e) => setTempHeight(e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                                    placeholder="1080"
                                    min="1"
                                />
                            </div>

                            <div className="text-xs text-gray-500">
                                比例: {tempWidth && tempHeight ? `${(parseInt(tempWidth) / parseInt(tempHeight)).toFixed(2)}:1` : '--'}
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => setShowCustomDialog(false)}
                                    className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleCustomSizeApply}
                                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                                >
                                    確定
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SceneToolbar;
