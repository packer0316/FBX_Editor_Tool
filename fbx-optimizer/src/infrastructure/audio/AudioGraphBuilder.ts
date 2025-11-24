import type { AudioTrack } from '../../domain/value-objects/AudioTrack';

/**
 * 音訊圖形建立器
 * 
 * 負責建立和連接音訊處理節點，封裝複雜的音訊效果處理圖形建立邏輯。
 * 此類別提供兩種圖形建立方法：即時播放和離線渲染。
 * 
 * 音訊處理流程：
 * Source -> EQ (Low/Mid/High) -> Filters (Lowpass/Highpass) -> Main Gain -> Volume -> Destination
 *                                                              |-> Echo (Delay + Gain) -> Volume
 * 
 * @example
 * ```typescript
 * const { volumeGain } = AudioGraphBuilder.createPlaybackGraph(
 *   audioContext,
 *   sourceNode,
 *   track
 * );
 * volumeGain.connect(audioContext.destination);
 * ```
 */
export class AudioGraphBuilder {
    /**
     * 建立音訊處理圖形（用於即時播放）
     * 
     * 建立用於即時播放的音訊處理圖形，包含所有效果節點（EQ、濾波器、回音等）。
     * 此方法會設定所有節點的參數並連接它們，返回音量控制節點以便連接到輸出。
     * 
     * @param audioContext - Web Audio API 音訊上下文
     * @param audioSourceNode - 音訊來源節點，將被設定播放速率和音高
     * @param track - 音訊軌道設定，包含所有效果參數（volume、pitch、echo、EQ 等）
     * @returns 包含音訊來源節點和音量控制節點的物件
     * 
     * @example
     * ```typescript
     * const sourceNode = audioContext.createBufferSource();
     * sourceNode.buffer = audioBuffer;
     * 
     * const { volumeGain } = AudioGraphBuilder.createPlaybackGraph(
     *   audioContext,
     *   sourceNode,
     *   track
     * );
     * 
     * volumeGain.connect(audioContext.destination);
     * sourceNode.start(0);
     * ```
     */
    static createPlaybackGraph(
        audioContext: AudioContext,
        audioSourceNode: AudioBufferSourceNode,
        track: AudioTrack
    ): {
        audioSourceNode: AudioBufferSourceNode;
        volumeGain: GainNode;
    } {
        // Pitch/Speed
        audioSourceNode.playbackRate.value = track.playbackRate;
        audioSourceNode.detune.value = track.pitch;

        // Filters & EQ
        const lowpassFilter = audioContext.createBiquadFilter();
        lowpassFilter.type = 'lowpass';
        lowpassFilter.frequency.value = track.lowpass;

        const highpassFilter = audioContext.createBiquadFilter();
        highpassFilter.type = 'highpass';
        highpassFilter.frequency.value = track.highpass;

        const eqLowFilter = audioContext.createBiquadFilter();
        eqLowFilter.type = 'lowshelf';
        eqLowFilter.frequency.value = 320;
        eqLowFilter.gain.value = track.eqLow;

        const eqMidFilter = audioContext.createBiquadFilter();
        eqMidFilter.type = 'peaking';
        eqMidFilter.frequency.value = 1000;
        eqMidFilter.gain.value = track.eqMid;

        const eqHighFilter = audioContext.createBiquadFilter();
        eqHighFilter.type = 'highshelf';
        eqHighFilter.frequency.value = 3200;
        eqHighFilter.gain.value = track.eqHigh;

        // Echo Effect
        const mainGain = audioContext.createGain();
        const echoDelay = audioContext.createDelay();
        const echoGain = audioContext.createGain();

        echoDelay.delayTime.value = 0.3; // 300ms delay
        echoGain.gain.value = track.echo;

        // Volume
        const volumeGain = audioContext.createGain();
        volumeGain.gain.value = track.volume;

        // Connect Graph
        // Source -> EQ -> Filters -> Volume -> Destination
        //                                  |-> Echo -> Volume
        audioSourceNode.connect(eqLowFilter);
        eqLowFilter.connect(eqMidFilter);
        eqMidFilter.connect(eqHighFilter);
        eqHighFilter.connect(lowpassFilter);
        lowpassFilter.connect(highpassFilter);
        highpassFilter.connect(mainGain);

        // Echo loop
        mainGain.connect(volumeGain);
        mainGain.connect(echoDelay);
        echoDelay.connect(echoGain);
        echoGain.connect(volumeGain);

        return {
            audioSourceNode,
            volumeGain,
        };
    }

