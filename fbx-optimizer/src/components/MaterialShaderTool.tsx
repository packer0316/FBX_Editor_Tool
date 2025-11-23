import { useState, useEffect, useRef } from 'react';
import { Palette, Plus, ChevronDown, ChevronRight, X, Image as ImageIcon, Sliders, Lock, GripVertical } from 'lucide-react';
import type { ShaderFeature, ShaderFeatureType } from '../types/shaderTypes';

interface MaterialShaderToolProps {
    fileName: string | null;
    features: ShaderFeature[];
    onFeaturesChange: (features: ShaderFeature[]) => void;
}

// 可用的 Shader 功能列表
const AVAILABLE_FEATURES: Omit<ShaderFeature, 'id' | 'expanded' | 'params'>[] = [
    {
        type: 'matcap',
        name: 'Matcap',
        description: '材質捕捉 - 模擬環境光照',
        icon: '🌐',
    },
    {
        type: 'matcap_add',
        name: 'Matcap Add',
        description: '疊加 Matcap 效果',
        icon: '✨',
    },
    {
        type: 'normal_map',
        name: 'Normal Map',
        description: '法線貼圖 - 增加表面細節',
        icon: '🗺️',
    },
    {
        type: 'rim_light',
        name: 'Rim Light',
        description: '邊緣光 - 輪廓高光效果',
        icon: '💡',
    },
    {
        type: 'dissolve',
        name: 'Dissolve Effect',
        description: '溶解效果 - 消失動畫',
        icon: '🔥',
    },
    {
        type: 'bleach',
        name: 'Bleach Color',
        description: '漂白效果 - 受擊閃白',
        icon: '⚡',
    },
    {
        type: 'flash',
        name: 'Flash Effect',
        description: '閃光效果 - 流動光澤',
        icon: '✨',
    },
    {
        type: 'alpha_test',
        name: 'Alpha Test',
        description: '透明度測試 - 硬邊緣透明',
        icon: '🔲',
    },
];

// 獲取功能的預設參數
const getDefaultParams = (type: ShaderFeatureType): Record<string, any> => {
    switch (type) {
        case 'matcap':
            return {
                texture: null,
                maskTexture: null,
                progress: 0.5,
            };
        case 'matcap_add':
            return {
                texture: null,
                maskTexture: null,
                strength: 1.0,
                color: '#ffffff',
            };
        case 'normal_map':
            return {
                texture: null,
                strength: 1.0,
            };
        case 'rim_light':
            return {
                texture: null,
                color: '#ffffff',
                power: 2.7,
                intensity: 1.0,
            };
        case 'dissolve':
            return {
                texture: null,
                threshold: 0.0,
                edgeWidth: 0.15,
                color1: '#ffff00',
                color2: '#ff0000',
            };
        case 'bleach':
            return {
                color: '#ffffff',
                intensity: 0.0,
            };
        case 'flash':
            return {
                texture: null,
                maskTexture: null,
                color: '#ffffff',
                intensity: 1.0,
                speed: 1.5,
                width: 0.5,
                reverse: false,
            };
        case 'alpha_test':
            return {
                threshold: 0.5,
            };
        default:
            return {};
    }
};

// 參數中文標籤映射
const getParamLabel = (paramName: string): string => {
    const labels: Record<string, string> = {
        // Texture parameters
        'texture': '貼圖',
        'maskTexture': '遮罩貼圖',

        // Matcap parameters
        'progress': '混合程度',
        'strength': '強度',

        // Rim Light parameters
        'power': '邊緣銳利度',
        'intensity': '強度',

        // Flash parameters
        'speed': '速度',
        'width': '寬度',
        'reverse': '反向',

        // Dissolve parameters
        'threshold': '溶解閾值',
        'edgeWidth': '邊緣寬度',
        'color1': '顏色1',
        'color2': '顏色2',

        // Color parameters
        'color': '顏色',

        // Normal Map parameters
        'rotateDelta': '旋轉角度',
    };

    return labels[paramName] || paramName;
};

