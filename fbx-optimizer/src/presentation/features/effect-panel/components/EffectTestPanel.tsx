import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { PlayEffectUseCase } from '../../../../application/use-cases/PlayEffectUseCase';
import { isEffekseerRuntimeReady, getEffekseerRuntimeAdapter } from '../../../../application/use-cases/effectRuntimeStore';
import { Sparkles, Plus, Trash2, Play, Square, Repeat, ChevronDown, ChevronRight, AlertCircle, CheckCircle2, Loader2, FolderOpen, Move3d, RefreshCcw, Maximize, Gauge, Link, X } from 'lucide-react';
import type { EffectTrigger } from '../../../../domain/value-objects/EffectTrigger';
import { getClipId, getClipDisplayName, type IdentifiableClip } from '../../../../utils/clip/clipIdentifierUtils';

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
                            <input
                                type="number"
                                value={values[index]}
                                onChange={(e) => handleChange(index, e.target.value)}
                                step={step}
                                min={min}
                                className="w-full pl-5 pr-1 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500 text-right font-mono"
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
    createdClips
}: { 
    item: EffectItem, 
    isRuntimeReady: boolean, 
    onUpdate: (id: string, updates: Partial<EffectItem>) => void, 
    onRemove: (id: string) => void,
    model: THREE.Group | null,
    bones: THREE.Object3D[],
    createdClips: IdentifiableClip[]
}) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [localPath, setLocalPath] = useState(item.path);
    const [newTriggerState, setNewTriggerState] = useState<{ clipId: string, frame: string }>({ clipId: '', frame: '' });
    
    // 追蹤當前播放的 Handle，以便即時更新參數
    const currentHandleRef = useRef<effekseer.EffekseerHandle | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    
    // 找到綁定的 bone
    const boundBone = item.boundBoneUuid 
        ? bones.find(b => b.uuid === item.boundBoneUuid) || null
        : null;

    // 載入特效
    const handleLoad = async () => {
        if (!isRuntimeReady || !localPath.trim()) return;

        onUpdate(item.id, { isLoading: true });
        try {
            const adapter = getEffekseerRuntimeAdapter();
            const context = adapter.effekseerContext;
            
            if (!context) throw new Error('Effekseer Context 未初始化');

            const effectUrl = `/effekseer/${localPath}`;
            
            await new Promise<void>((resolve, reject) => {
                const effect = context.loadEffect(
                    effectUrl,
                    1.0, // 載入時 Scale 設為 1.0，完全由動態 Scale 控制
                    () => {
                        adapter.loadedEffects.set(item.id, effect);
                        resolve();
                    },
                    (msg: string, filePath: string) => {
                        reject(new Error(`${msg} (${filePath})`));
                    }
                );
            });

            const fileName = localPath.split('/').pop()?.split('.')[0] || localPath;
            
            onUpdate(item.id, { 
                isLoaded: true, 
                isLoading: false, 
                name: fileName,
                path: localPath 
            });
        } catch (error) {
            console.error('[EffectCard] 載入失敗:', error);
            alert(`載入失敗: ${error instanceof Error ? error.message : String(error)}`);
            onUpdate(item.id, { isLoading: false, isLoaded: false });
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

    // 更新正在播放的特效參數
    const updateRunningEffect = () => {
        if (!currentHandleRef.current || !currentHandleRef.current.exists) {
            return;
        }
        
        const currentItem = itemRef.current;
        const currentBoundBone = boundBoneRef.current;
        
        const h = currentHandleRef.current;
        
        // 計算位置
        let x = currentItem.position[0];
        let y = currentItem.position[1];
        let z = currentItem.position[2];
        
        if (currentBoundBone && model) {
            // 獲取 bone 的世界位置
            const boneWorldPos = new THREE.Vector3();
            currentBoundBone.getWorldPosition(boneWorldPos);
            // 加上偏移量
            x = boneWorldPos.x + currentItem.position[0];
            y = boneWorldPos.y + currentItem.position[1];
            z = boneWorldPos.z + currentItem.position[2];
        }
        
        h.setLocation(x, y, z);
        
        // 計算旋轉
        let rx = currentItem.rotation[0];
        let ry = currentItem.rotation[1];
        let rz = currentItem.rotation[2];
        
        if (currentBoundBone && model) {
            // 獲取 bone 的世界旋轉（Euler）
            const boneWorldQuat = new THREE.Quaternion();
            currentBoundBone.getWorldQuaternion(boneWorldQuat);
            const boneEuler = new THREE.Euler().setFromQuaternion(boneWorldQuat);
            
            // 結合 bone 旋轉和特效旋轉
            rx = (boneEuler.x * 180 / Math.PI) + currentItem.rotation[0];
            ry = (boneEuler.y * 180 / Math.PI) + currentItem.rotation[1];
            rz = (boneEuler.z * 180 / Math.PI) + currentItem.rotation[2];
        }
        
        // Convert degrees to radians
        h.setRotation(
            rx * Math.PI / 180, 
            ry * Math.PI / 180, 
            rz * Math.PI / 180
        );
        h.setScale(currentItem.scale[0], currentItem.scale[1], currentItem.scale[2]);
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
        }
        
        onUpdate(item.id, { isPlaying: true });
        setTimeout(() => onUpdate(item.id, { isPlaying: false }), 500);
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

        onUpdate(item.id, { 
            isLooping: false, 
            loopIntervalId: null,
            isPlaying: false 
        });
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

        const newTrigger: EffectTrigger = {
            id: crypto.randomUUID(),
            clipId: newTriggerState.clipId,
            clipName: getClipDisplayName(selectedClip),
            frame: frame
        };

        onUpdate(item.id, {
            triggers: [...item.triggers, newTrigger]
        });

        setNewTriggerState({ clipId: '', frame: '' });
    };

    const removeTrigger = (triggerId: string) => {
        onUpdate(item.id, {
            triggers: item.triggers.filter(t => t.id !== triggerId)
        });
    };

    useEffect(() => {
        return () => {
            if (item.loopIntervalId) {
                clearInterval(item.loopIntervalId);
            }
        };
    }, [item.loopIntervalId]);

    return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-visible transition-colors hover:border-gray-600">
            {/* Header */}
            <div className="flex items-center justify-between p-3 bg-gray-800/50 border-b border-gray-700">
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
                        className="bg-transparent text-sm font-medium text-gray-200 focus:outline-none focus:text-white truncate w-full"
                        placeholder="特效名稱"
                    />
                </div>
                
                <div className="flex items-center gap-2">
                    {item.isLoading && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
                    {item.isLoaded && !item.isLoading && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                    
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
                                className="w-full pl-8 pr-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300 focus:outline-none focus:border-blue-500 disabled:opacity-50"
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
                                <select
                                    value={item.boundBoneUuid || ''}
                                    onChange={(e) => onUpdate(item.id, { boundBoneUuid: e.target.value || null })}
                                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
                                >
                                    <option value="">無綁定（世界座標）</option>
                                    {bones.length === 0 ? (
                                        <option value="" disabled>模型未載入或無骨骼</option>
                                    ) : (
                                        bones.map((bone) => (
                                            <option key={bone.uuid} value={bone.uuid}>
                                                {bone.name || '未命名骨骼'}
                                            </option>
                                        ))
                                    )}
                                </select>
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
                                <div className="flex-1">
                                    <Vector3Input 
                                        label="縮放 (Scale)" 
                                        values={item.scale} 
                                        onChange={(v) => onUpdate(item.id, { scale: v })}
                                        step={0.5}
                                        icon={Maximize}
                                    />
                                </div>
                                <div className="w-1/3">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-0.5">
                                            <Gauge className="w-3.5 h-3.5" />
                                            <span>速度</span>
                                        </div>
                                        <div className="relative">
                                            <input 
                                                type="number" 
                                                value={item.speed}
                                                onChange={(e) => onUpdate(item.id, { speed: parseFloat(e.target.value) })}
                                                step={0.1}
                                                min={0}
                                                className="w-full pl-2 pr-1 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500 text-right font-mono"
                                            />
                                            <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] text-gray-500">x</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Playback Controls */}
            <div className="flex gap-2">
                <button
                    onClick={handlePlay}
                            disabled={!item.isLoaded}
                            className="flex-1 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/50 rounded text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95"
                        >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            Play
                </button>
                <button
                    onClick={handleStop}
                            disabled={!item.isLoaded}
                            className="flex-1 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/50 rounded text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95"
                        >
                            <Square className="w-3.5 h-3.5 fill-current" />
                            Stop
                        </button>
                        <button
                            onClick={handleLoopToggle}
                            disabled={!item.isLoaded}
                            className={`flex-1 py-1.5 rounded text-xs flex items-center justify-center gap-1.5 transition-all border disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95
                                ${item.isLooping
                                    ? 'bg-orange-600 text-white border-orange-500 shadow-[0_0_10px_rgba(234,88,12,0.3)]'
                                    : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'}`}
                        >
                            <Repeat className="w-3.5 h-3.5" />
                            {item.isLooping ? 'Looping' : 'Loop'}
                        </button>
                    </div>

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
                                        return (
                                            <div key={trigger.id} className="flex items-center justify-between bg-gray-800 rounded px-2 py-1.5 border border-gray-700">
                                                <div className="flex items-center gap-2 text-xs">
                                                    <span className="text-blue-400">{displayName}</span>
                                                    <span className="text-gray-500">@</span>
                                                    <span style={{ color: item.color }}>{trigger.frame} Frame</span>
                                                </div>
                                                <button
                                                    onClick={() => removeTrigger(trigger.id)}
                                                    className="text-gray-500 hover:text-red-400 transition-colors"
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
                                    <input
                                        type="number"
                                        placeholder="Frame"
                                        value={newTriggerState.frame}
                                        onChange={(e) => setNewTriggerState(prev => ({ ...prev, frame: e.target.value }))}
                                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
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
 */
interface EffectTestPanelProps {
    model?: THREE.Group | null;
    bones?: THREE.Object3D[];
    effects: EffectItem[];
    setEffects: React.Dispatch<React.SetStateAction<EffectItem[]>>;
    createdClips: IdentifiableClip[];
}

export default function EffectTestPanel({ model = null, bones = [], effects, setEffects, createdClips }: EffectTestPanelProps) {
    const [isRuntimeReady, setIsRuntimeReady] = useState(false);

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
                <button 
                    onClick={addEffectCard}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-medium transition-colors shadow-lg shadow-blue-900/20"
                >
                    <Plus className="w-3.5 h-3.5" />
                    新增特效
                </button>
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
                            <span>將 .efk 和所有資源（.png, .efkmat 等）放到 <code className="bg-gray-700 px-1 py-0.5 rounded text-gray-300">public/effekseer/</code></span>
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
                </div>
            </div>
        </div>
    );
}
