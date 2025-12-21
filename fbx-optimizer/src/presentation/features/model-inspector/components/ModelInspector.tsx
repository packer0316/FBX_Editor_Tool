import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Eye, EyeOff, Play, Pause, Plus, ChevronRight, ChevronDown, Film, CheckSquare, Square, Trash2, Repeat, Upload, FileUp } from 'lucide-react';
import { NumberInput } from '../../../../components/ui/NumberInput';
import type { AudioTrack } from '../../../../domain/value-objects/AudioTrack';
import type { EffectItem } from '../../effect-panel/components/EffectTestPanel';
import ProgressBar from '../../../components/ProgressBar';
import { getClipId, getClipDisplayName, isSameClip, type IdentifiableClip } from '../../../../utils/clip/clipIdentifierUtils';
import { parseIniFromFile } from '../../../../utils/ini/iniParser';
import type { ThemeStyle } from '../../../../presentation/hooks/useTheme';

interface ModelInspectorProps {
    model: THREE.Group | null;
    clip: IdentifiableClip | null;
    currentTime: number;
    duration: number;
    isPlaying: boolean;
    onPlayPause: () => void;
    onSeek: (time: number) => void;
    onCreateClip: (name: string, start: number, end: number) => void;
    createdClips: IdentifiableClip[];
    onSelectClip: (clip: IdentifiableClip) => void;
    playlist: IdentifiableClip[];
    isPlaylistPlaying: boolean;
    currentPlaylistIndex: number;
    onAddToPlaylist: (clip: IdentifiableClip) => void;
    onRemoveFromPlaylist: (index: number) => void;
    onReorderPlaylist: (from: number, to: number) => void;
    onPlayPlaylist: () => void;
    onPausePlaylist: () => void;
    onDeleteCreatedClip: (index: number) => void;
    isLoopEnabled: boolean;
    /** 進度條即時更新 ref（繞過 React 渲染，實現 60fps 更新） */
    progressTimeRef?: React.MutableRefObject<number>;
    onToggleLoop: () => void;
    audioTracks: AudioTrack[];
    effects: EffectItem[];
    theme: ThemeStyle;
}

