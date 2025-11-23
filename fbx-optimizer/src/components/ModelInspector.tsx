import React, { useState, useEffect } from 'react';
import * as THREE from 'three';
import { Eye, EyeOff, Play, Pause, Plus, ChevronRight, ChevronDown, Film, CheckSquare, Square, Trash2, Repeat, Music } from 'lucide-react';
import type { AudioTrack } from '../App';

interface ModelInspectorProps {
    model: THREE.Group | null;
    clip: THREE.AnimationClip | null;
    currentTime: number;
    duration: number;
    isPlaying: boolean;
    onPlayPause: () => void;
    onSeek: (time: number) => void;
    onCreateClip: (name: string, start: number, end: number) => void;
    createdClips: THREE.AnimationClip[];
    onSelectClip: (clip: THREE.AnimationClip) => void;
    playlist: THREE.AnimationClip[];
    isPlaylistPlaying: boolean;
    currentPlaylistIndex: number;
    onAddToPlaylist: (clip: THREE.AnimationClip) => void;
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

    // Helper to check if a child is part of the skeleton hierarchy
    const isSkeletonNode = (child: THREE.Object3D) => {
        return (
            child.type === 'Bone' ||
            child.type === 'Object3D' ||
            child.name.toLowerCase().includes('bone') ||
            child.name.toLowerCase().includes('root') ||
            child.name.toLowerCase().includes('bip') ||
            child.name.toLowerCase().includes('dummy')
        ) && !child.isMesh && !child.isSkinnedMesh;
    };

    const hasChildren = bone.children.some(isSkeletonNode);

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
                        isSkeletonNode(child) && <BoneTree key={child.uuid} bone={child} depth={depth + 1} expandAll={expandAll} />
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
    const [rootBone, setRootBone] = useState<THREE.Object3D | null>(null);
    const [updateCounter, setUpdateCounter] = useState(0); // 用於強制重繪
    const [expandAll, setExpandAll] = useState(true); // 骨架展開狀態
    const [isDraggingSlider, setIsDraggingSlider] = useState(false); // 是否正在拖動播放條
    const [wasPlayingBeforeDrag, setWasPlayingBeforeDrag] = useState(false); // 拖動前是否在播放

    // 新增動作片段的狀態
    const [newClipName, setNewClipName] = useState('');
    const [startFrame, setStartFrame] = useState(0);
    const [endFrame, setEndFrame] = useState(0);

    // Drag and Drop state for playlist
    const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

    // 遍歷模型獲取 Mesh 和骨架資訊
    useEffect(() => {
        if (model) {
            const meshList: THREE.Mesh[] = [];
            let root: THREE.Object3D | null = null;

            model.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                    meshList.push(child as THREE.Mesh);
                }
                if (
                    (child.type === 'Bone' ||
                        child.type === 'Object3D' ||
                        child.parent?.type === 'Bone' ||
                        child.name.toLowerCase().includes('bone') ||
                        child.name.toLowerCase().includes('root') ||
                        child.name.toLowerCase().includes('bip') ||
                        child.name.toLowerCase().includes('dummy')) &&
                    !root &&
                    child !== model &&
                    !child.isMesh &&
                    !child.isSkinnedMesh
                ) {
                    // 找到最上層的骨架 (通常是 RootNode 的子節點)
                    // 往上找直到 parent 不是 Bone 且不是上述類型
                    let current = child;
                    while (current.parent && (
                        current.parent.type === 'Bone' ||
                        current.parent.type === 'Object3D' ||
                        current.parent.name.toLowerCase().includes('root') ||
                        current.parent.name.toLowerCase().includes('dummy')
                    ) && current.parent !== model) {
                        current = current.parent;
                    }
                    root = current;
                }
            });

