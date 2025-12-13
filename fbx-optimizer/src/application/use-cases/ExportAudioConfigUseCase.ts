/**
 * ExportAudioConfigUseCase - 匯出音效配置為 ZIP 檔案
 * 
 * 功能：
 * 1. 收集所有被引用的音效檔案
 * 2. 將音效統一轉換為 MP3 格式
 * 3. 生成 JSON 配置檔（動作 → 音效 → 觸發時間）
 * 4. 打包成 ZIP 檔案下載
 */

import JSZip from 'jszip';
import type { AudioTrack } from '../../domain/value-objects/AudioTrack';

declare global {
  interface Window {
    lamejs?: {
      Mp3Encoder: new (channels: number, sampleRate: number, bitrate: number) => {
        encodeBuffer: (left: Int16Array, right: Int16Array) => Int8Array;
        flush: () => Int8Array;
      };
    };
  }
}

/** 單一觸發點資訊 */
interface TriggerPoint {
  frame: number;
  time: number;
}

/** 動作配置（音效名稱 → 觸發點陣列） */
interface ActionConfig {
  [audioName: string]: TriggerPoint[];
}

/** 完整匯出配置 */
interface AudioConfigExport {
  version: string;
  fps: number;
  exportDate: string;
  modelName?: string;
  actions: {
    [actionName: string]: ActionConfig;
  };
  audioFiles: string[];
}

const FPS = 30;