export default function MaterialShaderTool({ fileName: _fileName, features, onFeaturesChange }: MaterialShaderToolProps) {
    const [showFeatureMenu, setShowFeatureMenu] = useState(false);

    // Local state for drag and drop to support live reordering without committing to parent
    const [localFeatures, setLocalFeatures] = useState<ShaderFeature[]>(features);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const dragNodeRef = useRef<HTMLDivElement | null>(null);

    // Sync local features with props when not dragging
    useEffect(() => {
        if (draggedIndex === null) {
            setLocalFeatures(features);
        }
    }, [features, draggedIndex]);

    // 添加功能
    const addFeature = (featureTemplate: typeof AVAILABLE_FEATURES[0]) => {
        const newFeature: ShaderFeature = {
            id: `${featureTemplate.type}_${Date.now()}`,
            ...featureTemplate,
            expanded: true,
            params: getDefaultParams(featureTemplate.type),
        };

        let newFeatures = [...features];

        if (newFeature.type === 'normal_map') {
            newFeatures = newFeatures.filter(f => f.type !== 'normal_map');
            newFeatures.unshift(newFeature);
        } else {
            newFeatures.push(newFeature);
        }

        const normalMapIndex = newFeatures.findIndex(f => f.type === 'normal_map');
        if (normalMapIndex > 0) {
            const [normalMap] = newFeatures.splice(normalMapIndex, 1);
            newFeatures.unshift(normalMap);
        }

        onFeaturesChange(newFeatures);
        setShowFeatureMenu(false);
    };

    // 移除功能
    const removeFeature = (id: string) => {
        onFeaturesChange(features.filter(f => f.id !== id));
    };

    // 切換展開/收起
    const toggleExpanded = (id: string) => {
        onFeaturesChange(features.map(f =>
            f.id === id ? { ...f, expanded: !f.expanded } : f
        ));
    };

    // 更新參數
    const updateParam = (id: string, paramName: string, value: any) => {
        onFeaturesChange(features.map(f =>
            f.id === id
                ? { ...f, params: { ...f.params, [paramName]: value } }
                : f
        ));
    };

    // --- Drag and Drop Logic ---

    const handleDragStart = (e: React.DragEvent, index: number) => {
        e.stopPropagation(); // Prevent triggering global drag handlers
        if (localFeatures[index].type === 'normal_map') {
            e.preventDefault();
            return;
        }

        e.dataTransfer.effectAllowed = 'move';
        // We rely on default browser behavior for the drag image (snapshot of the element)
        // But we delay setting the state to ensure the snapshot is taken BEFORE we turn it into a placeholder
        setTimeout(() => {
            setDraggedIndex(index);
        }, 0);
    };

    const handleDragEnter = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        e.stopPropagation();
        if (draggedIndex === null || draggedIndex === targetIndex) return;

        // Prevent interacting with Normal Map at index 0
        if (targetIndex === 0 && localFeatures[0].type === 'normal_map') return;

        // Perform the swap in local state
        const newLocalFeatures = [...localFeatures];
        const draggedItem = newLocalFeatures[draggedIndex];

        // Remove from old position
        newLocalFeatures.splice(draggedIndex, 1);
        // Insert at new position
        newLocalFeatures.splice(targetIndex, 0, draggedItem);

        setLocalFeatures(newLocalFeatures);
        setDraggedIndex(targetIndex); // Update dragged index to track the item
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Necessary to allow dropping
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (draggedIndex !== null) {
            // Commit the final order to the parent
            onFeaturesChange(localFeatures);
            setDraggedIndex(null);
        }
    };

    const handleDragEnd = (e: React.DragEvent) => {
        e.stopPropagation();
        setDraggedIndex(null);
        // If cancelled, localFeatures will sync back to props via useEffect
    };

    // 渲染參數控制項
    const renderParamControl = (feature: ShaderFeature, paramName: string, value: any) => {
        const commonInputClass = "w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-purple-500";

        // 貼圖參數
        if (paramName.includes('texture') || paramName.includes('Texture')) {
            const label = getParamLabel(paramName);
            return (
                <div key={paramName} className="space-y-1">
                    <label className="text-xs text-gray-400 flex items-center gap-1">
                        <ImageIcon size={12} />
                        {label}
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            id={`${feature.id}_${paramName}`}
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) updateParam(feature.id, paramName, file);
                            }}
                        />
                        <label
                            htmlFor={`${feature.id}_${paramName}`}
                            className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-gray-400 cursor-pointer hover:border-purple-500 transition-colors text-center"
                        >
                            {value ? value.name : '選擇貼圖...'}
                        </label>
                        {value && (
                            <button
                                onClick={() => updateParam(feature.id, paramName, null)}
                                className="px-2 py-1 bg-red-600/20 border border-red-600 rounded text-red-400 hover:bg-red-600/30 transition-colors"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>
            );
        }

        // 顏色參數
        if (paramName.includes('color') || paramName.includes('Color')) {
            const label = getParamLabel(paramName);
            return (
                <div key={paramName} className="space-y-1">
                    <label className="text-xs text-gray-400">{label}</label>
                    <div className="flex gap-2">
                        <input
                            type="color"
                            value={value}
                            onChange={(e) => updateParam(feature.id, paramName, e.target.value)}
                            className="w-12 h-8 bg-gray-700 border border-gray-600 rounded cursor-pointer"
                        />
                        <input
                            type="text"
                            value={value}
                            onChange={(e) => updateParam(feature.id, paramName, e.target.value)}
                            className={commonInputClass}
                        />
                    </div>
                </div>
            );
        }

        // 數值參數（滑桿）
        if (typeof value === 'number') {
            let min = 0, max = 1, step = 0.01;

            // 根據參數名稱設定範圍
            if (paramName === 'power') { min = 0.1; max = 10; step = 0.1; }
            else if (paramName === 'intensity' || paramName === 'strength') { min = 0; max = 5; step = 0.1; }

            else if (paramName === 'speed') { min = 0; max = 5; step = 0.1; }
            else if (paramName === 'width') { min = 0.1; max = 1.0; step = 0.05; }
            else if (paramName === 'threshold') { min = 0; max = 1; step = 0.01; }
            else if (paramName === 'edgeWidth') { min = 0; max = 0.5; step = 0.01; }
            else if (paramName === 'rotateDelta') { min = 0; max = 6.28; step = 0.1; }

            const label = getParamLabel(paramName);
            return (
                <div key={paramName} className="space-y-1">
                    <label className="text-xs text-gray-400 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                            <Sliders size={12} />
                            {label}
                        </span>
                        <span className="text-purple-400 font-mono">{value.toFixed(2)}</span>
                    </label>
                    <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={value}
                        onChange={(e) => updateParam(feature.id, paramName, parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-purple"
                    />
                </div>
            );
        }

        // Boolean 參數（Checkbox）
        if (typeof value === 'boolean') {
            const label = getParamLabel(paramName);
            return (
                <div key={paramName} className="space-y-1">
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={value}
                            onChange={(e) => updateParam(feature.id, paramName, e.target.checked)}
                            className="w-4 h-4 bg-gray-700 border-2 border-gray-600 rounded cursor-pointer checked:bg-purple-600 checked:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <span className="text-xs text-gray-400 group-hover:text-white transition-colors">
                            {label}
                        </span>
                    </label>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="space-y-4 h-full flex flex-col">
            {/* 標題 */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-700">
                <div className="flex items-center gap-2">
                    <Palette className="text-purple-400" size={24} />
                    <h2 className="text-lg font-bold text-white">Material Shader 工具</h2>
                </div>
                <div className="text-xs text-gray-500">
                    {features.length} 個功能
                </div>
            </div>

            {/* 功能字卡列表 */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {localFeatures.length === 0 ? (
                    <div className="bg-gray-900/50 rounded-lg p-8 border border-gray-700 text-center">
                        <Palette size={48} className="text-purple-400 opacity-50 mx-auto mb-4" />
                        <p className="text-gray-400 mb-2">尚未添加任何功能</p>
                        <p className="text-sm text-gray-500">點擊下方 + 按鈕開始添加</p>
                    </div>
                ) : (
                    localFeatures.map((feature, index) => (
                        <div
                            key={feature.id}
                            onDragEnter={(e) => handleDragEnter(e, index)}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            className={`
                                bg-gray-900/50 border rounded-lg overflow-hidden transition-all duration-200
                                ${draggedIndex === index ? 'border-2 border-dashed border-gray-600 bg-transparent opacity-50' : 'border-gray-700 hover:border-purple-500/50'}
                                ${feature.type === 'normal_map' ? 'border-l-4 border-l-blue-500' : ''}
                            `}
                        >
                            {/* Hide content if dragged to simulate "hole" */}
                            <div className={draggedIndex === index ? 'opacity-0' : ''}>
                                {/* 字卡標題 */}
                                <div
                                    draggable={feature.type !== 'normal_map'}
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragEnd={handleDragEnd}
                                    className="flex items-center justify-between p-3 bg-gray-800/50 cursor-move"
                                >
                                    <div className="flex items-center gap-2 flex-1">
                                        {/* Drag Handle / Lock Icon */}
                                        {feature.type === 'normal_map' ? (
                                            <Lock size={14} className="text-blue-400 mr-1" />
                                        ) : (
                                            <GripVertical size={16} className="text-gray-600 cursor-grab active:cursor-grabbing mr-1" />
                                        )}

                                        <button
                                            onClick={() => toggleExpanded(feature.id)}
                                            className="text-gray-400 hover:text-white transition-colors"
                                        >
                                            {feature.expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                        </button>
                                        <span className="text-xl">{feature.icon}</span>
                                        <div className="flex-1">
                                            <div className="font-medium text-white flex items-center gap-2">
                                                {feature.name}
                                                {feature.type === 'normal_map' && (
                                                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">Fixed</span>
                                                )}
                                            </div>
                                            {!feature.expanded && (
                                                <div className="text-xs text-gray-500">{feature.description}</div>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-500 bg-gray-700 px-2 py-1 rounded">
                                            #{index + 1}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => removeFeature(feature.id)}
                                        className="ml-2 p-1 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>

                                {/* 展開的參數區域 */}
                                {feature.expanded && (
                                    <div className="p-3 space-y-3 border-t border-gray-700">
                                        <p className="text-xs text-gray-400 italic">{feature.description}</p>
                                        {Object.entries(feature.params).map(([paramName, value]) =>
                                            renderParamControl(feature, paramName, value)
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* 添加功能按鈕 */}
            <div className="relative pt-3 border-t border-gray-700">
                <button
                    onClick={() => setShowFeatureMenu(!showFeatureMenu)}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors font-medium"
                >
                    <Plus size={20} />
                    添加功能
                </button>

                {/* 功能選單 */}
                {showFeatureMenu && (
                    <>
                        <div
                            className="fixed inset-0 z-10"
                            onClick={() => setShowFeatureMenu(false)}
                        />
                        <div className="absolute bottom-full left-0 right-0 mb-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 max-h-80 overflow-y-auto">
                            {AVAILABLE_FEATURES.map((feature) => (
                                <button
                                    key={feature.type}
                                    onClick={() => addFeature(feature)}
                                    className="w-full px-4 py-3 text-left hover:bg-gray-700 transition-colors border-b border-gray-700 last:border-b-0 flex items-center gap-3"
                                >
                                    <span className="text-2xl">{feature.icon}</span>
                                    <div className="flex-1">
                                        <div className="font-medium text-white">{feature.name}</div>
                                        <div className="text-xs text-gray-400">{feature.description}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
