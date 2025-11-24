import { useState, useRef } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Play, Settings, X, Download, Music } from 'lucide-react';
import type { AudioTrack } from '../../../../domain/value-objects/AudioTrack';
import type { AudioTrigger } from '../../../../domain/value-objects/AudioTrigger';
import type { AudioController } from '../../../../infrastructure/audio/WebAudioAdapter';
import { updateArrayItemById, updateArrayItemProperties } from '../../../../utils/array/arrayUtils';
import { getClipId, getClipDisplayName, type IdentifiableClip } from '../../../../utils/clip/clipIdentifierUtils';

interface AudioPanelProps {
    audioTracks: AudioTrack[];
    setAudioTracks: (tracks: AudioTrack[]) => void;
    createdClips: IdentifiableClip[];
    audioController: InstanceType<typeof AudioController>;
}

export default function AudioPanel({ audioTracks, setAudioTracks, createdClips, audioController }: AudioPanelProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
    const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
    const [expandedSettings, setExpandedSettings] = useState<Record<string, boolean>>({});
    const [editingNameId, setEditingNameId] = useState<string | null>(null);
    const [editingTrackName, setEditingTrackName] = useState('');

    // Temporary state for adding new triggers
    const [newTriggerState, setNewTriggerState] = useState<Record<string, { clipId: string, frame: string }>>({});

    const [activeTab, setActiveTab] = useState<Record<string, 'basic' | 'eq' | 'effects'>>({});

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

    const switchTab = (id: string, tab: 'basic' | 'eq' | 'effects') => {
        setActiveTab(prev => ({ ...prev, [id]: tab }));
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
            [trackId]: { ...prev[trackId] || { clipId: getClipId(createdClips[0]) || '', frame: '' }, [field]: value }
        }));
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Upload Button */}
            <div className="flex flex-col gap-2">
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
                    className="flex items-center justify-center gap-2 w-full py-3 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg transition-colors text-gray-300 hover:text-white"
                >
                    <Plus className="w-5 h-5" />
                    <span>添加音效</span>
                </button>
            </div>

            {/* Track List */}
            <div className="flex flex-col gap-3">
                {audioTracks.map(track => (
                    <div key={track.id} className="bg-gray-900 border border-gray-700 rounded-lg overflow-visible relative">
                        {/* Header */}
                        <div className="flex items-center justify-between p-3 bg-gray-800/50 border-b border-gray-700">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <button
                                    onClick={() => toggleCard(track.id)}
                                    className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
                                >
                                    {(expandedCards[track.id] ?? true) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                                <Music className="w-4 h-4 text-purple-400 flex-shrink-0" />
                                {editingNameId === track.id ? (
                                    <input
                                        type="text"
                                        value={editingTrackName}
                                        onChange={(e) => setEditingTrackName(e.target.value)}
                                        onBlur={saveName}
                                        onKeyDown={(e) => e.key === 'Enter' && saveName()}
                                        className="bg-gray-700 text-white px-2 py-1 rounded text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        autoFocus
                                    />
                                ) : (
                                    <span
                                        className="text-sm font-medium text-gray-200 truncate cursor-pointer hover:text-blue-400"
                                        onClick={() => startEditingName(track)}
                                        title="點擊編輯名稱"
                                    >
                                        {track.name}
                                    </span>
                                )}
                            </div>


                            <div className="flex items-center gap-1">
                                <input
                                    type="color"
                                    value={track.color}
                                    onChange={(e) => updateColor(track.id, e.target.value)}
                                    className="w-6 h-6 rounded cursor-pointer bg-transparent border-none p-0"
                                    title="設定顏色"
                                />
                                <div className="relative">
                                    <button
                                        onClick={() => toggleSettings(track.id)}
                                        className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-700/50 rounded transition-colors"
                                        title="播放設定"
                                    >
                                        <Settings className="w-4 h-4" />
                                    </button>

                                    {/* Floating Settings Panel */}
                                    {expandedSettings[track.id] && (
                                        <>
                                            {/* Backdrop */}
                                            <div
                                                className="fixed inset-0 z-40"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    closeSettings(track.id);
                                                }}
                                            />

                                            {/* Panel */}
                                            <div
                                                className="absolute right-0 top-full mt-2 w-80 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl z-50 p-4 cursor-default"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {/* Header */}
                                                <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-700">
                                                    <div className="flex items-center gap-2">
                                                        <Settings className="w-4 h-4 text-blue-400" />
                                                        <span className="text-sm font-medium text-white">播放設定</span>
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            closeSettings(track.id);
                                                        }}
                                                        className="text-gray-400 hover:text-white transition-colors"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                {/* Tabs */}
                                                <div className="flex gap-1 mb-4 bg-gray-900/50 p-1 rounded-lg">
                                                    {(['basic', 'eq', 'effects'] as const).map(tab => (
                                                        <button
                                                            key={tab}
                                                            onClick={() => switchTab(track.id, tab)}
                                                            className={`flex-1 py-1 text-xs rounded-md transition-colors ${(activeTab[track.id] || 'basic') === tab
                                                                ? 'bg-gray-700 text-white shadow-sm'
                                                                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
                                                                }`}
                                                        >
                                                            {tab === 'basic' && '基本'}
                                                            {tab === 'eq' && 'EQ/濾波'}
                                                            {tab === 'effects' && '效果'}
                                                        </button>
                                                    ))}
                                                </div>

                                                {/* Tab Content */}
                                                <div className="space-y-4">
                                                    {/* Basic Tab */}
                                                    {(!activeTab[track.id] || activeTab[track.id] === 'basic') && (
                                                        <>
                                                            {/* Playback Rate */}
                                                            <div className="space-y-2">
                                                                <label className="text-xs text-gray-300 flex items-center justify-between">
                                                                    <span className="font-medium">播放速度</span>
                                                                    <span className="text-blue-400 font-mono text-sm">{track.playbackRate.toFixed(2)}x</span>
                                                                </label>
                                                                <input
                                                                    type="range"
                                                                    min="0.25"
                                                                    max="2.0"
                                                                    step="0.05"
                                                                    value={track.playbackRate}
                                                                    onChange={(e) => updateTrackProperty(track.id, 'playbackRate', parseFloat(e.target.value))}
                                                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                                />
                                                                <div className="relative w-full text-[10px] text-gray-500 mt-1 h-4">
                                                                    <span className="absolute left-0">0.25x</span>
                                                                    <span className="absolute -translate-x-1/2" style={{ left: '42.86%' }}>1.0x</span>
                                                                    <span className="absolute right-0">2.0x</span>
                                                                </div>
                                                            </div>

                                                            {/* Pitch */}
                                                            <div className="space-y-2">
                                                                <label className="text-xs text-gray-300 flex items-center justify-between">
                                                                    <span className="font-medium">音高 (Pitch)</span>
                                                                    <span className="text-green-400 font-mono text-sm">{track.pitch > 0 ? '+' : ''}{track.pitch}</span>
                                                                </label>
                                                                <input
                                                                    type="range"
                                                                    min="-1200"
                                                                    max="1200"
                                                                    step="100"
                                                                    value={track.pitch}
                                                                    onChange={(e) => updateTrackProperty(track.id, 'pitch', parseFloat(e.target.value))}
                                                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                                                                />
                                                                <div className="relative w-full text-[10px] text-gray-500 mt-1 h-4">
                                                                    <span className="absolute left-0">-12</span>
                                                                    <span className="absolute left-1/2 -translate-x-1/2">0</span>
                                                                    <span className="absolute right-0">+12</span>
                                                                </div>
                                                            </div>

                                                            {/* Volume */}
                                                            <div className="space-y-2">
                                                                <label className="text-xs text-gray-300 flex items-center justify-between">
                                                                    <span className="font-medium">音量</span>
                                                                    <span className="text-purple-400 font-mono text-sm">{Math.round(track.volume * 100)}%</span>
                                                                </label>
                                                                <input
                                                                    type="range"
                                                                    min="0"
                                                                    max="3.0"
                                                                    step="0.01"
                                                                    value={track.volume}
                                                                    onChange={(e) => updateTrackProperty(track.id, 'volume', parseFloat(e.target.value))}
                                                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                                                />
                                                                <div className="relative w-full text-[10px] text-gray-500 mt-1 h-4">
                                                                    <span className="absolute left-0">0%</span>
                                                                    <span className="absolute left-1/3 -translate-x-1/2">100%</span>
                                                                    <span className="absolute right-0">300%</span>
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}

                                                    {/* EQ/Filter Tab */}
                                                    {activeTab[track.id] === 'eq' && (
                                                        <>
                                                            {/* 3-Band EQ */}
                                                            <div className="space-y-3">
                                                                <div className="text-xs font-medium text-gray-400">3段均衡器 (EQ)</div>
                                                                <div className="grid grid-cols-3 gap-2">
                                                                    {[
                                                                        { label: 'Low', prop: 'eqLow' as const, color: 'text-red-400', accent: 'accent-red-500' },
                                                                        { label: 'Mid', prop: 'eqMid' as const, color: 'text-yellow-400', accent: 'accent-yellow-500' },
                                                                        { label: 'High', prop: 'eqHigh' as const, color: 'text-cyan-400', accent: 'accent-cyan-500' }
                                                                    ].map(eqBand => (
                                                                        <div key={eqBand.label} className="flex flex-col items-center gap-1">
                                                                            <input
                                                                                type="range"
                                                                                min="-20"
                                                                                max="20"
                                                                                step="1"
                                                                                value={track[eqBand.prop]}
                                                                                onChange={(e) => updateTrackProperty(track.id, eqBand.prop, parseFloat(e.target.value))}
                                                                                className={`h-24 w-2 bg-gray-700 rounded-lg appearance-none cursor-pointer ${eqBand.accent} writing-mode-vertical`}
                                                                                style={{ writingMode: 'vertical-lr', WebkitAppearance: 'slider-vertical' }}
                                                                            />
                                                                            <span className={`text-[10px] ${eqBand.color}`}>{eqBand.label}</span>
                                                                            <span className="text-[10px] text-gray-500">{track[eqBand.prop]}dB</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            <div className="h-px bg-gray-700 my-2" />

                                                            {/* Filters */}
                                                            <div className="space-y-3">
                                                                <div className="text-xs font-medium text-gray-400">濾波器 (Filters)</div>

                                                                <div className="space-y-1">
                                                                    <label className="text-xs text-gray-300 flex items-center justify-between">
                                                                        <span className="font-medium">Lowpass (高頻截止)</span>
                                                                        <span className="text-orange-400 font-mono text-sm">{track.lowpass < 20000 ? track.lowpass + 'Hz' : 'Off'}</span>
                                                                    </label>
                                                                    <input
                                                                        type="range"
                                                                        min="20"
                                                                        max="20000"
                                                                        step="100"
                                                                        value={track.lowpass}
                                                                        onChange={(e) => updateTrackProperty(track.id, 'lowpass', parseFloat(e.target.value))}
                                                                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                                                                    />
                                                                </div>

                                                                <div className="space-y-1">
                                                                    <label className="text-xs text-gray-300 flex items-center justify-between">
                                                                        <span className="font-medium">Highpass (低頻截止)</span>
                                                                        <span className="text-teal-400 font-mono text-sm">{track.highpass > 0 ? track.highpass + 'Hz' : 'Off'}</span>
                                                                    </label>
                                                                    <input
                                                                        type="range"
                                                                        min="0"
                                                                        max="20000"
                                                                        step="100"
                                                                        value={track.highpass}
                                                                        onChange={(e) => updateTrackProperty(track.id, 'highpass', parseFloat(e.target.value))}
                                                                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}

                                                    {/* Effects Tab */}
                                                    {activeTab[track.id] === 'effects' && (
                                                        <>
                                                            <div className="space-y-3">
                                                                <div className="text-xs font-medium text-gray-400">回音效果 (Echo)</div>

                                                                <div className="space-y-1">
                                                                    <label className="text-xs text-gray-300 flex items-center justify-between">
                                                                        <span className="font-medium">強度 (Mix)</span>
                                                                        <span className="text-pink-400 font-mono text-sm">{Math.round(track.echo * 100)}%</span>
                                                                    </label>
                                                                    <input
                                                                        type="range"
                                                                        min="0"
                                                                        max="1"
                                                                        step="0.05"
                                                                        value={track.echo}
                                                                        onChange={(e) => updateTrackProperty(track.id, 'echo', parseFloat(e.target.value))}
                                                                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>

                                                {/* Reset Button */}
                                                <button
                                                    onClick={() => resetPlaybackSettings(track.id)}
                                                    className="w-full mt-4 py-2 px-3 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs rounded transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <span>重置為預設值</span>
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <button
                                    onClick={() => playAudio(track)}
                                    className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-gray-700/50 rounded transition-colors"
                                    title="播放音效"
                                >
                                    <Play className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => audioController.exportAudio(track)}
                                    className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-700/50 rounded transition-colors"
                                    title="下載處理後的音效 (MP3)"
                                >
                                    <Download className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDeleteTrack(track.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700/50 rounded transition-colors"
                                    title="刪除音效"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        {(expandedCards[track.id] ?? true) && (
                            <div className="p-3 space-y-3">
                                {/* Note Section */}
                                <div>
                                    <button
                                        onClick={() => toggleNote(track.id)}
                                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300 mb-1"
                                    >
                                        {expandedNotes[track.id] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                        備註
                                    </button>
                                    {expandedNotes[track.id] && (
                                        <textarea
                                            value={track.note}
                                            onChange={(e) => updateNote(track.id, e.target.value)}
                                            placeholder="輸入備註..."
                                            className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-xs text-gray-300 focus:outline-none focus:border-blue-500 min-h-[60px]"
                                        />
                                    )}
                                </div>

                                {/* Triggers List */}
                                <div className="space-y-2">
                                    <div className="text-xs text-gray-400 font-medium">觸發設定</div>
                                    {track.triggers.map(trigger => {
                                        const matchedClip = createdClips.find(clip => getClipId(clip) === trigger.clipId);
                                        const displayName = matchedClip ? getClipDisplayName(matchedClip) : trigger.clipName || 'Unknown Clip';
                                        return (
                                            <div key={trigger.id} className="flex items-center justify-between bg-gray-800 rounded px-2 py-1.5 border border-gray-700">
                                                <div className="flex items-center gap-2 text-xs">
                                                    <span className="text-blue-400">{displayName}</span>
                                                    <span className="text-gray-500">@</span>
                                                    <span style={{ color: track.color }}>{trigger.frame} Frame</span>
                                                </div>
                                                <button
                                                    onClick={() => removeTrigger(track.id, trigger.id)}
                                                    className="text-gray-500 hover:text-red-400"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Add Trigger */}
                                <div className="flex gap-2 items-end pt-2 border-t border-gray-800">
                                    <div className="flex-1 min-w-0">
                                        <label className="text-[10px] text-gray-500 block mb-1">動作</label>
                                        <select
                                            value={newTriggerState[track.id]?.clipId || ''}
                                            onChange={(e) => updateNewTriggerState(track.id, 'clipId', e.target.value)}
                                            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
                                        >
                                            <option value="">選擇動作...</option>
                                            {createdClips.map(animationClip => (
                                                <option key={getClipId(animationClip)} value={getClipId(animationClip)}>{getClipDisplayName(animationClip)}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="w-20">
                                        <label className="text-[10px] text-gray-500 block mb-1">幀數</label>
                                        <input
                                            type="number"
                                            placeholder="Frame"
                                            value={newTriggerState[track.id]?.frame || ''}
                                            onChange={(e) => updateNewTriggerState(track.id, 'frame', e.target.value)}
                                            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    <button
                                        onClick={() => addTrigger(track.id)}
                                        disabled={!newTriggerState[track.id]?.clipId || !newTriggerState[track.id]?.frame}
                                        className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white p-1.5 rounded transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {audioTracks.length === 0 && (
                    <div className="text-center py-8 text-gray-500 text-sm border-2 border-dashed border-gray-700 rounded-lg">
                        尚未載入音效
                    </div>
                )}
            </div>
        </div>
    );
}

