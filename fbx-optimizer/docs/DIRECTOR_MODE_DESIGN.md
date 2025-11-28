# Director Mode（導演模式）設計文檔

> **文件維護者**: JR.H  
> **建立日期**: 2025.11.28  
> **最後更新**: 2025.11.28  
> **狀態**: 規劃階段

---

## 📋 目錄

1. [功能概述](#功能概述)
2. [核心概念](#核心概念)
3. [UI/UX 設計](#uiux-設計)
4. [技術架構](#技術架構)
5. [資料結構](#資料結構)
6. [開發規則](#開發規則)
7. [擴充性考量](#擴充性考量)
8. [待優化功能](#待優化功能)
9. [Todo List](#todo-list)

---

## 功能概述

### 目標
創建一個類似影片剪輯軟體的動畫編輯器，讓使用者可以：
- 在時間軸上排列多個動作片段
- 跨模型統一編排動畫序列
- 視覺化管理動作的播放順序與時機

### 使用情境
1. 遊戲開發者需要預覽多個角色的動作配合
2. 動畫師需要編排複雜的動作序列
3. 技術美術需要測試動作銜接效果

---

## 核心概念

### 術語定義

| 術語 | 英文 | 說明 |
|------|------|------|
| 導演模式 | Director Mode | 全域動畫編排模式 |
| 時間軸 | Timeline | 以幀為單位的時間刻度 |
| 軌道 | Track | 一條可放置動作片段的橫向軌道 |
| 片段 | Clip | 一個動作在軌道上的實例 |
| 播放頭 | Playhead | 當前播放位置的指示器 |
| 幀 | Frame | 時間的最小單位（預設 30 FPS） |

### 概念圖

```
┌─────────────────────────────────────────────────────────────────────┐
│  Director Mode                                            [X 關閉]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────────────────────────────┐│
│  │ 左側面板         │  │ 右側時間軸編輯器                          ││
│  │                  │  │                                          ││
│  │ ▼ 模型A          │  │    0    30    60    90   120   150  幀   ││
│  │   ├─ idle        │  │    │     │     │     │     │     │      ││
│  │   ├─ walk   ←────┼──┼──▶ ████████████                          ││
│  │   └─ run         │  │                                          ││
│  │                  │  │ 軌道1 ████████████████                   ││
│  │ ▼ 模型B          │  │                                          ││
│  │   ├─ attack      │  │ 軌道2      ██████████████████            ││
│  │   └─ die         │  │                                          ││
│  │                  │  │ 軌道3           ████████                  ││
│  │ [+ 新增軌道]     │  │                                          ││
│  │                  │  │ ▼ (播放頭)                                ││
│  └──────────────────┘  └──────────────────────────────────────────┘│
│                                                                     │
│  [▶ 播放] [⏸ 暫停] [⏹ 停止] [⟲ 循環]  FPS: 30  總幀數: 240        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## UI/UX 設計

### 進入導演模式
- 右上角新增「Director」按鈕
- 點擊後下方區域分割為左右兩塊
- ESC 或點擊 X 關閉導演模式

### 左側面板（動作來源）
- 顯示所有已載入模型的動作列表
- 樹狀結構：模型 → 動作清單
- 支援拖曳動作到右側時間軸
- 顯示每個動作的幀數/時長

### 右側時間軸編輯器
- **時間刻度尺**：頂部顯示幀數刻度
- **軌道區域**：可新增/刪除多條軌道
- **片段方塊**：動作在軌道上的視覺呈現
- **播放頭**：可拖曳的當前幀指示線

### 片段（Clip）互動
- 拖曳放置到軌道的指定幀位置
- 左右拖曳調整起始幀
- 顯示動作名稱與幀數範圍
- 右鍵選單：刪除、複製、設定循環

### 播放控制
- 播放/暫停/停止按鈕
- 循環播放開關
- FPS 設定（預設 30）
- 當前幀 / 總幀數顯示
- 時間軸縮放（滑鼠滾輪）

---

## 技術架構

### 遵循 Clean Architecture

```
src/
├── domain/
│   └── entities/
│       ├── director/
│       │   ├── DirectorSession.ts      # 導演會話實體
│       │   ├── Timeline.ts             # 時間軸實體
│       │   ├── Track.ts                # 軌道實體
│       │   └── Clip.ts                 # 片段實體
│       └── types/
│           └── director.types.ts       # 類型定義
│
├── application/
│   ├── use-cases/
│   │   └── director/
│   │       ├── AddClipToTrackUseCase.ts
│   │       ├── MoveClipUseCase.ts
│   │       ├── RemoveClipUseCase.ts
│   │       ├── CreateTrackUseCase.ts
│   │       ├── DeleteTrackUseCase.ts
│   │       └── PlayTimelineUseCase.ts
│   └── services/
│       └── DirectorPlaybackService.ts  # 播放同步服務
│
├── infrastructure/
│   └── adapters/
│       └── DirectorStorageAdapter.ts   # 持久化（可選）
│
└── presentation/
    ├── features/
    │   └── director/
    │       ├── components/
    │       │   ├── DirectorPanel.tsx       # 主面板容器
    │       │   ├── ActionSourcePanel.tsx   # 左側動作來源面板
    │       │   ├── TimelineEditor.tsx      # 右側時間軸編輯器
    │       │   ├── TimelineRuler.tsx       # 時間刻度尺
    │       │   ├── TrackRow.tsx            # 單一軌道行
    │       │   ├── ClipBlock.tsx           # 片段方塊
    │       │   ├── Playhead.tsx            # 播放頭
    │       │   └── PlaybackControls.tsx    # 播放控制列
    │       └── hooks/
    │           ├── useDirectorSession.ts   # 導演會話狀態
    │           ├── useTimelinePlayback.ts  # 播放控制
    │           ├── useDragAndDrop.ts       # 拖放邏輯
    │           └── useTimelineZoom.ts      # 縮放控制
    └── stores/
        └── directorStore.ts            # Zustand 狀態管理
```

### 狀態管理（Zustand Store）

```typescript
interface DirectorState {
  // 模式狀態
  isDirectorMode: boolean;
  
  // 時間軸資料
  timeline: {
    totalFrames: number;
    fps: number;
    currentFrame: number;
    isPlaying: boolean;
    isLooping: boolean;
  };
  
  // 軌道與片段
  tracks: Track[];
  
  // UI 狀態
  zoom: number;           // 縮放比例
  scrollOffset: number;   // 捲動偏移
  selectedClipId: string | null;
  
  // Actions
  toggleDirectorMode: () => void;
  addTrack: () => void;
  removeTrack: (trackId: string) => void;
  addClip: (trackId: string, clip: Clip) => void;
  moveClip: (clipId: string, newTrackId: string, newStartFrame: number) => void;
  removeClip: (clipId: string) => void;
  setCurrentFrame: (frame: number) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
}
```

---

## 資料結構

### Track（軌道）

```typescript
interface Track {
  id: string;
  name: string;
  order: number;          // 顯示順序
  isLocked: boolean;      // 是否鎖定
  isMuted: boolean;       // 是否靜音（不播放）
  clips: Clip[];
}
```

### Clip（片段）

```typescript
interface Clip {
  id: string;
  trackId: string;
  
  // 來源資訊
  sourceModelId: string;      // 來源模型 ID
  sourceAnimationName: string; // 動作名稱
  sourceAnimationDuration: number; // 原始動作幀數
  
  // 時間軸位置
  startFrame: number;         // 起始幀
  endFrame: number;           // 結束幀（自動計算）
  
  // 進階設定（未來擴充）
  speed: number;              // 播放速度（預設 1.0）
  loop: boolean;              // 是否在片段內循環
  blendIn: number;            // 混合入幀數
  blendOut: number;           // 混合出幀數
}
```

### DirectorSession（導演會話）

```typescript
interface DirectorSession {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  
  timeline: {
    totalFrames: number;
    fps: number;
  };
  
  tracks: Track[];
}
```

---

## 開發規則

### 1. 命名規範
- 元件使用 PascalCase：`TimelineEditor.tsx`
- Hooks 使用 camelCase 並以 `use` 開頭：`useTimelinePlayback.ts`
- 類型定義集中在 `*.types.ts`
- 常數使用 UPPER_SNAKE_CASE：`DEFAULT_FPS = 30`

### 2. 元件設計原則
- 單一職責：每個元件只負責一件事
- 受控元件：狀態由父層或 Store 管理
- 純展示與邏輯分離：Hooks 處理邏輯，元件專注渲染

### 3. 效能考量
- 使用 `React.memo` 包裝軌道與片段元件
- 虛擬化長列表（如軌道數量過多時）
- 播放時使用 `requestAnimationFrame`
- 避免在 render 中計算複雜數據

### 4. 測試策略
- 單元測試：Use Cases、純函數
- 整合測試：Store 狀態流轉
- E2E 測試：拖放操作、播放功能

### 5. 錯誤處理
- 片段重疊時提供視覺警告
- 拖放無效位置時回彈
- 播放錯誤時顯示提示訊息

---

## 擴充性考量

### 第一階段（MVP）
- [x] 基本導演模式切換
- [x] 軌道新增/刪除
- [x] 片段拖放放置
- [x] 基本播放控制

### 第二階段
- [ ] 片段時間調整（拖曳邊緣改變長度）
- [ ] 軌道重新排序
- [ ] 時間軸縮放
- [ ] 片段複製/貼上

### 第三階段
- [ ] 動作混合（Blend In/Out）
- [ ] 片段速度調整
- [ ] 關鍵幀標記
- [ ] 匯出動畫序列

### 第四階段
- [ ] 導演會話儲存/載入
- [ ] 多時間軸切換
- [ ] 與音訊同步
- [ ] 曲線編輯器

---

## 待優化功能

### 用戶體驗
1. **吸附功能**：片段拖放時自動吸附到幀格線或其他片段邊緣
2. **快捷鍵**：
   - `Space`：播放/暫停
   - `Home`：跳到開頭
   - `End`：跳到結尾
   - `Delete`：刪除選中片段
   - `Ctrl+D`：複製片段
3. **右鍵選單**：快速操作片段
4. **Undo/Redo**：支援撤銷/重做操作

### 視覺效果
1. **片段顏色**：不同模型來源使用不同顏色
2. **波形預覽**：如有對應音訊，顯示波形
3. **縮圖預覽**：片段上顯示動作首幀縮圖
4. **軌道摺疊**：過多軌道時可摺疊

### 進階功能
1. **多選片段**：Shift/Ctrl 多選後批次操作
2. **片段群組**：將多個片段組成群組
3. **標記系統**：在時間軸上加入標記點
4. **預覽模式**：只預覽選中片段

---

## Todo List

### Phase 0：準備工作
- [ ] **安裝 Zustand**：`npm install zustand`（目前專案尚未安裝）
- [ ] 建立 `director` 資料夾結構
- [ ] 定義所有 TypeScript 類型
- [ ] 建立 Zustand Store 骨架
- [ ] 設計 UI 色彩與樣式變數

### Phase 1：基礎 UI
- [ ] 實作「Director」按鈕（右上角）
- [ ] 實作導演模式面板容器 `DirectorPanel.tsx`
- [ ] 實作左側動作來源面板 `ActionSourcePanel.tsx`
  - [ ] 顯示模型樹狀結構
  - [ ] 顯示每個動作的幀數
  - [ ] 支援拖曳開始事件
- [ ] 實作右側時間軸編輯器 `TimelineEditor.tsx`
  - [ ] 時間刻度尺 `TimelineRuler.tsx`
  - [ ] 軌道容器與滾動
- [ ] 實作軌道元件 `TrackRow.tsx`
  - [ ] 軌道標題與控制按鈕
  - [ ] 新增/刪除軌道功能
- [ ] 實作片段方塊 `ClipBlock.tsx`
  - [ ] 顯示動作名稱
  - [ ] 根據幀數計算寬度

### Phase 2：拖放功能
- [ ] 實作 `useDragAndDrop.ts` Hook
- [ ] 從左側動作列表拖曳
- [ ] 放置到右側軌道
- [ ] 計算放置的幀位置
- [ ] 片段在軌道內拖曳移動
- [ ] 跨軌道拖曳
- [ ] 無效放置位置的處理

### Phase 3：播放功能
- [ ] 實作播放頭 `Playhead.tsx`
  - [ ] 可視化當前幀位置
  - [ ] 支援拖曳跳轉
- [ ] 實作播放控制列 `PlaybackControls.tsx`
  - [ ] 播放/暫停/停止按鈕
  - [ ] 循環開關
  - [ ] FPS 設定
  - [ ] 當前幀/總幀數顯示
- [ ] 實作 `useTimelinePlayback.ts` Hook
  - [ ] requestAnimationFrame 播放循環
  - [ ] 同步所有模型的動作播放
  - [ ] 根據片段位置觸發對應動作

### Phase 4：進階互動
- [ ] 時間軸縮放（滑鼠滾輪）
- [ ] 片段選取與刪除
- [ ] 片段右鍵選單
- [ ] 快捷鍵支援
- [ ] 軌道靜音/鎖定功能

### Phase 5：優化與打磨
- [ ] 吸附功能
- [ ] 片段顏色區分
- [ ] 動畫過渡效果
- [ ] 效能優化
- [ ] 錯誤處理完善

---

## 🔍 專案整合分析

> 此章節分析現有專案架構，識別開發 Director Mode 時需要特別注意的整合點與潛在風險。

### 現有系統架構分析

#### 1. 動畫系統現況

**SceneViewer.tsx 中的動畫機制：**
```typescript
// 每個模型擁有獨立的 AnimationMixer
const mixerRef = useRef<THREE.AnimationMixer | null>(null);
const actionRef = useRef<THREE.AnimationAction | null>(null);

// Model 組件透過 forwardRef 暴露播放控制
useImperativeHandle(ref, () => ({
  play: () => { ... },
  pause: () => { ... },
  seekTo: (time: number) => { ... },
  getCurrentTime: () => actionRef.current?.time ?? 0,
  getDuration: () => actionRef.current?.getClip().duration ?? 0,
}));
```

**⚠️ 注意點：**
- 每個模型有獨立的 `AnimationMixer`，時間是相對於各自動畫的
- Director Mode 需要一個**全域時間軸**來統一控制
- 需要計算每個 Clip 在全域時間軸上的偏移量

#### 2. 多模型管理系統

**useModelsManager Hook：**
```typescript
interface ModelInstance {
  // 每個模型有獨立的播放狀態
  isPlaying: boolean;
  currentTime: number;
  isLoopEnabled: boolean;
  
  // 每個模型有獨立的動作片段
  createdClips: IdentifiableClip[];
  audioTracks: AudioTrack[];
  effects: EffectItem[];
}
```

**⚠️ 注意點：**
- Director Mode 需要跨模型存取所有動作片段
- 需要建立「模型 → 動作」的樹狀結構供左側面板使用
- 考慮是否需要將 Director 狀態整合到 `ModelInstance` 或獨立管理

#### 3. 現有觸發器系統

**AudioSyncUseCase.ts：**
```typescript
handleTimeUpdate(time, isPlaying, clip, audioTracks) {
  const currentClipId = getClipId(clip);
  
  audioTracks.forEach(track => {
    track.triggers.forEach(trigger => {
      if (trigger.clipId === currentClipId) {
        const triggerTime = trigger.frame / this.fps;
        if (triggerTime > previousTime && triggerTime <= time) {
          this.audioController.play(track);
        }
      }
    });
  });
}
```

**⚠️ 注意點：**
- 現有觸發器使用 `clipId` 匹配，這在 Director Mode 仍可使用
- Director Mode 時間軸需要轉換為各 Clip 的局部時間再觸發
- 需要修改或擴展 `AudioSyncUseCase` 支援 Director 時間

#### 4. 現有 Playlist 系統

**PlaylistUseCase.ts：**
- 處理動作序列的線性播放
- 使用 `IdentifiableClip` 確保片段唯一識別

**⚠️ 注意點：**
- Director Mode 與 Playlist 概念不同：
  - **Playlist**：同一模型的動作線性排列
  - **Director**：跨模型、多軌道、非線性編排
- 需要決定兩者是否互斥或可共存
- **建議**：Director Mode 開啟時停用 Playlist 播放

---

### 🚨 關鍵整合挑戰

#### 挑戰 1：全域時間軸與模型動畫同步

**問題：**
- 現有系統中，每個模型的 `currentTime` 是相對於當前播放的 `clip.duration`
- Director Mode 有全域時間軸（例如 0~300 幀）
- 每個 Clip 可能在不同起始幀開始

**解決方案：**
```typescript
// Director 時間軸轉換為 Clip 局部時間
function getClipLocalTime(globalFrame: number, clip: Clip, fps: number): number | null {
  if (globalFrame < clip.startFrame || globalFrame > clip.endFrame) {
    return null; // Clip 不在此幀播放
  }
  return (globalFrame - clip.startFrame) / fps;
}
```

**實作步驟：**
1. 建立 `DirectorPlaybackService`
2. 在 `useFrame` 中根據 Director 全域時間計算各模型的局部時間
3. 呼叫各模型的 `seekTo(localTime)`

#### 挑戰 2：播放模式切換

**問題：**
- 單模型播放模式 vs Director Mode
- 需要清楚的狀態管理避免衝突

**解決方案：**
```typescript
type PlaybackMode = 'single' | 'playlist' | 'director';

// 在 App.tsx 或 directorStore 中管理
const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('single');

// 進入 Director Mode 時
function enterDirectorMode() {
  setPlaybackMode('director');
  // 暫停所有現有播放
  models.forEach(m => pauseModel(m.id));
}
```

#### 挑戰 3：觸發器系統擴展

**問題：**
- 現有 `AudioSyncUseCase` 接收單一 `clip` 和 `time`
- Director Mode 可能同時有多個 Clip 在播放

**解決方案：**
```typescript
// 新增 Director 專用方法
handleDirectorTimeUpdate(
  globalFrame: number,
  fps: number,
  tracks: Track[],
  allAudioTracks: Map<string, AudioTrack[]>  // modelId → audioTracks
) {
  tracks.forEach(track => {
    track.clips.forEach(clip => {
      const localTime = getClipLocalTime(globalFrame, clip, fps);
      if (localTime !== null) {
        const modelAudioTracks = allAudioTracks.get(clip.sourceModelId);
        // 使用現有邏輯觸發
        this.checkAndTrigger(localTime, clip, modelAudioTracks);
      }
    });
  });
}
```

#### 挑戰 4：UI 整合位置

**問題：**
- 下方面板目前是 `ModelInspector`
- Director Mode 需要佔用下方大部分空間

**解決方案：**
```
┌────────────────────────────────────────────────────┐
│  [底部面板]                                         │
│  ┌──────────────────────────────────────────────┐ │
│  │ [Director Mode OFF]                          │ │
│  │ → 顯示 ModelInspector（現有）                 │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │ [Director Mode ON]                           │ │
│  │ ┌─────────┬──────────────────────────────────┐│ │
│  │ │左側面板 │  時間軸編輯器                     ││ │
│  │ │(模型動作)│  (軌道+片段+播放頭)              ││ │
│  │ └─────────┴──────────────────────────────────┘│ │
│  └──────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

**實作建議：**
```tsx
// 在 App.tsx 的底部面板區域
{isDirectorMode ? (
  <DirectorPanel
    models={models}
    onClose={() => setIsDirectorMode(false)}
  />
) : (
  <ModelInspector {...props} />
)}
```

---

### ⚠️ 開發時特別注意事項

#### 1. 狀態一致性

| 場景 | 注意點 |
|------|--------|
| 進入 Director Mode | 暫停所有模型的獨立播放 |
| 退出 Director Mode | 清空 Director 狀態，恢復預設播放狀態 |
| 刪除模型 | 移除該模型相關的所有 Clips |
| 新增動作片段 | 更新左側面板的動作列表 |

#### 2. 資料來源對應

```typescript
// 左側面板顯示的動作來源
interface ActionSource {
  modelId: string;
  modelName: string;
  clips: {
    clipId: string;
    displayName: string;
    durationFrames: number;  // clip.duration * fps
  }[];
}

// 從 models 中收集
const actionSources: ActionSource[] = models.map(m => ({
  modelId: m.id,
  modelName: m.name,
  clips: [
    m.originalClip,
    m.masterClip,
    ...m.createdClips
  ].filter(Boolean).map(c => ({
    clipId: getClipId(c),
    displayName: getClipDisplayName(c),
    durationFrames: Math.round(c.duration * 30)
  }))
}));
```

#### 3. 效能優化要點

| 元件 | 優化策略 |
|------|----------|
| `TrackRow` | 使用 `React.memo`，只在 clips 變化時重新渲染 |
| `ClipBlock` | 使用 `React.memo`，獨立處理拖曳狀態 |
| 播放頭更新 | 使用 `requestAnimationFrame`，不觸發 React 重新渲染 |
| 時間軸捲動 | 使用 CSS `transform` 而非 `scrollLeft` |

#### 4. 拖放實作建議

**推薦方案：原生 Drag API + 自訂邏輯**

```typescript
// 開始拖曳（左側動作列表）
const handleDragStart = (e: DragEvent, clip: ActionSource['clips'][0], modelId: string) => {
  e.dataTransfer.setData('application/json', JSON.stringify({
    type: 'clip',
    clipId: clip.clipId,
    modelId,
    durationFrames: clip.durationFrames
  }));
};

// 放置（軌道區域）
const handleDrop = (e: DragEvent, trackId: string) => {
  const data = JSON.parse(e.dataTransfer.getData('application/json'));
  const dropX = e.clientX - timelineRect.left;
  const startFrame = Math.round(dropX / pixelsPerFrame);
  
  addClipToTrack(trackId, {
    ...data,
    startFrame
  });
};
```

#### 5. 避免與現有系統衝突

| 現有系統 | Director Mode 行為 |
|----------|-------------------|
| `isPlaying` (App.tsx) | Director Mode 有獨立的播放狀態 |
| `currentTime` (App.tsx) | Director Mode 使用全域 `currentFrame` |
| `onTimeUpdate` callback | Director Mode 不觸發，改用內部時間管理 |
| Playlist 播放 | Director Mode 開啟時自動停用 |
| Audio/Effect Trigger | 改用 Director 專用的觸發邏輯 |

---

### 📝 開發順序建議

```
Phase 0（準備）
└── 確認現有程式碼熟悉度
    ├── 閱讀 SceneViewer.tsx 的動畫控制邏輯
    ├── 閱讀 useModelsManager.ts
    └── 閱讀 AudioSyncUseCase.ts

Phase 1（基礎架構）
└── 建立獨立的 Director 系統
    ├── directorStore.ts（Zustand）
    ├── director.types.ts
    └── DirectorPanel.tsx（空殼）

Phase 2（UI 優先）
└── 先完成可見的 UI
    ├── 時間軸刻度尺
    ├── 軌道渲染
    └── 播放控制列

Phase 3（拖放核心）
└── 實現拖放邏輯
    ├── 左側動作可拖曳
    ├── 軌道可接收
    └── Clip 顯示

Phase 4（播放同步）
└── 實現播放邏輯
    ├── 全域時間軸控制
    ├── 各模型動畫同步
    └── 觸發器整合
```

---

## ⚖️ 技術決策與權衡

### 決策 1：狀態管理方案

| 選項 | 優點 | 缺點 | 建議 |
|------|------|------|------|
| **Zustand Store** | 獨立管理、易於調試 | 需要額外套件（已安裝） | ✅ 推薦 |
| React Context | 不需額外套件 | 大狀態頻繁更新會有效能問題 | ❌ |
| App.tsx 集中管理 | 與現有模式一致 | App.tsx 已過於臃腫 | ❌ |

**結論**：使用 Zustand，建立獨立的 `directorStore.ts`

### 決策 2：拖放方案

| 選項 | 優點 | 缺點 | 建議 |
|------|------|------|------|
| **原生 Drag API** | 輕量、無依賴 | 自訂較多 | ✅ 推薦 |
| React DnD | 功能完整 | 學習成本、Bundle 增大 | 備選 |
| @dnd-kit | 現代、觸控支援 | 額外依賴 | 備選 |

**結論**：先用原生 Drag API，如遇複雜需求再評估

### 決策 3：時間軸渲染方案

| 選項 | 優點 | 缺點 | 建議 |
|------|------|------|------|
| **DOM + CSS Transform** | 簡單、效能佳 | - | ✅ 推薦 |
| Canvas 渲染 | 大量元素時更流暢 | 互動實作複雜 | 備選 |
| SVG | 向量清晰 | 元素多時效能差 | ❌ |

**結論**：使用 DOM + CSS Transform，配合 React.memo 優化

---

## 🚧 風險評估

| 風險 | 機率 | 影響 | 緩解措施 |
|------|------|------|----------|
| 多模型同步播放效能問題 | 中 | 高 | 使用 `requestAnimationFrame`、限制同時播放模型數 |
| 拖放體驗不流暢 | 中 | 中 | 使用節流、GPU 加速 |
| 與現有播放系統衝突 | 高 | 高 | 明確的模式切換、互斥狀態 |
| 觸發器時間計算錯誤 | 中 | 高 | 完整的單元測試 |
| UI 在小螢幕顯示不良 | 低 | 中 | 設定最小寬度、響應式設計 |

---

## 📐 檔案命名規範

| 類型 | 命名格式 | 範例 |
|------|----------|------|
| 實體 | `PascalCase.ts` | `Track.ts`, `Clip.ts` |
| 類型 | `*.types.ts` | `director.types.ts` |
| Store | `*Store.ts` | `directorStore.ts` |
| 元件 | `PascalCase.tsx` | `TimelineEditor.tsx` |
| Hook | `use*.ts` | `useTimelinePlayback.ts` |
| Use Case | `*UseCase.ts` | `AddClipToTrackUseCase.ts` |

---

## 附錄：參考資源

- [Blender NLA Editor 文檔](https://docs.blender.org/manual/en/latest/editors/nla/index.html)
- [React DnD 拖放函式庫](https://react-dnd.github.io/react-dnd/)
- [Framer Motion 動畫庫](https://www.framer.com/motion/)
- [Zustand 狀態管理](https://github.com/pmndrs/zustand)

---

## 📊 開發進度追蹤

> 最後更新：2025.11.28

### Phase 0：準備工作 ✅
- [x] 安裝 Zustand 狀態管理套件
- [x] 建立 director 資料夾結構與 TypeScript 類型定義
- [x] 建立 directorStore.ts (Zustand Store 骨架)

### Phase 1：基礎 UI ✅
- [x] 實作「Director」按鈕於 SceneToolbar
- [x] 實作 DirectorPanel.tsx 主面板容器
- [x] 實作 ActionSourcePanel.tsx 左側動作來源面板
- [x] 實作 TimelineEditor.tsx 與 TimelineRuler.tsx
- [x] 實作 TrackRow.tsx 軌道元件（新增/刪除功能）
- [x] 實作 ClipBlock.tsx 片段方塊
- [x] 實作 Playhead.tsx 播放頭
- [x] 實作 PlaybackControls.tsx 播放控制列
- [x] 整合 DirectorPanel 到 App.tsx
- [x] 收集模型動作來源 (actionSources)

### Phase 2：拖放功能 ✅
- [x] 實作 useDragAndDrop.ts Hook
- [x] 實作拖曳放置到軌道與幀位置計算
- [x] 實作片段軌道內/跨軌道拖曳移動
- [x] 實作即時拖曳預覽（ClipBlock 跟隨滑鼠）
- [x] 修正內部拖曳不觸發檔案上傳區域
- [x] 修正佈局：Track Header 與 Timeline 分離
- [x] 自動擴展時間軸長度

### Phase 3：播放功能 ✅
- [x] 實作 useTimelinePlayback.ts Hook
- [x] 實作 requestAnimationFrame 播放循環
- [x] 實作模型動畫同步控制（當前活躍模型）
- [x] 根據片段位置計算局部時間並更新動畫
- [x] ESC 鍵關閉 Director Mode
- [x] 進入 Director Mode 時暫停原本播放

### Phase 4：進階互動 ✅
- [x] 時間軸縮放（Ctrl+滾輪，或使用 +/- 按鈕）
- [x] 片段選取刪除、快捷鍵支援（useKeyboardShortcuts Hook）
- [x] 軌道靜音/鎖定功能與右鍵選單
- [x] 軌道重命名（雙擊或右鍵選單）
- [x] 軌道上下移動排序
- [x] 快捷鍵提示面板

### Phase 5：優化與打磨 ✅
- [x] 強化吸附功能（片段邊緣吸附、視覺指示）
- [x] 片段顏色依據模型自動區分
- [x] React.memo 效能優化（所有主要組件）
- [x] 吸附視覺反饋（琥珀色指示線）

### 測試覆蓋
| Phase | 測試數量 | 狀態 |
|-------|---------|------|
| Phase 0 | 59 tests | ✅ |
| Phase 1 | 12 tests | ✅ |
| Phase 2 | 5 tests | ✅ |
| Phase 3 | - (整合測試) | ✅ |
| Phase 4 | - (整合測試) | ✅ |
| Phase 5 | - (整合測試) | ✅ |
| **Total** | **76 tests** | ✅ |

---

## 完成摘要

### Phase 5 完成記錄 (2025-11-28)

#### 5.1 吸附功能強化
- ✅ 實現片段拖曳時自動吸附到其他片段邊緣（5幀閾值）
- ✅ 添加琥珀色視覺指示線顯示吸附點
- ✅ 片段在吸附時顯示琥珀色邊框高亮

#### 5.2 片段顏色區分
- ✅ 每個模型自動分配唯一顏色（8色循環）
- ✅ 顏色通過拖曳數據傳遞到片段
- ✅ 視覺上易於區分不同模型的動畫

#### 5.3 效能優化
- ✅ 為所有主要組件添加 `React.memo`：
  - TimelineRuler
  - Playhead
  - PlaybackControls
  - ActionSourcePanel
  - TrackRow (已有)
  - ClipBlock (已有)
- ✅ 減少不必要的重渲染，提升播放流暢度

### 額外完成功能
- ✅ Director Mode 面板高度可調整
- ✅ 軌道名稱欄位寬度可調整
- ✅ 片段名稱顯示模型前綴（模型名 - 動畫名）
- ✅ 整合音效和特效觸發功能
- ✅ 右鍵選單支持刪除動畫
- ✅ 多模型獨立播放支持

---

*此文檔將隨開發進度持續更新*

