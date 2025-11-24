import type { AudioTrack } from '../../domain/value-objects/AudioTrack';
import { AudioGraphBuilder } from './AudioGraphBuilder';

declare global {
    interface Window {
        lamejs?: any;
    }
}

/**
 * Web Audio API 適配器
 * 
 * 封裝 Web Audio API 的操作，提供音訊載入、播放、停止和導出功能。
 * 此類別負責管理音訊上下文、音訊緩衝區和音訊節點的生命週期。
 * 
 * 主要功能：
 * - 音訊檔案的載入與解碼
 * - 音訊播放（支援即時效果處理）
 * - 音訊停止與清理
 * - 音訊導出為 MP3 格式
 * 
 * @example
 * ```typescript
 * const audioController = new WebAudioAdapter();
 * await audioController.play(audioTrack);
 * audioController.stop(trackId);
 * ```
 */
export class WebAudioAdapter {
    private audioContext: AudioContext | null = null;
    private sourceNodes: Record<string, AudioBufferSourceNode> = {};
    private audioBuffers: Record<string, AudioBuffer> = {};

    /**
     * 建立 Web Audio API 適配器實例
     * 
     * 音訊上下文會延遲初始化，以避免瀏覽器的自動播放政策問題。
     * 實際的音訊上下文會在第一次播放時才建立。
     */
    constructor() {
        // Initialize lazily to avoid autoplay policy issues
    }

    /**
     * 取得或建立音訊上下文
     * 
     * @returns AudioContext 實例
     * @private
     */
    private getAudioContext(): AudioContext {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        return this.audioContext;
    }

    /**
     * 載入音訊緩衝區
     * 
     * 從音訊軌道的 URL 載入音訊檔案，解碼為 AudioBuffer，並快取結果。
     * 如果該軌道已經載入過，則直接返回快取的 AudioBuffer。
     * 
     * @param track - 音訊軌道物件，包含 id 和 url 屬性
     * @returns Promise 解析為解碼後的 AudioBuffer
     * @throws {Error} 當音訊檔案載入失敗或格式不支援時可能拋出錯誤
     * 
     * @example
     * ```typescript
     * const buffer = await audioController.loadAudioBuffer(track);
     * console.log('音訊時長:', buffer.duration, '秒');
     * ```
     */
    public async loadAudioBuffer(track: AudioTrack): Promise<AudioBuffer> {
        if (this.audioBuffers[track.id]) return this.audioBuffers[track.id];

        const audioFileResponse = await fetch(track.url);
        const audioFileArrayBuffer = await audioFileResponse.arrayBuffer();
        const audioContext = this.getAudioContext();
        const decodedAudioBuffer = await audioContext.decodeAudioData(audioFileArrayBuffer);
        this.audioBuffers[track.id] = decodedAudioBuffer;
        return decodedAudioBuffer;
    }

    /**
     * 播放音訊軌道
     * 
     * 播放指定的音訊軌道，並應用所有設定的效果（EQ、濾波器、回音等）。
     * 如果音訊上下文處於暫停狀態，會自動恢復。如果該軌道正在播放，
     * 會先停止舊的播放再開始新的播放。
     * 
     * @param track - 要播放的音訊軌道，包含所有效果參數
     * @returns Promise，當播放開始時解析
     * @throws {Error} 當音訊載入或播放失敗時會在控制台輸出錯誤（不會拋出）
     * 
     * @example
     * ```typescript
     * await audioController.play({
     *   id: 'track1',
     *   url: 'blob:...',
     *   volume: 0.8,
     *   pitch: 0,
     *   echo: 0.3,
     *   // ... 其他參數
     * });
     * ```
     */
    public async play(track: AudioTrack) {
        try {
            const audioContext = this.getAudioContext();
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            // Stop existing playback for this track
            this.stop(track.id);

            const audioBuffer = await this.loadAudioBuffer(track);

            // Create nodes
            const audioSourceNode = audioContext.createBufferSource();
            audioSourceNode.buffer = audioBuffer;

            // Build audio processing graph
            const { volumeGain } = AudioGraphBuilder.createPlaybackGraph(
                audioContext,
                audioSourceNode,
                track
            );

            volumeGain.connect(audioContext.destination);

            audioSourceNode.start(0);
            this.sourceNodes[track.id] = audioSourceNode;

            audioSourceNode.onended = () => {
                if (this.sourceNodes[track.id] === audioSourceNode) {
                    delete this.sourceNodes[track.id];
                }
            };

        } catch (error) {
            console.error("Audio playback error:", error);
        }
    }

    /**
     * 停止指定軌道的播放
     * 
     * 停止指定 ID 的音訊軌道播放，並清理相關的音訊節點。
     * 如果音訊已經停止，會忽略錯誤。
     * 
     * @param trackId - 要停止的音訊軌道 ID
     * 
     * @example
     * ```typescript
     * audioController.stop('track1');
     * ```
     */
    public stop(trackId: string) {
        if (this.sourceNodes[trackId]) {
            try {
                this.sourceNodes[trackId].stop();
            } catch (stopError) {
                // Ignore if already stopped
            }
            delete this.sourceNodes[trackId];
        }
    }

    /**
     * 停止所有軌道的播放
     * 
     * 停止所有正在播放的音訊軌道，用於清理所有播放狀態。
     * 
     * @example
     * ```typescript
     * audioController.stopAll();
     * ```
     */
    public stopAll() {
        Object.keys(this.sourceNodes).forEach(trackId => this.stop(trackId));
    }

