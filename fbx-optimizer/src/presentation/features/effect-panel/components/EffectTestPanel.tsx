import { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { PlayEffectUseCase } from '../../../../application/use-cases/PlayEffectUseCase';
import { isEffekseerRuntimeReady, getEffekseerRuntimeAdapter } from '../../../../application/use-cases/effectRuntimeStore';
import { EffectHandleRegistry } from '../../../../infrastructure/effect/EffectHandleRegistry';
import { Sparkles, Plus, Trash2, Play, Square, Repeat, ChevronDown, ChevronRight, AlertCircle, CheckCircle2, Loader2, FolderOpen, Move3d, RefreshCcw, RefreshCw, Maximize, Gauge, Link, X, Film, ChevronLeft, ChevronRight as ChevronRightIcon, Pause, Eye, EyeOff, FileImage, XCircle, Image, Box, FileQuestion, Trash, Download } from 'lucide-react';
import { NumberInput } from '../../../../components/ui/NumberInput';
import type { EffectTrigger } from '../../../../domain/value-objects/EffectTrigger';
import { getClipId, getClipDisplayName, type IdentifiableClip } from '../../../../utils/clip/clipIdentifierUtils';
import type { ThemeStyle } from '../../../../presentation/hooks/useTheme';

// 特效播放控制組件
const EffectPlaybackControls = ({
    effectHandle,
    onPlay,
    onStop,
    onStepFrame,
    onPlayOneFrame,
    hasActiveEffect,
    effectColor
}: {
    effectHandle: effekseer.EffekseerHandle | null;
    onPlay: () => void;
    onStop: () => void;
    onStepFrame: (frames: number) => void;
    onPlayOneFrame: () => void;
    hasActiveEffect: boolean;
    effectColor: string;
}) => {
    const [isPaused, setIsPaused] = useState(false);

    // 暫停/繼續特效
    const togglePause = () => {
        if (hasActiveEffect && effectHandle) {
            const newPaused = !isPaused;
            effectHandle.setPaused(newPaused);
            setIsPaused(newPaused);
        }
    };

    // 當特效結束時重置暫停狀態
    useEffect(() => {
        if (!hasActiveEffect) {
            setIsPaused(false);
        }
    }, [hasActiveEffect]);

    return (
        <div className="space-y-2 p-3 bg-gray-950/30 rounded border border-gray-800">
            <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
                <Film className="w-3.5 h-3.5" />
                <span>特效播放控制</span>
                {hasActiveEffect && (
                    <span className="ml-auto text-[10px] font-medium" style={{ color: effectColor }}>
                        {isPaused ? '已暫停' : '播放中'}
                    </span>
                )}
            </div>

            {/* 控制按鈕 */}
            <div className="flex items-center gap-2">
                {/* 播放新特效 */}
                <button
                    onClick={() => {
                        setIsPaused(false);
                        onPlay();
                    }}
                    className="flex-1 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/50 rounded text-xs flex items-center justify-center gap-1.5 transition-all hover:scale-[1.02] active:scale-95"
                    title="播放特效"
                >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    播放
                </button>

                {/* 暫停/繼續 */}
                <button
                    onClick={togglePause}
                    disabled={!hasActiveEffect}
                    className={`flex-1 py-1.5 rounded text-xs flex items-center justify-center gap-1.5 transition-all border hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                        isPaused
                            ? 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border-blue-600/50'
                            : 'bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 border-orange-600/50'
                    }`}
                    title={isPaused ? '繼續播放' : '暫停'}
                >
                    {isPaused ? (
                        <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            繼續
                        </>
                    ) : (
                        <>
                            <Pause className="w-3.5 h-3.5" />
                            暫停
                        </>
                    )}
                </button>

                {/* 停止 */}
                <button
                    onClick={() => {
                        setIsPaused(false);
                        onStop();
                    }}
                    disabled={!hasActiveEffect}
                    className="flex-1 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/50 rounded text-xs flex items-center justify-center gap-1.5 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="停止特效"
                >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    停止
                </button>
            </div>

            {/* 逐幀控制 (1/60秒 = 1幀) */}
            <div className="flex items-center gap-2 pt-2 border-t border-gray-800">
                <span className="text-[10px] text-gray-500">逐幀:</span>
                
                {/* 播放1幀就暫停 */}
                <button
                    onClick={() => {
                        onPlayOneFrame();
                        setIsPaused(true);
                    }}
                    className="p-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-600/50 rounded transition-colors"
                    title="播放 1 幀後暫停 (1/60秒)"
                >
                    <Play className="w-3.5 h-3.5 fill-current" />
                </button>

                {/* +0.5F */}
                <button
                    onClick={() => {
                        if (hasActiveEffect) {
                            onStepFrame(0.5);
                            setIsPaused(true);
                        }
                    }}
                    disabled={!hasActiveEffect}
                    className="px-1.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded text-[10px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="前進 0.5 幀 (≈8ms)"
                >
                    +.5
                </button>

                {/* +1F */}
                <button
                    onClick={() => {
                        if (hasActiveEffect) {
                            onStepFrame(1);
                            setIsPaused(true);
                        }
                    }}
                    disabled={!hasActiveEffect}
                    className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded text-[10px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="前進 1 幀 (≈17ms)"
                >
                    +1F
                </button>

                {/* +3F */}
                <button
                    onClick={() => {
                        if (hasActiveEffect) {
                            onStepFrame(3);
                            setIsPaused(true);
                        }
                    }}
                    disabled={!hasActiveEffect}
                    className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded text-[10px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="前進 3 幀 (≈50ms)"
                >
                    +3F
                </button>

                {/* +10F */}
                <button
                    onClick={() => {
                        if (hasActiveEffect) {
                            onStepFrame(10);
                            setIsPaused(true);
                        }
                    }}
                    disabled={!hasActiveEffect}
                    className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded text-[10px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="前進 10 幀 (≈167ms)"
                >
                    +10F
                </button>
            </div>

            {/* 提示 */}
            <div className="text-[10px] text-gray-600 mt-1">
                💡 繼續播放 N/60 秒後自動暫停
            </div>
        </div>
    );
};

// 資源狀態介面
export interface ResourceStatus {
    path: string;       // 資源路徑
    exists: boolean;    // 是否存在
    type: 'image' | 'material' | 'model' | 'other';
}

// 定義單個特效卡片的狀態介面
export interface EffectItem {
    id: string;          // 唯一識別碼
    name: string;        // 顯示名稱 (預設為檔名)
    path: string;        // 檔案路徑
    isLoaded: boolean;   // 是否已載入
    isLoading: boolean;  // 載入中
    isPlaying: boolean;  // 是否正在播放 (主要用於 UI 狀態)
    isLooping: boolean;  // 是否開啟循環
    loopIntervalId: number | null; // 循環計時器 ID
    isVisible: boolean;  // 是否顯示（不影響播放狀態）

    // Transform & Playback
    position: [number, number, number];
    rotation: [number, number, number]; // Degrees
    scale: [number, number, number];
    speed: number;

    // Bone Binding
    boundBoneUuid: string | null; // 綁定的骨骼 UUID

    // Frame Triggers
    triggers: EffectTrigger[]; // 觸發設定
    color: string; // 特效顏色（用於時間軸顯示）

    // Resource Status (載入時追蹤的資源狀態)
    resourceStatus?: ResourceStatus[];
}

// 向量輸入組件
const Vector3Input = ({
    label,
    values,
    onChange,
    step = 0.1,
    min,
    icon: Icon
}: {
    label: string,
    values: [number, number, number],
    onChange: (newValues: [number, number, number]) => void,
    step?: number,
    min?: number,
    icon: React.ComponentType<{ className?: string }>
}) => {
    const handleChange = (index: 0 | 1 | 2, val: string) => {
        const num = parseFloat(val);
        if (isNaN(num)) return;
        const newValues = [...values] as [number, number, number];
        newValues[index] = num;
        onChange(newValues);
    };

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-0.5">
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
                {(['X', 'Y', 'Z'] as const).map((axis, i) => {
                    const index = i as 0 | 1 | 2;
                    return (
                        <div key={axis} className="relative group">
                            <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 font-mono pointer-events-none group-hover:text-blue-400 transition-colors">
                                {axis}
                            </div>
                            <NumberInput
                                value={values[index]}
                                onChange={(val) => handleChange(index, val)}
                                step={step}
                                min={min}
                                className="w-full bg-gray-800 rounded border border-gray-700 focus-within:border-blue-500"
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

/**
 * 單個特效卡片組件
 */
const EffectCard = ({
    item,
    isRuntimeReady,
    onUpdate,
    onRemove,
    model,
    bones,
    createdClips,
    theme,
    duration,
    fps = 30,
    effectResourceCache,
    setEffectResourceCache
}: {
    item: EffectItem,
    isRuntimeReady: boolean,
    onUpdate: (id: string, updates: Partial<EffectItem>) => void,
    onRemove: (id: string) => void,
    model: THREE.Group | null,
    bones: THREE.Object3D[],
    createdClips: IdentifiableClip[],
    theme: ThemeStyle,
    duration: number,
    fps?: number,
    effectResourceCache: Map<string, ResourceStatus[]>,
    setEffectResourceCache: React.Dispatch<React.SetStateAction<Map<string, ResourceStatus[]>>>
}) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [localPath, setLocalPath] = useState(item.path);
    const [newTriggerState, setNewTriggerState] = useState<{ clipId: string, frame: string, duration: string }>({ clipId: '', frame: '', duration: '' });
    const [editingTriggerId, setEditingTriggerId] = useState<string | null>(null);
    const [editingFrame, setEditingFrame] = useState<string>('');
    const [editingDuration, setEditingDuration] = useState<string>('');
    const [hasActiveEffect, setHasActiveEffect] = useState(false); // 追蹤特效是否存在
    const [boneSearchQuery, setBoneSearchQuery] = useState(''); // 骨骼搜尋
    const [isBoneDropdownOpen, setIsBoneDropdownOpen] = useState(false); // 骨骼下拉選單開啟狀態
    const [showResourcePopover, setShowResourcePopover] = useState(false); // 資源狀態 Popover
    const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 }); // Popover 位置
    const [previewImage, setPreviewImage] = useState<string | null>(null); // 預覽圖片 URL
    const [fullsizeImage, setFullsizeImage] = useState<string | null>(null); // 全尺寸預覽圖片
    const [isDragging, setIsDragging] = useState(false); // 是否正在拖曳
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 }); // 拖曳偏移量
    const resourcePopoverRef = useRef<HTMLDivElement>(null); // Popover 參考
    const resourceButtonRef = useRef<HTMLButtonElement>(null); // 按鈕參考
    const fullsizeModalRef = useRef<HTMLDivElement>(null); // 全尺寸 Modal 參考
    const boneDropdownRef = useRef<HTMLDivElement>(null); // 骨骼下拉選單參考

    // 點擊外部關閉 Popover 和預覽
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            // 如果點擊的是全尺寸 Modal 內部，不關閉 Popover
            if (fullsizeModalRef.current && fullsizeModalRef.current.contains(target)) {
                return;
            }
            // 如果點擊的是 Popover 外部，關閉 Popover
            if (resourcePopoverRef.current && !resourcePopoverRef.current.contains(target)) {
                setShowResourcePopover(false);
                setPreviewImage(null);
            }
        };
        if (showResourcePopover) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showResourcePopover]);

    // 點擊外部關閉骨骼下拉選單
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (boneDropdownRef.current && !boneDropdownRef.current.contains(target)) {
                setIsBoneDropdownOpen(false);
                setBoneSearchQuery('');
            }
        };
        if (isBoneDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isBoneDropdownOpen]);

    // 拖曳邏輯
    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            setPopoverPosition({
                top: e.clientY - dragOffset.y,
                left: e.clientX - dragOffset.x
            });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragOffset]);

    // 開始拖曳
    const handleDragStart = (e: React.MouseEvent) => {
        if (resourcePopoverRef.current) {
            const rect = resourcePopoverRef.current.getBoundingClientRect();
            setDragOffset({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            });
            setIsDragging(true);
        }
    };

    // 計算並更新 Popover 位置（置中）
    const updatePopoverPosition = () => {
        // 預設置中顯示
        const popoverWidth = 450;
        const popoverHeight = 350;
        setPopoverPosition({
            top: Math.max(50, (window.innerHeight - popoverHeight) / 2),
            left: Math.max(50, (window.innerWidth - popoverWidth) / 2)
        });
    };

    // 追蹤當前播放的 Handle，以便即時更新參數
    const currentHandleRef = useRef<effekseer.EffekseerHandle | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    // 監測特效是否已結束
    useEffect(() => {
        if (!hasActiveEffect) return;

        const checkEffectExists = () => {
            if (currentHandleRef.current && !currentHandleRef.current.exists) {
                setHasActiveEffect(false);
                onUpdate(item.id, { isPlaying: false });
            }
        };

        const interval = setInterval(checkEffectExists, 100);
        return () => clearInterval(interval);
    }, [hasActiveEffect, item.id, onUpdate]);

    // 卡片刪除時停止特效（組件卸載）
    useEffect(() => {
        return () => {
            if (item.loopIntervalId) {
                clearInterval(item.loopIntervalId);
            }
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            if (currentHandleRef.current && currentHandleRef.current.exists) {
                currentHandleRef.current.stop();
                console.log('[EffectCard] 卡片刪除，停止特效');
            }
        };
    }, []);

    // 找到綁定的 bone
    const boundBone = item.boundBoneUuid
        ? bones.find(b => b.uuid === item.boundBoneUuid) || null
        : null;

    // 根據副檔名判斷資源類型
    const getResourceType = (path: string): ResourceStatus['type'] => {
        const ext = path.split('.').pop()?.toLowerCase() || '';
        if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'dds', 'tga'].includes(ext)) return 'image';
        if (['efkmat'].includes(ext)) return 'material';
        if (['efkmodel', 'fbx', 'obj'].includes(ext)) return 'model';
        return 'other';
    };

    // 載入特效
    const handleLoad = async () => {
        if (!isRuntimeReady || !localPath.trim()) return;

        console.log('[EffectCard] 🔵 開始載入特效:', localPath);
        
        // 🔥 檢查全域資源快取
        const cachedResources = effectResourceCache.get(localPath);
        if (cachedResources && cachedResources.length > 0) {
            console.log('[EffectCard] 📋 使用快取的資源列表:', cachedResources.length, '個');
        }
        
        onUpdate(item.id, { isLoading: true });
        
        // 用於追蹤資源狀態
        const resourceStatusMap = new Map<string, ResourceStatus>();
        // 追蹤所有資源檢查的 Promise
        const resourceCheckPromises: Promise<void>[] = [];
        
        try {
            const adapter = getEffekseerRuntimeAdapter();
            const context = adapter.effekseerContext;

            if (!context) throw new Error('Effekseer Context 未初始化');

            const effectUrl = `/effekseer/${localPath}`;
            const baseDir = effectUrl.substring(0, effectUrl.lastIndexOf('/') + 1);
            console.log('[EffectCard] 📂 Base Directory:', baseDir);

            // redirect 回調：攔截資源請求並檢查是否存在
            const redirect = (path: string): string => {
                console.log('[EffectCard] 🔍 資源請求:', path);
                
                // 計算完整 URL
                let fullUrl = path;
                if (!path.startsWith('/') && !path.startsWith('http')) {
                    // 相對路徑，拼接基礎目錄
                    fullUrl = baseDir + path;
                }

                // 保留完整相對路徑用於顯示
                const resourcePath = path;

                // 避免重複檢查同一資源
                if (!resourceStatusMap.has(resourcePath)) {
                    // 使用 fetch HEAD 檢查資源是否存在
                    const checkPromise = fetch(fullUrl, { method: 'HEAD' })
                        .then(response => {
                            resourceStatusMap.set(resourcePath, {
                                path: resourcePath,
                                exists: response.ok,
                                type: getResourceType(resourcePath)
                            });
                            console.log('[EffectCard]', response.ok ? '✅' : '❌', resourcePath, response.ok ? '存在' : '不存在');
                        })
                        .catch(() => {
                            resourceStatusMap.set(resourcePath, {
                                path: resourcePath,
                                exists: false,
                                type: getResourceType(resourcePath)
                            });
                            console.log('[EffectCard] ❌', resourcePath, '請求失敗');
                        });
                    
                    resourceCheckPromises.push(checkPromise);
                }

                return fullUrl;
            };

            // 🔥 載入特效：收集所有缺失的資源
            let loadSuccess = true;
            const missingResources: string[] = []; // 記錄 Effekseer 報告的缺失資源
            
            await new Promise<void>((resolve) => {
                const effect = context.loadEffect(
                    effectUrl,
                    1.0,
                    () => {
                        console.log('[EffectCard] ✅ 特效載入成功');
                        adapter.loadedEffects.set(item.id, effect);
                        resolve();
                    },
                    (_msg: string, filePath: string) => {
                        console.log('[EffectCard] ❌ 資源缺失:', filePath);
                        loadSuccess = false;
                        // 記錄缺失的資源路徑
                        missingResources.push(filePath);
                        // 不 resolve，讓 Effekseer 繼續嘗試載入其他資源
                        // Effekseer 會多次呼叫 onerror 直到所有缺失資源都報告完畢
                    },
                    redirect
                );
                
                // 設定超時，等待 Effekseer 報告所有缺失資源
                setTimeout(() => {
                    resolve();
                }, 2000); // 2 秒超時
            });

            const fileName = localPath.split('/').pop()?.split('.')[0] || localPath;

            // 🔥 等待所有資源檢查完成
            console.log('[EffectCard] ⏳ 等待所有資源檢查完成... (共', resourceCheckPromises.length, '個)');
            if (resourceCheckPromises.length > 0) {
                await Promise.all(resourceCheckPromises);
            }

            // 🔥 使用 Effekseer 報告的缺失資源來修正 resourceStatusMap
            for (const missingPath of missingResources) {
                // 從完整路徑提取純檔名
                const fileName = missingPath.split('/').pop() || missingPath;
                
                console.log('[EffectCard] 🔴 標記為缺失:', fileName);
                
                // 檢查 resourceStatusMap 中是否已有此資源（可能用不同的 key）
                let found = false;
                for (const [key, value] of resourceStatusMap.entries()) {
                    const keyFileName = key.split('/').pop() || key;
                    if (keyFileName === fileName) {
                        // 更新現有記錄為缺失
                        resourceStatusMap.set(key, {
                            ...value,
                            exists: false
                        });
                        found = true;
                        break;
                    }
                }
                
                // 如果沒找到，新增記錄
                if (!found) {
                    resourceStatusMap.set(fileName, {
                        path: fileName,
                        exists: false,
                        type: getResourceType(fileName)
                    });
                }
            }
            
            const resourceStatusArray = Array.from(resourceStatusMap.values());
            const successCount = resourceStatusArray.filter(r => r.exists).length;
            const failCount = resourceStatusArray.filter(r => !r.exists).length;
            
            console.log('[EffectCard] 📊 引用資源:', successCount, '/ 缺失資源:', failCount);
            console.log('[EffectCard] 📊 Effekseer 報告的缺失資源:', missingResources);

            // 🔥 處理載入結果
            if (!loadSuccess) {
                // 載入失敗，顯示詳細的資源報告
                const failedResources = resourceStatusArray.filter(r => !r.exists);
                const successResources = resourceStatusArray.filter(r => r.exists);
                
                const failedList = failedResources.map(r => `  ❌ ${r.path}`).join('\n');
                const successList = successResources.map(r => `  ✅ ${r.path}`).join('\n');
                
                let errorMessage = `載入特效失敗！\n\n`;
                errorMessage += `📋 引用資源: ${successCount}\n`;
                errorMessage += `❌ 缺失資源: ${failCount}\n\n`;
                
                if (failedResources.length > 0) {
                    errorMessage += `缺失的資源:\n${failedList}\n\n`;
                }
                if (successResources.length > 0) {
                    errorMessage += `已找到的資源:\n${successList}`;
                }
                
                alert(errorMessage);
                
                onUpdate(item.id, {
                    isLoaded: false,
                    isLoading: false,
                    name: fileName,
                    path: localPath,
                    resourceStatus: resourceStatusArray
                });
            } else {
                // 載入成功
                console.log('[EffectCard] 🎉 載入完成');
                
                // 處理快取情況
                if (resourceStatusArray.length === 0) {
                    // 沒有追蹤到新資源，檢查全域快取
                    if (cachedResources && cachedResources.length > 0) {
                        // 🔥 使用全域快取的資源列表
                        console.log('[EffectCard] 📋 使用全域快取的資源狀態:', cachedResources.length, '個');
                        onUpdate(item.id, {
                            isLoaded: true,
                            isLoading: false,
                            name: fileName,
                            path: localPath,
                            resourceStatus: cachedResources
                        });
                    } else if (item.resourceStatus && item.resourceStatus.length > 0) {
                        // 保留當前 item 的 resourceStatus
                        console.log('[EffectCard] ⚠️ 保留現有資源狀態');
                        onUpdate(item.id, {
                            isLoaded: true,
                            isLoading: false,
                            name: fileName,
                            path: localPath
                        });
                    } else {
                        // 真的沒有外部資源
                        onUpdate(item.id, {
                            isLoaded: true,
                            isLoading: false,
                            name: fileName,
                            path: localPath,
                            resourceStatus: [{
                                path: '(資源已快取，by其他特效檔)',
                                exists: true,
                                type: 'other' as const
                            }]
                        });
                    }
                } else {
                    // 🔥 追蹤到新資源，存入全域快取
                    console.log('[EffectCard] 💾 存入全域快取:', localPath, '->', resourceStatusArray.length, '個資源');
                    setEffectResourceCache(prev => new Map(prev).set(localPath, resourceStatusArray));
                    
                    onUpdate(item.id, {
                        isLoaded: true,
                        isLoading: false,
                        name: fileName,
                        path: localPath,
                        resourceStatus: resourceStatusArray
                    });
                }
            }
        } catch (error) {
            console.error('[EffectCard] 載入失敗:', error);
            alert(`載入失敗: ${error instanceof Error ? error.message : String(error)}`);
            onUpdate(item.id, { 
                isLoading: false, 
                isLoaded: false,
                resourceStatus: Array.from(resourceStatusMap.values())
            });
        }
    };

    // 使用 ref 來存儲最新的 item，避免閉包問題
    const itemRef = useRef(item);
    useEffect(() => {
        itemRef.current = item;
    }, [item]);

    const boundBoneRef = useRef(boundBone);
    useEffect(() => {
        boundBoneRef.current = boundBone;
    }, [boundBone]);

    // 更新正在播放的特效參數（使用 setMatrix 避免歐拉角順序問題）
    const updateRunningEffect = () => {
        if (!currentHandleRef.current || !currentHandleRef.current.exists) {
            return;
        }

        const currentItem = itemRef.current;
        const currentBoundBone = boundBoneRef.current;

        const h = currentHandleRef.current;

        if (currentBoundBone && model) {
            // 有綁定 bone 時，使用 setMatrix 避免歐拉角順序問題
            
            // 獲取 bone 的世界位置
            const boneWorldPos = new THREE.Vector3();
            currentBoundBone.getWorldPosition(boneWorldPos);

            // 獲取 bone 的世界旋轉
            const boneWorldQuat = new THREE.Quaternion();
            currentBoundBone.getWorldQuaternion(boneWorldQuat);

            // 將 local offset 轉換到 world space（模擬 parent-child 關係）
            const offsetVec = new THREE.Vector3(
                currentItem.position[0],
                currentItem.position[1],
                currentItem.position[2]
            );
            offsetVec.applyQuaternion(boneWorldQuat);

            // 計算最終位置 = 骨骼位置 + 轉換後的偏移量
            const finalPos = new THREE.Vector3(
                boneWorldPos.x + offsetVec.x,
                boneWorldPos.y + offsetVec.y,
                boneWorldPos.z + offsetVec.z
            );

            // 計算旋轉（使用 Quaternion 相乘，正確模擬 parent-child 關係）
            const offsetEuler = new THREE.Euler(
                currentItem.rotation[0] * Math.PI / 180,
                currentItem.rotation[1] * Math.PI / 180,
                currentItem.rotation[2] * Math.PI / 180
            );
            const offsetQuat = new THREE.Quaternion().setFromEuler(offsetEuler);
            const finalQuat = boneWorldQuat.clone().multiply(offsetQuat);

            // 縮放
            const finalScale = new THREE.Vector3(
                currentItem.scale[0],
                currentItem.scale[1],
                currentItem.scale[2]
            );

            // 建立變換矩陣並傳給 Effekseer
            const matrix = new THREE.Matrix4();
            matrix.compose(finalPos, finalQuat, finalScale);
            h.setMatrix(new Float32Array(matrix.elements));
        } else {
            // 沒有綁定 bone 時，使用傳統方式
            h.setLocation(
                currentItem.position[0],
                currentItem.position[1],
                currentItem.position[2]
            );
            h.setRotation(
                currentItem.rotation[0] * Math.PI / 180,
                currentItem.rotation[1] * Math.PI / 180,
                currentItem.rotation[2] * Math.PI / 180
            );
            h.setScale(currentItem.scale[0], currentItem.scale[1], currentItem.scale[2]);
        }
        
        h.setSpeed(currentItem.speed);
    };

    // 當參數改變時，嘗試更新當前 Handle（僅在沒有綁定 bone 時，因為綁定時會用 animationFrame 持續更新）
    useEffect(() => {
        if (!boundBone) {
            updateRunningEffect();
        }
    }, [item.position, item.rotation, item.scale, item.speed, boundBone]);

    // 持續更新綁定到 bone 的特效位置
    useEffect(() => {
        if (boundBone && currentHandleRef.current && currentHandleRef.current.exists) {
            const updateLoop = () => {
                if (currentHandleRef.current && currentHandleRef.current.exists) {
                    updateRunningEffect();
                    animationFrameRef.current = requestAnimationFrame(updateLoop);
                } else {
                    animationFrameRef.current = null;
                }
            };
            animationFrameRef.current = requestAnimationFrame(updateLoop);

            return () => {
                if (animationFrameRef.current !== null) {
                    cancelAnimationFrame(animationFrameRef.current);
                    animationFrameRef.current = null;
                }
            };
        }
    }, [boundBone, item.isPlaying]);

    // 播放
    const handlePlay = () => {
        if (!item.isLoaded) return;

        // 播放新特效前，先停止舊的特效（避免 handle 丟失無法操控）
        if (currentHandleRef.current && currentHandleRef.current.exists) {
            currentHandleRef.current.stop();
        }

        // 計算位置
        let x = item.position[0];
        let y = item.position[1];
        let z = item.position[2];

        if (boundBone && model) {
            // 獲取 bone 的世界位置
            const boneWorldPos = new THREE.Vector3();
            boundBone.getWorldPosition(boneWorldPos);
            // 加上偏移量
            x = boneWorldPos.x + item.position[0];
            y = boneWorldPos.y + item.position[1];
            z = boneWorldPos.z + item.position[2];
        }

        // 計算旋轉
        let rx = item.rotation[0];
        let ry = item.rotation[1];
        let rz = item.rotation[2];

        if (boundBone && model) {
            // 獲取 bone 的世界旋轉（Euler）
            const boneWorldQuat = new THREE.Quaternion();
            boundBone.getWorldQuaternion(boneWorldQuat);
            const boneEuler = new THREE.Euler().setFromQuaternion(boneWorldQuat);

            // 結合 bone 旋轉和特效旋轉
            rx = (boneEuler.x * 180 / Math.PI) + item.rotation[0];
            ry = (boneEuler.y * 180 / Math.PI) + item.rotation[1];
            rz = (boneEuler.z * 180 / Math.PI) + item.rotation[2];
        }

        const handle = PlayEffectUseCase.execute({
            id: item.id,
            x, y, z,
            rx: rx * Math.PI / 180,
            ry: ry * Math.PI / 180,
            rz: rz * Math.PI / 180,
            sx: item.scale[0], sy: item.scale[1], sz: item.scale[2],
            speed: item.speed
        });

        if (handle) {
            currentHandleRef.current = handle;
            setHasActiveEffect(true);
            // 套用顯示/隱藏狀態
            handle.setShown(item.isVisible);
        }

        onUpdate(item.id, { isPlaying: true });
    };

    // 播放 1 幀後立即暫停（用於逐幀觀看）
    const handlePlayOneFrame = () => {
        if (!item.isLoaded) return;

        // 先停止舊的特效
        if (currentHandleRef.current && currentHandleRef.current.exists) {
            currentHandleRef.current.stop();
        }

        // 計算位置
        let x = item.position[0];
        let y = item.position[1];
        let z = item.position[2];

        if (boundBone && model) {
            const boneWorldPos = new THREE.Vector3();
            boundBone.getWorldPosition(boneWorldPos);
            x = boneWorldPos.x + item.position[0];
            y = boneWorldPos.y + item.position[1];
            z = boneWorldPos.z + item.position[2];
        }

        // 計算旋轉
        let rx = item.rotation[0];
        let ry = item.rotation[1];
        let rz = item.rotation[2];

        if (boundBone && model) {
            const boneWorldQuat = new THREE.Quaternion();
            boundBone.getWorldQuaternion(boneWorldQuat);
            const boneEuler = new THREE.Euler().setFromQuaternion(boneWorldQuat);
            rx = (boneEuler.x * 180 / Math.PI) + item.rotation[0];
            ry = (boneEuler.y * 180 / Math.PI) + item.rotation[1];
            rz = (boneEuler.z * 180 / Math.PI) + item.rotation[2];
        }

        const handle = PlayEffectUseCase.execute({
            id: item.id,
            x, y, z,
            rx: rx * Math.PI / 180,
            ry: ry * Math.PI / 180,
            rz: rz * Math.PI / 180,
            sx: item.scale[0], sy: item.scale[1], sz: item.scale[2],
            speed: item.speed
        });

        if (handle) {
            currentHandleRef.current = handle;
            setHasActiveEffect(true);
            // 套用顯示/隱藏狀態
            handle.setShown(item.isVisible);
            // 前進 1 幀然後立即暫停
            const adapter = getEffekseerRuntimeAdapter();
            if (adapter?.effekseerContext) {
                adapter.effekseerContext.update(1); // 前進 1 幀
            }
            handle.setPaused(true); // 立即暫停
        }

        onUpdate(item.id, { isPlaying: true });
    };

    // 停止
    const handleStop = () => {
        if (item.loopIntervalId) {
            clearInterval(item.loopIntervalId);
        }

        if (animationFrameRef.current !== null) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        if (currentHandleRef.current) {
            currentHandleRef.current.stop();
            currentHandleRef.current = null;
        }

        setHasActiveEffect(false);
        onUpdate(item.id, {
            isLooping: false,
            loopIntervalId: null,
            isPlaying: false
        });
    };

    // 逐幀前進（用「繼續→等待→暫停」模擬）
    const handleStepFrame = (frames: number) => {
        if (!currentHandleRef.current || !currentHandleRef.current.exists) {
            console.log('[EffectCard] 沒有活躍的特效');
            return;
        }

        const handle = currentHandleRef.current;
        const durationMs = (frames / 60) * 1000; // N幀 = N/60秒

        // 繼續播放
        handle.setPaused(false);
        
        // 等待指定時間後暫停
        setTimeout(() => {
            if (handle && handle.exists) {
                handle.setPaused(true);
            }
        }, durationMs);

        console.log(`[EffectCard] 前進 ${frames} 幀 (${durationMs.toFixed(1)}ms)`);
    };

    // 切換 Loop
    const handleLoopToggle = () => {
        if (!item.isLoaded) return;

        if (item.isLooping) {
            handleStop();
        } else {
            handlePlay(); // 先播放一次
            const intervalId = window.setInterval(() => {
                handlePlay();
            }, 2000); // 固定 2 秒循環

            onUpdate(item.id, {
                isLooping: true,
                loopIntervalId: intervalId
            });
        }
    };

    // Trigger 管理
    const addTrigger = () => {
        if (!newTriggerState.clipId || !newTriggerState.frame) return;

        const frame = parseInt(newTriggerState.frame);
        if (isNaN(frame)) return;

        const selectedClip = createdClips.find(clip => getClipId(clip) === newTriggerState.clipId);
        if (!selectedClip) return;

        // 解析 duration（可選）
        let duration: number | undefined;
        if (newTriggerState.duration) {
            const parsedDuration = parseFloat(newTriggerState.duration);
            if (!isNaN(parsedDuration) && parsedDuration > 0) {
                duration = Math.round(parsedDuration * 100) / 100; // 限制小數點後兩位
            }
        }

        const newTrigger: EffectTrigger = {
            id: crypto.randomUUID(),
            clipId: newTriggerState.clipId,
            clipName: getClipDisplayName(selectedClip),
            frame: frame,
            duration: duration
        };

        onUpdate(item.id, {
            triggers: [...item.triggers, newTrigger]
        });

        setNewTriggerState({ clipId: '', frame: '', duration: '' });
    };

    const removeTrigger = (triggerId: string) => {
        // 停止所有該特效的播放實例
        EffectHandleRegistry.stopAllByEffectId(item.id);
        
        // 從觸發列表中移除該 trigger
        onUpdate(item.id, {
            triggers: item.triggers.filter(t => t.id !== triggerId)
        });
    };

    // 開始編輯觸發器
    const startEditTrigger = (trigger: EffectTrigger) => {
        setEditingTriggerId(trigger.id);
        setEditingFrame(trigger.frame.toString());
        setEditingDuration(trigger.duration !== undefined ? trigger.duration.toString() : '');
    };

    // 儲存編輯的觸發器
    const saveEditTrigger = () => {
        if (!editingTriggerId) return;

        const frame = parseInt(editingFrame);
        if (isNaN(frame) || frame < 0) {
            setEditingTriggerId(null);
            setEditingFrame('');
            setEditingDuration('');
            return;
        }

        // 解析 duration（可選）
        let duration: number | undefined;
        if (editingDuration) {
            const parsedDuration = parseFloat(editingDuration);
            if (!isNaN(parsedDuration) && parsedDuration > 0) {
                duration = Math.round(parsedDuration * 100) / 100; // 限制小數點後兩位
            }
        }

        onUpdate(item.id, {
            triggers: item.triggers.map(t =>
                t.id === editingTriggerId ? { ...t, frame, duration } : t
            )
        });

        setEditingTriggerId(null);
        setEditingFrame('');
        setEditingDuration('');
    };

    // 取消編輯
    const cancelEditTrigger = () => {
        setEditingTriggerId(null);
        setEditingFrame('');
    };

    // 處理按鍵事件
    const handleEditKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            saveEditTrigger();
        } else if (e.key === 'Escape') {
            cancelEditTrigger();
        }
    };

    useEffect(() => {
        return () => {
            if (item.loopIntervalId) {
                clearInterval(item.loopIntervalId);
            }
        };
    }, [item.loopIntervalId]);

    return (
        <div className={`${theme.panelBg} border ${theme.panelBorder} rounded-lg overflow-visible transition-colors hover:border-gray-600`}>
            {/* Header */}
            <div className={`flex items-center justify-between p-3 ${theme.toolbarBg} border-b ${theme.toolbarBorder}`}>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <Sparkles className={`w-4 h-4 ${item.isLooping ? 'text-orange-400 animate-pulse' : 'text-purple-400'}`} />
                    <input
                        type="text"
                        value={item.name}
                        onChange={(e) => onUpdate(item.id, { name: e.target.value })}
                        className={`bg-transparent text-sm font-medium ${theme.text} focus:outline-none focus:text-white truncate w-full`}
                        placeholder="特效名稱"
                    />
                </div>

                <div className="flex items-center gap-2">
                    {item.isLoading && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
                    {item.isLoaded && !item.isLoading && <CheckCircle2 className="w-4 h-4 text-green-500" />}

                    {/* 資源狀態按鈕 */}
                    {item.isLoaded && item.resourceStatus && item.resourceStatus.length > 0 && (
                        <>
                            <button
                                ref={resourceButtonRef}
                                onClick={() => {
                                    updatePopoverPosition();
                                    setShowResourcePopover(!showResourcePopover);
                                    setPreviewImage(null);
                                }}
                                className={`p-1.5 rounded transition-colors ${
                                    item.resourceStatus.some(r => !r.exists)
                                        ? 'text-red-400 hover:text-red-300 hover:bg-red-600/20'
                                        : 'text-green-400 hover:text-green-300 hover:bg-green-600/20'
                                }`}
                                title="查看引用資源"
                            >
                                <FileImage className="w-4 h-4" />
                            </button>

                            {/* 資源狀態 Popover - 使用 Portal 渲染到 body */}
                            {showResourcePopover && createPortal(
                                <div 
                                    ref={resourcePopoverRef}
                                    className="fixed w-[450px] bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden"
                                    style={{ 
                                        top: popoverPosition.top, 
                                        left: popoverPosition.left,
                                        zIndex: 99999
                                    }}
                                >
                                    {/* 可拖曳的標題列 */}
                                    <div 
                                        className="px-3 py-2.5 bg-gray-800 border-b border-gray-700 flex items-center justify-between cursor-move select-none"
                                        onMouseDown={handleDragStart}
                                    >
                                        <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
                                            <FileImage className="w-4 h-4" />
                                            <span>引用資源列表</span>
                                            <span className="ml-2 px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-400">
                                                {item.resourceStatus.filter(r => r.exists).length}/{item.resourceStatus.length}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setShowResourcePopover(false);
                                                setPreviewImage(null);
                                            }}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-700 rounded transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                    
                                    <div className="flex">
                                        {/* 資源列表 */}
                                        <div className="flex-1 max-h-[300px] overflow-y-auto">
                                            {item.resourceStatus.map((resource, idx) => {
                                                const effectDir = `/effekseer/${localPath.substring(0, localPath.lastIndexOf('/') + 1)}`;
                                                // 處理路徑：如果已經是完整路徑就直接使用，否則拼接 effectDir
                                                let imageUrl: string | null = null;
                                                if (resource.type === 'image' && resource.exists) {
                                                    if (resource.path.startsWith('/effekseer/') || resource.path.startsWith('http')) {
                                                        // 已經是完整路徑
                                                        imageUrl = resource.path;
                                                    } else if (resource.path.startsWith('/')) {
                                                        // 以 / 開頭的絕對路徑
                                                        imageUrl = resource.path;
                                                    } else {
                                                        // 相對路徑，拼接 effectDir
                                                        imageUrl = `${effectDir}${resource.path}`;
                                                    }
                                                }
                                                
                                                return (
                                                    <div 
                                                        key={idx} 
                                                        className={`flex items-center gap-2 px-3 py-2 border-b border-gray-800 last:border-b-0 transition-colors cursor-pointer ${
                                                            previewImage === imageUrl ? 'bg-blue-900/30' : 'hover:bg-gray-800/50'
                                                        }`}
                                                        onClick={() => {
                                                            if (imageUrl) {
                                                                setPreviewImage(previewImage === imageUrl ? null : imageUrl);
                                                            }
                                                        }}
                                                    >
                                                        {/* 資源類型圖示 */}
                                                        {resource.type === 'image' && <Image className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />}
                                                        {resource.type === 'material' && <Box className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />}
                                                        {resource.type === 'model' && <Box className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />}
                                                        {resource.type === 'other' && <FileQuestion className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                                                        
                                                        {/* 檔名 */}
                                                        <span className="text-xs text-gray-300 truncate flex-1" title={resource.path}>
                                                            {resource.path}
                                                        </span>
                                                        
                                                        {/* 預覽按鈕（僅圖片類型且存在時顯示） */}
                                                        {imageUrl && (
                                                            <Eye className="w-3.5 h-3.5 text-gray-500 hover:text-blue-400 flex-shrink-0" />
                                                        )}
                                                        
                                                        {/* 狀態圖示 */}
                                                        {resource.exists ? (
                                                            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                                                        ) : (
                                                            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* 圖片預覽區域 */}
                                        {previewImage && (
                                            <div className="w-[180px] border-l border-gray-700 bg-gray-950 p-3 flex flex-col items-center justify-center">
                                                <div className="relative">
                                                    <img 
                                                        src={previewImage} 
                                                        alt="Preview" 
                                                        className="max-w-full max-h-[240px] object-contain rounded border border-gray-700"
                                                        style={{ imageRendering: 'pixelated' }}
                                                    />
                                                    {/* 放大按鈕 */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setFullsizeImage(previewImage);
                                                        }}
                                                        className="absolute bottom-1.5 right-1.5 p-1.5 bg-black/70 hover:bg-blue-600/80 rounded transition-colors"
                                                        title="檢視原始大小"
                                                    >
                                                        <Maximize className="w-4 h-4 text-white" />
                                                    </button>
                                                </div>
                                                <p className="text-[10px] text-gray-500 mt-2 text-center truncate w-full">
                                                    {previewImage.split('/').pop()}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {item.resourceStatus.some(r => !r.exists) && (
                                        <div className="px-3 py-2 bg-red-900/20 border-t border-red-900/50">
                                            <p className="text-xs text-red-400">
                                                有 {item.resourceStatus.filter(r => !r.exists).length} 個資源缺失
                                            </p>
                                        </div>
                                    )}
                                </div>,
                                document.body
                            )}

                            {/* 全尺寸圖片 Modal */}
                            {fullsizeImage && createPortal(
                                <div 
                                    ref={fullsizeModalRef}
                                    className="fixed inset-0 bg-black/80 flex items-center justify-center"
                                    style={{ zIndex: 999999 }}
                                    onClick={() => setFullsizeImage(null)}
                                >
                                    <div 
                                        className="relative max-w-[90vw] max-h-[90vh] bg-gray-900 rounded-lg border border-gray-700 shadow-2xl overflow-auto"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {/* 標題列 */}
                                        <div className="sticky top-0 flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                                            <div className="flex items-center gap-2 text-sm text-gray-300">
                                                <Image className="w-4 h-4 text-blue-400" />
                                                <span>{fullsizeImage.split('/').pop()}</span>
                                            </div>
                                            <button
                                                onClick={() => setFullsizeImage(null)}
                                                className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                        {/* 圖片 */}
                                        <div className="p-4 flex items-center justify-center" style={{ background: 'repeating-conic-gradient(#1a1a1a 0% 25%, #2a2a2a 0% 50%) 50% / 20px 20px' }}>
                                            <img 
                                                src={fullsizeImage} 
                                                alt="Full size preview" 
                                                className="max-w-full max-h-[80vh]"
                                                style={{ imageRendering: 'pixelated' }}
                                            />
                                        </div>
                                    </div>
                                </div>,
                                document.body
                            )}
                        </>
                    )}

                    {/* 顯示/隱藏按鈕 */}
                    <button
                        onClick={() => {
                            const newVisible = !item.isVisible;
                            onUpdate(item.id, { isVisible: newVisible });
                            // 如果有活躍的特效，更新顯示狀態
                            if (currentHandleRef.current && currentHandleRef.current.exists) {
                                currentHandleRef.current.setShown(newVisible);
                            }
                        }}
                        className={`p-1.5 rounded transition-colors ${
                            item.isVisible 
                                ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-600/20' 
                                : 'text-gray-600 hover:text-gray-400 hover:bg-gray-700/50'
                        }`}
                        title={item.isVisible ? '隱藏特效' : '顯示特效'}
                    >
                        {item.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>

                    <button
                        onClick={() => onRemove(item.id)}
                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700/50 rounded transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Content */}
            {isExpanded && (
                <div className="p-3 space-y-4">
                    {/* Path Input */}
                    <div className="flex gap-2">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={localPath}
                                onChange={(e) => setLocalPath(e.target.value)}
                                disabled={item.isLoaded || item.isLoading}
                                placeholder="path/to/effect.efk"
                                className={`w-full pl-8 pr-3 py-1.5 ${theme.toolbarBg} border ${theme.toolbarBorder} rounded text-xs text-white bg-gray-800/90 focus:outline-none focus:border-blue-500 disabled:opacity-50 placeholder:text-gray-400`}
                            />
                            <FolderOpen className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        </div>
                        <button
                            onClick={handleLoad}
                            disabled={item.isLoaded || item.isLoading || !isRuntimeReady}
                            className={`px-3 py-1.5 text-xs rounded font-medium transition-colors flex items-center gap-1
                                ${item.isLoaded
                                    ? 'bg-gray-700 text-gray-400 cursor-default'
                                    : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                        >
                            {item.isLoaded ? '已載入' : '載入'}
                        </button>
                    </div>

                    {/* Bone Binding */}
                    {item.isLoaded && (
                        <div className="space-y-2 p-3 bg-gray-950/30 rounded border border-gray-800">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-0.5">
                                    <Link className="w-3.5 h-3.5" />
                                    <span>骨骼綁定</span>
                                </div>
                                
                                {/* Bone Search Dropdown */}
                                <div className="relative" ref={boneDropdownRef}>
                                    {/* Current Selection / Search Input */}
                                    <div 
                                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 cursor-pointer flex items-center justify-between hover:border-gray-600 transition-colors"
                                        onClick={() => setIsBoneDropdownOpen(!isBoneDropdownOpen)}
                                    >
                                        <span className={item.boundBoneUuid ? 'text-gray-300' : 'text-gray-500'}>
                                            {item.boundBoneUuid 
                                                ? (boundBone?.name || '未命名骨骼')
                                                : '無綁定（世界座標）'
                                            }
                                        </span>
                                        <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${isBoneDropdownOpen ? 'rotate-180' : ''}`} />
                                    </div>
                                    
                                    {/* Dropdown Panel */}
                                    {isBoneDropdownOpen && (
                                        <div className="absolute z-50 mt-1 w-full bg-gray-800 border border-gray-700 rounded shadow-lg shadow-black/50">
                                            {/* Search Input */}
                                            <div className="p-2 border-b border-gray-700">
                                                <input
                                                    type="text"
                                                    placeholder="搜尋骨骼..."
                                                    value={boneSearchQuery}
                                                    onChange={(e) => setBoneSearchQuery(e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
                                                    autoFocus
                                                />
                                            </div>
                                            
                                            {/* Bone List */}
                                            <div className="max-h-40 overflow-y-auto">
                                                {/* Unbind Option */}
                                                <div
                                                    onClick={() => {
                                                        onUpdate(item.id, { boundBoneUuid: null });
                                                        setIsBoneDropdownOpen(false);
                                                        setBoneSearchQuery('');
                                                    }}
                                                    className={`px-3 py-2 text-xs cursor-pointer transition-colors ${
                                                        !item.boundBoneUuid
                                                            ? 'bg-blue-500/20 text-blue-400'
                                                            : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
                                                    }`}
                                                >
                                                    無綁定（世界座標）
                                                </div>
                                                
                                                {/* Filtered Bones */}
                                                {bones.length === 0 ? (
                                                    <div className="px-3 py-2 text-xs text-gray-500 italic">
                                                        此模型無骨骼
                                                    </div>
                                                ) : (
                                                    bones
                                                        .filter((bone) =>
                                                            bone.name.toLowerCase().includes(boneSearchQuery.toLowerCase())
                                                        )
                                                        .map((bone) => (
                                                            <div
                                                                key={bone.uuid}
                                                                onClick={() => {
                                                                    onUpdate(item.id, { boundBoneUuid: bone.uuid });
                                                                    setIsBoneDropdownOpen(false);
                                                                    setBoneSearchQuery('');
                                                                }}
                                                                className={`px-3 py-2 text-xs cursor-pointer transition-colors ${
                                                                    item.boundBoneUuid === bone.uuid
                                                                        ? 'bg-blue-500/20 text-blue-400'
                                                                        : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
                                                                }`}
                                                            >
                                                                {bone.name || '未命名骨骼'}
                                                            </div>
                                                        ))
                                                )}
                                                
                                                {/* No results message */}
                                                {bones.length > 0 && 
                                                    boneSearchQuery && 
                                                    bones.filter((bone) => bone.name.toLowerCase().includes(boneSearchQuery.toLowerCase())).length === 0 && (
                                                    <div className="px-3 py-2 text-xs text-gray-500 italic">
                                                        找不到符合的骨骼
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                {item.boundBoneUuid && boundBone && (
                                    <div className="text-[10px] text-blue-400 mt-1 flex items-center gap-1">
                                        <Link className="w-3 h-3" />
                                        <span>已綁定到: {boundBone.name}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}


                    {/* Transform Controls */}
                    {item.isLoaded && (
                        <div className="space-y-3 p-3 bg-gray-950/30 rounded border border-gray-800">
                            <Vector3Input
                                label="位置 (Position)"
                                values={item.position}
                                onChange={(v) => onUpdate(item.id, { position: v })}
                                icon={Move3d}
                            />

                            <Vector3Input
                                label="旋轉 (Rotation °)"
                                values={item.rotation}
                                onChange={(v) => onUpdate(item.id, { rotation: v })}
                                step={15}
                                icon={RefreshCcw}
                            />

                            <div className="flex gap-3">
                                <div className="w-1/3">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-0.5">
                                            <Maximize className="w-3.5 h-3.5" />
                                            <span>縮放</span>
                                        </div>
                                        <div className="relative">
                                            <NumberInput
                                                value={item.scale[0]}
                                                onChange={(val) => {
                                                    const num = parseFloat(val);
                                                    if (!isNaN(num)) {
                                                        onUpdate(item.id, { scale: [num, num, num] });
                                                    }
                                                }}
                                                step={0.1}
                                                min={0.01}
                                                className="w-full bg-gray-800 rounded border border-gray-700 focus-within:border-blue-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="w-1/3">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-0.5">
                                            <Gauge className="w-3.5 h-3.5" />
                                            <span>速度</span>
                                        </div>
                                        <div className="relative">
                                            <NumberInput
                                                value={item.speed}
                                                onChange={(val) => onUpdate(item.id, { speed: parseFloat(val) })}
                                                step={0.1}
                                                min={0}
                                                className="w-full bg-gray-800 rounded border border-gray-700 focus-within:border-blue-500"
                                            />
                                            <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] text-gray-500">x</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 特效播放控制（暫停/繼續/逐幀） */}
                    {item.isLoaded && (
                        <EffectPlaybackControls
                            effectHandle={currentHandleRef.current}
                            onPlay={handlePlay}
                            onStop={handleStop}
                            onStepFrame={handleStepFrame}
                            onPlayOneFrame={handlePlayOneFrame}
                            hasActiveEffect={hasActiveEffect}
                            effectColor={item.color}
                        />
                    )}

                    {/* Loop 控制 */}
                    {item.isLoaded && (
                        <button
                            onClick={handleLoopToggle}
                            className={`w-full py-1.5 rounded text-xs flex items-center justify-center gap-1.5 transition-all border hover:scale-[1.02] active:scale-95
                                ${item.isLooping
                                    ? 'bg-orange-600 text-white border-orange-500 shadow-[0_0_10px_rgba(234,88,12,0.3)]'
                                    : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'}`}
                        >
                            <Repeat className="w-3.5 h-3.5" />
                            {item.isLooping ? '循環播放中...' : '開啟循環播放'}
                        </button>
                    )}

                    {/* Frame Triggers */}
                    {item.isLoaded && (
                        <div className="space-y-2 p-3 bg-gray-950/30 rounded border border-gray-800">
                            <div className="text-xs text-gray-400 font-medium">觸發設定</div>

                            {/* Triggers List */}
                            {item.triggers.length > 0 && (
                                <div className="space-y-2">
                                    {item.triggers.map(trigger => {
                                        const matchedClip = createdClips.find(clip => getClipId(clip) === trigger.clipId);
                                        const displayName = matchedClip ? getClipDisplayName(matchedClip) : trigger.clipName || 'Unknown Clip';
                                        const isEditing = editingTriggerId === trigger.id;

                                        return (
                                            <div key={trigger.id} className={`flex items-center justify-between bg-gray-800 rounded px-2 py-1.5 border transition-colors ${isEditing ? 'border-blue-500' : 'border-gray-700 hover:border-gray-600 cursor-pointer'}`}>
                                                {isEditing ? (
                                                    // 編輯模式
                                                    <div className="flex items-center gap-2 text-xs flex-1">
                                                        <span className="text-blue-400">{displayName}</span>
                                                        <span className="text-gray-500">@</span>
                                                        <input
                                                            type="number"
                                                            value={editingFrame}
                                                            onChange={(e) => setEditingFrame(e.target.value)}
                                                            onKeyDown={handleEditKeyDown}
                                                            onBlur={saveEditTrigger}
                                                            autoFocus
                                                            min={0}
                                                            className="w-16 bg-gray-900 border border-blue-500 rounded px-1.5 py-0.5 text-xs focus:outline-none"
                                                            style={{ color: item.color }}
                                                        />
                                                        <span className="text-gray-500">F</span>
                                                        <input
                                                            type="number"
                                                            value={editingDuration}
                                                            onChange={(e) => setEditingDuration(e.target.value)}
                                                            onKeyDown={handleEditKeyDown}
                                                            onBlur={saveEditTrigger}
                                                            placeholder="秒"
                                                            min={0}
                                                            step={0.01}
                                                            className="w-14 bg-gray-900 border border-blue-500 rounded px-1.5 py-0.5 text-xs focus:outline-none text-orange-400"
                                                        />
                                                        <span className="text-gray-500 text-[10px]">s</span>
                                                    </div>
                                                ) : (
                                                    // 顯示模式（可點擊編輯）
                                                    <div
                                                        className="flex items-center gap-2 text-xs flex-1"
                                                        onClick={() => startEditTrigger(trigger)}
                                                        title="點擊編輯"
                                                    >
                                                        <span className="text-blue-400">{displayName}</span>
                                                        <span className="text-gray-500">@</span>
                                                        <span className="hover:underline" style={{ color: item.color }}>{trigger.frame}F</span>
                                                        {trigger.duration !== undefined && (
                                                            <>
                                                                <span className="text-gray-600">|</span>
                                                                <span className="text-orange-400 hover:underline">{trigger.duration}s</span>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeTrigger(trigger.id);
                                                    }}
                                                    className="text-gray-500 hover:text-red-400 transition-colors ml-2"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Add Trigger */}
                            <div className="flex gap-2 items-end pt-2 border-t border-gray-800">
                                <div className="flex-1 min-w-0">
                                    <label className="text-[10px] text-gray-500 block mb-1">動作</label>
                                    <select
                                        value={newTriggerState.clipId}
                                        onChange={(e) => setNewTriggerState(prev => ({ ...prev, clipId: e.target.value }))}
                                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
                                    >
                                        <option value="">選擇動作...</option>
                                        {createdClips.map(clip => (
                                            <option key={getClipId(clip)} value={getClipId(clip)}>
                                                {getClipDisplayName(clip)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="w-20">
                                    <label className="text-[10px] text-gray-500 block mb-1">幀數</label>
                                    <NumberInput
                                        placeholder="Frame"
                                        value={newTriggerState.frame}
                                        onChange={(val) => setNewTriggerState(prev => ({ ...prev, frame: val }))}
                                        className="w-full bg-gray-800 rounded border border-gray-700 focus-within:border-blue-500"
                                    />
                                </div>
                                <div className="w-20">
                                    <label className="text-[10px] text-gray-500 block mb-1">持續(秒)</label>
                                    <NumberInput
                                        placeholder="秒"
                                        value={newTriggerState.duration}
                                        onChange={(val) => setNewTriggerState(prev => ({ ...prev, duration: val }))}
                                        step={0.01}
                                        className="w-full bg-gray-800 rounded border border-gray-700 focus-within:border-blue-500"
                                    />
                                </div>
                                <button
                                    onClick={addTrigger}
                                    disabled={!newTriggerState.clipId || !newTriggerState.frame}
                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-all disabled:hover:bg-blue-600"
                                >
                                    <Plus className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

/**
 * Effekseer 特效測試面板（優化版）
 * 
 * 特效預覽時間軸是獨立的，不會影響主動畫播放。
 */
interface EffectTestPanelProps {
    model?: THREE.Group | null;
    bones?: THREE.Object3D[];
    effects: EffectItem[];
    setEffects: React.Dispatch<React.SetStateAction<EffectItem[]>>;
    createdClips: IdentifiableClip[];
    theme: ThemeStyle;
    /** 動畫總時長（只讀，用於顯示時間軸範圍） */
    duration?: number;
    /** 幀率 */
    fps?: number;
    /** 清除所有模型的特效快取回調（因為 Effekseer 快取是全域共用的） */
    onClearAllModelsEffects?: () => void;
}

export default function EffectTestPanel({
    model = null,
    bones = [],
    effects,
    setEffects,
    createdClips,
    theme,
    duration = 0,
    fps = 30,
    onClearAllModelsEffects
}: EffectTestPanelProps) {
    const [isRuntimeReady, setIsRuntimeReady] = useState(false);
    
    // 全域資源快取：特效路徑 -> 資源列表（解決 Effekseer 內部快取導致重複載入無法追蹤資源的問題）
    const [effectResourceCache, setEffectResourceCache] = useState<Map<string, ResourceStatus[]>>(new Map());

    // 檢查 Runtime 狀態
    useEffect(() => {
        const checkReady = () => setIsRuntimeReady(isEffekseerRuntimeReady());
        checkReady();
        const interval = setInterval(checkReady, 1000);
        return () => clearInterval(interval);
    }, []);

    // 新增特效卡片
    const addEffectCard = () => {
        const newEffect: EffectItem = {
            id: `effect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: '新特效',
            path: 'BigExplosion_Orange.efk',
            isLoaded: false,
            isLoading: false,
            isPlaying: false,
            isLooping: false,
            loopIntervalId: null,
            isVisible: true, // 預設顯示
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            speed: 1.0,
            boundBoneUuid: null,
            triggers: [],
            color: '#9333EA' // 預設紫色
        };
        setEffects(prev => [...prev, newEffect]);
    };

    // 更新特效狀態
    const updateEffect = (id: string, updates: Partial<EffectItem>) => {
        setEffects(prev => prev.map(item =>
            item.id === id ? { ...item, ...updates } : item
        ));
    };

    // 移除特效
    const removeEffect = (id: string) => {
        const effect = effects.find(e => e.id === id);
        if (effect?.loopIntervalId) {
            clearInterval(effect.loopIntervalId);
        }
        setEffects(prev => prev.filter(item => item.id !== id));
    };

    // 載入資料夾中的所有 EFK
    const [isLoadingFolder, setIsLoadingFolder] = useState(false);
    const [availableFolders, setAvailableFolders] = useState<string[]>([]);
    const [showFolderDropdown, setShowFolderDropdown] = useState(false);
    const folderDropdownRef = useRef<HTMLDivElement>(null);

    // 刷新資料夾列表
    const refreshFolderList = async () => {
        try {
            // 加上時間戳避免快取
            const res = await fetch(`/effekseer/manifest.json?t=${Date.now()}`);
            const manifest = await res.json();
            const folders = Object.keys(manifest.root?.subdirs || {});
            setAvailableFolders(folders);
            console.log('✅ [EffectTestPanel] 資料夾列表已更新，共', folders.length, '個資料夾:', folders);
        } catch (err) {
            console.warn('⚠️ [EffectTestPanel] 更新資料夾列表失敗:', err);
        }
    };

    // 載入 manifest 獲取可用資料夾
    useEffect(() => {
        refreshFolderList();
    }, []);

    // 點擊外部關閉下拉選單
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (folderDropdownRef.current && !folderDropdownRef.current.contains(e.target as Node)) {
                setShowFolderDropdown(false);
            }
        };
        if (showFolderDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showFolderDropdown]);

    // 載入指定資料夾的所有 EFK
    const loadFolder = async (folderName: string) => {
        setIsLoadingFolder(true);
        setShowFolderDropdown(false);

        try {
            // 加上時間戳避免快取
            const res = await fetch(`/effekseer/manifest.json?t=${Date.now()}`);
            const manifest = await res.json();
            
            const folderData = manifest.root?.subdirs?.[folderName];
            if (!folderData) {
                console.warn(`[EffectTestPanel] Folder "${folderName}" not found in manifest`);
                return;
            }

            const efkFiles: { name: string; path: string }[] = folderData.efk || [];
            
            if (efkFiles.length === 0) {
                console.warn(`[EffectTestPanel] No EFK files found in "${folderName}"`);
                return;
            }

            // 預設顏色列表
            const colors = ['#9333EA', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#06B6D4'];

            // 批量新增 EFK
            const newEffects: EffectItem[] = efkFiles.map((file, index) => ({
                id: `effect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: file.name.replace('.efk', ''),
                path: file.path,
                isLoaded: false,
                isLoading: false,
                isPlaying: false,
                isLooping: false,
                loopIntervalId: null,
                isVisible: true,
                position: [0, 0, 0] as [number, number, number],
                rotation: [0, 0, 0] as [number, number, number],
                scale: [1, 1, 1] as [number, number, number],
                speed: 1.0,
                boundBoneUuid: null,
                triggers: [],
                color: colors[index % colors.length]
            }));

            setEffects(prev => [...prev, ...newEffects]);
            console.log(`[EffectTestPanel] 已新增 ${newEffects.length} 個特效 from "${folderName}"`);
        } catch (err) {
            console.error('[EffectTestPanel] 載入資料夾失敗:', err);
        } finally {
            setIsLoadingFolder(false);
        }
    };

    // 手動重新掃描並更新 manifest
    const [isRefreshingManifest, setIsRefreshingManifest] = useState(false);

    const handleRefreshManifest = async () => {
        setIsRefreshingManifest(true);
        setShowFolderDropdown(false); // 關閉下拉選單
        console.log('🔄 [EffectTestPanel] 手動觸發重新掃描資料夾...');
        
        try {
            // 呼叫 Vite 開發伺服器的 API
            const response = await fetch('/api/efk/refresh-manifest', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log('✅ [EffectTestPanel] Manifest 重新生成成功');
                
                // 等待一下讓檔案完全寫入
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // 重新載入資料夾列表
                await refreshFolderList();
                
                console.log('✅ [EffectTestPanel] 資料夾列表已更新');
            } else {
                console.error('❌ [EffectTestPanel] Manifest 重新生成失敗:', result.message);
                alert(`❌ 掃描失敗：${result.message}`);
            }
        } catch (err) {
            console.error('❌ [EffectTestPanel] 呼叫 API 失敗:', err);
            alert('❌ 掃描失敗\n\n請確認開發伺服器是否正常運行\n(npm run dev)');
        } finally {
            setIsRefreshingManifest(false);
        }
    };

    // 清除 Effekseer 快取
    const handleClearCache = () => {
        const adapter = getEffekseerRuntimeAdapter();
        
        // 確認對話框
        if (!window.confirm('確定要清除所有特效快取嗎？\n\n這將釋放所有已載入的特效資源，需要重新載入才能播放。')) {
            return;
        }

        try {
            adapter.clearAllCache();
            
            // 清空全域資源快取
            setEffectResourceCache(new Map());
            console.log('[EffectTestPanel] 🗑️ 全域資源快取已清空');
            
            // 清除所有模型的特效狀態（因為 Effekseer 快取是全域共用的）
            if (onClearAllModelsEffects) {
                onClearAllModelsEffects();
                console.log('[EffectTestPanel] 🗑️ 所有模型的特效狀態已清除');
            } else {
                // 如果沒有提供回調，只清除當前模型的特效
                setEffects(prev => prev.map(effect => ({
                    ...effect,
                    isLoaded: false,
                    resourceStatus: undefined
                })));
            }
            
            console.log('[EffectTestPanel] ✅ 快取已清除，所有特效已重置');
            alert('✅ 快取已清除！\n\n所有模型的特效都需要重新點擊「載入」按鈕。');
        } catch (err) {
            console.error('[EffectTestPanel] 清除快取失敗:', err);
            alert('❌ 清除快取失敗，請查看 Console');
        }
    };

    // 打包匯出所有特效及其資源
    const [isExporting, setIsExporting] = useState(false);
    
    const handleExportEffects = async () => {
        // 檢查是否有已載入的特效
        const loadedEffects = effects.filter(e => e.isLoaded);
        if (loadedEffects.length === 0) {
            alert('❌ 沒有已載入的特效！\n\n請先載入至少一個特效。');
            return;
        }

        // 確認對話框
        const effectNames = loadedEffects.map(e => `  • ${e.name}`).join('\n');
        if (!window.confirm(`確定要打包匯出以下特效嗎？\n\n${effectNames}\n\n將會包含所有引用的資源檔案。`)) {
            return;
        }

        setIsExporting(true);
        console.log('[EffectTestPanel] 📦 開始打包匯出...');

        try {
            const zip = new JSZip();
            const addedFiles = new Set<string>(); // 避免重複添加
            const failedFiles: string[] = []; // 記錄失敗的檔案

            for (const effect of loadedEffects) {
                console.log(`[EffectTestPanel] 📂 處理特效: ${effect.name}`);
                
                // 1. 添加 .efk 檔案
                const efkPath = effect.path;
                const efkUrl = `/effekseer/${efkPath}`;
                
                if (!addedFiles.has(efkPath)) {
                    try {
                        const response = await fetch(efkUrl);
                        if (response.ok) {
                            const blob = await response.blob();
                            zip.file(efkPath, blob);
                            addedFiles.add(efkPath);
                            console.log(`[EffectTestPanel] ✅ 添加: ${efkPath}`);
                        } else {
                            failedFiles.push(efkPath);
                            console.warn(`[EffectTestPanel] ⚠️ 無法下載: ${efkPath}`);
                        }
                    } catch (err) {
                        failedFiles.push(efkPath);
                        console.error(`[EffectTestPanel] ❌ 下載失敗: ${efkPath}`, err);
                    }
                }

                // 2. 添加引用的資源
                if (effect.resourceStatus && effect.resourceStatus.length > 0) {
                    for (const resource of effect.resourceStatus) {
                        // 跳過特殊標記
                        if (resource.path === '(資源已快取，by其他特效檔)') continue;
                        
                        // 計算資源的完整路徑
                        let resourcePath = resource.path;
                        
                        // 如果是相對路徑，拼接特效所在目錄
                        if (!resourcePath.startsWith('/') && !resourcePath.startsWith('http')) {
                            const effectDir = efkPath.includes('/') 
                                ? efkPath.substring(0, efkPath.lastIndexOf('/') + 1) 
                                : '';
                            resourcePath = effectDir + resourcePath;
                        } else if (resourcePath.startsWith('/effekseer/')) {
                            resourcePath = resourcePath.replace('/effekseer/', '');
                        }

                        if (!addedFiles.has(resourcePath) && resource.exists) {
                            try {
                                const resourceUrl = `/effekseer/${resourcePath}`;
                                const response = await fetch(resourceUrl);
                                if (response.ok) {
                                    const blob = await response.blob();
                                    zip.file(resourcePath, blob);
                                    addedFiles.add(resourcePath);
                                    console.log(`[EffectTestPanel] ✅ 添加資源: ${resourcePath}`);
                                } else {
                                    failedFiles.push(resourcePath);
                                    console.warn(`[EffectTestPanel] ⚠️ 無法下載資源: ${resourcePath}`);
                                }
                            } catch (err) {
                                failedFiles.push(resourcePath);
                                console.error(`[EffectTestPanel] ❌ 下載資源失敗: ${resourcePath}`, err);
                            }
                        }
                    }
                }
            }

            // 生成 ZIP 檔案
            console.log(`[EffectTestPanel] 📦 生成 ZIP 檔案... (${addedFiles.size} 個檔案)`);
            const zipBlob = await zip.generateAsync({ 
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 }
            });

            // 下載
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const fileName = `effekseer_export_${timestamp}.zip`;
            
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            // 顯示結果
            let resultMessage = `✅ 打包完成！\n\n`;
            resultMessage += `📦 檔案名稱: ${fileName}\n`;
            resultMessage += `📋 已打包: ${addedFiles.size} 個檔案\n`;
            
            if (failedFiles.length > 0) {
                resultMessage += `\n⚠️ 以下檔案無法下載:\n`;
                resultMessage += failedFiles.map(f => `  • ${f}`).join('\n');
            }
            
            alert(resultMessage);
            console.log('[EffectTestPanel] ✅ 匯出完成:', fileName);

        } catch (err) {
            console.error('[EffectTestPanel] ❌ 打包失敗:', err);
            alert(`❌ 打包失敗！\n\n${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Header / Status */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isRuntimeReady ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-yellow-500 animate-pulse'}`} />
                    <span className="text-xs text-gray-400">
                        {isRuntimeReady ? 'Runtime Ready' : 'Initializing...'}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {/* 打包匯出按鈕 */}
                    <button
                        onClick={handleExportEffects}
                        disabled={!isRuntimeReady || isExporting || effects.filter(e => e.isLoaded).length === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 disabled:bg-gray-700 disabled:cursor-not-allowed text-green-400 hover:text-green-300 disabled:text-gray-500 rounded-md text-xs font-medium transition-colors border border-green-600/30"
                        title="打包匯出所有已載入的特效及其資源"
                    >
                        {isExporting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Download className="w-3.5 h-3.5" />
                        )}
                        {isExporting ? '打包中...' : '打包匯出'}
                    </button>
                    
                    {/* 清除快取按鈕 */}
                    <button
                        onClick={handleClearCache}
                        disabled={!isRuntimeReady}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 disabled:bg-gray-700 disabled:cursor-not-allowed text-red-400 hover:text-red-300 disabled:text-gray-500 rounded-md text-xs font-medium transition-colors border border-red-600/30"
                        title="清除所有特效快取（釋放記憶體）"
                    >
                        <Trash className="w-3.5 h-3.5" />
                        清除快取
                    </button>
                    
                    {/* 載入資料夾下拉選單 */}
                    <div className="relative" ref={folderDropdownRef}>
                        <button
                            onClick={() => {
                                refreshFolderList(); // 每次點擊都刷新列表
                                setShowFolderDropdown(!showFolderDropdown);
                            }}
                            disabled={isLoadingFolder}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md text-xs font-medium transition-colors shadow-lg shadow-purple-900/20"
                            title={availableFolders.length === 0 ? '尚未找到資料夾，請確認 public/effekseer/ 下有子資料夾' : `共 ${availableFolders.length} 個資料夾可用`}
                        >
                            {isLoadingFolder ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <FolderOpen className="w-3.5 h-3.5" />
                            )}
                            載入資料夾
                            <ChevronDown className="w-3 h-3" />
                        </button>
                        
                        {showFolderDropdown && (
                            <div className="absolute top-full right-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
                                {/* 重新掃描按鈕 - 置頂選項 */}
                                <button
                                    onClick={handleRefreshManifest}
                                    disabled={isRefreshingManifest}
                                    className="w-full px-3 py-2 text-left text-xs text-green-400 hover:bg-gray-700 hover:text-green-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors flex items-center gap-2 border-b border-gray-700/50"
                                >
                                    {isRefreshingManifest ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <RefreshCw className="w-3.5 h-3.5" />
                                    )}
                                    {isRefreshingManifest ? '掃描中...' : '🔄 重新掃描資源'}
                                </button>

                                {/* 資料夾列表 */}
                                {availableFolders.length > 0 ? (
                                    availableFolders.map(folder => (
                                        <button
                                            key={folder}
                                            onClick={() => loadFolder(folder)}
                                            className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex items-center gap-2"
                                        >
                                            <FolderOpen className="w-3.5 h-3.5 text-yellow-500" />
                                            {folder}
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-3 py-2 text-xs text-gray-500 text-center">
                                        尚未找到資料夾
                                        <div className="text-xs text-gray-600 mt-1">
                                            請在 public/effekseer/ 下新增資料夾
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={addEffectCard}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-medium transition-colors shadow-lg shadow-blue-900/20"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        新增特效
                    </button>
                </div>
            </div>

            {/* Effect Cards List */}
            <div className="flex flex-col gap-3 min-h-[100px]">
                {effects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-gray-700 rounded-lg text-gray-500">
                        <Sparkles className="w-8 h-8 mb-2 opacity-50" />
                        <p className="text-xs">點擊上方按鈕新增特效</p>
                    </div>
                ) : (
                    effects.map(effect => (
                        <EffectCard
                            key={effect.id}
                            item={effect}
                            isRuntimeReady={isRuntimeReady}
                            onUpdate={updateEffect}
                            onRemove={removeEffect}
                            model={model}
                            bones={bones}
                            createdClips={createdClips}
                            theme={theme}
                            duration={duration}
                            fps={fps}
                            effectResourceCache={effectResourceCache}
                            setEffectResourceCache={setEffectResourceCache}
                        />
                    ))
                )}
            </div>

            {/* Footer Instructions */}
            <div className="mt-4 pt-4 border-t border-gray-700/50">
                <div className="bg-gray-800/50 rounded-lg p-3 text-xs text-gray-400 border border-gray-700/50">
                    <div className="flex items-center gap-2 mb-2 text-gray-300 font-medium">
                        <AlertCircle className="w-3.5 h-3.5 text-blue-400" />
                        使用說明
                    </div>
                    <ul className="space-y-1.5 pl-1 mb-3 pb-3 border-b border-gray-700/50">
                        <li className="flex gap-2">
                            <span className="text-gray-600">•</span>
                            <span>將 .efk 和所有資源（.png, .efkmat 等）放到 <code className="bg-gray-700 px-1 py-0.5 rounded text-gray-300">fbx-optimizer/public/effekseer/</code>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText('fbx-optimizer/public/effekseer/');
                                        alert('✅ 路徑已複製到剪貼簿！\n\n請在專案資料夾中開啟：\nfbx-optimizer/public/effekseer/');
                                    }}
                                    className="inline-flex items-center ml-1 p-0.5 rounded hover:bg-gray-600 text-blue-400 hover:text-blue-300 transition-colors"
                                    title="複製路徑"
                                >
                                    <FolderOpen className="w-3.5 h-3.5" />
                                </button>
                            </span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-gray-600">•</span>
                            <span>保持原始資料夾結構，例如: <span className="text-gray-400">Texture/Particle.png</span></span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-gray-600">•</span>
                            <span>輸入相對路徑，例如: <span className="text-green-400">BigExplosion_Orange.efk</span></span>
                        </li>
                    </ul>
                    <div className="flex items-center gap-2 mb-2 text-gray-300 font-medium">
                        <AlertCircle className="w-3.5 h-3.5 text-orange-400" />
                        操作提示
                    </div>
                    <ul className="space-y-1.5 pl-1">
                        <li className="flex gap-2">
                            <span className="text-gray-600">•</span>
                            <span>支援即時調整位置、旋轉與縮放</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-gray-600">•</span>
                            <span>Scale 預設為 1.0，可依需求調整</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-gray-600">•</span>
                            <span>Rotation 單位為角度 (Degrees)</span>
                        </li>
                    </ul>
                    <div className="flex items-center gap-2 mb-2 mt-3 pt-3 border-t border-gray-700/50 text-gray-300 font-medium">
                        <Download className="w-3.5 h-3.5 text-purple-400" />
                        打包提醒
                    </div>
                    <ul className="space-y-1.5 pl-1">
                        <li className="flex gap-2">
                            <span className="text-gray-600">1.</span>
                            <span><span className="text-purple-400">打包匯出</span> 功能只針對當前選中的模型</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-gray-600">2.</span>
                            <span>避免不同模型之間的 efk 引用，若有多支 3D 模型掛上共享資源的 efk，請先 <span className="text-red-400">「清除快取」</span></span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-gray-600">3.</span>
                            <span><span className="text-red-400">「清除快取」</span> 會將此專案所有的 efk 清除 cache，可重新載入</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-gray-600">4.</span>
                            <span>若有多個 efk 吃共同資源，管理列表將顯示 <span className="text-yellow-400">「已存於快取」</span></span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
