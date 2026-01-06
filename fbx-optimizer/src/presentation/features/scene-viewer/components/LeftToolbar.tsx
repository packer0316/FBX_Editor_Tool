import React, { useState, useRef, useEffect } from 'react';
import { Grid, Camera, Activity, FolderOpen } from 'lucide-react';
import { type ThemeStyle, themeOptions, type ThemeMode } from '../../../hooks/useTheme';
import { useClickOutside } from '../../../hooks/useClickOutside';
import { CAMERA_PRESETS, type CameraPresetType } from '../../../../domain/value-objects/CameraPreset';

interface LeftToolbarProps {
    currentTheme: ThemeStyle;
    showGrid: boolean;
    setShowGrid: (show: boolean) => void;
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
    activeSidebarPanel: 'none' | 'theme' | 'camera' | 'ground';
    toggleSidebarPanel: (panel: 'none' | 'theme' | 'camera' | 'ground') => void;

    // Camera Settings
    cameraSettings: { fov: number; near: number; far: number };
    setCameraSettings: (settings: { fov: number; near: number; far: number }) => void;
    applyPreset: (preset: CameraPresetType) => void;
    selectedPreset: CameraPresetType;
    toneMappingExposure: number;
    setToneMappingExposure: (val: number) => void;
    whitePoint: number;
    setWhitePoint: (val: number) => void;
    hdriUrl: string;
    setHdriUrl: (url: string) => void;
    environmentIntensity: number;
    setEnvironmentIntensity: (val: number) => void;

    // Bone Binding
    bones: any[]; // Using any[] for now to avoid importing Bone type if not easily available, or import it if possible
    boneSearchQuery: string;
    setBoneSearchQuery: (q: string) => void;
    selectedBoneUuid: string | null;
    setSelectedBoneUuid: (uuid: string | null) => void;
    isCameraBound: boolean;
    setIsCameraBound: (bound: boolean) => void;

    // Ground Settings
    showGroundPlane: boolean;
    setShowGroundPlane: (show: boolean) => void;
    groundPlaneColor: string;
    setGroundPlaneColor: (color: string) => void;
    groundPlaneOpacity: number;
    setGroundPlaneOpacity: (opacity: number) => void;
    enableShadows: boolean;
    setEnableShadows: (enable: boolean) => void;

    // Keyboard Camera Controls
    keyboardControlsEnabled: boolean;
    setKeyboardControlsEnabled: (enabled: boolean) => void;
    cameraMoveSpeed: number;
    setCameraMoveSpeed: (speed: number) => void;

    // Performance Monitor
    showPerformanceMonitor: boolean;
    setShowPerformanceMonitor: (show: boolean) => void;

    // Orthographic Camera
    isOrthographic: boolean;
    setIsOrthographic: (isOrtho: boolean) => void;
    orthoZoom: number;
    setOrthoZoom: (zoom: number) => void;

    // Scene Background Color
    sceneBgColor: string;
    setSceneBgColor: (color: string | null) => void;
    defaultSceneBgColor: string;

    // Project IO
    onOpenProjectIO?: () => void;
}

