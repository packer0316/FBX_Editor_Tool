import type { AudioTrack } from '../../domain/value-objects/AudioTrack';
import type { AudioController } from '../../infrastructure/audio/WebAudioAdapter';
import { getClipId, type IdentifiableClip } from '../../utils/clip/clipIdentifierUtils';

/**
 * 音訊同步 Use Case
 * 負責處理動畫播放時的音訊觸發邏輯
 */
export class AudioSyncUseCase {
  private lastAudioTimeRef: React.MutableRefObject<number>;
  private lastAudioFrameRef: React.MutableRefObject<number>;
  private audioController: InstanceType<typeof AudioController>;
  private fps: number = 30;

  constructor(
    audioController: InstanceType<typeof AudioController>,
    lastAudioTimeRef: React.MutableRefObject<number>,
    lastAudioFrameRef: React.MutableRefObject<number>
  ) {
    this.audioController = audioController;
    this.lastAudioTimeRef = lastAudioTimeRef;
    this.lastAudioFrameRef = lastAudioFrameRef;
  }

  /**
   * 處理時間更新並觸發音訊
   */
  handleTimeUpdate(
    time: number,
    isPlaying: boolean,
    clip: IdentifiableClip | null,
    audioTracks: AudioTrack[]
  ): void {
    if (!isPlaying || !clip) {
      return;
    }

    // Detect loop or seek (if time goes backward)
    if (time < this.lastAudioTimeRef.current) {
      this.lastAudioFrameRef.current = -1;
      this.lastAudioTimeRef.current = time;
      return;
    }

    const previousTime = this.lastAudioTimeRef.current;
    const currentClipId = getClipId(clip);

    audioTracks.forEach(track => {
      track.triggers.forEach(trigger => {
        // 使用 customId 進行精確匹配，解決相同名稱片段的問題
        if (trigger.clipId === currentClipId) {
          const triggerTime = trigger.frame / this.fps;

          if (triggerTime > previousTime && triggerTime <= time) {
            console.log(`[Audio Trigger] ✓ Playing: ${track.name} at frame ${trigger.frame} for clip ${clip.displayName || clip.name}`);
            this.audioController.play(track);
          }
        }
      });
    });

    this.lastAudioTimeRef.current = time;
  }
}

