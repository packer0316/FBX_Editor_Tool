import type { AudioTrack } from '../App';

declare global {
    interface Window {
        lamejs?: any;
    }
}

export class AudioController {
    private audioContext: AudioContext | null = null;
    private sourceNodes: Record<string, AudioBufferSourceNode> = {};
    private audioBuffers: Record<string, AudioBuffer> = {};

    constructor() {
        // Initialize lazily to avoid autoplay policy issues
    }

    private getAudioContext(): AudioContext {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        return this.audioContext;
    }

    public async loadAudioBuffer(track: AudioTrack): Promise<AudioBuffer> {
        if (this.audioBuffers[track.id]) return this.audioBuffers[track.id];

        const response = await fetch(track.url);
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = this.getAudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        this.audioBuffers[track.id] = audioBuffer;
        return audioBuffer;
    }

    public async play(track: AudioTrack) {
        try {
            const audioContext = this.getAudioContext();
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            // Stop existing playback for this track
            this.stop(track.id);

            const buffer = await this.loadAudioBuffer(track);

            // Create nodes
            const source = audioContext.createBufferSource();
            source.buffer = buffer;

            // Pitch/Speed (detune affects pitch and speed)
            source.playbackRate.value = track.playbackRate;
            source.detune.value = track.pitch;

            // Filters & EQ
            const lowpass = audioContext.createBiquadFilter();
            lowpass.type = 'lowpass';
            lowpass.frequency.value = track.lowpass;

            const highpass = audioContext.createBiquadFilter();
            highpass.type = 'highpass';
            highpass.frequency.value = track.highpass;

            const eqLow = audioContext.createBiquadFilter();
            eqLow.type = 'lowshelf';
            eqLow.frequency.value = 320;
            eqLow.gain.value = track.eqLow;

            const eqMid = audioContext.createBiquadFilter();
            eqMid.type = 'peaking';
            eqMid.frequency.value = 1000;
            eqMid.gain.value = track.eqMid;

            const eqHigh = audioContext.createBiquadFilter();
            eqHigh.type = 'highshelf';
            eqHigh.frequency.value = 3200;
            eqHigh.gain.value = track.eqHigh;

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

            source.connect(eqLow);
            eqLow.connect(eqMid);
            eqMid.connect(eqHigh);
            eqHigh.connect(lowpass);
            lowpass.connect(highpass);
            highpass.connect(mainGain);

            // Echo loop
            mainGain.connect(volumeGain);
            mainGain.connect(echoDelay);
            echoDelay.connect(echoGain);
            echoGain.connect(volumeGain);

            volumeGain.connect(audioContext.destination);

            source.start(0);
            this.sourceNodes[track.id] = source;

            source.onended = () => {
                if (this.sourceNodes[track.id] === source) {
                    delete this.sourceNodes[track.id];
                }
            };

        } catch (error) {
            console.error("Audio playback error:", error);
        }
    }

    public stop(trackId: string) {
        if (this.sourceNodes[trackId]) {
            try {
                this.sourceNodes[trackId].stop();
            } catch (e) {
                // Ignore if already stopped
            }
            delete this.sourceNodes[trackId];
        }
    }

    public stopAll() {
        Object.keys(this.sourceNodes).forEach(id => this.stop(id));
    }

    public cleanup(trackId: string) {
        this.stop(trackId);
        delete this.audioBuffers[trackId];
    }

