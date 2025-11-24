import * as THREE from 'three';
import type { AudioTrack } from '../../domain/value-objects/AudioTrack';
import { AudioController } from '../../infrastructure/audio/WebAudioAdapter';

/**
 * 音訊同步 Use Case
 * 負責處理動畫播放時的音訊觸發邏輯
 */
export class AudioSyncUseCase {
  private lastTimeRef: React.MutableRefObject<number>;
  private lastAudioFrameRef: React.MutableRefObject<number>;
  private audioController: AudioController;
  private fps: number = 30;

  constructor(
    audioController: AudioController,
    lastTimeRef: React.MutableRefObject<number>,
    lastAudioFrameRef: React.MutableRefObject<number>
  ) {
    this.audioController = audioController;
    this.lastTimeRef = lastTimeRef;
    this.lastAudioFrameRef = lastAudioFrameRef;
  }

  /**
   * 處理時間更新並觸發音訊
   */
  handleTimeUpdate(
    time: number,
    isPlaying: boolean,
    clip: THREE.AnimationClip | null,
    audioTracks: AudioTrack[]
  ): void {
    if (!isPlaying || !clip) {
      return;
    }

    // Detect loop or seek (if time goes backward)
    if (time < this.lastTimeRef.current) {
      this.lastAudioFrameRef.current = -1;
      this.lastTimeRef.current = time;
      return;
    }

    const previousTime = this.lastTimeRef.current;

    audioTracks.forEach(track => {
      track.triggers.forEach(trigger => {
        const clipName = trigger.clipName || '';

        // Match by clip name instead of UUID (since UUID changes after optimization)
        if (clipName === clip.name) {
          const triggerTime = trigger.frame / this.fps;

          if (triggerTime > previousTime && triggerTime <= time) {
            console.log(`[Audio Trigger] ✓ Playing: ${track.name} at frame ${trigger.frame}`);
            this.audioController.play(track);
          }
        }
      });
    });

    this.lastTimeRef.current = time;
  }
}

