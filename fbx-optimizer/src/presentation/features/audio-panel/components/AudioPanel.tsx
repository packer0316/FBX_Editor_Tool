import { useState, useRef } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Play, Settings, Download, Music, X, Package, Upload, Edit2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 類名合併工具
 */
function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

import { NumberInput } from '../../../../components/ui/NumberInput';
import type { AudioTrack } from '../../../../domain/value-objects/AudioTrack';
import type { AudioTrigger } from '../../../../domain/value-objects/AudioTrigger';
import type { AudioController } from '../../../../infrastructure/audio/WebAudioAdapter';
import { updateArrayItemById, updateArrayItemProperties } from '../../../../utils/array/arrayUtils';
import { getClipId, getClipDisplayName, type IdentifiableClip } from '../../../../utils/clip/clipIdentifierUtils';
import type { ThemeStyle } from '../../../../presentation/hooks/useTheme';
import AudioSettingsPanel from './AudioSettingsPanel';
import { ExportAudioConfigUseCase } from '../../../../application/use-cases/ExportAudioConfigUseCase';

interface AudioPanelProps {
    audioTracks: AudioTrack[];
    setAudioTracks: (tracks: AudioTrack[]) => void;
    createdClips: IdentifiableClip[];
    audioController: InstanceType<typeof AudioController>;
    theme: ThemeStyle;
    modelName?: string;
}

