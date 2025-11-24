import type { AudioTrigger } from './AudioTrigger';

export interface AudioTrack {
  id: string;
  name: string;
  url: string;
  file: File;
  note: string;
  triggers: AudioTrigger[];
  color: string;
  playbackRate: number;
  volume: number;
  // Advanced Audio Features
  pitch: number; // detune in cents
  echo: number; // mix 0-1
  eqLow: number; // gain dB
  eqMid: number; // gain dB
  eqHigh: number; // gain dB
  lowpass: number; // frequency Hz
  highpass: number; // frequency Hz
}



