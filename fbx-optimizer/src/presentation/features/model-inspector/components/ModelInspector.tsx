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
                className="flex items-center hover:bg-gray-700 p-1 rounded cursor-pointer text-sm"
                style={{ paddingLeft: `${depth * 12 + 4}px` }}
                onClick={() => setExpanded(!expanded)}
            >
                <button className="mr-1 w-4 h-4 flex items-center justify-center text-gray-400">
                    {hasChildren && (expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
                </button>

                <span className="flex-1 truncate text-gray-300">{bone.name}</span>

                <button onClick={toggleVisibility} className="ml-2 text-gray-400 hover:text-white">
                    {visible ? <Eye size={14} /> : <EyeOff size={14} />}
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

    onToggleLoop,
    audioTracks,
    effects,
    theme
}: ModelInspectorProps) {
    const [activeTab, setActiveTab] = useState<'mesh' | 'bone' | 'clip' | 'playlist'>('mesh');
    const [meshes, setMeshes] = useState<THREE.Mesh[]>([]);
    const [rootBones, setRootBones] = useState<THREE.Object3D[]>([]); // 改為陣列，支援多個根骨架
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

    // Sync slider value with current time when not dragging
    useEffect(() => {
        if (!isDraggingSlider) {
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

            // 收集所有 Mesh
            model.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                    meshList.push(child as THREE.Mesh);
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
        } else {
            setMeshes([]);
            setRootBones([]);
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
        <div className={`${theme.panelBg} rounded-lg p-4 pt-6 flex flex-col h-full border ${theme.panelBorder}`}>
            {/* 上半部：列表切換 */}
            <div className={`flex space-x-2 mb-3 border-b ${theme.panelBorder} pb-2 overflow-x-auto`}>
                <button
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'mesh' ? theme.activeButton : theme.button}`}
                    onClick={() => setActiveTab('mesh')}
                >
                    Mesh
                </button>
                <button
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'bone' ? theme.activeButton : theme.button}`}
                    onClick={() => setActiveTab('bone')}
                >
                    骨架 ({rootBones.length})
                </button>
                <button
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'clip' ? theme.activeButton : theme.button}`}
                    onClick={() => setActiveTab('clip')}
                >
                    動作 ({createdClips.length})
                </button>
                <button
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'playlist' ? theme.activeButton : theme.button}`}
                    onClick={() => setActiveTab('playlist')}
                >
                    動作序列播放 ({playlist.length})
                </button>
            </div>

            {/* 列表內容區 (可捲動) */}
            <div className="flex-1 overflow-y-auto mb-4 pr-2 custom-scrollbar">
                {activeTab === 'mesh' && (
                    <div className="space-y-1" key={updateCounter}>
                        {meshes.length === 0 ? (
                            <div className="text-gray-500 text-sm text-center mt-4">無 Mesh 資料</div>
                        ) : (
                            meshes.map(mesh => {
                                const isVisible = mesh.visible;
                                return (
                                    <div key={mesh.uuid}
                                        className="flex items-center justify-between hover:bg-gray-700 p-2 rounded cursor-pointer"
                                        onClick={() => toggleMeshVisibility(mesh)}
                                    >
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <button className={`text-gray-400 hover:text-white ${isVisible ? 'text-blue-400' : ''}`}>
                                                {isVisible ? <CheckSquare size={16} /> : <Square size={16} />}
                                            </button>
                                            <span className={`text-sm truncate ${!isVisible ? 'text-gray-500' : 'text-gray-300'}`} title={mesh.name}>
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
                                        className={`flex flex-col p-2 rounded border transition-colors overflow-visible ${(isCurrentClip && isPlaying)
                                            ? 'bg-blue-900/70 border-blue-500'
                                            : isCurrentClip
                                                ? 'bg-gray-800 border-blue-600'
                                                : 'bg-gray-800 border-gray-700 hover:bg-gray-700'
                                            }`}
                                    >
                                        {/* Top row: clip info and buttons */}
                                        <div className="flex items-center justify-between mb-2">
                                            <div
                                                className="flex flex-col gap-0.5 flex-1 cursor-pointer"
                                                onClick={() => onSelectClip(animationClip)}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Film size={14} className={isCurrentClip ? 'text-blue-400' : 'text-gray-500'} />
                                                    <span className={`text-sm ${isCurrentClip ? 'text-blue-200 font-medium' : 'text-gray-300'}`}>{getClipDisplayName(animationClip)}</span>
                                                </div>
                                                {/* Display frame range if available */}
                                                {(animationClip as any).startFrame !== undefined && (animationClip as any).endFrame !== undefined && (
                                                    <span className="text-xs text-gray-500 ml-5">
                                                        {(animationClip as any).startFrame}-{(animationClip as any).endFrame}幀
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-500 font-mono">{animationClip.duration.toFixed(2)}s</span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onAddToPlaylist(animationClip); }}
                                                    className="text-gray-400 hover:text-green-400 p-1"
                                                    title="加入動作序列"
                                                >
                                                    <Plus size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDeleteCreatedClip(clipIndex);
                                                    }}
                                                    className="text-gray-400 hover:text-red-400 p-1"
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
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-gray-400">拖拉可排序</span>
                            <button
                                onClick={isPlaylistPlaying ? onPausePlaylist : onPlayPlaylist}
                                className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-bold transition-colors ${isPlaylistPlaying
                                    ? 'bg-yellow-600 hover:bg-yellow-500 text-white'
                                    : 'bg-green-600 hover:bg-green-500 text-white'
                                    }`}
                                disabled={playlist.length === 0}
                            >
                                {isPlaylistPlaying ? <Pause size={12} /> : <Play size={12} />}
                                {isPlaylistPlaying ? '暫停播放' : '全部播放'}
                            </button>
                        </div>

                        {playlist.length === 0 ? (
                            <div className="text-gray-500 text-sm text-center mt-4 border-2 border-dashed border-gray-700 rounded p-4">
                                尚未加入任何動作
                                <br />
                                <span className="text-xs">請從「動作」分頁加入</span>
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
                                        className={`relative flex flex-col p-2 rounded border transition-colors overflow-visible ${isCurrentClip
                                            ? 'bg-blue-900/30 border-blue-500'
                                            : 'bg-gray-800 border-gray-700 hover:bg-gray-700'
                                            } ${draggedItemIndex === playlistIndex ? 'opacity-50' : ''}`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-gray-500 font-mono w-4">{playlistIndex + 1}.</span>
                                                    <span className={`text-sm font-medium ${isCurrentClip ? 'text-blue-300' : 'text-gray-300'}`}>
                                                        {getClipDisplayName(playlistClip)}
                                                    </span>
                                                </div>
                                                {/* Display frame range if available */}
                                                {(playlistClip as any).startFrame !== undefined && (playlistClip as any).endFrame !== undefined && (
                                                    <span className="text-xs text-gray-500 ml-6">
                                                        {(playlistClip as any).startFrame}-{(playlistClip as any).endFrame}幀
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-500">{playlistClip.duration.toFixed(1)}s</span>
                                                {isCurrentClip && (
                                                    <span className="text-xs text-blue-400 font-mono">{Math.round(clipProgress)}%</span>
                                                )}
                                                <button
                                                    onClick={() => onRemoveFromPlaylist(playlistIndex)}
                                                    className="text-gray-500 hover:text-red-400 p-1"
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

            {/* 下半部：動畫控制與剪輯 - Premium Redesign */}
            <div className={`mt-auto border-t ${theme.panelBorder} bg-gradient-to-b from-gray-900/50 to-black/80 backdrop-blur-md p-4 space-y-4`}>
                {/* 播放控制 */}
                <div className="flex items-center gap-4">
                    {/* Play/Pause Button */}
                    <button
                        onClick={onPlayPause}
                        className={`group relative w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 shadow-lg hover:shadow-blue-500/30 hover:scale-105 active:scale-95 ${isPlaying
                            ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
                            : 'bg-gradient-to-br from-blue-600 to-indigo-700'
                            }`}
                    >
                        <div className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                        {isPlaying ? <Pause size={24} className="text-white fill-current" /> : <Play size={24} className="text-white fill-current" />}
                    </button>

                    {/* Loop Toggle Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleLoop();
                        }}
                        className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 border ${isLoopEnabled
                            ? 'bg-green-500/20 border-green-500/50 text-green-400 shadow-[0_0_10px_rgba(74,222,128,0.2)]'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                            }`}
                        title={isLoopEnabled ? '循環播放：開啟' : '循環播放：關閉'}
                    >
                        <Repeat size={18} />
                    </button>

                    {/* Timeline Slider */}
                    <div className="flex-1 flex flex-col justify-center gap-1">
                        <div className="flex justify-between text-[10px] font-medium tracking-wider text-gray-400 uppercase">
                            <span>{currentFrame} Frame</span>
                            <span>{totalFrames} Frame</span>
                        </div>
                        <div className="relative h-6 flex items-center group">
                            {/* Custom Track Background */}
                            <div className="absolute w-full h-1.5 bg-gray-700/50 rounded-full overflow-hidden pointer-events-none">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 opacity-30"
                                    style={{ width: '100%' }}
                                />
                            </div>
                            {/* Progress Fill */}
                            <div
                                className="absolute h-1.5 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full pointer-events-none transition-all duration-75 ease-out"
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
                                style={{
                                    WebkitAppearance: 'none',
                                    appearance: 'none',
                                    width: '100%',
                                    height: '24px',
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
                                className="absolute w-3 h-3 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)] pointer-events-none transition-all duration-75 ease-out group-hover:scale-125"
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
                        className={`w-8 h-8 flex items-center justify-center rounded-full transition-all duration-300 ${isClipFormExpanded
                            ? 'bg-white/10 text-white rotate-180'
                            : 'bg-transparent text-gray-500 hover:bg-white/5 hover:text-white'
                            }`}
                        title={isClipFormExpanded ? '縮起' : '展開'}
                    >
                        <ChevronDown size={18} />
                    </button>
                </div>

                {/* 剪輯建立 - Premium Style */}
                <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isClipFormExpanded ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div
                        onDragOver={handleIniDragOver}
                        onDragLeave={handleIniDragLeave}
                        onDrop={handleIniDrop}
                        className={`relative group rounded-xl border transition-all duration-300 ${isDraggingIni
                            ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.2)]'
                            : 'border-white/10 bg-white/5 hover:bg-white/[0.07] hover:border-white/20'
                            }`}
                    >
                        {/* 拖曳提示覆蓋層 */}
                        {isDraggingIni && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-xl z-20 pointer-events-none">
                                <div className="flex flex-col items-center animate-bounce">
                                    <FileUp className="w-8 h-8 text-blue-400 mb-2" />
                                    <p className="text-sm text-blue-300 font-medium">放開以導入 INI 檔案</p>
                                </div>
                            </div>
                        )}

                        <div className="p-3 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-1 h-4 bg-blue-500 rounded-full" />
                                    <span className="text-xs font-bold text-gray-300 tracking-wide uppercase">New Action Clip</span>
                                </div>
                                <button
                                    onClick={() => iniFileInputRef.current?.click()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg transition-all hover:shadow-[0_0_10px_rgba(59,130,246,0.15)]"
                                >
                                    <Upload size={12} />
                                    <span>Import INI</span>
                                </button>
                            </div>

                            <input
                                ref={iniFileInputRef}
                                type="file"
                                accept=".ini"
                                onChange={handleIniFileSelect}
                                className="hidden"
                            />

                            <div className="flex items-center gap-3">
                                <div className="flex-1 relative group/input">
                                    <input
                                        type="text"
                                        placeholder="動作名稱 (Action Name)"
                                        value={newClipName}
                                        onChange={(e) => setNewClipName(e.target.value)}
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:bg-black/40 transition-all"
                                    />
                                </div>

                                <div className="flex items-center bg-black/20 border border-white/10 rounded-lg p-1 gap-1">
                                    <NumberInput
                                        placeholder="Start"
                                        value={startFrame}
                                        onChange={(val) => setStartFrame(val)}
                                        className="w-12"
                                    />
                                    <span className="text-gray-600">/</span>
                                    <NumberInput
                                        placeholder="End"
                                        value={endFrame}
                                        onChange={(val) => setEndFrame(val)}
                                        className="w-12"
                                    />
                                </div>

                                <button
                                    onClick={handleCreateClip}
                                    className="flex items-center justify-center w-9 h-9 bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white rounded-lg shadow-lg shadow-green-900/20 hover:shadow-green-500/30 hover:scale-105 active:scale-95 transition-all duration-200"
                                    title="新增片段"
                                >
                                    <Plus size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