export default function AudioPanel({ audioTracks, setAudioTracks, createdClips, audioController, theme, modelName }: AudioPanelProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const settingsButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
    const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
    const [expandedSettings, setExpandedSettings] = useState<Record<string, boolean>>({});
    const [editingNameId, setEditingNameId] = useState<string | null>(null);
    const [editingTrackName, setEditingTrackName] = useState('');
    const [isExporting, setIsExporting] = useState(false);

    // Temporary state for adding new triggers
    const [newTriggerState, setNewTriggerState] = useState<Record<string, { clipId: string, frame: string }>>({});

    const handleExportConfig = async () => {
        if (isExporting) return;
        setIsExporting(true);
        try {
            await ExportAudioConfigUseCase.execute(audioTracks, modelName);
        } finally {
            setIsExporting(false);
        }
    };

    const playAudio = async (track: AudioTrack) => {
        await audioController.play(track);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const newTracks: AudioTrack[] = Array.from(files).map(file => ({
            id: crypto.randomUUID(),
            name: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
            url: URL.createObjectURL(file),
            file: file,
            note: '',
            triggers: [],
            color: '#FACC15', // Default yellow
            playbackRate: 1.0,
            volume: 1.0,
            pitch: 0,
            echo: 0,
            eqLow: 0,
            eqMid: 0,
            eqHigh: 0,
            lowpass: 20000,
            highpass: 0
        }));

        setAudioTracks([...audioTracks, ...newTracks]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDeleteTrack = (id: string) => {
        const trackToDelete = audioTracks.find(track => track.id === id);
        if (trackToDelete) {
            URL.revokeObjectURL(trackToDelete.url); // Cleanup URL
            audioController.cleanup(id);
        }
        setAudioTracks(audioTracks.filter(track => track.id !== id));
    };

    const toggleCard = (id: string) => {
        setExpandedCards(prev => ({ ...prev, [id]: prev[id] === undefined ? false : !prev[id] }));
    };

    const toggleNote = (id: string) => {
        setExpandedNotes(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const toggleSettings = (id: string) => {
        setExpandedSettings(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const startEditingName = (track: AudioTrack) => {
        setEditingNameId(track.id);
        setEditingTrackName(track.name);
    };

    const saveName = () => {
        if (!editingNameId) return;

        setAudioTracks(updateArrayItemProperties(audioTracks, editingNameId, { name: editingTrackName }));
        setEditingNameId(null);
    };

    const updateNote = (id: string, note: string) => {
        setAudioTracks(updateArrayItemProperties(audioTracks, id, { note }));
    };

    const updateColor = (id: string, color: string) => {
        setAudioTracks(updateArrayItemProperties(audioTracks, id, { color }));
    };

    const updateTrackProperty = (id: string, property: keyof AudioTrack, value: number) => {
        setAudioTracks(updateArrayItemProperties(audioTracks, id, { [property]: value } as Partial<AudioTrack>));
    };

    const closeSettings = (id: string) => {
        setExpandedSettings(prev => ({ ...prev, [id]: false }));
    };

    const resetPlaybackSettings = (id: string) => {
        setAudioTracks(updateArrayItemProperties(audioTracks, id, {
            playbackRate: 1.0,
            volume: 1.0,
            pitch: 0,
            echo: 0,
            eqLow: 0,
            eqMid: 0,
            eqHigh: 0,
            lowpass: 20000,
            highpass: 0
        }));
    };

    const addTrigger = (trackId: string) => {
        const state = newTriggerState[trackId];
        if (!state?.clipId || !state.frame) return;

        const frame = parseInt(state.frame);
        if (isNaN(frame)) return;

        // Find the selected clip
        const selectedAnimationClip = createdClips.find(clip => getClipId(clip) === state.clipId);
        if (!selectedAnimationClip) return;

        const newTrigger: AudioTrigger = {
            id: crypto.randomUUID(),
            clipId: state.clipId,  // 使用 customId 進行精確匹配
            clipName: getClipDisplayName(selectedAnimationClip), // 顯示名稱
            frame: frame
        };

        setAudioTracks(updateArrayItemById(audioTracks, trackId, track => ({
            ...track,
            triggers: [...track.triggers, newTrigger]
        })));

        // Reset input
        setNewTriggerState(prev => ({
            ...prev,
            [trackId]: { ...prev[trackId], frame: '' }
        }));
    };

    const removeTrigger = (trackId: string, triggerId: string) => {
        setAudioTracks(updateArrayItemById(audioTracks, trackId, track => ({
            ...track,
            triggers: track.triggers.filter(trigger => trigger.id !== triggerId)
        })));
    };

    const updateNewTriggerState = (trackId: string, field: 'clipId' | 'frame', value: string) => {
        setNewTriggerState(prev => ({
            ...prev,
            [trackId]: {
                ...prev[trackId] || {
                    clipId: createdClips.length > 0 ? getClipId(createdClips[0]) : '',
                    frame: ''
                },
                [field]: value
            }
        }));
    };

    return (
        <div className={cn("h-full flex flex-col gap-0", theme.panelBg)}>
            {/* Header - 專業儀器感設計 (雙行佈局優化) */}
            <div className={cn(
                "pt-5 pb-4 border-b flex flex-col gap-4 relative overflow-hidden",
                theme.panelBorder,
                "bg-gradient-to-b from-white/[0.05] to-transparent"
            )}>
                {/* 頂部極細高光 */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-green-500/30 to-transparent" />
                
                {/* 第一排：圖標與主題字 (再縮小) */}
                <div className="flex items-center gap-2 px-4 relative z-10">
                    <div className="w-7 h-7 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center shadow-[0_0_15px_rgba(34,197,94,0.1)] flex-shrink-0">
                        <Music className="text-green-400" size={14} />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-white text-[10px] font-black tracking-[0.2em] uppercase leading-tight truncate">Audio System</h2>
                        <div className="text-[7px] text-gray-500 font-medium tracking-[0.1em] uppercase truncate">Spatial Orchestration</div>
                    </div>
                </div>

                {/* 第二排：功能區 (Export & Switch) - 與下方字卡切齊 */}
                <div className="px-4 relative z-10">
                    <div className="flex items-center justify-between gap-3 bg-white/[0.03] p-1.5 px-2.5 rounded-2xl border border-white/5 shadow-inner min-h-[44px]">
                        <div className="flex items-center bg-white/5 rounded-full p-0.5 border border-white/10">
                            <button
                                onClick={handleExportConfig}
                                disabled={isExporting || audioTracks.length === 0}
                                className="px-3 py-1.5 hover:bg-white/10 text-gray-300 hover:text-white rounded-full text-[9px] font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed"
                                title="Export Config (ZIP)"
                            >
                                <Package size={11} className="text-blue-400" />
                                <span>{isExporting ? '匯出中...' : '匯出'}</span>
                            </button>
                        </div>

                        {/* 音效數量指示器 */}
                        <div className="flex items-center gap-2 px-3 py-1 bg-green-500/5 rounded-full border border-green-500/10">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                            <span className="text-[9px] font-black text-green-400 uppercase tracking-widest">{audioTracks.length} 個軌道</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                {/* Add Audio Button - 未來主義霓虹設計 */}
                <div>
                    <input
                        type="file"
                        accept=".mp3,.wav,.ogg"
                        multiple
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="group relative w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl cursor-pointer transition-all duration-500 overflow-hidden border border-green-500/30 bg-green-600/10 hover:border-green-400 hover:shadow-[0_0_30px_rgba(34,197,94,0.2)] hover:-translate-y-0.5"
                    >
                        {/* 動態掃光效果 */}
                        <div className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-sweep pointer-events-none" />
                        
                        <div className="flex items-center gap-3 relative z-10">
                            <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center border border-green-500/30 group-hover:border-green-400 group-hover:bg-green-500/30 transition-all duration-500">
                                <Plus size={18} className="text-green-300 group-hover:text-white" />
                            </div>
                            <div className="text-left">
                                <div className="text-xs font-black tracking-[0.4em] uppercase text-green-100 group-hover:text-white transition-colors duration-500">
                                    導入音訊
                                </div>
                                <div className="text-[9px] font-medium tracking-[0.1em] uppercase text-green-400/60 group-hover:text-green-300 transition-colors duration-500">
                                    支援 MP3, WAV, OGG
                                </div>
                            </div>
                        </div>

                        {/* 右側裝飾小點 */}
                        <div className="absolute right-6 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-2 group-hover:translate-x-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                        </div>
                    </button>
                </div>

                {/* Track List */}
                <div className="space-y-4">
                    {audioTracks.map(track => (
                        <div key={track.id} className={cn(
                            "group/card relative rounded-3xl transition-all duration-500 border overflow-hidden",
                            (expandedCards[track.id] ?? true) 
                                ? "pb-4 bg-white/[0.08] border-white/20 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)]" 
                                : "pb-0 bg-white/[0.04] border-white/10 shadow-sm hover:bg-white/[0.06] hover:border-white/20"
                        )}>
                            {/* 左側色彩邊緣裝飾 */}
                            <div className="absolute left-0 top-0 bottom-0 w-1 opacity-60" style={{ backgroundColor: track.color }} />
                            
                            {/* Track Header */}
                            <div className={cn(
                                "p-4 flex flex-col gap-2 transition-all duration-300",
                                (expandedCards[track.id] ?? true) ? "border-b border-white/10 bg-black/20" : "border-transparent"
                            )}>
                                {/* 第一排：圖示與名稱 */}
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => toggleCard(track.id)}
                                        className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 text-gray-500 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
                                    >
                                        {(expandedCards[track.id] ?? true) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </button>
                                    
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-inner border border-white/5" style={{ backgroundColor: `${track.color}15`, color: track.color }}>
                                        <Music size={16} />
                                    </div>
                                    
                                    <div className="min-w-0 flex-1">
                                        {editingNameId === track.id ? (
                                            <input
                                                type="text"
                                                value={editingTrackName}
                                                onChange={(e) => setEditingTrackName(e.target.value)}
                                                onBlur={saveName}
                                                onKeyDown={(e) => e.key === 'Enter' && saveName()}
                                                autoFocus
                                                className="bg-black/30 text-white px-2 py-1 rounded border border-blue-500/50 text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                                            />
                                        ) : (
                                            <div className="flex items-center gap-2 group/name truncate">
                                                <span
                                                    className="text-white text-[11px] font-black tracking-widest uppercase cursor-pointer hover:text-blue-300 transition-colors truncate block"
                                                    onClick={() => startEditingName(track)}
                                                    title="Click to rename"
                                                >
                                                    {track.name}
                                                </span>
                                                <Edit2 size={10} className="text-gray-500 opacity-0 group-hover/name:opacity-100 transition-opacity" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* 第二排：統計與功能按鈕 */}
                                <div className="flex items-center justify-between pl-11">
                                    <div className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">
                                        {track.triggers.length} 個已設置觸發
                                    </div>

                                    {/* Quick Actions Bar - Pill Design */}
                                    <div className="flex items-center bg-white/[0.05] hover:bg-white/[0.08] rounded-full p-0.5 border border-white/5 shadow-inner transition-colors">
                                        <div className="flex items-center px-2 mr-1 border-r border-white/10 h-3.5">
                                            <input
                                                type="color"
                                                value={track.color}
                                                onChange={(e) => updateColor(track.id, e.target.value)}
                                                className="w-3.5 h-3.5 rounded-full cursor-pointer bg-transparent border-none p-0 overflow-hidden"
                                                title="Set Color"
                                            />
                                        </div>
                                        
                                        <button
                                            ref={(el) => { if (el) settingsButtonRefs.current[track.id] = el; }}
                                            onClick={() => toggleSettings(track.id)}
                                            className={cn(
                                                "p-1.5 rounded-full transition-all",
                                                expandedSettings[track.id] ? 'text-blue-400 bg-blue-500/10' : 'text-gray-500 hover:text-blue-400 hover:bg-white/5'
                                            )}
                                            title="Playback Settings"
                                        >
                                            <Settings size={12} />
                                        </button>
                                        
                                        <AudioSettingsPanel
                                            track={track}
                                            isOpen={!!expandedSettings[track.id]}
                                            onClose={() => closeSettings(track.id)}
                                            onUpdate={(prop, val) => updateTrackProperty(track.id, prop, val)}
                                            onReset={() => resetPlaybackSettings(track.id)}
                                            anchorEl={settingsButtonRefs.current[track.id]}
                                        />

                                        <button
                                            onClick={() => playAudio(track)}
                                            className="p-1.5 text-gray-500 hover:text-green-400 hover:bg-white/5 rounded-full transition-all"
                                            title="Preview Sound"
                                        >
                                            <Play size={12} fill="currentColor" className="opacity-40" />
                                        </button>

                                        <button
                                            onClick={() => audioController.exportAudio(track)}
                                            className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-white/5 rounded-full transition-all"
                                            title="Download Processed (MP3)"
                                        >
                                            <Download size={12} />
                                        </button>

                                        <div className="w-px h-3 bg-white/10 mx-1" />

                                        <button
                                            onClick={() => handleDeleteTrack(track.id)}
                                            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-white/5 rounded-full transition-all"
                                            title="Remove Track"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Track Content */}
                            {(expandedCards[track.id] ?? true) && (
                                <div className="p-4 space-y-5">
                                    {/* Note Section - 升級設計 */}
                                    <div className="rounded-2xl border border-white/10 overflow-hidden bg-black/60 shadow-inner">
                                        <button
                                            onClick={() => toggleNote(track.id)}
                                            className="w-full px-4 py-2.5 bg-white/[0.05] hover:bg-white/[0.08] flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 transition-all"
                                        >
                                            <span className="flex items-center gap-2.5">
                                                <Edit2 size={12} className="text-blue-400 opacity-70" />
                                                <span>備註</span>
                                            </span>
                                            <div className="w-5 h-5 rounded-full flex items-center justify-center bg-white/5">
                                                {expandedNotes[track.id] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                            </div>
                                        </button>
                                        {expandedNotes[track.id] && (
                                            <div className="p-3 animate-fade-in">
                                                <textarea
                                                    value={track.note}
                                                    onChange={(e) => updateNote(track.id, e.target.value)}
                                                    placeholder="輸入備註或標籤..."
                                                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-[11px] text-gray-300 focus:outline-none focus:border-blue-500/50 min-h-[80px] font-medium custom-scrollbar"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Triggers Section - 儀器面板感 */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between px-1">
                                            <div className="text-[10px] text-gray-400 font-black uppercase tracking-[0.3em]">同步觸發</div>
                                            <div className="h-px bg-white/10 flex-1 mx-4" />
                                            <div className="text-[9px] text-gray-500 font-bold uppercase">{track.triggers.length} 組</div>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 gap-2">
                                            {track.triggers.map(trigger => {
                                                const matchedClip = createdClips.find(clip => getClipId(clip) === trigger.clipId);
                                                const displayName = matchedClip ? getClipDisplayName(matchedClip) : trigger.clipName || 'Unknown Clip';
                                                return (
                                                    <div key={trigger.id} className="group/trigger flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.05] rounded-xl px-3 py-2 border border-white/5 transition-all">
                                                        <div className="flex items-center gap-3 text-[10px] font-bold">
                                                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: track.color, boxShadow: `0 0 8px ${track.color}80` }} />
                                                            <span className="text-gray-300 tracking-wider uppercase">{displayName}</span>
                                                            <div className="w-px h-3 bg-white/10" />
                                                            <span className="text-gray-500">幀</span>
                                                            <span className="text-white bg-white/5 px-2 py-0.5 rounded-full" style={{ color: track.color }}>{trigger.frame}</span>
                                                        </div>
                                                        <button
                                                            onClick={() => removeTrigger(track.id, trigger.id)}
                                                            className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover/trigger:opacity-100"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                );
                                            })}

                                            {track.triggers.length === 0 && (
                                                <div className="text-center py-6 bg-black/20 rounded-2xl border border-dashed border-white/5 text-[10px] text-gray-600 font-medium italic tracking-wide">
                                                    尚未分配同步觸發
                                                </div>
                                            )}
                                        </div>

                                        {/* Add Trigger Sub-panel */}
                                        <div className="bg-black/60 rounded-2xl p-4 border border-white/10 shadow-inner mt-4 space-y-4">
                                            <div className="flex gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <label className="text-[9px] text-gray-400 font-black uppercase tracking-[0.2em] mb-1.5 block">目標動畫</label>
                                                    <select
                                                        value={newTriggerState[track.id]?.clipId || ''}
                                                        onChange={(e) => updateNewTriggerState(track.id, 'clipId', e.target.value)}
                                                        className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-[11px] text-gray-200 focus:outline-none focus:border-blue-500/50 appearance-none font-bold tracking-wide"
                                                    >
                                                        <option value="" className="bg-[#1a1a1e]">選擇片段...</option>
                                                        {createdClips.map(animationClip => (
                                                            <option key={getClipId(animationClip)} value={getClipId(animationClip)} className="bg-[#1a1a1e]">{getClipDisplayName(animationClip)}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="w-24">
                                                    <label className="text-[9px] text-gray-400 font-black uppercase tracking-[0.2em] mb-1.5 block">觸發幀數</label>
                                                    <NumberInput
                                                        placeholder="0"
                                                        value={newTriggerState[track.id]?.frame || ''}
                                                        onChange={(val) => updateNewTriggerState(track.id, 'frame', val)}
                                                        className="w-full bg-white/[0.05] rounded-xl border border-white/10 focus-within:border-blue-500/50 h-[34px]"
                                                    />
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => addTrigger(track.id)}
                                                disabled={!newTriggerState[track.id]?.clipId || !newTriggerState[track.id]?.frame}
                                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/50 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed text-[10px] font-black uppercase tracking-[0.3em] transition-all"
                                            >
                                                <Plus size={12} />
                                                <span>註冊觸發器</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {audioTracks.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 bg-white/[0.01] border-2 border-dashed border-white/5 rounded-[32px] gap-4">
                            <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center text-gray-700">
                                <Music size={32} />
                            </div>
                            <div className="text-center">
                                <div className="text-gray-500 text-[11px] font-black uppercase tracking-[0.3em]">未載入音訊</div>
                                <div className="text-gray-700 text-[9px] font-medium tracking-wider mt-1">導入軌道開始編排</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