export class ExportAudioConfigUseCase {
  /**
   * 匯出音效配置為 ZIP 檔案
   * 
   * @param audioTracks - 要匯出的音效軌道陣列
   * @param modelName - 模型名稱（可選，用於檔名）
   */
  public static async execute(
    audioTracks: AudioTrack[],
    modelName?: string
  ): Promise<void> {
    try {
      // 檢查是否有音效
      if (audioTracks.length === 0) {
        alert('沒有音效可匯出');
        return;
      }

      // 檢查是否有觸發設定
      const tracksWithTriggers = audioTracks.filter(t => t.triggers.length > 0);
      if (tracksWithTriggers.length === 0) {
        alert('沒有設定任何觸發點，請先為音效設定觸發時機');
        return;
      }

      const zip = new JSZip();
      const soundsFolder = zip.folder('sounds');
      if (!soundsFolder) {
        throw new Error('無法建立 sounds 資料夾');
      }

      // 收集所有被引用的音效（有 triggers 的）
      const referencedTracks = tracksWithTriggers;
      const audioFileNames: string[] = [];

      // 建立配置結構
      const actionsConfig: { [actionName: string]: ActionConfig } = {};

      // 處理每個音效軌道
      for (const track of referencedTracks) {
        const safeFileName = this.sanitizeFileName(track.name);
        const mp3FileName = `${safeFileName}.mp3`;
        audioFileNames.push(mp3FileName);

        // 轉換並加入 MP3 到 ZIP
        console.log(`[Audio Export] 正在轉換: ${track.name}`);
        const mp3Blob = await this.convertToMp3(track);
        soundsFolder.file(mp3FileName, mp3Blob);

        // 處理每個觸發點
        for (const trigger of track.triggers) {
          const actionName = trigger.clipName || 'Unknown';
          
          // 初始化動作配置
          if (!actionsConfig[actionName]) {
            actionsConfig[actionName] = {};
          }

          // 初始化音效陣列
          if (!actionsConfig[actionName][safeFileName]) {
            actionsConfig[actionName][safeFileName] = [];
          }

          // 添加觸發點
          actionsConfig[actionName][safeFileName].push({
            frame: trigger.frame,
            time: parseFloat((trigger.frame / FPS).toFixed(3))
          });
        }
      }

      // 對每個動作的音效觸發點按 frame 排序
      for (const actionName of Object.keys(actionsConfig)) {
        for (const audioName of Object.keys(actionsConfig[actionName])) {
          actionsConfig[actionName][audioName].sort((a, b) => a.frame - b.frame);
        }
      }

      // 建立 config.json
      const config: AudioConfigExport = {
        version: '1.0',
        fps: FPS,
        exportDate: new Date().toISOString(),
        modelName: modelName,
        actions: actionsConfig,
        audioFiles: audioFileNames
      };

      // 加入 config.json 到 ZIP
      zip.file('audio_config.json', JSON.stringify(config, null, 2));

      // 生成 ZIP 並下載
      const blob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const fileName = modelName ? `audio_${modelName}_${timestamp}` : `audio_export_${timestamp}`;
      link.download = `${fileName}.zip`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // 清理
      setTimeout(() => URL.revokeObjectURL(url), 100);

      console.log(`✅ 音效配置已匯出: ${link.download}`);
      console.log(`   - 包含 ${audioFileNames.length} 個音效檔案`);
      console.log(`   - 包含 ${Object.keys(actionsConfig).length} 個動作配置`);
    } catch (error) {
      console.error('❌ 匯出音效配置失敗:', error);
      alert(`匯出失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
      throw error;
    }
  }

  /**
   * 將音效轉換為 MP3 格式
   */
  private static async convertToMp3(track: AudioTrack): Promise<Blob> {
    // 檢查 lamejs
    if (!window.lamejs || !window.lamejs.Mp3Encoder) {
      throw new Error('lamejs 未載入，請確認 index.html 是否正確引入 /lame.min.js');
    }

    // 載入音訊
    const response = await fetch(track.url);
    const arrayBuffer = await response.arrayBuffer();
    
    // 解碼音訊
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    await audioContext.close();

    // 計算調整後的時長
    const adjustedDuration = audioBuffer.duration / track.playbackRate;
    const SAMPLE_RATE = 44100;
    const NUMBER_OF_CHANNELS = 2;

    // 建立離線上下文進行渲染
    const offlineAudioContext = new OfflineAudioContext(
      NUMBER_OF_CHANNELS,
      Math.ceil(adjustedDuration * SAMPLE_RATE),
      SAMPLE_RATE
    );

    // 建立音源
    const sourceNode = offlineAudioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.playbackRate.value = track.playbackRate;

    // 建立音量節點
    const gainNode = offlineAudioContext.createGain();
    gainNode.gain.value = track.volume;

    // 連接節點
    sourceNode.connect(gainNode);
    gainNode.connect(offlineAudioContext.destination);
    sourceNode.start(0);

    // 渲染音訊
    const renderedBuffer = await offlineAudioContext.startRendering();

    // 編碼為 MP3
    const mp3Encoder = new window.lamejs.Mp3Encoder(NUMBER_OF_CHANNELS, SAMPLE_RATE, 128);
    const mp3Chunks: Int8Array[] = [];

    const leftChannel = renderedBuffer.getChannelData(0);
    const rightChannel = renderedBuffer.numberOfChannels > 1 
      ? renderedBuffer.getChannelData(1) 
      : leftChannel;
    
    const MP3_BLOCK_SIZE = 1152;

    // 轉換為 Int16
    const leftInt16 = new Int16Array(leftChannel.length);
    const rightInt16 = new Int16Array(rightChannel.length);

    for (let i = 0; i < leftChannel.length; i++) {
      leftInt16[i] = Math.max(-32768, Math.min(32767, leftChannel[i] * 32767));
      rightInt16[i] = Math.max(-32768, Math.min(32767, rightChannel[i] * 32767));
    }

    // 分塊編碼
    for (let i = 0; i < leftInt16.length; i += MP3_BLOCK_SIZE) {
      const leftChunk = leftInt16.subarray(i, i + MP3_BLOCK_SIZE);
      const rightChunk = rightInt16.subarray(i, i + MP3_BLOCK_SIZE);
      const encoded = mp3Encoder.encodeBuffer(leftChunk, rightChunk);
      if (encoded.length > 0) {
        mp3Chunks.push(encoded);
      }
    }

    // Flush 剩餘資料
    const final = mp3Encoder.flush();
    if (final.length > 0) {
      mp3Chunks.push(final);
    }

    return new Blob(mp3Chunks as unknown as BlobPart[], { type: 'audio/mp3' });
  }

  /**
   * 清理檔名，移除不安全字元
   */
  private static sanitizeFileName(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .trim();
  }
}