    /**
     * 建立音訊處理圖形（用於離線渲染）
     * 
     * 建立用於離線渲染的音訊處理圖形，與即時播放圖形相同，但使用 OfflineAudioContext。
     * 此方法用於音訊導出功能，確保導出的音訊包含所有效果。
     * 
     * @param offlineAudioContext - 離線音訊上下文，用於離線渲染
     * @param offlineSourceNode - 離線音訊來源節點，將被設定播放速率和音高
     * @param track - 音訊軌道設定，包含所有效果參數
     * @returns 包含離線音訊來源節點和音量控制節點的物件
     * 
     * @example
     * ```typescript
     * const offlineContext = new OfflineAudioContext(2, sampleCount, 44100);
     * const sourceNode = offlineContext.createBufferSource();
     * sourceNode.buffer = audioBuffer;
     * 
     * const { volumeGain } = AudioGraphBuilder.createOfflineGraph(
     *   offlineContext,
     *   sourceNode,
     *   track
     * );
     * 
     * volumeGain.connect(offlineContext.destination);
     * sourceNode.start(0);
     * const renderedBuffer = await offlineContext.startRendering();
     * ```
     */
    static createOfflineGraph(
        offlineAudioContext: OfflineAudioContext,
        offlineSourceNode: AudioBufferSourceNode,
        track: AudioTrack
    ): {
        offlineSourceNode: AudioBufferSourceNode;
        volumeGain: GainNode;
    } {
        // Pitch/Speed
        offlineSourceNode.playbackRate.value = track.playbackRate;
        offlineSourceNode.detune.value = track.pitch;

        // Filters & EQ
        const offlineLowpassFilter = offlineAudioContext.createBiquadFilter();
        offlineLowpassFilter.type = 'lowpass';
        offlineLowpassFilter.frequency.value = track.lowpass;

        const offlineHighpassFilter = offlineAudioContext.createBiquadFilter();
        offlineHighpassFilter.type = 'highpass';
        offlineHighpassFilter.frequency.value = track.highpass;

        const offlineEqLowFilter = offlineAudioContext.createBiquadFilter();
        offlineEqLowFilter.type = 'lowshelf';
        offlineEqLowFilter.frequency.value = 320;
        offlineEqLowFilter.gain.value = track.eqLow;

        const offlineEqMidFilter = offlineAudioContext.createBiquadFilter();
        offlineEqMidFilter.type = 'peaking';
        offlineEqMidFilter.frequency.value = 1000;
        offlineEqMidFilter.gain.value = track.eqMid;

        const offlineEqHighFilter = offlineAudioContext.createBiquadFilter();
        offlineEqHighFilter.type = 'highshelf';
        offlineEqHighFilter.frequency.value = 3200;
        offlineEqHighFilter.gain.value = track.eqHigh;

        const offlineMainGain = offlineAudioContext.createGain();
        const offlineEchoDelay = offlineAudioContext.createDelay();
        const offlineEchoGain = offlineAudioContext.createGain();
        offlineEchoDelay.delayTime.value = 0.3;
        offlineEchoGain.gain.value = track.echo;

        const offlineVolumeGain = offlineAudioContext.createGain();
        offlineVolumeGain.gain.value = track.volume;

        // Connect the graph
        offlineSourceNode.connect(offlineEqLowFilter);
        offlineEqLowFilter.connect(offlineEqMidFilter);
        offlineEqMidFilter.connect(offlineEqHighFilter);
        offlineEqHighFilter.connect(offlineLowpassFilter);
        offlineLowpassFilter.connect(offlineHighpassFilter);
        offlineHighpassFilter.connect(offlineMainGain);
        offlineMainGain.connect(offlineVolumeGain);
        offlineMainGain.connect(offlineEchoDelay);
        offlineEchoDelay.connect(offlineEchoGain);
        offlineEchoGain.connect(offlineVolumeGain);

        return {
            offlineSourceNode,
            volumeGain: offlineVolumeGain,
        };
    }
}

