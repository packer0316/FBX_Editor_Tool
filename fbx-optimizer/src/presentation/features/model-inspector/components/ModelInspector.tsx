import { useState, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Eye, EyeOff, Play, Pause, Plus, ChevronRight, ChevronDown, Film, CheckSquare, Square, Trash2, Repeat } from 'lucide-react';
import type { AudioTrack } from '../../../../domain/value-objects/AudioTrack';
import ProgressBar from '../../../components/ProgressBar';
import { getClipId, getClipDisplayName, isSameClip, type IdentifiableClip } from '../../../../utils/clip/clipIdentifierUtils';

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
    audioTracks
}: ModelInspectorProps) {
    const [activeTab, setActiveTab] = useState<'mesh' | 'bone' | 'clip' | 'playlist'>('mesh');
    const [meshes, setMeshes] = useState<THREE.Mesh[]>([]);
    const [rootBones, setRootBones] = useState<THREE.Object3D[]>([]); // 改為陣列，支援多個根骨架
    const [updateCounter, setUpdateCounter] = useState(0); // 用於強制重繪
    const [expandAll, setExpandAll] = useState(true); // 骨架展開狀態
    const [isDraggingSlider, setIsDraggingSlider] = useState(false); // 是否正在拖動播放條
    const [wasPlayingBeforeDrag, setWasPlayingBeforeDrag] = useState(false); // 拖動前是否在播放

    // 新增動作片段的狀態
    const [newClipName, setNewClipName] = useState('');
    // 使用字串方便讓使用者可以把「0」完全刪掉再輸入
    const [startFrame, setStartFrame] = useState<string>('');
    const [endFrame, setEndFrame] = useState<string>('');

    // Drag and Drop state for playlist
    const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

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

    // 播放條拖動處理
    const handleSliderMouseDown = () => {
        setIsDraggingSlider(true);
        setWasPlayingBeforeDrag(isPlaying);
        if (isPlaying) {
            onPlayPause(); // 暫停播放
        }
    };

    const handleSliderMouseUp = () => {
        setIsDraggingSlider(false);
        if (wasPlayingBeforeDrag) {
            onPlayPause(); // 恢復播放
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
        <div className="bg-gray-800 rounded-lg p-4 pt-6 flex flex-col h-full border border-gray-700">
            {/* 上半部：列表切換 */}
            <div className="flex space-x-2 mb-3 border-b border-gray-700 pb-2 overflow-x-auto">
                <button
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'mesh' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
                    onClick={() => setActiveTab('mesh')}
                >
                    Mesh
                </button>
                <button
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'bone' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
                    onClick={() => setActiveTab('bone')}
                >
                    骨架 ({rootBones.length})
                </button>
                <button
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'clip' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
                    onClick={() => setActiveTab('clip')}
                >
                    動作 ({createdClips.length})
                </button>
                <button
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'playlist' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
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
                            <div className="text-gray-500 text-sm text-center mt-4">尚未建立動作片段</div>
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

                                        {/* Progress Bar with Audio Markers */}
                                        <ProgressBar
                                            progress={progress}
                                            state={progressState}
                                            size="md"
                                            audioMarkers={audioMarkers}
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

            {/* 下半部：動畫控制與剪輯 */}
            <div className="border-t border-gray-700 pt-3 space-y-3">
                {/* 播放控制 */}
                <div className="flex items-center space-x-3">
                    <button
                        onClick={onPlayPause}
                        className="w-10 h-10 flex items-center justify-center bg-blue-600 hover:bg-blue-500 rounded-full text-white transition-colors"
                    >
                        {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                    </button>

                    {/* Loop Toggle Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleLoop();
                        }}
                        className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${isLoopEnabled
                            ? 'bg-green-600 hover:bg-green-500 text-white'
                            : 'bg-gray-700 hover:bg-gray-600 text-gray-400'
                            }`}
                        title={isLoopEnabled ? '循環播放：開啟' : '循環播放：關閉'}
                    >
                        <Repeat size={20} />
                    </button>

                    <div className="flex-1">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span>{currentFrame} Frame</span>
                            <span>{totalFrames} Frame</span>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={duration || 0}
                            step={0.01}
                            value={duration > 0 ? currentTime % duration : 0}
                            onChange={(e) => onSeek(parseFloat(e.target.value))}
                            onMouseDown={handleSliderMouseDown}
                            onMouseUp={handleSliderMouseUp}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>
                </div>

                {/* 剪輯建立 */}
                <div className="bg-gray-900/50 p-3 rounded border border-gray-700">
                    <div className="text-xs text-gray-400 mb-2 font-medium">新增動作片段</div>
                    <div className="flex items-center space-x-2">
                        <input
                            type="text"
                            placeholder="動作名稱"
                            value={newClipName}
                            onChange={(e) => setNewClipName(e.target.value)}
                            className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
                        />
                        <div className="flex items-center space-x-1">
                            <input
                                type="number"
                                placeholder="始"
                                value={startFrame}
                                onChange={(e) => setStartFrame(e.target.value)}
                                className="w-16 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white text-center"
                            />
                            <span className="text-gray-500">-</span>
                            <input
                                type="number"
                                placeholder="終"
                                value={endFrame}
                                onChange={(e) => setEndFrame(e.target.value)}
                                className="w-16 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white text-center"
                            />
                        </div>
                        <button
                            onClick={handleCreateClip}
                            className="bg-green-600 hover:bg-green-500 text-white p-1.5 rounded transition-colors"
                            title="新增片段"
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