const LeftToolbar: React.FC<LeftToolbarProps> = ({
    currentTheme,
    showGrid,
    setShowGrid,
    themeMode,
    setThemeMode,
    activeSidebarPanel,
    toggleSidebarPanel,
    cameraSettings,
    setCameraSettings,
    applyPreset,
    selectedPreset,
    toneMappingExposure,
    setToneMappingExposure,
    whitePoint,
    setWhitePoint,
    hdriUrl,
    setHdriUrl,
    environmentIntensity,
    setEnvironmentIntensity,
    bones,
    boneSearchQuery,
    setBoneSearchQuery,
    selectedBoneUuid,
    setSelectedBoneUuid,
    isCameraBound,
    setIsCameraBound,
    showGroundPlane,
    setShowGroundPlane,
    groundPlaneColor,
    setGroundPlaneColor,
    groundPlaneOpacity,
    setGroundPlaneOpacity,
    enableShadows,
    setEnableShadows,
    keyboardControlsEnabled,
    setKeyboardControlsEnabled,
    cameraMoveSpeed,
    setCameraMoveSpeed,
    showPerformanceMonitor,
    setShowPerformanceMonitor,
    isOrthographic,
    setIsOrthographic,
    orthoZoom,
    setOrthoZoom,
    sceneBgColor,
    setSceneBgColor,
    defaultSceneBgColor,
    onOpenProjectIO
}) => {
    const themeMenuRef = useRef<HTMLDivElement>(null);
    const cameraSettingsRef = useRef<HTMLDivElement>(null);
    const groundSettingsRef = useRef<HTMLDivElement>(null);

    // Drag functionality state
    // Default position: top-1/3 (approx 33%)
    const [positionY, setPositionY] = useState<number>(33);
    const isDraggingRef = useRef(false);
    const dragOffsetRef = useRef<number>(0); // 記錄拖拉開始時，滑鼠相對工具列中心的偏移
    const toolbarRef = useRef<HTMLDivElement>(null);

    const handleMouseDown = (e: React.MouseEvent) => {
        isDraggingRef.current = true;
        e.preventDefault(); // Prevent text selection

        // 計算拖拉開始時，滑鼠相對工具列中心的偏移量
        if (toolbarRef.current) {
            const toolbarRect = toolbarRef.current.getBoundingClientRect();
            const toolbarCenterY = toolbarRect.top + toolbarRect.height / 2;
            dragOffsetRef.current = e.clientY - toolbarCenterY;
        }
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDraggingRef.current) return;

            // 計算新位置：滑鼠位置 - 拖拉偏移量 = 工具列中心應在的位置
            const toolbarCenterY = e.clientY - dragOffsetRef.current;
            const newY = (toolbarCenterY / window.innerHeight) * 100;

            // Clamp between 10% and 90% to keep it on screen
            const clampedY = Math.max(10, Math.min(90, newY));

            setPositionY(clampedY);
        };

        const handleMouseUp = () => {
            isDraggingRef.current = false;
            dragOffsetRef.current = 0;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    // 點擊外部關閉面板
    useClickOutside(
        [toolbarRef, themeMenuRef, cameraSettingsRef, groundSettingsRef] as React.RefObject<HTMLElement>[],
        () => {
            toggleSidebarPanel('none');
        },
        activeSidebarPanel !== 'none'
    );

    return (
        <div
            ref={toolbarRef}
            className={`absolute left-4 w-14 ${currentTheme.toolbarBg} ${currentTheme.toolbarBorder} rounded-2xl flex flex-col items-center py-4 space-y-4 z-[400] shadow-2xl backdrop-blur-2xl border transition-colors duration-300`}
            style={{
                top: `${positionY}%`,
                transform: 'translateY(-50%)'
            }}
        >
            {/* Tool: Select / Move */}
            <div className="group relative">
                <button className={`p-3 rounded-xl transition-all duration-300 hover:scale-110 ${currentTheme.button} ${currentTheme.itemHover}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" /><path d="M13 13l6 6" /></svg>
                </button>
                <div className={`absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 ${currentTheme.tooltipBg} backdrop-blur-md border ${currentTheme.toolbarBorder} ${currentTheme.tooltipText} text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl transition-opacity duration-200`}>
                    選取工具 (V)
                    <div className={`absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 ${currentTheme.tooltipBg} rotate-45 border-b border-l ${currentTheme.toolbarBorder}`}></div>
                </div>
            </div>

            {/* Tool: Project IO (Export/Import) */}
            <div className="group relative">
                <button 
                    onClick={onOpenProjectIO}
                    className={`p-3 rounded-xl transition-all duration-300 hover:scale-110 ${currentTheme.button} ${currentTheme.itemHover}`}
                >
                    <FolderOpen size={20} />
                </button>
                <div className={`absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 ${currentTheme.tooltipBg} backdrop-blur-md border ${currentTheme.toolbarBorder} ${currentTheme.tooltipText} text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl transition-opacity duration-200`}>
                    專案匯出 / 載入
                    <div className={`absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 ${currentTheme.tooltipBg} rotate-45 border-b border-l ${currentTheme.toolbarBorder}`}></div>
                </div>
            </div>

            {/* Tool: Scale */}
            <div className="group relative">
                <button disabled className={`p-3 rounded-xl transition-all duration-300 ${currentTheme.button} opacity-30 cursor-not-allowed`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 3l-6 6" /><path d="M21 3v6" /><path d="M21 3h-6" /><path d="M3 21l6-6" /><path d="M3 21v-6" /><path d="M3 21h6" /><path d="M14.5 9.5L9.5 14.5" /></svg>
                </button>
                <div className={`absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 ${currentTheme.tooltipBg} backdrop-blur-md border ${currentTheme.toolbarBorder} ${currentTheme.tooltipText} text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl transition-opacity duration-200`}>
                    縮放工具 (未實作)
                    <div className={`absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 ${currentTheme.tooltipBg} rotate-45 border-b border-l ${currentTheme.toolbarBorder}`}></div>
                </div>
            </div>

            {/* Tool: Grid Toggle */}
            <div className="group relative">
                <button
                    onClick={() => setShowGrid(!showGrid)}
                    className={`p-3 rounded-xl transition-all duration-300 hover:scale-110 ${showGrid ? currentTheme.activeButton : `${currentTheme.button} ${currentTheme.itemHover}`}`}
                >
                    <Grid size={20} />
                </button>
                <div className={`absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 ${currentTheme.tooltipBg} backdrop-blur-md border ${currentTheme.toolbarBorder} ${currentTheme.tooltipText} text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl transition-opacity duration-200`}>
                    {showGrid ? '隱藏網格' : '顯示網格'}
                    <div className={`absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 ${currentTheme.tooltipBg} rotate-45 border-b border-l ${currentTheme.toolbarBorder}`}></div>
                </div>
            </div>

            {/* Tool: Performance Monitor Toggle */}
            <div className="group relative">
                <button
                    onClick={() => setShowPerformanceMonitor(!showPerformanceMonitor)}
                    className={`p-3 rounded-xl transition-all duration-300 hover:scale-110 ${showPerformanceMonitor ? 'bg-gradient-to-b from-emerald-400 to-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)] border-t border-white/20' : `${currentTheme.button} ${currentTheme.itemHover}`}`}
                >
                    <Activity size={20} />
                </button>
                <div className={`absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 ${currentTheme.tooltipBg} backdrop-blur-md border ${currentTheme.toolbarBorder} ${currentTheme.tooltipText} text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl transition-opacity duration-200`}>
                    {showPerformanceMonitor ? '隱藏效能監控' : '顯示效能監控'}
                    <div className={`absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 ${currentTheme.tooltipBg} rotate-45 border-b border-l ${currentTheme.toolbarBorder}`}></div>
                </div>
            </div>

            <div className={`w-8 h-px ${currentTheme.toolbarBorder} bg-opacity-20 my-1`}></div>

            {/* Tool: Theme Toggle */}
            <div className="group relative" ref={themeMenuRef}>
                <button
                    className={`p-3 rounded-xl transition-all duration-300 hover:scale-110 ${activeSidebarPanel === 'theme' ? currentTheme.activeButton : `${currentTheme.button} ${currentTheme.itemHover}`}`}
                    onClick={() => toggleSidebarPanel('theme')}
                >
                    {(() => {
                        const option = themeOptions.find(opt => opt.id === themeMode);
                        const Icon = option?.icon || themeOptions[0].icon;
                        return <Icon size={20} />;
                    })()}
                </button>

                {/* Tooltip (only show when menu is closed) */}
                {activeSidebarPanel !== 'theme' && (
                    <div className={`absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 ${currentTheme.tooltipBg} backdrop-blur-md border ${currentTheme.toolbarBorder} ${currentTheme.tooltipText} text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl transition-opacity duration-200`}>
                        切換模式
                        <div className={`absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 ${currentTheme.tooltipBg} rotate-45 border-b border-l ${currentTheme.toolbarBorder}`}></div>
                    </div>
                )}

                {/* Theme Selection Menu */}
                {activeSidebarPanel === 'theme' && (
                    <div className={`fixed left-20 top-4 w-48 max-h-[calc(100vh-2rem)] overflow-y-auto ${currentTheme.panelBg} border ${currentTheme.panelBorder} rounded-xl shadow-2xl py-2 px-1 z-50 flex flex-col gap-1 custom-scrollbar animate-fade-in-left`}>
                        {themeOptions.map((option) => {
                            const Icon = option.icon;
                            const isActive = themeMode === option.id;
                            return (
                                <button
                                    key={option.id}
                                    onClick={() => {
                                        setThemeMode(option.id);
                                        toggleSidebarPanel('none');
                                    }}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${isActive
                                        ? currentTheme.activeButton
                                        : `${currentTheme.text} hover:bg-white/5`
                                        }`}
                                >
                                    <Icon size={16} />
                                    <span className="flex-1 text-left">{option.name}</span>
                                    {/* Color Preview Dot */}
                                    <div
                                        className="w-3 h-3 rounded-full border border-gray-500/30 shadow-sm"
                                        style={{ backgroundColor: option.color }}
                                    />
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Tool: Camera Settings */}
            <div className="group relative" ref={cameraSettingsRef}>
                <button
                    className={`p-3 rounded-xl transition-all duration-300 hover:scale-110 ${activeSidebarPanel === 'camera'
                        ? currentTheme.activeButton
                        : `${currentTheme.button} ${currentTheme.itemHover}`
                        }`}
                    onClick={() => toggleSidebarPanel('camera')}
                >
                    <Camera size={20} />
                </button>
                <div className={`absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 ${currentTheme.tooltipBg} backdrop-blur-md border ${currentTheme.toolbarBorder} ${currentTheme.tooltipText} text-xs rounded-lg opacity-0 pointer-events-none whitespace-nowrap z-50 shadow-xl transition-opacity duration-200 ${activeSidebarPanel !== 'camera' ? 'group-hover:opacity-100' : ''}`}>
                    相機參數
                    <div className={`absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 ${currentTheme.tooltipBg} rotate-45 border-b border-l ${currentTheme.toolbarBorder}`}></div>
                </div>

                {/* Camera Settings Popover */}
                {activeSidebarPanel === 'camera' && (
                    <div className={`fixed left-20 top-4 bottom-4 w-64 overflow-y-auto ${currentTheme.panelBg} border ${currentTheme.panelBorder} rounded-xl shadow-2xl z-50 custom-scrollbar animate-fade-in-left`}>
                        <div className="sticky top-0 bg-gray-900/95 backdrop-blur-sm z-10 px-4 pt-4 pb-3 border-b border-white/10">
                            <h3 className={`text-sm font-bold ${currentTheme.text} flex items-center gap-2`}>
                                <Camera size={16} className="text-neon-blue" />
                                相機參數
                            </h3>
                        </div>
                        <div className="px-4 py-4 space-y-5">

                            {/* Camera Type Toggle */}
                            <div>
                                <label className="text-xs text-gray-400 block mb-2 font-medium">相機類型</label>
                                <div className="grid grid-cols-2 gap-1.5">
                                    <button
                                        onClick={() => setIsOrthographic(false)}
                                        className={`py-1.5 text-[11px] rounded-md transition-all ${!isOrthographic
                                            ? 'bg-neon-blue text-white shadow-md shadow-blue-500/20 font-medium'
                                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'
                                            }`}
                                    >
                                        透視
                                    </button>
                                    <button
                                        onClick={() => setIsOrthographic(true)}
                                        className={`py-1.5 text-[11px] rounded-md transition-all ${isOrthographic
                                            ? 'bg-neon-blue text-white shadow-md shadow-blue-500/20 font-medium'
                                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'
                                            }`}
                                    >
                                        正交
                                    </button>
                                </div>
                            </div>

                            {/* FOV Slider (透視模式) */}
                            {!isOrthographic && (
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs text-gray-400 font-medium">FOV (視野)</label>
                                        <span className="text-xs text-neon-blue font-mono bg-blue-500/10 px-1.5 py-0.5 rounded">{cameraSettings.fov}°</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="10"
                                        max="120"
                                        step="1"
                                        value={cameraSettings.fov}
                                        onChange={(e) =>
                                            setCameraSettings({ ...cameraSettings, fov: parseFloat(e.target.value) })
                                        }
                                        className="w-full h-1.5 slider-blue-track appearance-none cursor-pointer rounded-full"
                                    />
                                </div>
                            )}

                            {/* Zoom Slider (正交模式) */}
                            {isOrthographic && (
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs text-gray-400 font-medium">縮放 (Zoom)</label>
                                        <span className="text-xs text-neon-blue font-mono bg-blue-500/10 px-1.5 py-0.5 rounded">{orthoZoom}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1"
                                        max="200"
                                        step="1"
                                        value={orthoZoom}
                                        onChange={(e) => setOrthoZoom(parseFloat(e.target.value))}
                                        className="w-full h-1.5 slider-blue-track appearance-none cursor-pointer rounded-full"
                                    />
                                </div>
                            )}

                            {/* Near Plane Input */}
                            <div>
                                <label className="text-xs text-gray-400 block mb-2 font-medium">Near (近裁剪面)</label>
                                <input
                                    type="number"
                                    min="0.01"
                                    max="10"
                                    step="0.01"
                                    value={cameraSettings.near}
                                    onChange={(e) =>
                                        setCameraSettings({ ...cameraSettings, near: parseFloat(e.target.value) })
                                    }
                                    className={`w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg ${currentTheme.text} text-sm focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue transition-all`}
                                />
                            </div>

                            {/* Far Plane Input */}
                            <div>
                                <label className="text-xs text-gray-400 block mb-2 font-medium">Far (遠裁剪面)</label>
                                <input
                                    type="number"
                                    min="100"
                                    max="10000"
                                    step="10"
                                    value={cameraSettings.far}
                                    onChange={(e) =>
                                        setCameraSettings({ ...cameraSettings, far: parseFloat(e.target.value) })
                                    }
                                    className={`w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg ${currentTheme.text} text-sm focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue transition-all`}
                                />
                            </div>

                            {/* Reset Button */}
                            <button
                                onClick={() => setCameraSettings({ fov: 50, near: 0.1, far: 1000 })}
                                className="w-full py-2 text-xs text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-white/5 hover:border-white/20"
                            >
                                重置預設值
                            </button>

                            {/* Scene Background Color */}
                            <div className="pt-4 border-t border-white/10">
                                <h4 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">預覽視窗底色</h4>
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <input
                                            type="color"
                                            value={sceneBgColor}
                                            onChange={(e) => setSceneBgColor(e.target.value)}
                                            className="w-10 h-10 rounded-lg cursor-pointer border-2 border-white/10 hover:border-white/30 transition-colors"
                                            style={{ backgroundColor: sceneBgColor }}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            value={sceneBgColor}
                                            onChange={(e) => setSceneBgColor(e.target.value)}
                                            placeholder="#000000"
                                            className={`w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg ${currentTheme.text} text-xs font-mono focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue transition-all`}
                                        />
                                    </div>
                                </div>
                                {sceneBgColor !== defaultSceneBgColor && (
                                    <button
                                        onClick={() => setSceneBgColor(null)}
                                        className="mt-2 w-full py-1.5 text-xs text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-white/5 hover:border-white/20"
                                    >
                                        重置為主題預設
                                    </button>
                                )}
                            </div>

                            {/* Tone Mapping & Exposure Section */}
                            <div className="pt-4 border-t border-white/10">
                                <h4 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">Tone Mapping & 曝光</h4>

                                {/* Camera Presets */}
                                <div className="mb-4">
                                    <label className="text-xs text-gray-400 block mb-2 font-medium">相機預設</label>
                                    <div className="grid grid-cols-3 gap-1.5">
                                        {Object.values(CAMERA_PRESETS).map((preset) => (
                                            <button
                                                key={preset.type}
                                                onClick={() => applyPreset(preset.type)}
                                                className={`py-1.5 text-[10px] rounded-md transition-all ${selectedPreset === preset.type
                                                    ? 'bg-neon-blue text-white shadow-md shadow-blue-500/20 font-medium'
                                                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'
                                                    }`}
                                                title={preset.description}
                                            >
                                                {preset.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Tone Mapping Exposure */}
                                <div className="mb-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs text-gray-400 font-medium">曝光 (Exposure)</label>
                                        <span className="text-xs text-neon-blue font-mono bg-blue-500/10 px-1.5 py-0.5 rounded">{toneMappingExposure.toFixed(2)}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0.1"
                                        max="3.0"
                                        step="0.1"
                                        value={toneMappingExposure}
                                        onChange={(e) => setToneMappingExposure(parseFloat(e.target.value))}
                                        className="w-full h-1.5 slider-blue-track appearance-none cursor-pointer rounded-full"
                                    />
                                </div>

                                {/* White Point */}
                                <div className="mb-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs text-gray-400 font-medium">白點 (White Point)</label>
                                        <span className="text-xs text-neon-blue font-mono bg-blue-500/10 px-1.5 py-0.5 rounded">{whitePoint.toFixed(2)}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0.5"
                                        max="2.0"
                                        step="0.1"
                                        value={whitePoint}
                                        onChange={(e) => setWhitePoint(parseFloat(e.target.value))}
                                        className="w-full h-1.5 slider-blue-track appearance-none cursor-pointer rounded-full"
                                    />
                                </div>

                                {/* HDRI Environment */}
                                <div className="mb-4">
                                    <label className="text-xs text-gray-400 block mb-2 font-medium">HDRI 環境貼圖 (可選)</label>
                                    <input
                                        type="text"
                                        placeholder="輸入 HDRI URL..."
                                        value={hdriUrl}
                                        onChange={(e) => setHdriUrl(e.target.value)}
                                        className={`w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg ${currentTheme.text} text-xs focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue transition-all`}
                                    />
                                    {hdriUrl && (
                                        <button
                                            onClick={() => setHdriUrl('')}
                                            className="mt-2 w-full py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors border border-red-500/20"
                                        >
                                            清除 HDRI
                                        </button>
                                    )}
                                </div>

                                {/* Environment Intensity */}
                                {hdriUrl && (
                                    <div className="mb-3">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="text-xs text-gray-400 font-medium">環境光強度</label>
                                            <span className="text-xs text-neon-blue font-mono bg-blue-500/10 px-1.5 py-0.5 rounded">{environmentIntensity.toFixed(2)}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="3"
                                            step="0.1"
                                            value={environmentIntensity}
                                            onChange={(e) => setEnvironmentIntensity(parseFloat(e.target.value))}
                                            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Keyboard Controls Section */}
                            <div className="pt-4 border-t border-white/10">
                                <h4 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">鍵盤控制</h4>
                                
                                {/* Enable Keyboard Controls */}
                                <div className="mb-3">
                                    <label className="flex items-center justify-between cursor-pointer group">
                                        <span className="text-xs text-gray-300 group-hover:text-white transition-colors">啟用 WASD 移動</span>
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                checked={keyboardControlsEnabled}
                                                onChange={(e) => setKeyboardControlsEnabled(e.target.checked)}
                                                className="sr-only"
                                            />
                                            <div className={`w-10 h-5 rounded-full transition-all ${keyboardControlsEnabled ? 'bg-neon-blue' : 'bg-gray-700'}`}>
                                                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${keyboardControlsEnabled ? 'translate-x-5' : ''}`}></div>
                                            </div>
                                        </div>
                                    </label>
                                </div>

                                {/* Camera Move Speed */}
                                {keyboardControlsEnabled && (
                                    <div className="mb-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="text-xs text-gray-400 font-medium">移動速度</label>
                                            <span className="text-xs text-neon-blue font-mono bg-blue-500/10 px-1.5 py-0.5 rounded">{cameraMoveSpeed.toFixed(1)}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="1"
                                            max="20"
                                            step="0.5"
                                            value={cameraMoveSpeed}
                                            onChange={(e) => setCameraMoveSpeed(parseFloat(e.target.value))}
                                            className="w-full h-1.5 slider-blue-track appearance-none cursor-pointer rounded-full"
                                        />
                                        <div className="mt-2 px-2 py-1.5 bg-blue-500/5 border border-blue-500/20 rounded text-xs text-gray-400">
                                            <div className="space-y-0.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-semibold text-neon-blue">W/A/S/D</span>
                                                    <span>- 前後左右</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-semibold text-neon-blue">Q/E</span>
                                                    <span>- 上下移動</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-semibold text-neon-blue">Shift</span>
                                                    <span>- 加速移動</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Bone Binding Section */}
                            <div className="pt-4 border-t border-white/10">
                                <h4 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">骨骼綁定</h4>

                                {/* Bone Search */}
                                <div className="mb-3">
                                    <input
                                        type="text"
                                        placeholder="搜尋骨骼..."
                                        value={boneSearchQuery}
                                        onChange={(e) => setBoneSearchQuery(e.target.value)}
                                        className={`w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg ${currentTheme.text} text-xs focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue transition-all`}
                                    />
                                </div>

                                {/* Bone List */}
                                <div className="max-h-40 overflow-y-auto mb-3 bg-black/30 rounded-lg border border-white/10 custom-scrollbar">
                                    {bones.length === 0 ? (
                                        <div className="p-4 text-xs text-gray-500 text-center italic">
                                            {bones ? '此模型無骨骼' : '請先載入模型'}
                                        </div>
                                    ) : (
                                        bones
                                            .filter((bone) =>
                                                bone.name.toLowerCase().includes(boneSearchQuery.toLowerCase())
                                            )
                                            .map((bone) => (
                                                <div
                                                    key={bone.uuid}
                                                    onClick={() => setSelectedBoneUuid(bone.uuid)}
                                                    className={`px-3 py-2 text-xs cursor-pointer transition-colors ${selectedBoneUuid === bone.uuid
                                                        ? 'bg-neon-blue/20 text-neon-blue border-l-2 border-neon-blue'
                                                        : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                                                        }`}
                                                >
                                                    {bone.name || '未命名骨骼'}
                                                </div>
                                            ))
                                    )}
                                </div>

                                {/* Bind/Unbind Controls */}
                                <div className="flex gap-2">
                                    {!isCameraBound ? (
                                        <button
                                            onClick={() => {
                                                if (selectedBoneUuid) {
                                                    setIsCameraBound(true);
                                                }
                                            }}
                                            disabled={!selectedBoneUuid}
                                            className={`flex-1 py-2 text-xs rounded-lg transition-all font-medium ${selectedBoneUuid
                                                ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-600/20'
                                                : 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/5'
                                                }`}
                                        >
                                            開始綁定
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                setIsCameraBound(false);
                                                setSelectedBoneUuid(null);
                                            }}
                                            className="flex-1 py-2 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg transition-all font-medium"
                                        >
                                            取消綁定
                                        </button>
                                    )}
                                </div>

                                {isCameraBound && selectedBoneUuid && (
                                    <div className="mt-3 p-2.5 bg-green-500/10 border border-green-500/20 rounded-lg flex items-start gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0"></div>
                                        <p className="text-xs text-green-400 leading-relaxed">
                                            相機已綁定到: <span className="font-medium text-green-300">{bones.find((b) => b.uuid === selectedBoneUuid)?.name}</span>
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Tool: Ground Plane Toggle */}
            <div className="group relative" ref={groundSettingsRef}>
                <button
                    className={`p-3 rounded-xl transition-all duration-300 hover:scale-110 ${showGroundPlane || activeSidebarPanel === 'ground'
                        ? currentTheme.activeButton
                        : `${currentTheme.button} ${currentTheme.itemHover}`
                        }`}
                    onClick={() => toggleSidebarPanel('ground')}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>
                </button>
                <div className={`absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 ${currentTheme.tooltipBg} backdrop-blur-md border ${currentTheme.toolbarBorder} ${currentTheme.tooltipText} text-xs rounded-lg opacity-0 pointer-events-none whitespace-nowrap z-50 shadow-xl transition-opacity duration-200 ${activeSidebarPanel !== 'ground' ? 'group-hover:opacity-100' : ''}`}>
                    地面設定
                    <div className={`absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 ${currentTheme.tooltipBg} rotate-45 border-b border-l ${currentTheme.toolbarBorder}`}></div>
                </div>

                {/* Ground Settings Popover */}
                {activeSidebarPanel === 'ground' && (
                    <div className={`fixed left-20 top-4 bottom-4 w-64 overflow-y-auto ${currentTheme.panelBg} border ${currentTheme.panelBorder} rounded-xl shadow-2xl z-50 custom-scrollbar animate-fade-in-left`}>
                        <div className="sticky top-0 bg-gray-900/95 backdrop-blur-sm z-10 px-4 pt-4 pb-3 border-b border-white/10">
                            <h3 className={`text-sm font-bold ${currentTheme.text} flex items-center gap-2`}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-neon-blue"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>
                                地面設定
                            </h3>
                        </div>
                        <div className="px-4 py-4 space-y-5">

                            {/* Show Ground Plane Toggle */}
                            <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            checked={showGroundPlane}
                                            onChange={(e) => setShowGroundPlane(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-neon-blue"></div>
                                    </div>
                                    <span className="text-sm text-gray-300 font-medium">顯示地面</span>
                                </label>
                            </div>

                            {/* Color Picker */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs text-gray-400 font-medium">顏色</label>
                                    <span className="text-xs text-gray-500 font-mono">{groundPlaneColor}</span>
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="color"
                                        value={groundPlaneColor}
                                        onChange={(e) => setGroundPlaneColor(e.target.value)}
                                        className="w-8 h-8 rounded border border-white/10 bg-transparent cursor-pointer p-0 overflow-hidden"
                                    />
                                    <input
                                        type="text"
                                        value={groundPlaneColor}
                                        onChange={(e) => setGroundPlaneColor(e.target.value)}
                                        className={`flex-1 px-3 py-1 bg-black/30 border border-white/10 rounded-lg ${currentTheme.text} text-xs focus:outline-none focus:border-neon-blue transition-all`}
                                    />
                                </div>
                            </div>

                            {/* Opacity Slider */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs text-gray-400 font-medium">透明度</label>
                                    <span className="text-xs text-neon-blue font-mono bg-blue-500/10 px-1.5 py-0.5 rounded">{groundPlaneOpacity.toFixed(2)}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={groundPlaneOpacity}
                                    onChange={(e) => setGroundPlaneOpacity(parseFloat(e.target.value))}
                                    className="w-full h-1.5 slider-blue-track appearance-none cursor-pointer rounded-full"
                                />
                            </div>

                            {/* Shadow Toggle */}
                            <div className="pt-4 border-t border-white/10">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            checked={enableShadows}
                                            onChange={(e) => setEnableShadows(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-neon-blue"></div>
                                    </div>
                                    <span className="text-sm text-gray-300 font-medium">顯示陰影</span>
                                </label>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Drag Handle */}
            <div
                className="w-full flex justify-center pt-2 pb-1 cursor-ns-resize opacity-30 hover:opacity-100 transition-opacity"
                onMouseDown={handleMouseDown}
                title="拖曳調整位置"
            >
                <div className={`w-8 h-1 ${currentTheme.accent} opacity-50 rounded-full`}></div>
            </div>
        </div>
    );
};

export default LeftToolbar;