    public async exportAudio(track: AudioTrack) {
        try {
            // Load the audio buffer
            const buffer = await this.loadAudioBuffer(track);

            // Calculate the duration with playback rate adjustment
            const duration = buffer.duration / track.playbackRate;
            const sampleRate = 44100;
            const numberOfChannels = 2;

            // Create offline context for rendering
            const offlineCtx = new OfflineAudioContext(
                numberOfChannels,
                Math.ceil(duration * sampleRate),
                sampleRate
            );

            // Create source
            const source = offlineCtx.createBufferSource();
            source.buffer = buffer;
            source.playbackRate.value = track.playbackRate;
            source.detune.value = track.pitch;

            // Recreate the same audio graph as in play()
            const lowpass = offlineCtx.createBiquadFilter();
            lowpass.type = 'lowpass';
            lowpass.frequency.value = track.lowpass;

            const highpass = offlineCtx.createBiquadFilter();
            highpass.type = 'highpass';
            highpass.frequency.value = track.highpass;

            const eqLow = offlineCtx.createBiquadFilter();
            eqLow.type = 'lowshelf';
            eqLow.frequency.value = 320;
            eqLow.gain.value = track.eqLow;

            const eqMid = offlineCtx.createBiquadFilter();
            eqMid.type = 'peaking';
            eqMid.frequency.value = 1000;
            eqMid.gain.value = track.eqMid;

            const eqHigh = offlineCtx.createBiquadFilter();
            eqHigh.type = 'highshelf';
            eqHigh.frequency.value = 3200;
            eqHigh.gain.value = track.eqHigh;

            const mainGain = offlineCtx.createGain();
            const echoDelay = offlineCtx.createDelay();
            const echoGain = offlineCtx.createGain();
            echoDelay.delayTime.value = 0.3;
            echoGain.gain.value = track.echo;

            const volumeGain = offlineCtx.createGain();
            volumeGain.gain.value = track.volume;

            // Connect the graph
            source.connect(eqLow);
            eqLow.connect(eqMid);
            eqMid.connect(eqHigh);
            eqHigh.connect(lowpass);
            lowpass.connect(highpass);
            highpass.connect(mainGain);
            mainGain.connect(volumeGain);
            mainGain.connect(echoDelay);
            echoDelay.connect(echoGain);
            echoGain.connect(volumeGain);
            volumeGain.connect(offlineCtx.destination);

            source.start(0);

            // Render the audio
            const renderedBuffer = await offlineCtx.startRendering();

            // Convert to MP3 (using global lamejs loaded from index.html)
            if (!window.lamejs || !window.lamejs.Mp3Encoder) {
                throw new Error('lamejs 未載入，請確認 index.html 是否正確引入 /lame.min.js');
            }

            const mp3encoder = new window.lamejs.Mp3Encoder(numberOfChannels, sampleRate, 128);
            const mp3Data: Int8Array[] = [];

            const leftChannel = renderedBuffer.getChannelData(0);
            const rightChannel = renderedBuffer.getChannelData(1);
            const sampleBlockSize = 1152;

            // Convert Float32Array to Int16Array
            const leftInt16 = new Int16Array(leftChannel.length);
            const rightInt16 = new Int16Array(rightChannel.length);

            for (let i = 0; i < leftChannel.length; i++) {
                leftInt16[i] = Math.max(-32768, Math.min(32767, leftChannel[i] * 32767));
                rightInt16[i] = Math.max(-32768, Math.min(32767, rightChannel[i] * 32767));
            }

            // Encode in blocks
            for (let i = 0; i < leftInt16.length; i += sampleBlockSize) {
                const leftChunk = leftInt16.subarray(i, i + sampleBlockSize);
                const rightChunk = rightInt16.subarray(i, i + sampleBlockSize);
                const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
                if (mp3buf.length > 0) {
                    mp3Data.push(mp3buf);
                }
            }

            // Flush remaining data
            const mp3buf = mp3encoder.flush();
            if (mp3buf.length > 0) {
                mp3Data.push(mp3buf);
            }

            // Create blob and download
            const blob = new Blob(mp3Data as unknown as BlobPart[], { type: 'audio/mp3' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${track.name}_processed.mp3`;
            link.click();
            URL.revokeObjectURL(url);

            console.log(`[Audio Export] ✓ Exported: ${track.name}`);
        } catch (error) {
            console.error("[Audio Export] ✗ Failed:", error);
            alert("導出失敗,請檢查控制台錯誤訊息");
        }
    }
}