    /**
     * 清理指定軌道的資源
     * 
     * 停止播放並刪除快取的音訊緩衝區，釋放記憶體。
     * 通常在刪除音訊軌道時呼叫此方法。
     * 
     * @param trackId - 要清理的音訊軌道 ID
     * 
     * @example
     * ```typescript
     * audioController.cleanup('track1');
     * // 現在 track1 的音訊緩衝區已被釋放
     * ```
     */
    public cleanup(trackId: string) {
        this.stop(trackId);
        delete this.audioBuffers[trackId];
    }

    /**
     * 導出處理後的音訊為 MP3 格式
     * 
     * 將音訊軌道應用所有效果（EQ、濾波器、回音等）後，渲染為 MP3 檔案並觸發下載。
     * 此方法使用 OfflineAudioContext 進行離線渲染，確保所有效果都被正確應用。
     * 
     * 導出流程：
     * 1. 載入音訊緩衝區
     * 2. 建立離線音訊上下文
     * 3. 建立與播放時相同的音訊處理圖形
     * 4. 渲染音訊為 AudioBuffer
     * 5. 使用 lamejs 編碼為 MP3
     * 6. 建立 Blob 並觸發瀏覽器下載
     * 
     * @param track - 要導出的音訊軌道，包含所有效果參數
     * @returns Promise，當導出完成時解析
     * @throws {Error} 當 lamejs 未載入時拋出錯誤，其他錯誤會在控制台輸出並顯示警告
     * 
     * @example
     * ```typescript
     * await audioController.exportAudio(track);
     * // 瀏覽器會自動下載 track.name_processed.mp3
     * ```
     */
    public async exportAudio(track: AudioTrack) {
        try {
            // Load the audio buffer
            const audioBuffer = await this.loadAudioBuffer(track);

            // Calculate the duration with playback rate adjustment
            const adjustedDuration = audioBuffer.duration / track.playbackRate;
            const SAMPLE_RATE = 44100;
            const NUMBER_OF_CHANNELS = 2;

            // Create offline context for rendering
            const offlineAudioContext = new OfflineAudioContext(
                NUMBER_OF_CHANNELS,
                Math.ceil(adjustedDuration * SAMPLE_RATE),
                SAMPLE_RATE
            );

            // Create source
            const offlineSourceNode = offlineAudioContext.createBufferSource();
            offlineSourceNode.buffer = audioBuffer;

            // Build audio processing graph (same as playback)
            const { volumeGain } = AudioGraphBuilder.createOfflineGraph(
                offlineAudioContext,
                offlineSourceNode,
                track
            );

            volumeGain.connect(offlineAudioContext.destination);

            offlineSourceNode.start(0);

            // Render the audio
            const renderedAudioBuffer = await offlineAudioContext.startRendering();

            // Convert to MP3 (using global lamejs loaded from index.html)
            if (!window.lamejs || !window.lamejs.Mp3Encoder) {
                throw new Error('lamejs 未載入，請確認 index.html 是否正確引入 /lame.min.js');
            }

            const mp3Encoder = new window.lamejs.Mp3Encoder(NUMBER_OF_CHANNELS, SAMPLE_RATE, 128);
            const mp3EncodedChunks: Int8Array[] = [];

            const leftChannelData = renderedAudioBuffer.getChannelData(0);
            const rightChannelData = renderedAudioBuffer.getChannelData(1);
            const MP3_SAMPLE_BLOCK_SIZE = 1152;

            // Convert Float32Array to Int16Array
            const leftChannelInt16 = new Int16Array(leftChannelData.length);
            const rightChannelInt16 = new Int16Array(rightChannelData.length);

            for (let sampleIndex = 0; sampleIndex < leftChannelData.length; sampleIndex++) {
                leftChannelInt16[sampleIndex] = Math.max(-32768, Math.min(32767, leftChannelData[sampleIndex] * 32767));
                rightChannelInt16[sampleIndex] = Math.max(-32768, Math.min(32767, rightChannelData[sampleIndex] * 32767));
            }

            // Encode in blocks
            for (let blockStartIndex = 0; blockStartIndex < leftChannelInt16.length; blockStartIndex += MP3_SAMPLE_BLOCK_SIZE) {
                const leftChannelChunk = leftChannelInt16.subarray(blockStartIndex, blockStartIndex + MP3_SAMPLE_BLOCK_SIZE);
                const rightChannelChunk = rightChannelInt16.subarray(blockStartIndex, blockStartIndex + MP3_SAMPLE_BLOCK_SIZE);
                const encodedChunk = mp3Encoder.encodeBuffer(leftChannelChunk, rightChannelChunk);
                if (encodedChunk.length > 0) {
                    mp3EncodedChunks.push(encodedChunk);
                }
            }

            // Flush remaining data
            const finalEncodedChunk = mp3Encoder.flush();
            if (finalEncodedChunk.length > 0) {
                mp3EncodedChunks.push(finalEncodedChunk);
            }

            // Create blob and download
            const mp3Blob = new Blob(mp3EncodedChunks as unknown as BlobPart[], { type: 'audio/mp3' });
            const mp3BlobUrl = URL.createObjectURL(mp3Blob);
            const downloadLink = document.createElement('a');
            downloadLink.href = mp3BlobUrl;
            downloadLink.download = `${track.name}_processed.mp3`;
            downloadLink.click();
            URL.revokeObjectURL(mp3BlobUrl);

            console.log(`[Audio Export] ✓ Exported: ${track.name}`);
        } catch (error) {
            console.error("[Audio Export] ✗ Failed:", error);
            alert("導出失敗,請檢查控制台錯誤訊息");
        }
    }
}

// 為了向後兼容，導出舊名稱
export const AudioController = WebAudioAdapter;

