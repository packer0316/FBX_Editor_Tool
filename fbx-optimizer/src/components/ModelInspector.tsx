import React, { useState, useEffect } from 'react';
import * as THREE from 'three';
import { Eye, EyeOff, Play, Pause, Plus, ChevronRight, ChevronDown, Film, CheckSquare, Square } from 'lucide-react';

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
}

// 遞迴渲染骨架樹狀圖
const BoneTree = ({ bone, depth = 0, expandAll }: { bone: THREE.Object3D; depth?: number; expandAll?: boolean }) => {
    const [expanded, setExpanded] = useState(expandAll ?? true);
    const [visible, setVisible] = useState(bone.visible);
    const hasChildren = bone.children.some(c => c.type === 'Bone');

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
                        child.type === 'Bone' && <BoneTree key={child.uuid} bone={child} depth={depth + 1} expandAll={expandAll} />
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
    onSelectClip
}: ModelInspectorProps) {
    const [activeTab, setActiveTab] = useState<'mesh' | 'bone' | 'clip'>('mesh');
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

    // 初始化 Mesh 和 Bone 列表
    useEffect(() => {
        if (!model) {
            setMeshes([]);
            setRootBone(null);
            return;
        }

        const meshList: THREE.Mesh[] = [];
        const allBones: THREE.Object3D[] = [];

        model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;

                // 重要：克隆 material 以避免多個 mesh 共享同一個 material 實例
                if (Array.isArray(mesh.material)) {
                    mesh.material = mesh.material.map(m => m.clone());
                } else if (mesh.material) {
                    mesh.material = mesh.material.clone();
                }

                meshList.push(mesh);

                // 預設開啟顯示，並重置透明度
                child.visible = true;
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach(m => {
                        m.transparent = false;
                        m.opacity = 1.0;
                        m.needsUpdate = true;
                    });
                } else if (mesh.material) {
                    (mesh.material as THREE.Material).transparent = false;
                    (mesh.material as THREE.Material).opacity = 1.0;
                    (mesh.material as THREE.Material).needsUpdate = true;
                }
                mesh.userData.isDimmed = false; // Initialize dimmed state
            }

            // 收集所有骨骼
            if (child.type === 'Bone') {
                allBones.push(child);
            }
        });

        console.log('[ModelInspector] Found meshes:', meshList.length);
        console.log('[ModelInspector] Found bones:', allBones.length);

        // 找到根骨骼（parent 不是 Bone 的骨骼）
        let foundRootBone: THREE.Object3D | null = null;
        for (const bone of allBones) {
            if (bone.parent && bone.parent.type !== 'Bone') {
                foundRootBone = bone;
                console.log('[ModelInspector] Root bone found:', bone.name);
                break;
            }
        }

        setMeshes(meshList);
        setRootBone(foundRootBone);
    }, [model]);

    const toggleMeshVisibility = (mesh: THREE.Mesh) => {
        // 實現 "變暗" 效果：切換透明度而不是 visible
        const isDimmed = mesh.userData.isDimmed || false;
        const newDimmed = !isDimmed;

        mesh.userData.isDimmed = newDimmed;

        const applyOpacity = (material: THREE.Material) => {
            material.transparent = newDimmed;
            material.opacity = newDimmed ? 0.1 : 1.0;
            material.needsUpdate = true;
        };

        if (Array.isArray(mesh.material)) {
            mesh.material.forEach(applyOpacity);
        } else if (mesh.material) {
            applyOpacity(mesh.material as THREE.Material);
        }

        // 使用 counter 強制重繪，而不是修改 meshes 陣列
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

    // 處理播放條拖動開始
    const handleSliderMouseDown = () => {
        setIsDraggingSlider(true);
        setWasPlayingBeforeDrag(isPlaying);
        if (isPlaying) {
            onPlayPause(); // 暫停播放
        }
    };

    // 處理播放條拖動結束
    const handleSliderMouseUp = () => {
        setIsDraggingSlider(false);
        if (wasPlayingBeforeDrag) {
            onPlayPause(); // 恢復播放
        }
    };

    // 將時間轉換為幀數 (假設 30fps)
    // 使用 modulo 確保幀數不會超過總幀數
    const currentFrame = duration > 0 ? Math.floor((currentTime % duration) * 30) : 0;
    const totalFrames = Math.floor(duration * 30);

    return (
        <div className="bg-gray-800 rounded-lg p-4 pt-6 flex flex-col h-full border border-gray-700">
            {/* 上半部：列表切換 */}
            <div className="flex space-x-2 mb-3 border-b border-gray-700 pb-2">
                <button
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${activeTab === 'mesh' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
                    onClick={() => setActiveTab('mesh')}
                >
                    Mesh 列表 ({meshes.length})
                </button>
                <button
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${activeTab === 'bone' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
                    onClick={() => setActiveTab('bone')}
                >
                    骨架列表
                </button>
                <button
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${activeTab === 'clip' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
                    onClick={() => setActiveTab('clip')}
                >
                    動作清單 ({createdClips.length})
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
                                const isDimmed = mesh.userData.isDimmed || false;
                                return (
                                    <div key={mesh.uuid}
                                        className="flex items-center justify-between hover:bg-gray-700 p-2 rounded cursor-pointer"
                                        onClick={() => toggleMeshVisibility(mesh)}
                                    >
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <button className={`text-gray-400 hover:text-white ${!isDimmed ? 'text-blue-400' : ''}`}>
                                                {!isDimmed ? <CheckSquare size={16} /> : <Square size={16} />}
                                            </button>
                                            <span className={`text-sm truncate ${isDimmed ? 'text-gray-500' : 'text-gray-300'}`} title={mesh.name}>
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
                            createdClips.map((c, idx) => (
                                <div
                                    key={idx}
                                    className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${clip === c ? 'bg-blue-900/50 border border-blue-500/30' : 'hover:bg-gray-700'}`}
                                    onClick={() => onSelectClip(c)}
                                >
                                    <div className="flex items-center gap-2">
                                        <Film size={14} className={clip === c ? 'text-blue-400' : 'text-gray-500'} />
                                        <span className={`text-sm ${clip === c ? 'text-blue-200 font-medium' : 'text-gray-300'}`}>{c.name}</span>
                                    </div>
                                    <span className="text-xs text-gray-500 font-mono">{c.duration.toFixed(2)}s</span>
                                </div>
                            ))
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
