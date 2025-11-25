import { useState, useRef } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Play, Settings, Download, Music, X } from 'lucide-react';
import { NumberInput } from '../../../../components/ui/NumberInput';
import type { AudioTrack } from '../../../../domain/value-objects/AudioTrack';
import type { AudioTrigger } from '../../../../domain/value-objects/AudioTrigger';
import type { AudioController } from '../../../../infrastructure/audio/WebAudioAdapter';
import { updateArrayItemById, updateArrayItemProperties } from '../../../../utils/array/arrayUtils';
import { getClipId, getClipDisplayName, type IdentifiableClip } from '../../../../utils/clip/clipIdentifierUtils';
import type { ThemeStyle } from '../../../../presentation/hooks/useTheme';
import AudioSettingsPanel from './AudioSettingsPanel';

interface AudioPanelProps {
    audioTracks: AudioTrack[];
    setAudioTracks: (tracks: AudioTrack[]) => void;
    createdClips: IdentifiableClip[];
    audioController: InstanceType<typeof AudioController>;
    theme: ThemeStyle;
}

export default function AudioPanel({ audioTracks, setAudioTracks, createdClips, audioController, theme }: AudioPanelProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const settingsButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
    const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
    const [expandedSettings, setExpandedSettings] = useState<Record<string, boolean>>({});
    const [editingNameId, setEditingNameId] = useState<string | null>(null);
    const [editingTrackName, setEditingTrackName] = useState('');

    // Temporary state for adding new triggers
    const [newTriggerState, setNewTriggerState] = useState<Record<string, { clipId: string, frame: string }>>({});

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
                    className="flex items-center justify-center gap-2 w-full py-3.5 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-medium rounded-xl transition-all shadow-lg shadow-green-900/20 hover:shadow-green-500/30 hover:scale-[1.01]"
                >
                    <Plus className="w-5 h-5" />
                    <span>添加音效</span>
                </button>
            </div>

            {/* Track List */}
            <div className="flex flex-col gap-3">
                {audioTracks.map(track => (
                    <div key={track.id} className={`glass-panel rounded-xl overflow-visible relative border border-white/5 transition-all duration-300 ${!expandedCards[track.id] ? 'hover:bg-white/5' : ''}`}>
                        {/* Header */}
                        <div className={`flex items-center justify-between p-3 border-b border-white/5 ${!expandedCards[track.id] ? 'border-transparent' : ''}`}>
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
                                        autoFocus
                                        className="bg-black/30 text-white px-2 py-1 rounded text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-500 border border-blue-500/50"
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
                                        ref={(el) => {
                                            if (el) {
                                                settingsButtonRefs.current[track.id] = el;
                                            }
                                        }}
                                        onClick={() => toggleSettings(track.id)}
                                        className={`p-1.5 rounded transition-colors ${expandedSettings[track.id] ? 'text-blue-400 bg-blue-500/10' : 'text-gray-400 hover:text-blue-400 hover:bg-gray-700/50'}`}
                                        title="播放設定"
                                    >
                                        <Settings className="w-4 h-4" />
                                    </button>

                                    {/* Settings Panel (Portal) */}
                                    <AudioSettingsPanel
                                        track={track}
                                        isOpen={!!expandedSettings[track.id]}
                                        onClose={() => closeSettings(track.id)}
                                        onUpdate={(prop, val) => updateTrackProperty(track.id, prop, val)}
                                        onReset={() => resetPlaybackSettings(track.id)}
                                        anchorEl={settingsButtonRefs.current[track.id]}
                                    />
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
                                            className="w-full bg-black/30 border border-white/10 rounded p-2 text-xs text-gray-300 focus:outline-none focus:border-blue-500 min-h-[60px]"
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
                                            <div key={trigger.id} className="flex items-center justify-between bg-black/20 rounded px-2 py-1.5 border border-white/5">
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
                                <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                                    <div className="flex gap-2">
                                        <div className="flex-1 min-w-0">
                                            <label className="text-[10px] text-gray-500 block mb-1">動作</label>
                                            <select
                                                value={newTriggerState[track.id]?.clipId || ''}
                                                onChange={(e) => updateNewTriggerState(track.id, 'clipId', e.target.value)}
                                                className="w-full bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
                                            >
                                                <option value="">選擇動作...</option>
                                                {createdClips.map(animationClip => (
                                                    <option key={getClipId(animationClip)} value={getClipId(animationClip)}>{getClipDisplayName(animationClip)}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="w-20">
                                            <label className="text-[10px] text-gray-500 block mb-1">幀數</label>
                                            <NumberInput
                                                placeholder="Frame"
                                                value={newTriggerState[track.id]?.frame || ''}
                                                onChange={(val) => updateNewTriggerState(track.id, 'frame', val)}
                                                className="w-full bg-black/30 rounded border border-white/10 focus-within:border-blue-500"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => addTrigger(track.id)}
                                        disabled={!newTriggerState[track.id]?.clipId || !newTriggerState[track.id]?.frame}
                                        className="w-full flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white py-1.5 rounded transition-colors shadow-lg shadow-blue-900/20 text-xs font-medium"
                                    >
                                        <Plus className="w-3 h-3" />
                                        添加觸發
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {audioTracks.length === 0 && (
                    <div className="text-center py-10 text-gray-500 text-sm border-2 border-dashed border-white/10 rounded-xl bg-white/5">
                        尚未載入音效
                    </div>
                )}
            </div>
        </div>
    );
}

