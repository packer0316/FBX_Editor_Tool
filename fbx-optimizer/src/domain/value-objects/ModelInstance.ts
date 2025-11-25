import * as THREE from 'three';
import type { IdentifiableClip } from '../../../utils/clip/clipIdentifierUtils';
import type { ShaderGroup } from './ShaderFeature';
import type { AudioTrack } from './AudioTrack';
import type { EffectItem } from '../../../presentation/features/effect-panel/components/EffectTestPanel';

/**
 * 模型實例介面
 * 
 * 代表一個完整的模型實例，包含模型本身及其所有相關資料。
 * 每個模型實例擁有完全獨立的：
 * - Mesh 管理
 * - Bone（骨骼）管理
 * - 動作片段（Animation Clips）
 * - Shader 組合
 * - 音效軌道（Audio Tracks）
 * - 特效（Effects）
 */
export interface ModelInstance {
  // 基本資訊
  /** 唯一識別碼 */
  id: string;
  /** 顯示名稱（預設為檔名稱為檔名） */
  name: string;
  /** 原始檔案（用於重新載入） */
  file: File | null;
  
  // 模型資料
  /** Three.js 模型群組 */
  model: THREE.Group | null;
  /** Mesh 名稱列表 */
  meshNames: string[];
  /** 骨骼列表（從 model 提取） */
  bones: THREE.Object3D[];
  
  // 動畫相關
  /** 原始動畫片段 */
  originalClip: IdentifiableClip | null;
  /** 主動畫片段 */
  masterClip: IdentifiableClip | null;
  /** 優化後的動畫片段 */
  optimizedClip: IdentifiableClip | null;
  /** 用戶創建的動作片段 */
  createdClips: IdentifiableClip[];
  /** 優化容忍度 */
  tolerance: number;
  
  // Shader 相關
  /** Shader 組合列表 */
  shaderGroups: ShaderGroup[];
  /** Shader 是否啟用 */
  isShaderEnabled: boolean;
  
  // 音效相關
  /** 音效軌道列表 */
  audioTracks: AudioTrack[];
  
  // 特效相關
  /** 特效列表 */
  effects: EffectItem[];
  
  // 播放狀態（每個模型獨立）
  /** 是否正在播放 */
  isPlaying: boolean;
  /** 當前播放時間 */
  currentTime: number;
  /** 動畫總時長 */
  duration: number;
  /** 是否啟用循環播放 */
  isLoopEnabled: boolean;
  
  // 變換與渲染設定（每個模型獨立）
  /** 模型位置 [x, y, z] */
  position: [number, number, number];
  /** 模型旋轉 [x, y, z] (度數) */
  rotation: [number, number, number];
  /** 模型縮放 [x, y, z] */
  scale: [number, number, number];
  /** 渲染優先級（數字越大越前面，相同數字同一層） */
  renderPriority: number;
  /** 是否可見 */
  visible: boolean;
  
  // 元資料
  /** 建立時間戳 */
  createdAt: number;
  /** 最後更新時間戳 */
  updatedAt: number;
}

