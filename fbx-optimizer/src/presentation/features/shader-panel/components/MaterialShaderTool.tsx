import { useState, useEffect, useRef } from 'react';
import { Palette, Plus, ChevronDown, ChevronRight, X, Image as ImageIcon, Sliders, Check, Trash2, Edit2, ToggleLeft, ToggleRight } from 'lucide-react';
import type { ShaderFeature, ShaderFeatureType, ShaderGroup } from '../../../../domain/value-objects/ShaderFeature';
import { updateShaderGroupById, updateShaderGroupFeatureParam } from '../../../../utils/shader/shaderGroupUtils';
import type { ThemeStyle } from '../../../../presentation/hooks/useTheme';

interface MaterialShaderToolProps {
    fileName: string | null;
    shaderGroups: ShaderGroup[];
    meshNames: string[];
    onGroupsChange: (groups: ShaderGroup[]) => void;
    isShaderEnabled: boolean;
    onToggleShaderEnabled: (enabled: boolean) => void;
    theme: ThemeStyle;
}

// 可用的 Shader 功能列表
const AVAILABLE_FEATURES: Omit<ShaderFeature, 'id' | 'expanded' | 'params'>[] = [
    {
        type: 'unlit',
        name: 'Unlit (無光照)',
        description: '無光照模式 - 只顯示貼圖顏色',
        icon: '🔆',
        enabled: true,
    },
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
        case 'unlit':
            return {}; // Unlit 不需要任何參數
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
        'texture': '貼圖',
        'maskTexture': '遮罩貼圖',
        'progress': '混合程度',
        'strength': '強度',
        'power': '邊緣銳利度',
        'intensity': '強度',
        'speed': '速度',
        'width': '寬度',
        'reverse': '反向',
        'threshold': '溶解閾值',
        'edgeWidth': '邊緣寬度',
        'color1': '顏色1',
        'color2': '顏色2',
        'color': '顏色',
        'rotateDelta': '旋轉角度',
    };

    return labels[paramName] || paramName;
};

