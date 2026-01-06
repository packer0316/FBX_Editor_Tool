import { useState, useEffect, useRef } from 'react';
import { Palette, Plus, ChevronDown, ChevronRight, X, Image as ImageIcon, Sliders, Check, Trash2, Edit2, ToggleLeft, ToggleRight, Download, Upload, Package } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 類名合併工具
 */
function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

import type { ShaderFeature, ShaderFeatureType, ShaderGroup } from '../../../../domain/value-objects/ShaderFeature';
import { updateShaderGroupById, updateShaderGroupFeatureParam } from '../../../../utils/shader/shaderGroupUtils';
import type { ThemeStyle } from '../../../../presentation/hooks/useTheme';
import { downloadShaderFile } from '../../../../utils/shader/cocos-export';
import { ExportShaderConfigUseCase } from '../../../../application/use-cases/ExportShaderConfigUseCase';
import { ImportShaderConfigUseCase } from '../../../../application/use-cases/ImportShaderConfigUseCase';

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
    {
        type: 'set_texture',
        name: 'Set Texture（更換主貼圖）',
        description: '替換模型原始貼圖',
        icon: '🖼️',
        enabled: true,
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
                // RGB 通道遮罩功能（可折疊）
                rgbExpanded: false,   // RGB 區塊展開狀態
                useMaskR: false,      // 使用 R 通道
                useMaskG: false,      // 使用 G 通道
                useMaskB: false,      // 使用 B 通道
                textureR: null,       // R 通道專用 Matcap 貼圖
                textureG: null,       // G 通道專用 Matcap 貼圖
                textureB: null,       // B 通道專用 Matcap 貼圖
                strengthR: 1.0,       // R 通道強度
                strengthG: 1.0,       // G 通道強度
                strengthB: 1.0,       // B 通道強度
            };
        case 'matcap_add':
            return {
                texture: null,
                maskTexture: null,
                strength: 1.0,
                color: '#ffffff',
                // RGB 通道遮罩功能（可折疊）
                rgbExpanded: false,
                useMaskR: false,
                useMaskG: false,
                useMaskB: false,
                textureR: null,
                textureG: null,
                textureB: null,
                strengthR: 1.0,       // R 通道強度
                strengthG: 1.0,       // G 通道強度
                strengthB: 1.0,       // B 通道強度
            };
        case 'normal_map':
            return {
                texture: null,
                strength: 1.0,
                nonColor: true, // Non-Color 模式（與 Blender 相同）
                useUV2: false,  // 使用第二層 UV
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
        case 'set_texture':
            return {
                texture: null,      // 主貼圖
                tilingX: 1.0,       // X 軸平鋪
                tilingY: 1.0,       // Y 軸平鋪
                offsetX: 0.0,       // X 軸偏移
                offsetY: 0.0,       // Y 軸偏移
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
        'nonColor': 'Non-Color（線性）',
        'useUV2': '使用第二層 UV',
        'useMaskR': '使用 R 通道',
        'useMaskG': '使用 G 通道',
        'useMaskB': '使用 B 通道',
        'textureR': 'R 通道 Matcap',
        'textureG': 'G 通道 Matcap',
        'tilingX': 'X 軸平鋪',
        'tilingY': 'Y 軸平鋪',
        'offsetX': 'X 軸偏移',
        'offsetY': 'Y 軸偏移',
        'textureB': 'B 通道 Matcap',
        'strengthR': '強度',
        'strengthG': '強度',
        'strengthB': '強度',
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
            enabled: true,
        };
        onGroupsChange([...shaderGroups, newGroup]);
    };

    // 切換組合啟用狀態
    const toggleGroupEnabled = (groupId: string) => {
        onGroupsChange(shaderGroups.map(group =>
            group.id === groupId ? { ...group, enabled: !group.enabled } : group
        ));
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

    // 切換 mesh 選擇（允許同一個 mesh 被多個組選取）
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
            }
            // 不影響其他組的選取
            return group;
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

        // Boolean 參數（Checkbox）
        if (typeof value === 'boolean') {
            const label = getParamLabel(paramName);
            return (
                <div key={paramName} className="flex items-center justify-between py-1 group/param">
                    <label className="text-[10px] text-gray-500 font-bold tracking-wider uppercase group-hover/param:text-gray-300 transition-colors cursor-pointer" htmlFor={`${groupId}_${feature.id}_${paramName}`}>
                        {label}
                    </label>
                    <label className="relative inline-flex items-center cursor-pointer group flex-shrink-0">
                        <input
                            type="checkbox"
                            checked={value}
                            onChange={(e) => updateFeatureParam(groupId, feature.id, paramName, e.target.checked)}
                            className="sr-only peer"
                        />
                        {/* 高階儀器開關設計 - 紫色 */}
                        <div className="w-12 h-6 bg-black/40 border border-white/10 rounded-full peer transition-all duration-500 peer-checked:bg-purple-500/10 peer-checked:border-purple-500/50 relative after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white/10 after:rounded-full after:h-4 after:w-4 after:transition-all after:duration-500 peer-checked:after:translate-x-[24px] peer-checked:after:bg-white peer-checked:after:shadow-[0_0_20px_rgba(168,85,247,0.8),0_0_4px_rgba(168,85,247,0.4)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]"></div>
                    </label>
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
            else if (paramName === 'strengthR' || paramName === 'strengthG' || paramName === 'strengthB') { min = 0; max = 2; step = 0.1; }
            else if (paramName === 'speed') { min = 0; max = 5; step = 0.1; }
            else if (paramName === 'width') { min = 0.1; max = 1.0; step = 0.05; }
            else if (paramName === 'threshold') { min = 0; max = 1; step = 0.01; }
            else if (paramName === 'edgeWidth') { min = 0; max = 0.5; step = 0.01; }
            else if (paramName === 'rotateDelta') { min = 0; max = 6.28; step = 0.1; }
            else if (paramName === 'tilingX' || paramName === 'tilingY') { min = 0.1; max = 10; step = 0.1; }
            else if (paramName === 'offsetX' || paramName === 'offsetY') { min = -1; max = 1; step = 0.01; }

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

        return null;
    };

    return (
        <div className={`h-full flex flex-col ${theme.panelBg}`}>
            {/* Header - 專業儀器感設計 (雙行佈局優化) */}
            <div className={cn(
                "pt-5 pb-4 border-b flex flex-col gap-4 relative overflow-hidden",
                theme.panelBorder,
                "bg-gradient-to-b from-white/[0.05] to-transparent"
            )}>
                {/* 頂部極細高光 */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
                
                {/* 第一排：圖標與主題字 (再縮小) */}
                <div className="flex items-center gap-2 px-4 relative z-10">
                    <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.1)] flex-shrink-0">
                        <Palette className="text-purple-400" size={14} />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-white text-[10px] font-black tracking-[0.2em] uppercase leading-tight truncate">Material Shader</h2>
                        <div className="text-[7px] text-gray-500 font-medium tracking-[0.1em] uppercase truncate">System Config</div>
                    </div>
                </div>

                {/* 第二排：功能區 (Export/Import & Switch) - 與下方字卡切齊 */}
                <div className="px-4 relative z-10">
                    <div className="flex items-center justify-between gap-3 bg-white/[0.03] p-1.5 px-2.5 rounded-2xl border border-white/5 shadow-inner">
                        <div className="flex items-center bg-white/5 rounded-full p-0.5 border border-white/10">
                            <button
                                onClick={async () => {
                                    try {
                                        await ExportShaderConfigUseCase.execute(shaderGroups);
                                        alert('✅ Shader 配置已匯出');
                                    } catch (error) {
                                        console.error('匯出失敗:', error);
                                        alert('❌ 匯出失敗：' + (error instanceof Error ? error.message : '未知錯誤'));
                                    }
                                }}
                                className="px-2.5 py-1 hover:bg-white/10 text-gray-300 hover:text-white rounded-full text-[9px] font-bold tracking-wider uppercase transition-all flex items-center gap-1.5"
                                title="Export (ZIP)"
                            >
                                <Package size={11} className="text-blue-400" />
                                <span>Export</span>
                            </button>

                            <div className="w-px h-2.5 bg-white/10 self-center mx-0.5" />
                            
                            <input
                                type="file"
                                accept=".zip"
                                className="hidden"
                                id="import-shader-config"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    
                                    try {
                                        const importedGroups = await ImportShaderConfigUseCase.execute(file);
                                        onGroupsChange(importedGroups);
                                        alert('✅ Shader 配置已匯入');
                                    } catch (error) {
                                        console.error('匯入失敗:', error);
                                        alert('❌ 匯入失敗：' + (error instanceof Error ? error.message : '未知錯誤'));
                                    }
                                    
                                    e.target.value = '';
                                }}
                            />
                            <label
                                htmlFor="import-shader-config"
                                className="px-2.5 py-1 hover:bg-white/10 text-gray-300 hover:text-white rounded-full text-[9px] font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 cursor-pointer"
                                title="Import (ZIP)"
                            >
                                <Upload size={11} className="text-green-400" />
                                <span>Import</span>
                            </label>
                        </div>

                        {/* 主開關 */}
                        <label className="flex items-center cursor-pointer group flex-shrink-0">
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={isShaderEnabled}
                                    onChange={(e) => onToggleShaderEnabled(e.target.checked)}
                                />
                                {/* 高階儀器開關設計 - 紫色 */}
                                <div className="w-10 h-5 bg-black/40 border border-white/10 rounded-full peer transition-all duration-500 peer-checked:bg-purple-500/10 peer-checked:border-purple-500/50 relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white/10 after:rounded-full after:h-3.5 after:w-3.5 after:transition-all after:duration-500 peer-checked:after:translate-x-[20px] peer-checked:after:bg-white peer-checked:after:shadow-[0_0_15px_rgba(168,85,247,0.8),0_0_4px_rgba(168,85,247,0.4)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]"></div>
                            </div>
                        </label>
                    </div>
                </div>
            </div>

            {/* Groups List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {shaderGroups.map((group, groupIndex) => (
                    <div key={group.id} className={`glass-panel rounded-xl border border-white/5 transition-all duration-300 relative ${!group.expanded ? 'hover:bg-white/5' : ''} ${showFeatureMenu?.groupId === group.id || showMeshMenu === group.id ? 'z-20' : 'z-0'}`}>
                        {/* Group Header */}
                        <div className={cn(
                            "p-3 flex items-center justify-between border-b border-white/5 transition-all duration-300 min-w-0 gap-2",
                            !group.expanded ? "border-transparent" : ""
                        )}>
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <button
                                    onClick={() => toggleGroupExpanded(group.id)}
                                    className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
                                >
                                    {group.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
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
                                        className="bg-black/30 text-white px-2 py-1 rounded border border-purple-500/50 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 min-w-0 flex-1 max-w-[150px]"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                                        <span
                                            className="text-white font-medium cursor-pointer hover:text-purple-300 transition-colors truncate whitespace-nowrap block"
                                            onDoubleClick={() => {
                                                setEditingGroupId(group.id);
                                                setEditingName(group.name);
                                            }}
                                            title="雙擊修改名稱"
                                        >
                                            {group.name}
                                        </span>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingGroupId(group.id);
                                                    setEditingName(group.name);
                                                }}
                                                className="text-gray-500 hover:text-purple-400 transition-colors"
                                                title="修改名稱"
                                            >
                                                <Edit2 size={12} />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    try {
                                                        downloadShaderFile(group, group.name);
                                                    } catch (err) {
                                                        console.error('匯出失敗:', err);
                                                        alert('匯出失敗：' + (err instanceof Error ? err.message : '未知錯誤'));
                                                    }
                                                }}
                                                className="text-gray-500 hover:text-green-400 transition-colors"
                                                title="匯出 Cocos Creator Shader (.effect)"
                                            >
                                                <Download size={12} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <span className="text-[10px] text-gray-500 flex-shrink-0 hidden xs:inline whitespace-nowrap">
                                    ({group.selectedMeshes.length} meshes)
                                </span>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                                {/* 組合開關 */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleGroupEnabled(group.id);
                                    }}
                                    className={cn(
                                        "w-10 h-5 rounded-full relative transition-all duration-200 flex-shrink-0",
                                        (group.enabled ?? true)
                                            ? "bg-purple-600 hover:bg-purple-500"
                                            : "bg-gray-700 hover:bg-gray-600"
                                    )}
                                    title={(group.enabled ?? true) ? "停用此組合" : "啟用此組合"}
                                >
                                    <div className={cn(
                                        "w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all duration-200 shadow-sm",
                                        (group.enabled ?? true) ? "left-[22px]" : "left-0.5"
                                    )} />
                                </button>

                                {/* Mesh Selection Dropdown */}
                                <div className="relative" ref={showMeshMenu === group.id ? meshMenuRef : null}>
                                    <button
                                        onClick={() => setShowMeshMenu(showMeshMenu === group.id ? null : group.id)}
                                        className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[10px] sm:text-xs rounded-full transition-colors backdrop-blur-sm whitespace-nowrap"
                                    >
                                        <span className="hidden sm:inline">Mesh 選單 </span>▼
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
                                                            className="flex items-center gap-2 p-2.5 hover:bg-white/10 cursor-pointer transition-colors border-b border-white/5 last:border-0"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => toggleMeshSelection(group.id, meshName)}
                                                                className="w-4 h-4 rounded border-white/20 bg-black/30 checked:bg-purple-500 checked:border-purple-500"
                                                            />
                                                            <span className="text-sm text-white flex-1">{meshName}</span>
                                                            {isSelected && <Check size={14} className="text-green-400" />}
                                                            {isUsedByOther && (
                                                                <span className="text-xs text-orange-400">(已使用)</span>
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
                                            <div className="flex items-center">
                                                <label className="relative inline-flex items-center cursor-pointer group flex-shrink-0">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={feature.enabled !== false}
                                                        onChange={() => toggleFeatureEnabled(group.id, feature.id)}
                                                    />
                                                    {/* 高階儀器開關設計 - 綠色 */}
                                                    <div className="w-12 h-6 bg-black/40 border border-white/10 rounded-full peer transition-all duration-500 peer-checked:bg-emerald-500/10 peer-checked:border-emerald-500/50 relative after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white/10 after:rounded-full after:h-4 after:w-4 after:transition-all after:duration-500 peer-checked:after:translate-x-[24px] peer-checked:after:bg-emerald-400 peer-checked:after:shadow-[0_0_20px_rgba(52,211,153,0.7),0_0_4px_rgba(52,211,153,0.4)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]"></div>
                                                </label>
                                            </div>
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
                                                {/* 檢查是否啟用了 RGB 模式 */}
                                                {(() => {
                                                    const isRGBMode = (feature.type === 'matcap' || feature.type === 'matcap_add') && 
                                                        (feature.params.useMaskR || feature.params.useMaskG || feature.params.useMaskB);
                                                    
                                                    return (
                                                        <>
                                                            {/* 渲染非 RGB 相關參數 */}
                                                            {Object.entries(feature.params)
                                                                .filter(([paramName]) => !['rgbExpanded', 'useMaskR', 'useMaskG', 'useMaskB', 'textureR', 'textureG', 'textureB', 'strengthR', 'strengthG', 'strengthB'].includes(paramName))
                                                                .map(([paramName, value]) => {
                                                                    // 當 RGB 模式啟用時，禁用主貼圖和混合程度/強度
                                                                    const isDisabled = isRGBMode && (paramName === 'texture' || paramName === 'progress' || paramName === 'strength');
                                                                    return (
                                                                        <div key={paramName} className={isDisabled ? 'opacity-40 pointer-events-none' : ''}>
                                                                            {renderParamControl(group.id, feature, paramName, value)}
                                                                        </div>
                                                                    );
                                                                })}
                                                            
                                                            {/* Matcap RGB 通道折疊區塊 */}
                                                            {(feature.type === 'matcap' || feature.type === 'matcap_add') && (
                                                                <div className="mt-3 border border-white/10 rounded-lg overflow-hidden">
                                                                    <button
                                                                        onClick={() => updateFeatureParam(group.id, feature.id, 'rgbExpanded', !feature.params.rgbExpanded)}
                                                                        className="w-full px-3 py-2 bg-white/5 hover:bg-white/10 flex items-center justify-between text-xs text-gray-300 transition-colors"
                                                                    >
                                                                        <span className="flex items-center gap-2">
                                                                            <span>🎨</span>
                                                                            <span>RGB 通道遮罩設定</span>
                                                                        </span>
                                                                        {feature.params.rgbExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                                    </button>
                                                                    {feature.params.rgbExpanded && (
                                                                        <div className="p-3 space-y-3 bg-black/20">
                                                                            {/* R 通道 */}
                                                                            <div className="space-y-2">
                                                                                {renderParamControl(group.id, feature, 'useMaskR', feature.params.useMaskR)}
                                                                                {feature.params.useMaskR && (
                                                                                    <div className="pl-4 space-y-2 border-l-2 border-red-500/30">
                                                                                        {renderParamControl(group.id, feature, 'textureR', feature.params.textureR)}
                                                                                        {renderParamControl(group.id, feature, 'strengthR', feature.params.strengthR)}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            
                                                                            {/* G 通道 */}
                                                                            <div className="space-y-2">
                                                                                {renderParamControl(group.id, feature, 'useMaskG', feature.params.useMaskG)}
                                                                                {feature.params.useMaskG && (
                                                                                    <div className="pl-4 space-y-2 border-l-2 border-green-500/30">
                                                                                        {renderParamControl(group.id, feature, 'textureG', feature.params.textureG)}
                                                                                        {renderParamControl(group.id, feature, 'strengthG', feature.params.strengthG)}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            
                                                                            {/* B 通道 */}
                                                                            <div className="space-y-2">
                                                                                {renderParamControl(group.id, feature, 'useMaskB', feature.params.useMaskB)}
                                                                                {feature.params.useMaskB && (
                                                                                    <div className="pl-4 space-y-2 border-l-2 border-blue-500/30">
                                                                                        {renderParamControl(group.id, feature, 'textureB', feature.params.textureB)}
                                                                                        {renderParamControl(group.id, feature, 'strengthB', feature.params.strengthB)}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </>
                                                    );
                                                })()}
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

            {/* Add Group Button - 未來主義霓虹設計 */}
            <div className={cn("p-5 border-t bg-gradient-to-t from-white/[0.03] to-transparent", theme.panelBorder)}>
                <button
                    onClick={addGroup}
                    className="group relative w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl cursor-pointer transition-all duration-500 overflow-hidden border border-purple-500/30 bg-purple-600/10 hover:border-purple-400 hover:shadow-[0_0_30px_rgba(168,85,247,0.2)] hover:-translate-y-0.5"
                >
                    {/* 動態掃光效果 */}
                    <div className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-sweep pointer-events-none" />
                    
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center border border-purple-500/30 group-hover:border-purple-400 group-hover:bg-purple-500/30 transition-all duration-500">
                            <Plus size={18} className="text-purple-300 group-hover:text-white" />
                        </div>
                        <div className="text-left">
                            <div className="text-xs font-black tracking-[0.4em] uppercase text-purple-100 group-hover:text-white transition-colors duration-500">
                                Create Group
                            </div>
                            <div className="text-[9px] font-medium tracking-[0.1em] uppercase text-purple-400/60 group-hover:text-purple-300 transition-colors duration-500">
                                Add New Shader Configuration
                            </div>
                        </div>
                    </div>

                    {/* 右側裝飾小點 */}
                    <div className="absolute right-6 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-2 group-hover:translate-x-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                    </div>
                </button>
            </div>
        </div>
    );
}

