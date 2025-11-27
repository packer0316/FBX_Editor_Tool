import React, { useState, useRef, useEffect } from 'react';
import { RotateCcw, Camera, Video, Square, Monitor, X } from 'lucide-react';
import { type ThemeStyle } from '../../../hooks/useTheme';

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
    theme: ThemeStyle;
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
    onCustomSizeChange,
    theme
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

    // 基於 1080p 高度計算各比例的像素尺寸
    const aspectRatioOptions: { value: AspectRatio; label: string; pixels?: string }[] = [
        { value: 'free', label: '自由比例' },
        { value: '16:9', label: '16:9', pixels: '1920 × 1080' },
        { value: '16:10', label: '16:10', pixels: '1728 × 1080' },
        { value: '21:9', label: '21:9', pixels: '2560 × 1080' },
        { value: '32:9', label: '32:9', pixels: '3840 × 1080' },
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
        <div className="absolute top-6 left-1/2 -translate-x-1/2 flex gap-2 z-[350]">
            <div className={`glass rounded-full px-2 py-1.5 flex items-center gap-1 transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]`}>
                <button
                    onClick={onResetCamera}
                    className={`p-2.5 rounded-full transition-all duration-300 group relative ${theme.button} hover:scale-110`}
                    title="Reset Camera"
                >
                    <RotateCcw size={18} />
                    <span className="sr-only">Reset Camera</span>

                    {/* Tooltip */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 px-3 py-1.5 bg-gray-900/90 backdrop-blur-md border border-white/10 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl transition-opacity duration-200">
                        重置相機
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900/90 rotate-45 border-t border-l border-white/10"></div>
                    </div>
                </button>

                {/* 分隔線 */}
                <div className="w-px h-5 bg-white/10 mx-1"></div>

                <button
                    onClick={onTakeScreenshot}
                    className={`p-2.5 rounded-full transition-all duration-300 group relative ${theme.button} hover:scale-110`}
                    title="Take Screenshot"
                >
                    <Camera size={18} />
                    <span className="sr-only">Take Screenshot</span>

                    {/* Tooltip */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 px-3 py-1.5 bg-gray-900/90 backdrop-blur-md border border-white/10 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl transition-opacity duration-200">
                        拍照下載
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900/90 rotate-45 border-t border-l border-white/10"></div>
                    </div>
                </button>

                {/* 分隔線 */}
                <div className="w-px h-5 bg-white/10 mx-1"></div>

                <button
                    onClick={isRecording ? onStopRecording : onStartRecording}
                    className={`p-2.5 rounded-full transition-all duration-300 group relative ${isRecording
                        ? 'text-red-500 hover:text-red-400 bg-red-500/10 animate-pulse'
                        : `${theme.button} hover:scale-110`
                        }`}
                    title={isRecording ? "Stop Recording" : "Start Recording"}
                >
                    {isRecording ? <Square size={18} /> : <Video size={18} />}
                    <span className="sr-only">{isRecording ? 'Stop Recording' : 'Start Recording'}</span>

                    {/* Tooltip */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 px-3 py-1.5 bg-gray-900/90 backdrop-blur-md border border-white/10 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl transition-opacity duration-200">
                        {isRecording ? '停止錄影' : '開始錄影'}
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900/90 rotate-45 border-t border-l border-white/10"></div>
                    </div>
                </button>

                {/* 分隔線 */}
                <div className="w-px h-5 bg-white/10 mx-1"></div>

                {/* 比例選擇器 */}
                <div className="relative" ref={aspectMenuRef}>
                    <button
                        onClick={() => setShowAspectMenu(!showAspectMenu)}
                        className={`p-2.5 rounded-full transition-all duration-300 group relative ${theme.button} hover:scale-110`}
                        title="調整比例"
                    >
                        <Monitor size={18} />

                        {/* Tooltip */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 px-3 py-1.5 bg-gray-900/90 backdrop-blur-md border border-white/10 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl transition-opacity duration-200">
                            {getAspectRatioLabel()}
                            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900/90 rotate-45 border-t border-l border-white/10"></div>
                        </div>
                    </button>

                    {/* 比例選單 */}
                    {showAspectMenu && (
                        <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-4 ${theme.panelBg} border ${theme.panelBorder} rounded-xl shadow-2xl py-2 min-w-[220px] z-50 overflow-hidden animate-slide-up`}>
                            {aspectRatioOptions.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => handleAspectRatioSelect(option.value)}
                                    className={`w-full px-4 py-2.5 text-sm transition-all flex items-center justify-between gap-4 ${aspectRatio === option.value
                                        ? theme.activeButton
                                        : `${theme.text} hover:bg-white/5`
                                        }`}
                                >
                                    <span>{option.label}</span>
                                    {option.pixels && (
                                        <span className="text-xs text-gray-400 font-mono">{option.pixels}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* 自訂尺寸對話框 */}
            {showCustomDialog && (
                <div 
                    className="bg-black/60 backdrop-blur-sm z-[99999] animate-fade-in"
                    style={{ 
                        position: 'fixed', 
                        top: 0, 
                        left: 0, 
                        right: 0, 
                        bottom: 0,
                    }}
                    onClick={() => setShowCustomDialog(false)}
                >
                    <div 
                        className="glass-panel rounded-2xl shadow-2xl p-8 w-[360px]"
                        style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            marginTop: '400px',
                            transform: 'translate(-50%, -50%)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h3 className={`${theme.text} text-lg font-bold`}>自訂尺寸</h3>
                            <button
                                onClick={() => setShowCustomDialog(false)}
                                className={`${theme.text} opacity-60 hover:opacity-100 transition-colors p-1 hover:bg-white/10 rounded-full`}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <label className={`block text-sm ${theme.text} opacity-70 mb-2 font-medium`}>寬度 (Width)</label>
                                <input
                                    type="number"
                                    value={tempWidth}
                                    onChange={(e) => setTempWidth(e.target.value)}
                                    className={`w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 ${theme.text} focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue transition-all`}
                                    placeholder="1920"
                                    min="1"
                                />
                            </div>

                            <div>
                                <label className={`block text-sm ${theme.text} opacity-70 mb-2 font-medium`}>高度 (Height)</label>
                                <input
                                    type="number"
                                    value={tempHeight}
                                    onChange={(e) => setTempHeight(e.target.value)}
                                    className={`w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 ${theme.text} focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue transition-all`}
                                    placeholder="1080"
                                    min="1"
                                />
                            </div>

                            <div className={`text-xs ${theme.text} opacity-50 text-center font-mono`}>
                                比例: {tempWidth && tempHeight ? `${(parseInt(tempWidth) / parseInt(tempHeight)).toFixed(2)}:1` : '--'}
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setShowCustomDialog(false)}
                                    className={`flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 ${theme.text} rounded-lg transition-colors font-medium`}
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleCustomSizeApply}
                                    className="flex-1 px-4 py-2.5 bg-neon-blue hover:bg-blue-500 text-white rounded-lg transition-colors shadow-lg shadow-blue-500/30 font-medium"
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