export default function MaterialShaderTool({ fileName: _fileName, shaderGroups, meshNames, onGroupsChange, isShaderEnabled, onToggleShaderEnabled, theme }: MaterialShaderToolProps) {
    const [showFeatureMenu, setShowFeatureMenu] = useState<{ groupId: string } | null>(null);
    const [showMeshMenu, setShowMeshMenu] = useState<string | null>(null);
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState<string>('');

    const meshMenuRef = useRef<HTMLDivElement>(null);
    const featureMenuRef = useRef<HTMLDivElement>(null);

    // 點擊外部關閉選單
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // 關閉 Mesh 選單
            if (meshMenuRef.current && !meshMenuRef.current.contains(event.target as Node)) {
                setShowMeshMenu(null);
            }
            // 關閉功能選單
            if (featureMenuRef.current && !featureMenuRef.current.contains(event.target as Node)) {
                setShowFeatureMenu(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // 添加新組合
    const addGroup = () => {
        const newGroup: ShaderGroup = {
            id: `group_${Date.now()}`,
            name: `組合 ${shaderGroups.length + 1}`,
            features: [],
            selectedMeshes: [],
            expanded: true,
        };
        onGroupsChange([...shaderGroups, newGroup]);
    };

    // 刪除組合
    const removeGroup = (groupId: string) => {
        onGroupsChange(shaderGroups.filter(group => group.id !== groupId));
    };

    // 更新組合名稱
    const updateGroupName = (groupId: string, newName: string) => {
        if (!newName.trim()) return;
        onGroupsChange(updateShaderGroupById(shaderGroups, groupId, group => ({ ...group, name: newName })));
        setEditingGroupId(null);
    };

    // 切換組合展開/收起
    const toggleGroupExpanded = (groupId: string) => {
        onGroupsChange(updateShaderGroupById(shaderGroups, groupId, group => ({ ...group, expanded: !group.expanded })));
    };

    // 添加功能到組合
    const addFeatureToGroup = (groupId: string, featureTemplate: typeof AVAILABLE_FEATURES[0]) => {
        const newFeature: ShaderFeature = {
            id: `${featureTemplate.type}_${Date.now()}`,
            ...featureTemplate,
            expanded: true,
            enabled: true,
            params: getDefaultParams(featureTemplate.type),
        };

        onGroupsChange(shaderGroups.map(group => {
            if (group.id !== groupId) return group;

            let updatedFeatures = [...group.features];

            if (newFeature.type === 'normal_map') {
                updatedFeatures = updatedFeatures.filter(feature => feature.type !== 'normal_map');
                updatedFeatures.unshift(newFeature);
            } else {
                updatedFeatures.push(newFeature);
            }

            const normalMapIndex = updatedFeatures.findIndex(feature => feature.type === 'normal_map');
            if (normalMapIndex > 0) {
                const [normalMapFeature] = updatedFeatures.splice(normalMapIndex, 1);
                updatedFeatures.unshift(normalMapFeature);
            }

            return { ...group, features: updatedFeatures };
        }));

        setShowFeatureMenu(null);
    };

    // 從組合移除功能
    const removeFeatureFromGroup = (groupId: string, featureId: string) => {
        onGroupsChange(updateShaderGroupById(shaderGroups, groupId, group => ({
            ...group,
            features: group.features.filter(feature => feature.id !== featureId)
        })));
    };

    // 切換功能展開/收起
    const toggleFeatureExpanded = (groupId: string, featureId: string) => {
        onGroupsChange(updateShaderGroupById(shaderGroups, groupId, group => ({
            ...group,
            features: group.features.map(feature =>
                feature.id === featureId ? { ...feature, expanded: !feature.expanded } : feature
            )
        })));
    };

    // 切換功能啟用/禁用
    const toggleFeatureEnabled = (groupId: string, featureId: string) => {
        onGroupsChange(updateShaderGroupById(shaderGroups, groupId, group => ({
            ...group,
            features: group.features.map(feature =>
                feature.id === featureId ? { ...feature, enabled: !feature.enabled } : feature
            )
        })));
    };

    // 更新功能參數
    const updateFeatureParam = (groupId: string, featureId: string, paramName: string, value: any) => {
        onGroupsChange(updateShaderGroupFeatureParam(shaderGroups, groupId, featureId, paramName, value));
    };

    // 切換 mesh 選擇
    const toggleMeshSelection = (groupId: string, meshName: string) => {
        onGroupsChange(shaderGroups.map(group => {
            if (group.id === groupId) {
                const isMeshSelected = group.selectedMeshes.includes(meshName);
                return {
                    ...group,
                    selectedMeshes: isMeshSelected
                        ? group.selectedMeshes.filter(selectedMeshName => selectedMeshName !== meshName)
                        : [...group.selectedMeshes, meshName]
                };
            } else {
                // 從其他組移除這個 mesh
                return {
                    ...group,
                    selectedMeshes: group.selectedMeshes.filter(selectedMeshName => selectedMeshName !== meshName)
                };
            }
        }));
    };

    // 檢查 mesh 是否被其他組使用
    const isMeshUsedByOtherGroup = (groupId: string, meshName: string): boolean => {
        return shaderGroups.some(group => group.id !== groupId && group.selectedMeshes.includes(meshName));
    };

    // 渲染參數控制項
    const renderParamControl = (groupId: string, feature: ShaderFeature, paramName: string, value: any) => {
        const commonInputClass = "w-full px-2 py-1.5 bg-black/30 border border-white/10 rounded text-sm text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-all";

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
                            id={`${groupId}_${feature.id}_${paramName}`}
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) updateFeatureParam(groupId, feature.id, paramName, file);
                            }}
                        />
                        <label
                            htmlFor={`${groupId}_${feature.id}_${paramName}`}
                            className="flex-1 px-3 py-1.5 bg-black/30 border border-white/10 rounded text-sm text-gray-400 cursor-pointer hover:border-purple-500 hover:text-white transition-all text-center truncate"
                        >
                            {value ? value.name : '選擇貼圖...'}
                        </label>
                        {value && (
                            <button
                                onClick={() => updateFeatureParam(groupId, feature.id, paramName, null)}
                                className="px-2 py-1 bg-red-500/10 border border-red-500/30 rounded text-red-400 hover:bg-red-500/20 transition-colors"
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
                            onChange={(e) => updateFeatureParam(groupId, feature.id, paramName, e.target.value)}
                            className="w-12 h-8 bg-transparent border border-white/10 rounded cursor-pointer p-0.5"
                        />
                        <input
                            type="text"
                            value={value}
                            onChange={(e) => updateFeatureParam(groupId, feature.id, paramName, e.target.value)}
                            className={commonInputClass}
                        />
                    </div>
                </div>
            );
        }

        // 數值參數（滑桿）
        if (typeof value === 'number') {
            let min = 0, max = 1, step = 0.01;

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
                        onChange={(e) => updateFeatureParam(groupId, feature.id, paramName, parseFloat(e.target.value))}
                        className="w-full h-2 bg-black/30 rounded-lg appearance-none cursor-pointer slider-purple"
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
                            onChange={(e) => updateFeatureParam(groupId, feature.id, paramName, e.target.checked)}
                            className="w-4 h-4 bg-black/30 border-2 border-white/20 rounded cursor-pointer checked:bg-purple-600 checked:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
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
        <div className={`h-full flex flex-col ${theme.panelBg}`}>
            {/* Header */}
            <div className={`p-4 border-b ${theme.panelBorder} flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                    <Palette className="text-purple-400" size={20} />
                    <h2 className={`${theme.text} font-semibold`}>Material Shader 工具</h2>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                    <div className="relative">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={isShaderEnabled}
                            onChange={(e) => onToggleShaderEnabled(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-black/30 border border-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600 peer-checked:after:bg-white shadow-inner"></div>
                    </div>
                    {/* <span className="text-xs text-gray-400">{isShaderEnabled ? '開啟' : '關閉'}</span> */}
                </label>
            </div>

            {/* Groups List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {shaderGroups.map((group, groupIndex) => (
                    <div key={group.id} className={`glass-panel rounded-xl border border-white/5 transition-all duration-300 relative ${!group.expanded ? 'hover:bg-white/5' : ''} ${showFeatureMenu?.groupId === group.id || showMeshMenu === group.id ? 'z-20' : 'z-0'}`}>
                        {/* Group Header */}
                        <div className={`p-3 flex items-center justify-between border-b border-white/5 ${!group.expanded ? 'border-transparent' : ''}`}>
                            <div className="flex items-center gap-2 flex-1">
                                <button
                                    onClick={() => toggleGroupExpanded(group.id)}
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    {group.expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </button>

                                {editingGroupId === group.id ? (
                                    <input
                                        type="text"
                                        value={editingName}
                                        onChange={(e) => setEditingName(e.target.value)}
                                        onBlur={() => updateGroupName(group.id, editingName)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') updateGroupName(group.id, editingName);
                                            if (e.key === 'Escape') setEditingGroupId(null);
                                        }}
                                        autoFocus
                                        className="bg-black/30 text-white px-2 py-1 rounded border border-purple-500/50 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <div className="flex items-center gap-2 group/name">
                                        <span
                                            className="text-white font-medium cursor-pointer hover:text-purple-300 transition-colors"
                                            onDoubleClick={() => {
                                                setEditingGroupId(group.id);
                                                setEditingName(group.name);
                                            }}
                                            title="雙擊修改名稱"
                                        >
                                            {group.name}
                                        </span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingGroupId(group.id);
                                                setEditingName(group.name);
                                            }}
                                            className="text-gray-500 hover:text-purple-400 transition-colors"
                                            title="修改名稱"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                    </div>
                                )}
                                <span className="text-xs text-gray-400">({group.selectedMeshes.length} meshes)</span>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Mesh Selection Dropdown */}
                                <div className="relative" ref={showMeshMenu === group.id ? meshMenuRef : null}>
                                    <button
                                        onClick={() => setShowMeshMenu(showMeshMenu === group.id ? null : group.id)}
                                        className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs rounded-full transition-colors backdrop-blur-sm"
                                    >
                                        Mesh 選單 ▼
                                    </button>
                                    {showMeshMenu === group.id && (
                                        <div className="absolute right-0 top-full mt-2 w-64 glass-panel border border-white/10 rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto animate-slide-up">
                                            {meshNames.length === 0 ? (
                                                <div className="p-3 text-gray-400 text-sm">沒有可用的 mesh</div>
                                            ) : (
                                                meshNames.map(meshName => {
                                                    const isSelected = group.selectedMeshes.includes(meshName);
                                                    const isUsedByOther = isMeshUsedByOtherGroup(group.id, meshName);

                                                    return (
                                                        <label
                                                            key={meshName}
                                                            className={`flex items-center gap-2 p-2.5 hover:bg-white/10 cursor-pointer transition-colors border-b border-white/5 last:border-0 ${isUsedByOther && !isSelected ? 'opacity-50' : ''}`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                disabled={isUsedByOther && !isSelected}
                                                                onChange={() => toggleMeshSelection(group.id, meshName)}
                                                                className="w-4 h-4 rounded border-white/20 bg-black/30 checked:bg-purple-500 checked:border-purple-500"
                                                            />
                                                            <span className="text-sm text-white flex-1">{meshName}</span>
                                                            {isSelected && <Check size={14} className="text-green-400" />}
                                                            {isUsedByOther && !isSelected && (
                                                                <span className="text-xs text-gray-400">(已使用)</span>
                                                            )}
                                                        </label>
                                                    );
                                                })
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Delete Group Button (except first group) */}
                                {groupIndex > 0 ? (
                                    <button
                                        onClick={() => removeGroup(group.id)}
                                        className="p-1 text-red-400 hover:text-red-300 transition-colors"
                                        title="刪除組合"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                ) : (
                                    // 佔位符，保持對齊
                                    <div className="w-6 h-6"></div>
                                )}
                            </div>
                        </div>

                        {/* Group Content */}
                        {group.expanded && (
                            <div className="p-3 space-y-3">
                                {/* Features List */}
                                {group.features.map(feature => (
                                    <div key={feature.id} className={`bg-black/20 rounded-lg border ${feature.enabled !== false ? 'border-white/5' : 'border-white/5 opacity-50'}`}>
                                        <div className={`p-2.5 flex items-center gap-2 border-b border-white/5`}>
                                            <button
                                                onClick={() => toggleFeatureExpanded(group.id, feature.id)}
                                                className="text-gray-400 hover:text-white transition-colors"
                                            >
                                                {feature.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            </button>
                                            <span className="text-lg">{feature.icon}</span>
                                            <span className={`flex-1 ${theme.text} text-sm font-medium`}>{feature.name}</span>
                                            {/* 開關按鈕 */}
                                            <button
                                                onClick={() => toggleFeatureEnabled(group.id, feature.id)}
                                                className={`p-1 transition-colors ${feature.enabled !== false ? 'text-green-400 hover:text-green-300' : 'text-gray-500 hover:text-gray-400'}`}
                                                title={feature.enabled !== false ? '點擊停用' : '點擊啟用'}
                                            >
                                                {feature.enabled !== false ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                            </button>
                                            <button
                                                onClick={() => removeFeatureFromGroup(group.id, feature.id)}
                                                className="p-1 text-red-400 hover:text-red-300 transition-colors"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>

                                        {feature.expanded && (
                                            <div className="p-3 space-y-2">
                                                <p className="text-xs text-gray-400 mb-2">{feature.description}</p>
                                                {Object.entries(feature.params).map(([paramName, value]) =>
                                                    renderParamControl(group.id, feature, paramName, value)
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {/* Add Feature Button */}
                                <div className="relative" ref={showFeatureMenu?.groupId === group.id ? featureMenuRef : null}>
                                    <button
                                        onClick={() => setShowFeatureMenu(showFeatureMenu?.groupId === group.id ? null : { groupId: group.id })}
                                        className="w-full py-2.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 hover:border-purple-500/50 rounded-lg text-purple-300 text-sm font-medium transition-all flex items-center justify-center gap-2 group"
                                    >
                                        <Plus size={16} />
                                        添加功能
                                    </button>

                                    {showFeatureMenu?.groupId === group.id && (
                                        <div className="absolute left-0 top-full mt-2 w-full glass-panel border border-white/10 rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto animate-slide-up">
                                            {AVAILABLE_FEATURES.map(feature => (
                                                <button
                                                    key={feature.type}
                                                    onClick={() => addFeatureToGroup(group.id, feature)}
                                                    className="w-full p-3 hover:bg-white/10 text-left transition-colors border-b border-white/5 last:border-b-0 group"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xl">{feature.icon}</span>
                                                        <div className="flex-1">
                                                            <div className="text-white text-sm font-medium">{feature.name}</div>
                                                            <div className="text-gray-400 text-xs">{feature.description}</div>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Add Group Button */}
            <div className={`p-4 border-t ${theme.panelBorder}`}>
                <button
                    onClick={addGroup}
                    className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-medium rounded-xl transition-all shadow-lg shadow-purple-900/20 hover:shadow-purple-500/30 hover:scale-[1.01] flex items-center justify-center gap-2"
                >
                    <Plus size={20} />
                    添加組合
                </button>
            </div>
        </div>
    );
}