            setMeshes(meshList);
            setRootBone(root);
        } else {
            setMeshes([]);
            setRootBone(null);
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
        if (startFrame >= endFrame) {
            alert('結束幀必須大於起始幀');
            return;
        }
        onCreateClip(newClipName, startFrame, endFrame);
        setNewClipName('');
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
                    骨架
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
                    播放清單 ({playlist.length})
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
                        {!rootBone ? (
                            <div className="text-gray-500 text-sm text-center mt-4">無骨架資料</div>
                        ) : (
                            <>
                                <div className="flex justify-end mb-2">
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
                                <BoneTree bone={rootBone} expandAll={expandAll} />
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'clip' && (
                    <div className="space-y-1">
                        {createdClips.length === 0 ? (
                            <div className="text-gray-500 text-sm text-center mt-4">尚未建立動作片段</div>
                        ) : (
                            createdClips.map((c, idx) => {
                                // Calculate progress for current clip
                                // Use name for matching as UUIDs might change during optimization
                                const isCurrentClip = clip?.name === c.name;
                                let progress = 0;
                                if (isCurrentClip && c.duration > 0) {
                                    progress = (Math.min(currentTime, c.duration) / c.duration) * 100;
                                }

                                return (
                                    <div
                                        key={idx}
                                        className={`flex flex-col p-2 rounded border transition-colors ${(isCurrentClip && isPlaying)
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
                                                onClick={() => onSelectClip(c)}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Film size={14} className={isCurrentClip ? 'text-blue-400' : 'text-gray-500'} />
                                                    <span className={`text-sm ${isCurrentClip ? 'text-blue-200 font-medium' : 'text-gray-300'}`}>{c.name}</span>
                                                </div>
                                                {/* Display frame range if available */}
                                                {(c as any).startFrame !== undefined && (c as any).endFrame !== undefined && (
                                                    <span className="text-xs text-gray-500 ml-5">
                                                        {(c as any).startFrame}-{(c as any).endFrame}幀
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-500 font-mono">{c.duration.toFixed(2)}s</span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onAddToPlaylist(c); }}
                                                    className="text-gray-400 hover:text-green-400 p-1"
                                                    title="加入播放清單"
                                                >
                                                    <Plus size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDeleteCreatedClip(idx);
                                                    }}
                                                    className="text-gray-400 hover:text-red-400 p-1"
                                                    title="刪除動作"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="w-full h-2 bg-gray-900 rounded-full relative mt-2">
                                            <div
                                                className={`h-full rounded-full ${isCurrentClip ? 'bg-blue-500' : 'bg-gray-600'}`}
                                                style={{ width: `${progress}%` }}
                                            />
                                            {/* Audio Markers */}
                                            {audioTracks.flatMap(track =>
                                                track.triggers
                                                    .filter(t => t.clipName === c.name) // Match by name here too for consistency
                                                    .map(t => ({ trigger: t, track }))
                                            ).map(({ trigger, track }) => {
                                                // Calculate percentage based on frame count (assuming 30fps for now as standard)
                                                // If duration is 0, avoid division by zero
                                                const totalFrames = c.duration * 30;
                                                const pct = totalFrames > 0 ? (trigger.frame / totalFrames) * 100 : 0;

                                                return (
                                                    <div
                                                        key={trigger.id}
                                                        className="absolute top-0 bottom-0 w-1 z-10 hover:w-2 transition-all cursor-help group"
                                                        style={{
                                                            left: `${Math.min(Math.max(pct, 0), 100)}%`,
                                                            backgroundColor: track.color || '#FACC15'
                                                        }}
                                                    >
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50 whitespace-nowrap">
                                                            <div className="bg-gray-800 text-white text-xs px-2 py-1 rounded border border-gray-600 shadow-lg flex flex-col items-center">
                                                                <span className="font-medium" style={{ color: track.color || '#FACC15' }}>{track.name}</span>
                                                                <span className="text-gray-400 text-[10px]">Frame: {trigger.frame}</span>
                                                            </div>
                                                            <div className="w-2 h-2 bg-gray-600 transform rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1"></div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
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
                            playlist.map((c, idx) => {
                                const isCurrent = (isPlaylistPlaying && currentPlaylistIndex === idx) || (!isPlaylistPlaying && clip === c);
                                // A clip is completed if:
                                // 1. Its index is less than current index, OR
                                // 2. Playlist has finished (!isPlaylistPlaying) and this clip was in the playlist (idx <= currentPlaylistIndex)
                                const isCompleted = idx < currentPlaylistIndex || (!isPlaylistPlaying && idx <= currentPlaylistIndex && currentPlaylistIndex > 0);
                                let progress = 0;

                                if (isCompleted) {
                                    // Clips that have already finished playing should stay at 100%
                                    progress = 100;
                                } else if (isCurrent && c.duration > 0) {
                                    // Current playing clip shows actual progress
                                    progress = (Math.min(currentTime, c.duration) / c.duration) * 100;
                                }

                                return (
                                    <div
                                        key={`${c.uuid}-${idx}`}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, idx)}
                                        onDragOver={(e) => handleDragOver(e, idx)}
                                        onDragEnd={handleDragEnd}
                                        className={`relative flex flex-col p-2 rounded border transition-colors ${isCurrent
                                            ? 'bg-blue-900/30 border-blue-500'
                                            : 'bg-gray-800 border-gray-700 hover:bg-gray-700'
                                            } ${draggedItemIndex === idx ? 'opacity-50' : ''}`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-gray-500 font-mono w-4">{idx + 1}.</span>
                                                    <span className={`text-sm font-medium ${isCurrent ? 'text-blue-300' : 'text-gray-300'}`}>
                                                        {c.name}
                                                    </span>
                                                </div>
                                                {/* Display frame range if available */}
                                                {(c as any).startFrame !== undefined && (c as any).endFrame !== undefined && (
                                                    <span className="text-xs text-gray-500 ml-6">
                                                        {(c as any).startFrame}-{(c as any).endFrame}幀
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-500">{c.duration.toFixed(1)}s</span>
                                                {isCurrent && (
                                                    <span className="text-xs text-blue-400 font-mono">{Math.round(progress)}%</span>
                                                )}
                                                <button
                                                    onClick={() => onRemoveFromPlaylist(idx)}
                                                    className="text-gray-500 hover:text-red-400 p-1"
                                                >
                                                    <Plus size={14} className="rotate-45" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="w-full h-1.5 bg-gray-900 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full ${isCompleted ? 'bg-green-500' : (isCurrent ? 'bg-blue-500' : 'bg-gray-600')}`}
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
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
                                onChange={(e) => setStartFrame(Number(e.target.value))}
                                className="w-16 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white text-center"
                            />
                            <span className="text-gray-500">-</span>
                            <input
                                type="number"
                                placeholder="終"
                                value={endFrame}
                                onChange={(e) => setEndFrame(Number(e.target.value))}
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