// 遞迴渲染骨架樹狀圖
const BoneTree = ({ bone, depth = 0, expandAll }: { bone: THREE.Object3D; depth?: number; expandAll?: boolean }) => {
    const [expanded, setExpanded] = useState(expandAll ?? true);
    const [visible, setVisible] = useState(bone.visible);

    // Helper to check if a child is part of the hierarchy (排除 Mesh，保留所有其他節點)
    const isHierarchyNode = (child: THREE.Object3D) => {
        // 只排除 Mesh 和 SkinnedMesh，保留所有其他類型的節點
        return !(child as any).isMesh && !(child as any).isSkinnedMesh;
    };

    const hasChildren = bone.children.some(isHierarchyNode);

    // 當 expandAll 改變時，更新 expanded 狀態
    useEffect(() => {
        if (expandAll !== undefined) {
            setExpanded(expandAll);
        }
    }, [expandAll]);

    const toggleVisibility = (e: React.MouseEvent) => {
        e.stopPropagation();
        const newVisible = !visible;
        bone.visible = newVisible;
        setVisible(newVisible);
    };

    return (
        <div className="select-none">
            <div
                className="flex items-center hover:bg-white/5 p-1 rounded-md cursor-pointer text-[11px] font-medium transition-colors group"
                style={{ paddingLeft: `${depth * 12 + 4}px` }}
                onClick={() => setExpanded(!expanded)}
            >
                <button className="mr-1 w-4 h-4 flex items-center justify-center text-gray-500 group-hover:text-gray-300">
                    {hasChildren && (expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />)}
                </button>

                <span className="flex-1 truncate text-gray-400 group-hover:text-gray-200">{bone.name}</span>

                <button onClick={toggleVisibility} className="ml-2 text-gray-600 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    {visible ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>
            </div>

            {expanded && hasChildren && (
                <div>
                    {bone.children.map(child => (
                        isHierarchyNode(child) && <BoneTree key={child.uuid} bone={child} depth={depth + 1} expandAll={expandAll} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default function ModelInspector({
    model,
    clip,
    currentTime,
    duration,
    isPlaying,
    onPlayPause,
    onSeek,
    onCreateClip,
    createdClips,
    onSelectClip,
    playlist,
    isPlaylistPlaying,
    currentPlaylistIndex,
    onAddToPlaylist,
    onRemoveFromPlaylist,
    onReorderPlaylist,
    onPlayPlaylist,
    onPausePlaylist,
    onDeleteCreatedClip,
    isLoopEnabled,
    progressTimeRef,
    onToggleLoop,
    audioTracks,
    effects,
    theme
}: ModelInspectorProps) {
    const [activeTab, setActiveTab] = useState<'mesh' | 'bone' | 'clip' | 'playlist'>('mesh');
    const [meshes, setMeshes] = useState<THREE.Mesh[]>([]);
    const [rootBones, setRootBones] = useState<THREE.Object3D[]>([]); // 改為陣列，支援多個根骨架
    const [boneCount, setBoneCount] = useState(0); // 真正的骨骼數量（與 3DS Max/Blender 一致）
    const [updateCounter, setUpdateCounter] = useState(0); // 用於強制重繪
    const [expandAll, setExpandAll] = useState(true); // 骨架展開狀態
    const [wasPlayingBeforeDrag, setWasPlayingBeforeDrag] = useState(false); // 拖動前是否在播放

    // 新增動作片段的狀態
    const [newClipName, setNewClipName] = useState('');
    // 使用字串方便讓使用者可以把「0」完全刪掉再輸入
    const [startFrame, setStartFrame] = useState<string>('');
    const [endFrame, setEndFrame] = useState<string>('');

    // Drag and Drop state for playlist
    const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

    // INI 檔案導入相關
    const iniFileInputRef = useRef<HTMLInputElement>(null);
    const [isDraggingIni, setIsDraggingIni] = useState(false);

    // 新增動作片段表單的展開/縮起狀態
    const [isClipFormExpanded, setIsClipFormExpanded] = useState(true);
    const [isDraggingSlider, setIsDraggingSlider] = useState(false);
    const [sliderValue, setSliderValue] = useState(0);
    
    // 用於節流 seek 操作
    const seekAnimationFrameRef = useRef<number | null>(null);
    const lastSeekTimeRef = useRef<number>(0);
    
    // 進度條即時更新 refs
    const progressFillRef = useRef<HTMLDivElement>(null);
    const progressThumbRef = useRef<HTMLDivElement>(null);
    const frameDisplayRef = useRef<HTMLSpanElement>(null);

    // 🔥 使用 requestAnimationFrame 實現 60fps 進度條更新（繞過 React 渲染）
    useEffect(() => {
        if (!progressTimeRef || duration <= 0 || isDraggingSlider) return;
        
        let rafId: number;
        
        const updateProgress = () => {
            const time = progressTimeRef.current;
            const progress = duration > 0 ? ((time % duration) / duration) * 100 : 0;
            
            // 直接操作 DOM，不觸發 React 渲染
            if (progressFillRef.current) {
                progressFillRef.current.style.width = `${progress}%`;
            }
            if (progressThumbRef.current) {
                progressThumbRef.current.style.left = `${progress}%`;
            }
            if (frameDisplayRef.current) {
                const frame = Math.floor((time % duration) * 30);
                frameDisplayRef.current.textContent = `${frame} Frame`;
            }
            
            rafId = requestAnimationFrame(updateProgress);
        };
        
        rafId = requestAnimationFrame(updateProgress);
        
        return () => cancelAnimationFrame(rafId);
    }, [progressTimeRef, duration, isDraggingSlider]);

    // Sync slider value with current time when not dragging
    useEffect(() => {
        if (!isDraggingSlider) {
            // 🔥 無論是否有 progressTimeRef，都要同步 sliderValue（input range 需要）
            setSliderValue(duration > 0 ? currentTime % duration : 0);
        }
    }, [currentTime, duration, isDraggingSlider]);

    // 清理 requestAnimationFrame
    useEffect(() => {
        return () => {
            if (seekAnimationFrameRef.current !== null) {
                cancelAnimationFrame(seekAnimationFrameRef.current);
            }
        };
    }, []);

    // 遍歷模型獲取 Mesh 和層級結構資訊
    useEffect(() => {
        if (model) {
            const meshList: THREE.Mesh[] = [];
            const rootNodes: THREE.Object3D[] = [];
            const boneSet = new Set<THREE.Bone>();

            // 收集所有 Mesh 和計算骨骼數量
            model.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                    meshList.push(child as THREE.Mesh);
                }
                
                // 來源1: 樹狀結構中的 Bone 節點
                if (child.type === 'Bone' || (child as any).isBone) {
                    boneSet.add(child as THREE.Bone);
                }
                
                // 來源2: SkinnedMesh 的 skeleton.bones（與 3DS Max/Blender 一致）
                if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
                    const skinnedMesh = child as THREE.SkinnedMesh;
                    if (skinnedMesh.skeleton && skinnedMesh.skeleton.bones) {
                        skinnedMesh.skeleton.bones.forEach((bone) => {
                            boneSet.add(bone);
                        });
                    }
                }
            });

            // 直接使用模型的直接子節點作為根節點（排除 Mesh）
            model.children.forEach((child) => {
                // 排除 Mesh 和 SkinnedMesh，保留所有其他類型的節點
                if (!(child as any).isMesh && !(child as any).isSkinnedMesh) {
                    rootNodes.push(child);
                }
            });

            setMeshes(meshList);
            setRootBones(rootNodes);
            setBoneCount(boneSet.size);
        } else {
            setMeshes([]);
            setRootBones([]);
            setBoneCount(0);
        }
    }, [model]);

    const toggleMeshVisibility = (mesh: THREE.Mesh) => {
        mesh.visible = !mesh.visible;
        setUpdateCounter(prev => prev + 1);
    };

    const handleCreateClip = () => {
        if (!newClipName) {
            alert('請輸入動作名稱');
            return;
        }

        const start = parseInt(startFrame, 10);
        const end = parseInt(endFrame, 10);

        if (Number.isNaN(start) || Number.isNaN(end)) {
            alert('請輸入起始與結束幀');
            return;
        }

        if (start >= end) {
            alert('結束幀必須大於起始幀');
            return;
        }
        onCreateClip(newClipName, start, end);
        setNewClipName('');
        setStartFrame('');
        setEndFrame('');
    };

    // 處理 INI 檔案導入
    const handleIniFileImport = async (file: File) => {
        try {
            const result = await parseIniFromFile(file);

            if (result.clips.length === 0) {
                alert('INI 檔案中沒有找到動畫片段資訊');
                return;
            }

            // 批量創建動畫片段
            let successCount = 0;
            let skipCount = 0;

            for (const clipInfo of result.clips) {
                if (!clipInfo.enabled) {
                    skipCount++;
                    continue;
                }

                try {
                    onCreateClip(clipInfo.name, clipInfo.startFrame, clipInfo.endFrame);
                    successCount++;
                } catch (error) {
                    console.error(`創建片段 "${clipInfo.name}" 失敗:`, error);
                }
            }

            alert(`成功導入 ${successCount} 個動畫片段${skipCount > 0 ? `，跳過 ${skipCount} 個未啟用片段` : ''}`);
        } catch (error) {
            console.error('解析 INI 檔案失敗:', error);
            alert('解析 INI 檔案失敗，請確認檔案格式正確');
        }
    };

    // 檔案選擇處理
    const handleIniFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleIniFileImport(file);
            // 清空 input 以允許重複選擇相同檔案
            if (iniFileInputRef.current) {
                iniFileInputRef.current.value = '';
            }
        }
    };

    // 拖放處理
    const handleIniDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingIni(true);
    };

    const handleIniDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingIni(false);
    };

    const handleIniDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingIni(false);

        const file = e.dataTransfer.files[0];
        if (file && (file.name.endsWith('.ini') || file.name.endsWith('.INI'))) {
            handleIniFileImport(file);
        } else {
            alert('請拖放 .ini 檔案');
        }
    };

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        setSliderValue(val);
        
        // 🔥 同步更新 progressTimeRef（確保拖動時數值一致）
        if (progressTimeRef) {
            progressTimeRef.current = val;
        }
        
        // 🔥 拖動時即時更新 UI（因為 RAF 循環被暫停了）
        if (progressFillRef.current && duration > 0) {
            progressFillRef.current.style.width = `${(val / duration) * 100}%`;
        }
        if (progressThumbRef.current && duration > 0) {
            progressThumbRef.current.style.left = `${(val / duration) * 100}%`;
        }
        if (frameDisplayRef.current && duration > 0) {
            const frame = Math.floor((val % duration) * 30);
            frameDisplayRef.current.textContent = `${frame} Frame`;
        }
        
        // 使用 requestAnimationFrame 節流 seek 操作
        if (seekAnimationFrameRef.current !== null) {
            cancelAnimationFrame(seekAnimationFrameRef.current);
        }
        
        seekAnimationFrameRef.current = requestAnimationFrame(() => {
            // 限制 seek 頻率至最多每 16ms (約 60fps)
            const now = performance.now();
            if (now - lastSeekTimeRef.current >= 16) {
                onSeek(val);
                lastSeekTimeRef.current = now;
            }
            seekAnimationFrameRef.current = null;
        });
    };

    const handleSliderMouseDown = () => {
        setIsDraggingSlider(true);
        setWasPlayingBeforeDrag(isPlaying);
        if (isPlaying) {
            onPlayPause();
        }
    };

    const handleSliderMouseUp = (e: React.MouseEvent<HTMLInputElement>) => {
        // 確保執行最後一次 seek
        const finalValue = parseFloat((e.target as HTMLInputElement).value);
        onSeek(finalValue);
        
        // 🔥 確保 progressTimeRef 同步最終值（防止 RAF 循環用舊值覆蓋）
        if (progressTimeRef) {
            progressTimeRef.current = finalValue;
        }
        
        setIsDraggingSlider(false);
        if (wasPlayingBeforeDrag && !isPlaying) {
            onPlayPause();
        }
    };

    // 計算當前幀數
    const currentFrame = duration > 0 ? Math.floor((currentTime % duration) * 30) : 0;
    const totalFrames = Math.floor(duration * 30);

    // Playlist Drag Handlers
    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedItemIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedItemIndex === null || draggedItemIndex === index) return;
        onReorderPlaylist(draggedItemIndex, index);
        setDraggedItemIndex(index);
    };

    const handleDragEnd = () => {
        setDraggedItemIndex(null);
    };

    return (
        <div className={`bg-[#0f172a]/95 rounded-xl flex flex-col h-full border border-white/10 shadow-2xl overflow-hidden backdrop-blur-sm`}>
            {/* 上半部：列表切換 - Professional DCC Style Tab Design */}
            <div className="flex items-center px-4 h-12 bg-white/[0.02] border-b border-white/10 overflow-x-auto no-scrollbar">
                {[
                    { id: 'mesh', label: 'Mesh', count: meshes.length > 0 ? meshes.length : 0 },
                    { id: 'bone', label: '骨架', count: boneCount },
                    { id: 'clip', label: '動作', count: createdClips.length },
                    { id: 'playlist', label: '動作序列', count: playlist.length }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        className="group relative flex items-center gap-2.5 px-5 h-full transition-all duration-200 whitespace-nowrap"
                        onClick={() => setActiveTab(tab.id as any)}
                    >
                        <span className={`text-[11px] font-bold tracking-widest transition-colors ${
                            activeTab === tab.id ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'
                        }`}>
                            {tab.label.toUpperCase()}
                        </span>
                        
                        {tab.count > 0 && (
                            <span className={`flex items-center justify-center h-4 min-w-[1.25rem] px-1.5 rounded-full text-[9px] font-black transition-all ${
                                activeTab === tab.id 
                                    ? 'bg-blue-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.4)]' 
                                    : 'bg-white/5 text-gray-700 group-hover:bg-white/10 group-hover:text-gray-500'
                            }`}>
                                {tab.count}
                            </span>
                        )}

                        {/* 選中狀態指示條 */}
                        {activeTab === tab.id && (
                            <div className="absolute bottom-0 left-4 right-4 h-[2px] bg-blue-500 rounded-t-full shadow-[0_-2px_10px_rgba(59,130,246,0.6)]" />
                        )}
                    </button>
                ))}
            </div>

            {/* 列表內容區 (可捲動) */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {activeTab === 'mesh' && (
                    <div className="space-y-1" key={updateCounter}>
                        {meshes.length === 0 ? (
                            <div className="text-gray-500 text-sm text-center mt-4">無 Mesh 資料</div>
                        ) : (
                            meshes.map(mesh => {
                                const isVisible = mesh.visible;
                                return (
                                    <div key={mesh.uuid}
                                        className="flex items-center justify-between hover:bg-white/5 px-3 py-2 rounded-lg transition-colors cursor-pointer group"
                                        onClick={() => toggleMeshVisibility(mesh)}
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${isVisible ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-gray-600'}`}>
                                                {isVisible ? <CheckSquare size={14} /> : <Square size={14} />}
                                            </div>
                                            <span className={`text-xs font-medium truncate ${!isVisible ? 'text-gray-500' : 'text-gray-200'}`} title={mesh.name}>
                                                {mesh.name || 'Unnamed Mesh'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {activeTab === 'bone' && (
                    <div className="space-y-1">
                        {rootBones.length === 0 ? (
                            <div className="text-gray-500 text-sm text-center mt-4">無層級結構</div>
                        ) : (
                            <>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs text-gray-400">
                                        顯示完整層級結構 ({rootBones.length} 個根節點)
                                    </span>
                                    <button
                                        onClick={() => setExpandAll(!expandAll)}
                                        className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors flex items-center gap-1"
                                    >
                                        {expandAll ? (
                                            <>
                                                <ChevronDown size={14} />
                                                <span>全部收起</span>
                                            </>
                                        ) : (
                                            <>
                                                <ChevronRight size={14} />
                                                <span>全部展開</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                                {rootBones.map((rootBone) => (
                                    <div key={rootBone.uuid} className="mb-2">
                                        <BoneTree bone={rootBone} expandAll={expandAll} />
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'clip' && (
                    <div className="space-y-1">
                        {createdClips.length === 0 ? (
                            <div
                                data-drop-zone="ini"
                                onDragOver={handleIniDragOver}
                                onDragLeave={handleIniDragLeave}
                                onDrop={handleIniDrop}
                                className={`relative border-2 border-dashed rounded-lg p-8 text-center mt-4 transition-all ${isDraggingIni
                                    ? 'border-blue-500 bg-blue-500/10'
                                    : 'border-gray-700 bg-gray-800/30'
                                    }`}
                            >
                                {isDraggingIni ? (
                                    <div className="flex flex-col items-center">
                                        <FileUp className="w-10 h-10 text-blue-400 mb-3" />
                                        <p className="text-sm text-blue-300 font-medium mb-1">放開以導入 INI 檔案</p>
                                        <p className="text-xs text-gray-400">自動創建所有動畫片段</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center">
                                        <FileUp className="w-8 h-8 text-gray-600 mb-2" />
                                        <p className="text-gray-500 text-sm mb-1">尚未建立動作片段</p>
                                        <p className="text-gray-600 text-xs">拖放 .ini 檔案或使用下方按鈕創建</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            createdClips.map((animationClip, clipIndex) => {
                                // 使用 customId 進行精確匹配
                                const isCurrentClip = isSameClip(clip, animationClip) && !isPlaylistPlaying;
                                let progress = 0;
                                let progressState: 'playing' | 'inactive' = 'inactive';

                                if (isCurrentClip && animationClip.duration > 0) {
                                    progress = (Math.min(currentTime, animationClip.duration) / animationClip.duration) * 100;
                                    progressState = 'playing';
                                }

                                // 計算 Audio Markers（不使用 useMemo，因為在 map 中）
                                const audioMarkers = audioTracks.flatMap(audioTrack =>
                                    audioTrack.triggers
                                        .filter(trigger => trigger.clipId === getClipId(animationClip))
                                        .map(trigger => ({ trigger, audioTrack }))
                                );

                                // 計算 Effect Markers
                                const effectMarkers = effects.flatMap(effect =>
                                    effect.triggers
                                        .filter(trigger => trigger.clipId === getClipId(animationClip))
                                        .map(trigger => ({ trigger, effectItem: { id: effect.id, name: effect.name, color: effect.color, boundBoneUuid: effect.boundBoneUuid } }))
                                );

                                return (
                                    <div
                                        key={clipIndex}
                                        className={`flex flex-col px-3 py-2.5 rounded-lg border transition-all duration-200 overflow-visible ${
                                            isCurrentClip
                                                ? 'bg-blue-600/10 border-blue-500/40 shadow-[0_4px_15px_rgba(0,0,0,0.1)]'
                                                : 'bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10'
                                            }`}
                                    >
                                        {/* Top row: clip info and buttons */}
                                        <div className="flex items-center justify-between mb-2">
                                            <div
                                                className="flex flex-col gap-0.5 flex-1 cursor-pointer group/clipinfo"
                                                onClick={() => onSelectClip(animationClip)}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Film size={12} className={isCurrentClip ? 'text-blue-400' : 'text-gray-500 transition-colors group-hover/clipinfo:text-gray-300'} />
                                                    <span className={`text-xs font-bold tracking-tight ${isCurrentClip ? 'text-blue-100' : 'text-gray-400 group-hover/clipinfo:text-gray-200'}`}>
                                                        {getClipDisplayName(animationClip)}
                                                    </span>
                                                </div>
                                                {/* Display frame range if available */}
                                                {(animationClip as any).startFrame !== undefined && (animationClip as any).endFrame !== undefined && (
                                                    <span className="text-[10px] font-bold text-gray-600 ml-5 tracking-widest">
                                                        {(animationClip as any).startFrame} — {(animationClip as any).endFrame} F
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-[10px] font-bold text-gray-500 font-mono mr-2">{animationClip.duration.toFixed(2)}S</span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onAddToPlaylist(animationClip); }}
                                                    className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-green-400 hover:bg-green-400/10 rounded transition-all"
                                                    title="加入動作序列"
                                                >
                                                    <Plus size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDeleteCreatedClip(clipIndex);
                                                    }}
                                                    className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-all"
                                                    title="刪除動作"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Progress Bar with Audio and Effect Markers */}
                                        <ProgressBar
                                            progress={progress}
                                            state={progressState}
                                            size="md"
                                            audioMarkers={audioMarkers}
                                            effectMarkers={effectMarkers}
                                            clipDuration={animationClip.duration}
                                            className="mt-2"
                                        />
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {activeTab === 'playlist' && (
                    <div className="space-y-2">
                        <div className="flex justify-between items-center mb-3 px-1">
                            <div className="flex items-center gap-2">
                                <div className="w-1 h-3 bg-blue-500/50 rounded-full" />
                                <span className="text-[10px] font-bold text-gray-500 tracking-wider uppercase">Sequence Order</span>
                            </div>
                            <button
                                onClick={isPlaylistPlaying ? onPausePlaylist : onPlayPlaylist}
                                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${isPlaylistPlaying
                                    ? 'bg-amber-500 hover:bg-amber-400 text-white shadow-lg shadow-amber-900/20'
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20'
                                    }`}
                                disabled={playlist.length === 0}
                            >
                                {isPlaylistPlaying ? <Pause size={12} className="fill-current" /> : <Play size={12} className="fill-current" />}
                                <span>{isPlaylistPlaying ? 'PAUSE' : 'PLAY ALL'}</span>
                            </button>
                        </div>

                        {playlist.length === 0 ? (
                            <div className="text-gray-500 text-[11px] font-medium text-center py-12 border-2 border-dashed border-white/5 rounded-xl bg-white/[0.01]">
                                <Film className="w-8 h-8 mx-auto mb-3 opacity-10" />
                                <p>No actions in sequence</p>
                                <p className="text-[10px] text-gray-600 mt-1 uppercase tracking-widest">Add from "動作" tab</p>
                            </div>
                        ) : (
                            playlist.map((playlistClip, playlistIndex) => {
                                const isCurrentClip = (isPlaylistPlaying && currentPlaylistIndex === playlistIndex);
                                const isClipCompleted = playlistIndex < currentPlaylistIndex;

                                let clipProgress = 0;
                                let progressState: 'completed' | 'playing' | 'pending' = 'pending';

                                if (isClipCompleted) {
                                    clipProgress = 100;
                                    progressState = 'completed';
                                } else if (isCurrentClip && playlistClip.duration > 0) {
                                    clipProgress = (Math.min(currentTime, playlistClip.duration) / playlistClip.duration) * 100;
                                    progressState = 'playing';
                                }

                                // 計算 Audio Markers（不使用 useMemo，因為在 map 中）
                                const audioMarkers = audioTracks.flatMap(audioTrack =>
                                    audioTrack.triggers
                                        .filter(trigger => trigger.clipId === getClipId(playlistClip))
                                        .map(trigger => ({ trigger, audioTrack }))
                                );

                                return (
                                    <div
                                        key={`${getClipId(playlistClip)}-${playlistIndex}`}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, playlistIndex)}
                                        onDragOver={(e) => handleDragOver(e, playlistIndex)}
                                        onDragEnd={handleDragEnd}
                                        className={`relative flex flex-col px-3 py-2.5 rounded-lg border transition-all duration-200 overflow-visible ${isCurrentClip
                                            ? 'bg-blue-600/10 border-blue-500/40 shadow-[0_4px_15px_rgba(0,0,0,0.1)]'
                                            : 'bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10'
                                            } ${draggedItemIndex === playlistIndex ? 'opacity-50 shadow-none border-dashed' : ''} cursor-grab active:cursor-grabbing`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-gray-600 font-mono w-4">{String(playlistIndex + 1).padStart(2, '0')}</span>
                                                    <span className={`text-xs font-bold tracking-tight ${isCurrentClip ? 'text-blue-100' : 'text-gray-300'}`}>
                                                        {getClipDisplayName(playlistClip)}
                                                    </span>
                                                </div>
                                                {/* Display frame range if available */}
                                                {(playlistClip as any).startFrame !== undefined && (playlistClip as any).endFrame !== undefined && (
                                                    <span className="text-[10px] font-bold text-gray-600 ml-6 tracking-widest">
                                                        {(playlistClip as any).startFrame} — {(playlistClip as any).endFrame} F
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-gray-500 mr-1">{playlistClip.duration.toFixed(1)}S</span>
                                                {isCurrentClip && (
                                                    <span className="text-[10px] text-blue-400 font-bold font-mono">{Math.round(clipProgress)}%</span>
                                                )}
                                                <button
                                                    onClick={() => onRemoveFromPlaylist(playlistIndex)}
                                                    className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-all"
                                                >
                                                    <Plus size={14} className="rotate-45" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Progress Bar with Audio Markers */}
                                        <ProgressBar
                                            progress={clipProgress}
                                            state={progressState}
                                            size="sm"
                                            audioMarkers={audioMarkers}
                                            clipDuration={playlistClip.duration}
                                        />
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>

            {/* 下半部：動畫控制與剪輯 - Professional Redesign */}
            <div className={`mt-auto border-t border-white/10 bg-[#0f172a]/80 backdrop-blur-md p-4 space-y-4 relative z-10`}>
                {/* 播放控制 */}
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        {/* Play/Pause Button */}
                        <button
                            onClick={onPlayPause}
                            disabled={!model || !clip}
                            className={`group relative w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 ${
                                !model || !clip
                                    ? 'bg-white/5 cursor-not-allowed opacity-30'
                                    : isPlaying
                                        ? 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20'
                                        : 'bg-white/10 hover:bg-white/20 text-white border border-white/5'
                            }`}
                        >
                            {isPlaying ? <Pause size={20} className="fill-current" /> : <Play size={20} className="ml-0.5 fill-current" />}
                        </button>

                        {/* Loop Toggle Button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleLoop();
                            }}
                            disabled={!model || !clip}
                            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 border ${
                                !model || !clip
                                    ? 'bg-white/5 border-white/5 text-gray-600 cursor-not-allowed opacity-30'
                                    : isLoopEnabled
                                        ? 'bg-blue-500/20 border-blue-500/40 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                            }`}
                            title={isLoopEnabled ? '循環播放：開啟' : '循環播放：關閉'}
                        >
                            <Repeat size={18} />
                        </button>
                    </div>

                    {/* Timeline Slider */}
                    <div className="flex-1 flex flex-col justify-center gap-1.5">
                        <div className="flex justify-between items-end text-[10px] font-bold tracking-widest text-gray-500 uppercase">
                            <span ref={frameDisplayRef} className="text-blue-400/80">{currentFrame} FRAME</span>
                            <span className="opacity-50">{totalFrames} FRAME</span>
                        </div>
                        <div className="relative h-5 flex items-center group">
                            {/* Custom Track Background */}
                            <div className="absolute w-full h-1 bg-white/10 rounded-full overflow-hidden pointer-events-none">
                                <div
                                    className="h-full bg-white/5"
                                    style={{ width: '100%' }}
                                />
                            </div>
                            {/* Progress Fill */}
                            <div
                                ref={progressFillRef}
                                className="absolute h-1 bg-blue-500 rounded-full pointer-events-none shadow-[0_0_8px_rgba(59,130,246,0.4)]"
                                style={{ width: `${duration > 0 ? (sliderValue / duration) * 100 : 0}%` }}
                            />

                            <input
                                type="range"
                                min={0}
                                max={duration || 0}
                                step={0.01}
                                value={sliderValue}
                                onChange={handleSliderChange}
                                onMouseDown={handleSliderMouseDown}
                                onMouseUp={handleSliderMouseUp}
                                disabled={!model || !clip}
                                style={{
                                    WebkitAppearance: 'none',
                                    appearance: 'none',
                                    width: '100%',
                                    height: '20px',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    position: 'absolute',
                                    zIndex: 10,
                                    margin: 0,
                                    padding: 0
                                }}
                                className="range-slider-custom"
                            />

                            {/* Custom Thumb (Visual Only) */}
                            <div
                                ref={progressThumbRef}
                                className="absolute w-3 h-3 bg-white rounded-full shadow-xl pointer-events-none scale-0 group-hover:scale-100 transition-transform duration-150"
                                style={{
                                    left: `${duration > 0 ? (sliderValue / duration) * 100 : 0}%`,
                                    transform: 'translateX(-50%)'
                                }}
                            />
                        </div>
                    </div>

                    {/* Expand/Collapse Button */}
                    <button
                        onClick={() => setIsClipFormExpanded(!isClipFormExpanded)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 ${isClipFormExpanded
                            ? 'bg-white/10 text-white rotate-0'
                            : 'bg-transparent text-gray-500 hover:bg-white/5 hover:text-white rotate-180'
                            }`}
                        title={isClipFormExpanded ? '收起剪輯工具' : '展開剪輯工具'}
                    >
                        <ChevronDown size={18} />
                    </button>
                </div>

                {/* 剪輯建立 - Professional Style */}
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isClipFormExpanded ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div
                        data-drop-zone="ini"
                        onDragOver={handleIniDragOver}
                        onDragLeave={handleIniDragLeave}
                        onDrop={handleIniDrop}
                        className={`relative group rounded-lg border transition-all duration-300 ${isDraggingIni
                            ? 'border-blue-500 bg-blue-500/5'
                            : 'border-white/5 bg-white/[0.03] hover:bg-white/[0.06]'
                            }`}
                    >
                        <div className="p-3 flex items-center gap-4">
                            <div className="flex items-center gap-2 shrink-0">
                                <div className="w-1 h-3 bg-blue-500/50 rounded-full" />
                                <span className="text-[10px] font-bold text-gray-500 tracking-wider uppercase">New Clip</span>
                            </div>

                            <div className="flex-1 flex items-center gap-3">
                                <div className="flex-1 relative">
                                    <input
                                        type="text"
                                        placeholder="Action Name..."
                                        value={newClipName}
                                        onChange={(e) => setNewClipName(e.target.value)}
                                        className="w-full bg-white/5 border border-white/5 rounded px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/30 transition-all"
                                    />
                                </div>

                                <div className="flex items-center bg-white/5 border border-white/5 rounded px-2 py-1 gap-2">
                                    <NumberInput
                                        placeholder="Start"
                                        value={startFrame}
                                        onChange={(val) => setStartFrame(val)}
                                        className="w-10"
                                    />
                                    <span className="text-gray-700 text-xs">/</span>
                                    <NumberInput
                                        placeholder="End"
                                        value={endFrame}
                                        onChange={(val) => setEndFrame(val)}
                                        className="w-10"
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleCreateClip}
                                        className="flex items-center justify-center w-8 h-8 bg-blue-600 hover:bg-blue-500 text-white rounded transition-all duration-200 shadow-lg shadow-blue-900/20"
                                        title="新增片段"
                                    >
                                        <Plus size={16} />
                                    </button>

                                    <div className="w-px h-4 bg-white/10 mx-1" />

                                    <button
                                        onClick={() => iniFileInputRef.current?.click()}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/5 rounded transition-all"
                                    >
                                        <Upload size={12} />
                                        <span>INI</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 拖曳提示覆蓋層 */}
                        {isDraggingIni && (
                            <div className="absolute inset-0 flex items-center justify-center bg-blue-600/20 backdrop-blur-sm rounded-lg z-20 pointer-events-none">
                                <div className="flex flex-col items-center">
                                    <FileUp className="w-6 h-6 text-white mb-1" />
                                    <p className="text-[10px] text-white font-bold uppercase tracking-tighter">Drop INI Here</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                
                <input
                    ref={iniFileInputRef}
                    type="file"
                    accept=".ini"
                    onChange={handleIniFileSelect}
                    className="hidden"
                />
            </div>
        </div>
    );
}

