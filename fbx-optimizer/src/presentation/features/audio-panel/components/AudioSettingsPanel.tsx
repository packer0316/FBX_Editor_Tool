import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Settings, X } from 'lucide-react';
import type { AudioTrack } from '../../../../domain/value-objects/AudioTrack';

interface AudioSettingsPanelProps {
    track: AudioTrack;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: (property: keyof AudioTrack, value: number) => void;
    onReset: () => void;
    anchorEl: HTMLElement | null;
}

export default function AudioSettingsPanel({
    track,
    isOpen,
    onClose,
    onUpdate,
    onReset,
    anchorEl
}: AudioSettingsPanelProps) {
    const [activeTab, setActiveTab] = useState<'basic' | 'eq' | 'effects'>('basic');
    const panelRef = useRef<HTMLDivElement>(null);

    // Calculate position
    const [position, setPosition] = useState<{ top: number; right: number } | null>(null);

    useEffect(() => {
        if (isOpen && anchorEl) {
            const rect = anchorEl.getBoundingClientRect();
            setPosition({
                top: rect.bottom + 8,
                right: window.innerWidth - rect.right
            });
        }
    }, [isOpen, anchorEl]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(event.target as Node) && anchorEl && !anchorEl.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose, anchorEl]);

    if (!isOpen || !position) return null;

    return createPortal(
        <div
            ref={panelRef}
            style={{
                position: 'fixed',
                top: `${position.top}px`,
                right: `${position.right}px`,
                zIndex: 9999
            }}
            className="w-80 max-w-[calc(100vw-2rem)] glass-panel border border-white/10 rounded-xl shadow-2xl p-5 animate-slide-up bg-gray-900/95 backdrop-blur-xl"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-medium text-white">播放設定</span>
                </div>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-5 bg-black/40 p-1 rounded-lg border border-white/5">
                {(['basic', 'eq', 'effects'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-1.5 text-xs rounded-md transition-all font-medium ${activeTab === tab
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        {tab === 'basic' && '基本'}
                        {tab === 'eq' && 'EQ/濾波'}
                        {tab === 'effects' && '效果'}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
                {/* Basic Tab */}
                {activeTab === 'basic' && (
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
                                onChange={(e) => onUpdate('playbackRate', parseFloat(e.target.value))}
                                className="w-full h-2 premium-slider"
                                style={{ '--slider-color': '#3b82f6' } as React.CSSProperties}
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
                                onChange={(e) => onUpdate('pitch', parseFloat(e.target.value))}
                                className="w-full h-2 premium-slider"
                                style={{ '--slider-color': '#4ade80' } as React.CSSProperties}
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
                                onChange={(e) => onUpdate('volume', parseFloat(e.target.value))}
                                className="w-full h-2 premium-slider"
                                style={{ '--slider-color': '#c084fc' } as React.CSSProperties}
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
                {activeTab === 'eq' && (
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
                                            onChange={(e) => onUpdate(eqBand.prop, parseFloat(e.target.value))}
                                            className={`h-24 w-2 bg-black/30 rounded-lg appearance-none cursor-pointer premium-slider writing-mode-vertical`}
                                            style={{ writingMode: 'vertical-lr', direction: 'rtl', '--slider-color': eqBand.label === 'Low' ? '#f87171' : eqBand.label === 'Mid' ? '#facc15' : '#22d3ee' } as React.CSSProperties}
                                        />
                                        <span className={`text-[10px] ${eqBand.color}`}>{eqBand.label}</span>
                                        <span className="text-[10px] text-gray-500">{track[eqBand.prop]}dB</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="h-px bg-white/10 my-3" />

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
                                    onChange={(e) => onUpdate('lowpass', parseFloat(e.target.value))}
                                    className="w-full h-2 premium-slider"
                                    style={{ '--slider-color': '#fb923c' } as React.CSSProperties}
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
                                    onChange={(e) => onUpdate('highpass', parseFloat(e.target.value))}
                                    className="w-full h-2 premium-slider"
                                    style={{ '--slider-color': '#2dd4bf' } as React.CSSProperties}
                                />
                            </div>
                        </div>
                    </>
                )}

                {/* Effects Tab */}
                {activeTab === 'effects' && (
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
                                    onChange={(e) => onUpdate('echo', parseFloat(e.target.value))}
                                    className="w-full h-2 premium-slider"
                                    style={{ '--slider-color': '#f472b6' } as React.CSSProperties}
                                />
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Reset Button */}
            <button
                onClick={onReset}
                className="w-full mt-4 py-2 px-3 bg-white/5 hover:bg-white/10 text-gray-300 text-xs rounded-lg transition-colors flex items-center justify-center gap-2 border border-white/5"
            >
                <span>重置為預設值</span>
            </button>
        </div>,
        document.body
    );
}
