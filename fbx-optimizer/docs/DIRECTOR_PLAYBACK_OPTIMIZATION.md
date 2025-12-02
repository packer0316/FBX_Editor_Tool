# Director Mode 播放優化設計

## 🎯 快速參考

| 項目 | 內容 |
|------|------|
| **核心原則** | Director 只做「路標」，元素自主管理播放 |
| **事件類型** | 3 個核心（PlaybackStart, Stop, ClipUpdate）+ 1 個擴展（RateChange） |
| **總任務數** | 97 項（62 個 P0，30 個 P1，5 個 P2） |
| **修改檔案** | 7 個（詳見 [檔案清單](#-需要修改的檔案清單)） |
| **預估工時** | 8-12 天（P0+P1） |
| **效能提升** | 播放時減少 ~90% 事件發送 |
| **開始方式** | 從 [Phase 1](#phase-1事件系統基礎架構-) 開始 |

---

## 📋 目錄
1. [核心理念](#核心理念)
2. [播放模式](#播放模式)
3. [事件架構](#事件架構)
4. [3D 模型實現](#3d-模型實現)
5. [Spine 實現](#spine-實現)
6. [狀態機設計](#狀態機設計)
7. [完整實作 TODO List](#-完整實作-todo-list)
8. [實作路線圖](#-實作路線圖)
9. [總結](#-總結)

---

## 核心理念

### 問題分析
舊架構每幀都從 Director 發送時間更新給所有元素，造成：
- 大量事件廣播開銷
- 主線程負擔過重
- 不必要的計算

### 新設計原則
```
🎯 核心原則：讓元素自己管理自己的播放，Director 只在必要時介入
```

| 場景 | Director 行為 | 元素行為 |
|------|--------------|---------|
| 開始播放 | 發送「開始播放 X 動作」 | 自己用 delta 更新 |
| 播放中 | **什麼都不做** | 自己用 delta 更新 |
| 動作結束 | 檢測並切換下一個動作 | 等待指令 |
| 手動 Seek | 發送「跳到 X 時間」 | 設置絕對時間 |
| 暫停 | 發送「暫停」 | 停止更新 |

---

## 播放模式

### 模式 1：自然播放（Natural Playback）
```
影軌針進入 Clip 範圍
       ↓
發送 PlaybackStart 事件（帶動作名稱、起始時間）
       ↓
元素開始自己的 requestAnimationFrame / useFrame 循環
       ↓
元素自己用 mixer.update(delta) 或 adapter.update(delta)
       ↓
直到：
  • 動作自然結束（非循環模式）
  • 被下一個動作切換
  • 用戶暫停
```

### 模式 2：手動拖拉（Manual Seek）
```
用戶拖動影軌針 / 點擊時間軸
       ↓
發送 Seek 事件（帶目標幀數）
       ↓
Director 計算該幀有哪些活躍 Clips
       ↓
對每個活躍 Clip 發送 ClipUpdate 事件（帶動作名稱、局部時間）
       ↓
元素設置絕對時間（不自動播放）
```

---

## 事件架構

### 事件類型

```typescript
// 1. PlaybackStart - 告訴元素「播這個動作」
interface PlaybackStartEvent {
  modelId: string;       // 元素 ID（3D 模型或 Spine）
  animationId: string;   // 動作名稱
  startTime: number;     // 起始時間（秒）
  loop: boolean;         // 是否循環
}

// 2. PlaybackStop - 告訴元素「停止」
interface PlaybackStopEvent {
  modelId?: string;      // 元素 ID（空 = 全部停止）
}

// 3. ClipUpdate - 告訴元素「跳到這個時間」（用於 Seek）
interface ClipUpdateEvent {
  modelId: string;
  animationId: string;
  localTime: number;     // 局部時間（秒）
}
```

### 事件流程圖

```
┌─────────────────────────────────────────────────────────────────┐
│                        Director Store                           │
├─────────────────────────────────────────────────────────────────┤
│  play()        → isPlaying = true                               │
│  pause()       → isPlaying = false                              │
│  setCurrentFrame(f) → 發送 SeekEvent                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   useTimelinePlayback                           │
├─────────────────────────────────────────────────────────────────┤
│  播放時每幀只做一件事：追蹤 Clip 進入/離開                        │
│                                                                  │
│  進入 Clip → 發送 PlaybackStart（告訴元素「播這個」）             │
│  離開 Clip → 發送 PlaybackStop（告訴元素「停」）                  │
│                                                                  │
│  Seek 時 → 發送 ClipUpdate（告訴元素「跳到這裡」）                │
│                                                                  │
│  暫停/播放 → 發送 PlaybackStop / PlaybackStart                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              3D Model / Spine 元素                               │
├─────────────────────────────────────────────────────────────────┤
│  收到 PlaybackStart：                                            │
│    → 設置動作、起始時間                                          │
│    → 開始自己的動畫循環（自己管理 delta 更新）                    │
│                                                                  │
│  收到 PlaybackStop：                                             │
│    → 暫停動畫循環                                                │
│                                                                  │
│  收到 ClipUpdate：                                               │
│    → 設置絕對時間（用於 Seek）                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3D 模型實現

### 播放控制流程（簡化版）

```typescript
// 收到 PlaybackStart - 開始播放
onPlaybackStart(event) {
  // 1. 切換動畫
  if (event.animationId !== currentAnimation) {
    action = mixer.clipAction(findClip(event.animationId));
    action.reset().play();
  }
  
  // 2. 設置起始時間
  action.time = event.startTime;
  
  // 3. 設置循環模式（由元素自己處理，和非導演模式一樣）
  action.loop = event.loop ? LoopRepeat : LoopOnce;
  
  // 4. 開始播放
  action.paused = false;
  isPlayingRef.current = true;
}

// useFrame 中 - 和非導演模式一樣的播放邏輯
useFrame((_, delta) => {
  if (isPlayingRef.current) {
    mixer.update(delta);
    // 就這樣！元素自己管理播放，不需要通知 Director
  }
});

// 收到 PlaybackStop - 停止播放
onPlaybackStop(event) {
  action.paused = true;
  isPlayingRef.current = false;
}

// 收到 ClipUpdate - 設置時間（Seek 用）
onClipUpdate(event) {
  // 1. 切換動畫（如果需要）
  if (event.animationId !== currentAnimation) {
    action = mixer.clipAction(findClip(event.animationId));
  }
  
  // 2. 設置絕對時間
  action.time = event.localTime;
  action.paused = true;  // Seek 後保持暫停
  mixer.update(0);       // 強制更新骨架
}
```

---

## Spine 實現

### 播放控制流程（簡化版）

```typescript
// 收到 PlaybackStart - 開始播放
onPlaybackStart(event) {
  const adapter = getSpineRuntimeAdapter();
  
  // 1. 播放動畫（使用現有的播放邏輯）
  adapter.playAnimation(instanceId, event.animationId, event.loop);
  
  // 2. Seek 到起始時間
  adapter.seek(instanceId, event.startTime);
  
  // 3. 開始播放（使用現有的更新機制）
  isPlayingRef.current = true;
  // 元素自己管理後續更新，和非導演模式一樣
}

// 收到 PlaybackStop - 停止播放
onPlaybackStop(event) {
  adapter.pause(instanceId);
  isPlayingRef.current = false;
}

// 收到 ClipUpdate - 設置時間（Seek 用）
onClipUpdate(event) {
  // 1. 切換動畫（如果需要）
  adapter.playAnimation(instanceId, event.animationId, false);
  
  // 2. Seek 到指定時間
  adapter.seek(instanceId, event.localTime);
  
  // 3. 暫停（Seek 後不自動播放）
  adapter.pause(instanceId);
}
```

---

## 狀態機設計

### Director 狀態機

```
                    ┌─────────────┐
                    │    IDLE     │
                    │ (未播放)    │
                    └──────┬──────┘
                           │ play()
                           ▼
┌──────────────────────────────────────────────────────┐
│                     PLAYING                          │
│                                                      │
│  ┌─────────────┐    進入 Clip    ┌─────────────┐    │
│  │ Waiting for │ ───────────────→ │   Playing   │    │
│  │   Clip      │                  │    Clip     │    │
│  └─────────────┘ ←─────────────── └─────────────┘    │
│                    離開 Clip                          │
└──────────────────────────────────────────────────────┘
        │ pause()                          │ seek()
        ▼                                  ▼
┌─────────────┐                    ┌─────────────┐
│   PAUSED    │                    │   SEEKING   │
│ (暫停)      │                    │ (拖動中)    │
└─────────────┘                    └─────────────┘
```

### 元素狀態機（簡化版）

```
                    ┌─────────────┐
                    │    IDLE     │
                    │ (等待指令)  │
                    └──────┬──────┘
                           │ PlaybackStart
                           ▼
                    ┌─────────────┐
                    │   PLAYING   │ ←─┐
                    │ (自己更新)  │   │ PlaybackStart (切換動作)
                    └──────┬──────┘ ──┘
                           │
           ┌───────────────┴───────────────┐
           │                               │
           ▼                               ▼
    PlaybackStop                      ClipUpdate
           │                               │
           ▼                               ▼
    ┌─────────────┐                 ┌─────────────┐
    │   PAUSED    │                 │   SEEKING   │
    │ (暫停)      │                 │ (設置時間)  │
    └─────────────┘                 └─────────────┘

註：動作結束由元素自己處理（循環或保持最後一幀），不需要通知 Director
```

---

## 效能對比

| 項目 | 舊架構 | 新架構 |
|------|--------|--------|
| 播放時每幀事件 | ClipUpdate × N | **0** |
| 元素更新方式 | 外部控制 | **自己管理** |
| 事件發送時機 | 每幀 | 只在狀態變化時 |
| CPU 開銷 | 高 | **低** |

---

## 📝 完整實作 TODO List

> **設計原則**：
> - 🎯 **擴充性**：事件系統易於擴展，元素類型易於新增
> - 🔌 **低耦合**：Director 與元素只透過事件通訊
> - ⚡ **高效能**：最小化事件廣播，優化記憶體管理
> - ✅ **邏輯正確**：處理所有邊界情況
> - 🎬 **符合需求**：Director 只做路標，元素自主管理

---

### 📂 需要修改的檔案清單

| 優先級 | 檔案 | 修改範圍 | 說明 |
|-------|------|---------|------|
| 🔴 P0 | `directorEvents.types.ts` | 新增/修改 | 事件類型定義 |
| 🔴 P0 | `DirectorEventBus.ts` | 新增/修改 | 事件總線實現 |
| 🔴 P0 | `directorStore.ts` | 修改 | 添加播放速度、狀態追蹤 |
| 🟡 P1 | `useTimelinePlayback.ts` | 重構 | 播放控制邏輯 |
| 🟡 P1 | `SceneViewer.tsx` | 修改 | 3D 模型事件處理 |
| 🟡 P1 | `useDirectorSpineTrigger.ts` | 重構 | Spine 事件處理 |
| 🟢 P2 | `SpineElement.tsx` | 修改 | Spine 播放邏輯優化 |

---

### Phase 1：事件系統基礎架構 🔴

**目標**：建立可擴展、低耦合的事件系統

| # | 任務 | 檔案 | 優先級 | 狀態 |
|---|------|------|--------|------|
| **1.1 事件類型定義** | | | | |
| 1.1.1 | 定義 `PlaybackStartEvent` 介面（含 `modelId`, `animationId`, `startTime`, `loop`, `playbackRate`） | `directorEvents.types.ts` | P0 | ⬜ |
| 1.1.2 | 定義 `PlaybackStopEvent` 介面（含 `modelId?`，支援停止單個或全部） | `directorEvents.types.ts` | P0 | ⬜ |
| 1.1.3 | 定義 `ClipUpdateEvent` 介面（含 `modelId`, `animationId`, `localTime`） | `directorEvents.types.ts` | P0 | ⬜ |
| 1.1.4 | 定義 `PlaybackRateChangeEvent` 介面（含 `playbackRate`，支援倍速播放） | `directorEvents.types.ts` | P1 | ⬜ |
| **1.2 事件總線實現** | | | | |
| 1.2.1 | 實現 `EventBus` 類型安全的訂閱/取消訂閱機制 | `DirectorEventBus.ts` | P0 | ⬜ |
| 1.2.2 | 實現事件發送方法（`emit`），支援多訂閱者 | `DirectorEventBus.ts` | P0 | ⬜ |
| 1.2.3 | 添加事件節流機制（throttle），避免 Seek 風暴 | `DirectorEventBus.ts` | P1 | ⬜ |
| 1.2.4 | 添加記憶體清理方法（`clear`），防止記憶體洩漏 | `DirectorEventBus.ts` | P1 | ⬜ |
| **1.3 Store 狀態擴展** | | | | |
| 1.3.1 | 添加 `playbackRate` 狀態（預設 1.0） | `directorStore.ts` | P1 | ⬜ |
| 1.3.2 | 添加 `activeClips` 狀態追蹤（記錄當前活躍的 Clips） | `directorStore.ts` | P1 | ⬜ |
| 1.3.3 | 添加 `setPlaybackRate` 方法，發送 `PlaybackRateChangeEvent` | `directorStore.ts` | P1 | ⬜ |

---

### Phase 2：Director 播放控制層 🟡

**目標**：實現精確的 Clip 進入/離開檢測和狀態管理

| # | 任務 | 檔案 | 優先級 | 狀態 |
|---|------|------|--------|------|
| **2.1 清理舊邏輯** | | | | |
| 2.1.1 | 移除「播放時每幀發送 `ClipUpdate`」的邏輯 | `useTimelinePlayback.ts` | P0 | ⬜ |
| 2.1.2 | 移除對元素內部狀態的直接訪問（降低耦合） | `useTimelinePlayback.ts` | P0 | ⬜ |
| **2.2 Clip 進入/離開檢測** | | | | |
| 2.2.1 | 實現 `getActiveClipsAtFrame(frame)` 工具函數 | `useTimelinePlayback.ts` | P0 | ⬜ |
| 2.2.2 | 追蹤上一幀的活躍 Clips（`prevActiveClips`） | `useTimelinePlayback.ts` | P0 | ⬜ |
| 2.2.3 | 檢測新進入的 Clips（`newClips = current - prev`） | `useTimelinePlayback.ts` | P0 | ⬜ |
| 2.2.4 | 檢測離開的 Clips（`exitClips = prev - current`） | `useTimelinePlayback.ts` | P0 | ⬜ |
| **2.3 播放事件發送** | | | | |
| 2.3.1 | 進入 Clip 時：計算正確的 `startTime`（考慮進入時機） | `useTimelinePlayback.ts` | P0 | ⬜ |
| 2.3.2 | 進入 Clip 時：發送 `PlaybackStart`（含動作名稱、起始時間、循環、播放速度） | `useTimelinePlayback.ts` | P0 | ⬜ |
| 2.3.3 | 離開 Clip 時：發送 `PlaybackStop`（含元素 ID） | `useTimelinePlayback.ts` | P0 | ⬜ |
| **2.4 Seek 處理** | | | | |
| 2.4.1 | Seek 時：獲取目標幀的所有活躍 Clips | `useTimelinePlayback.ts` | P0 | ⬜ |
| 2.4.2 | 對每個活躍 Clip：計算局部時間（`localTime = (frame - clip.start) / fps`） | `useTimelinePlayback.ts` | P0 | ⬜ |
| 2.4.3 | 發送 `ClipUpdate` 事件（帶局部時間） | `useTimelinePlayback.ts` | P0 | ⬜ |
| 2.4.4 | Seek 事件添加節流（16ms，約 60fps），避免過度發送 | `useTimelinePlayback.ts` | P1 | ⬜ |
| **2.5 播放/暫停控制** | | | | |
| 2.5.1 | 播放（`play`）時：對所有活躍 Clips 發送 `PlaybackStart` | `useTimelinePlayback.ts` | P0 | ⬜ |
| 2.5.2 | 暫停（`pause`）時：發送 `PlaybackStop`（不帶 modelId，停止全部） | `useTimelinePlayback.ts` | P0 | ⬜ |
| 2.5.3 | 繼續播放時：從當前時間點繼續（不是從 Clip 開頭） | `useTimelinePlayback.ts` | P0 | ⬜ |

---

### Phase 3：3D 模型事件處理 🟡

**目標**：讓 3D 模型完全自主管理播放，保持與非 Director 模式一致

| # | 任務 | 檔案 | 優先級 | 狀態 |
|---|------|------|--------|------|
| **3.1 事件訂閱** | | | | |
| 3.1.1 | 在 `useEffect` 中訂閱 `playbackStart` 事件 | `SceneViewer.tsx` | P0 | ⬜ |
| 3.1.2 | 在 `useEffect` 中訂閱 `playbackStop` 事件 | `SceneViewer.tsx` | P0 | ⬜ |
| 3.1.3 | 在 `useEffect` 中訂閱 `clipUpdate` 事件 | `SceneViewer.tsx` | P0 | ⬜ |
| 3.1.4 | 在 `useEffect` 中訂閱 `playbackRateChange` 事件 | `SceneViewer.tsx` | P1 | ⬜ |
| 3.1.5 | 在 `useEffect` cleanup 中取消所有訂閱（防止記憶體洩漏） | `SceneViewer.tsx` | P0 | ⬜ |
| **3.2 PlaybackStart 處理** | | | | |
| 3.2.1 | 過濾事件：只處理 `modelId` 匹配的事件 | `SceneViewer.tsx` | P0 | ⬜ |
| 3.2.2 | 切換動畫：查找對應的 AnimationClip | `SceneViewer.tsx` | P0 | ⬜ |
| 3.2.3 | 設置循環模式：`action.loop = loop ? LoopRepeat : LoopOnce` | `SceneViewer.tsx` | P0 | ⬜ |
| 3.2.4 | 設置起始時間：`action.time = startTime` | `SceneViewer.tsx` | P0 | ⬜ |
| 3.2.5 | 設置播放速度：`action.timeScale = playbackRate` | `SceneViewer.tsx` | P1 | ⬜ |
| 3.2.6 | 開始播放：`action.paused = false` | `SceneViewer.tsx` | P0 | ⬜ |
| 3.2.7 | 動作不存在時：顯示錯誤提示，不中斷程式 | `SceneViewer.tsx` | P1 | ⬜ |
| **3.3 PlaybackStop 處理** | | | | |
| 3.3.1 | 過濾事件：處理 `modelId` 匹配或全域停止（`modelId === undefined`） | `SceneViewer.tsx` | P0 | ⬜ |
| 3.3.2 | 暫停動畫：`action.paused = true` | `SceneViewer.tsx` | P0 | ⬜ |
| 3.3.3 | 記錄暫停時間點（用於繼續播放） | `SceneViewer.tsx` | P1 | ⬜ |
| **3.4 ClipUpdate 處理（Seek）** | | | | |
| 3.4.1 | 過濾事件：只處理 `modelId` 匹配的事件 | `SceneViewer.tsx` | P0 | ⬜ |
| 3.4.2 | 切換動畫（如果需要） | `SceneViewer.tsx` | P0 | ⬜ |
| 3.4.3 | 設置絕對時間：`action.time = localTime` | `SceneViewer.tsx` | P0 | ⬜ |
| 3.4.4 | **保持播放狀態**：`action.paused = !directorStore.isPlaying` | `SceneViewer.tsx` | P0 | ⬜ |
| 3.4.5 | 強制更新骨架：`mixer.update(0)` | `SceneViewer.tsx` | P0 | ⬜ |
| **3.5 播放邏輯（無需改動）** | | | | |
| 3.5.1 | 確認 `useFrame` 中使用 `mixer.update(delta)` | `SceneViewer.tsx` | P0 | ⬜ |
| 3.5.2 | 確認播放邏輯與非 Director 模式一致 | `SceneViewer.tsx` | P0 | ⬜ |

---

### Phase 4：Spine 事件處理 🟡

**目標**：讓 Spine 完全自主管理播放，保持與非 Director 模式一致

| # | 任務 | 檔案 | 優先級 | 狀態 |
|---|------|------|--------|------|
| **4.1 事件訂閱** | | | | |
| 4.1.1 | 在 `useEffect` 中訂閱 `playbackStart` 事件 | `useDirectorSpineTrigger.ts` | P0 | ⬜ |
| 4.1.2 | 在 `useEffect` 中訂閱 `playbackStop` 事件 | `useDirectorSpineTrigger.ts` | P0 | ⬜ |
| 4.1.3 | 在 `useEffect` 中訂閱 `clipUpdate` 事件 | `useDirectorSpineTrigger.ts` | P0 | ⬜ |
| 4.1.4 | 在 `useEffect` 中訂閱 `playbackRateChange` 事件 | `useDirectorSpineTrigger.ts` | P1 | ⬜ |
| 4.1.5 | 在 `useEffect` cleanup 中取消所有訂閱 | `useDirectorSpineTrigger.ts` | P0 | ⬜ |
| **4.2 PlaybackStart 處理** | | | | |
| 4.2.1 | 過濾事件：只處理 `modelId` 匹配的事件 | `useDirectorSpineTrigger.ts` | P0 | ⬜ |
| 4.2.2 | 播放動畫：`adapter.playAnimation(instanceId, animationId, loop)` | `useDirectorSpineTrigger.ts` | P0 | ⬜ |
| 4.2.3 | Seek 到起始時間：`adapter.seek(instanceId, startTime)` | `useDirectorSpineTrigger.ts` | P0 | ⬜ |
| 4.2.4 | 設置播放速度：`adapter.setTimeScale(instanceId, playbackRate)` | `useDirectorSpineTrigger.ts` | P1 | ⬜ |
| 4.2.5 | 動作不存在時：顯示錯誤提示，不中斷程式 | `useDirectorSpineTrigger.ts` | P1 | ⬜ |
| **4.3 PlaybackStop 處理** | | | | |
| 4.3.1 | 過濾事件：處理 `modelId` 匹配或全域停止 | `useDirectorSpineTrigger.ts` | P0 | ⬜ |
| 4.3.2 | 暫停動畫：`adapter.pause(instanceId)` | `useDirectorSpineTrigger.ts` | P0 | ⬜ |
| **4.4 ClipUpdate 處理（Seek）** | | | | |
| 4.4.1 | 過濾事件：只處理 `modelId` 匹配的事件 | `useDirectorSpineTrigger.ts` | P0 | ⬜ |
| 4.4.2 | 播放動畫（如果需要切換） | `useDirectorSpineTrigger.ts` | P0 | ⬜ |
| 4.4.3 | Seek 到指定時間：`adapter.seek(instanceId, localTime)` | `useDirectorSpineTrigger.ts` | P0 | ⬜ |
| 4.4.4 | **保持播放狀態**：根據 `directorStore.isPlaying` 決定是否暫停 | `useDirectorSpineTrigger.ts` | P0 | ⬜ |
| **4.5 播放邏輯（確認無需改動）** | | | | |
| 4.5.1 | 確認使用現有的動畫更新機制（與非 Director 模式一致） | `SpineElement.tsx` | P0 | ⬜ |
| 4.5.2 | 確認播放邏輯不依賴 Director 的每幀更新 | `SpineElement.tsx` | P0 | ⬜ |

---

### Phase 5：邊界情況與錯誤處理 🟢

**目標**：處理各種邊界情況，確保邏輯正確性

| # | 任務 | 檔案 | 優先級 | 狀態 |
|---|------|------|--------|------|
| 5.1 | 處理 Clip 重疊：後面的 Clip 覆蓋前面的（或報警告） | `useTimelinePlayback.ts` | P1 | ⬜ |
| 5.2 | 處理動作不存在：顯示錯誤提示，使用 fallback 動作或保持當前動作 | `SceneViewer.tsx`, `useDirectorSpineTrigger.ts` | P1 | ⬜ |
| 5.3 | 處理元素動態卸載：確保事件監聽器被清理 | 所有組件 | P1 | ⬜ |
| 5.4 | 處理快速 Seek：事件節流，避免過度更新 | `useTimelinePlayback.ts` | P1 | ⬜ |
| 5.5 | 處理播放速度為 0：暫停播放，避免除以 0 錯誤 | 所有組件 | P2 | ⬜ |
| 5.6 | 處理負數播放速度：反向播放（如果支援） | 所有組件 | P2 | ⬜ |

---

### Phase 6：效能優化 🟢

**目標**：最大化效能，減少不必要的計算和記憶體使用

| # | 任務 | 檔案 | 優先級 | 狀態 |
|---|------|------|--------|------|
| 6.1 | 使用 `useMemo` 快取活躍 Clips 計算結果 | `useTimelinePlayback.ts` | P1 | ⬜ |
| 6.2 | 使用 `useCallback` 快取事件處理函數 | 所有組件 | P1 | ⬜ |
| 6.3 | 事件發送前檢查：是否有訂閱者（避免無用計算） | `DirectorEventBus.ts` | P2 | ⬜ |
| 6.4 | 添加性能監控：記錄事件發送次數和處理時間 | `DirectorEventBus.ts` | P2 | ⬜ |
| 6.5 | 優化 Clip 進入/離開檢測：使用 Set 替代 Array | `useTimelinePlayback.ts` | P2 | ⬜ |

---

### Phase 7：測試與驗證 ✅

**目標**：全面測試各種場景，確保功能正確性和效能

| # | 任務 | 測試場景 | 優先級 | 狀態 |
|---|------|---------|--------|------|
| **7.1 基礎播放測試** | | | | |
| 7.1.1 | 進入 Clip 時正確播放動作（從正確時間點開始） | 單個 3D 模型 | P0 | ⬜ |
| 7.1.2 | 離開 Clip 時正確停止 | 單個 3D 模型 | P0 | ⬜ |
| 7.1.3 | 循環播放由元素自己處理（不需要 Director 介入） | 單個 3D 模型 | P0 | ⬜ |
| 7.1.4 | Spine 動畫播放流暢度 | 單個 Spine | P0 | ⬜ |
| **7.2 Seek 測試** | | | | |
| 7.2.1 | 拖動進度條時正確顯示幀（時間準確） | 單個 3D 模型 | P0 | ⬜ |
| 7.2.2 | 快速拖動時不卡頓（事件節流生效） | 單個 3D 模型 | P1 | ⬜ |
| 7.2.3 | Seek 後播放狀態正確（播放中 Seek 後繼續播放） | 單個 3D 模型 | P0 | ⬜ |
| 7.2.4 | Seek 後暫停狀態正確（暫停中 Seek 後保持暫停） | 單個 3D 模型 | P0 | ⬜ |
| **7.3 播放控制測試** | | | | |
| 7.3.1 | 暫停功能正確 | 單個 3D 模型 | P0 | ⬜ |
| 7.3.2 | 繼續播放從正確時間點開始（不是從 Clip 開頭） | 單個 3D 模型 | P0 | ⬜ |
| 7.3.3 | 播放速度調整生效（0.5x, 1x, 2x） | 單個 3D 模型 | P1 | ⬜ |
| **7.4 多元素測試** | | | | |
| 7.4.1 | 多個 3D 模型同時播放不卡頓 | 5+ 個 3D 模型 | P0 | ⬜ |
| 7.4.2 | 多個 Spine 同時播放不卡頓 | 5+ 個 Spine | P0 | ⬜ |
| 7.4.3 | 3D + Spine 混合播放正常 | 混合場景 | P0 | ⬜ |
| **7.5 邊界情況測試** | | | | |
| 7.5.1 | 動作不存在時顯示錯誤，不崩潰 | 錯誤的動作名稱 | P1 | ⬜ |
| 7.5.2 | Clip 重疊時正確處理（後者覆蓋前者） | 重疊 Clips | P1 | ⬜ |
| 7.5.3 | 元素卸載時無記憶體洩漏 | 動態添加/移除元素 | P1 | ⬜ |
| **7.6 效能測試** | | | | |
| 7.6.1 | CPU 使用率下降（對比舊架構） | 10+ 元素同時播放 | P0 | ⬜ |
| 7.6.2 | 播放時事件發送次數 = 0（只在狀態變化時發送） | 播放 100 幀 | P0 | ⬜ |
| 7.6.3 | 記憶體使用穩定（無記憶體洩漏） | 長時間播放 | P1 | ⬜ |

---

## 📊 狀態與優先級說明

### 狀態符號

| 符號 | 意義 |
|------|------|
| ⬜ | 待完成 |
| 🔄 | 進行中 |
| ✅ | 已完成 |
| ❌ | 已取消/不實作 |

### 優先級定義

| 優先級 | 符號 | 說明 | 建議時程 |
|-------|------|------|---------|
| **P0** | 🔴 | **必須完成**，核心功能，無此無法運作 | 第 1 週 |
| **P1** | 🟡 | **重要功能**，影響體驗或效能 | 第 2 週 |
| **P2** | 🟢 | **優化項目**，錦上添花 | 第 3 週或更晚 |

---

## 🗺️ 實作路線圖

### 第 1 週：核心功能（P0 項目）

```
Day 1-2: Phase 1 事件系統
  ├─ 1.1.1~1.1.3 定義三個核心事件
  ├─ 1.2.1~1.2.2 實現事件總線
  └─ 測試：事件發送/訂閱正常

Day 3-4: Phase 2 播放控制
  ├─ 2.1.1~2.1.2 清理舊邏輯
  ├─ 2.2.1~2.2.4 Clip 進入/離開檢測
  ├─ 2.3.1~2.3.3 播放事件發送
  ├─ 2.4.1~2.4.3 Seek 處理
  └─ 2.5.1~2.5.3 播放/暫停控制

Day 5-6: Phase 3 + 4 元素事件處理
  ├─ 3.1~3.4 3D 模型事件處理（P0 項目）
  ├─ 4.1~4.4 Spine 事件處理（P0 項目）
  └─ 整合測試

Day 7: Phase 7 基礎測試
  ├─ 7.1 基礎播放測試
  ├─ 7.2 Seek 測試（P0 項目）
  ├─ 7.3 播放控制測試（P0 項目）
  └─ 7.6.1~7.6.2 效能測試
```

### 第 2 週：重要功能（P1 項目）

```
Day 1-2: 擴展功能
  ├─ 1.1.4 播放速度事件
  ├─ 1.2.3 事件節流
  ├─ 1.3.1~1.3.3 Store 狀態擴展
  └─ 3.2.5, 4.2.4 播放速度處理

Day 3-4: 邊界情況
  ├─ Phase 5 錯誤處理
  ├─ 3.2.7, 4.2.5 動作不存在處理
  └─ 5.1~5.4 各種邊界情況

Day 5-7: 效能優化與測試
  ├─ Phase 6 效能優化（P1 項目）
  ├─ 7.2.2 快速 Seek 測試
  ├─ 7.3.3 播放速度測試
  └─ 7.4 多元素測試
```

### 第 3 週：優化項目（P2 項目）

```
選擇性實作：
  ├─ 5.5~5.6 特殊播放速度處理
  ├─ 6.3~6.5 進階效能優化
  └─ 7.6.3 長時間記憶體測試
```

---

## 🎯 實作建議

### 建議順序

1. **先做 Phase 1 + 2**：建立事件系統和播放控制
2. **再做 Phase 3 或 4**：選一個元素類型先完成（建議 3D，因為較簡單）
3. **測試第一個元素類型**：確保邏輯正確
4. **完成另一個元素類型**：複製模式，應該很快
5. **全面測試**：Phase 7 的 P0 項目
6. **優化與擴展**：P1、P2 項目

### 關鍵注意事項

#### ⚠️ 1. Seek 後的播放狀態保持（P0）
```typescript
// ❌ 錯誤：Seek 後總是暫停
onClipUpdate(event) {
  action.time = event.localTime;
  action.paused = true;  // 錯誤！
}

// ✅ 正確：根據 Director 的狀態決定
onClipUpdate(event) {
  action.time = event.localTime;
  action.paused = !directorStore.isPlaying;  // 保持原本的播放狀態
}
```

#### ⚠️ 2. Clip 進入時的起始時間計算（P0）
```typescript
// ❌ 錯誤：總是從 0 開始
const startTime = 0;

// ✅ 正確：計算局部時間
const localFrame = currentFrame - clip.startFrame;
const startTime = localFrame / fps;
```

#### ⚠️ 3. 事件過濾（P0）
```typescript
// ✅ 每個元素必須過濾事件
directorEventBus.on('playbackStart', (event) => {
  if (event.modelId !== currentModelId) return;  // 重要！
  // 處理事件...
});
```

#### ⚠️ 4. 記憶體清理（P0）
```typescript
// ✅ 必須在 cleanup 中取消訂閱
useEffect(() => {
  const unsubStart = directorEventBus.on('playbackStart', handleStart);
  const unsubStop = directorEventBus.on('playbackStop', handleStop);
  
  return () => {
    unsubStart();
    unsubStop();
  };
}, []);
```

---

## 📈 新架構統計

### 任務統計

| Phase | P0（必須） | P1（重要） | P2（優化） | 總計 |
|-------|-----------|-----------|-----------|------|
| Phase 1 事件系統 | 5 | 6 | 0 | **11** |
| Phase 2 播放控制 | 11 | 3 | 0 | **14** |
| Phase 3 3D 模型 | 15 | 5 | 0 | **20** |
| Phase 4 Spine | 13 | 4 | 0 | **17** |
| Phase 5 邊界處理 | 0 | 4 | 2 | **6** |
| Phase 6 效能優化 | 0 | 2 | 3 | **5** |
| Phase 7 測試驗證 | 18 | 6 | 0 | **24** |
| **總計** | **62** | **30** | **5** | **97** |

### 核心指標（P0 項目）

| 指標 | 數值 | 說明 |
|------|------|------|
| 📂 修改檔案數 | **7 個** | 精確定義需要改動的檔案 |
| ⚙️ 核心任務數 | **62 個** | P0 必須完成的任務 |
| 📅 預估工時 | **5-7 天** | 一位開發者全職投入 |
| 🎯 核心事件數 | **3 個** | PlaybackStart, Stop, ClipUpdate |
| 🚀 效能提升 | **~90%** | 播放時減少 ~90% 的事件發送 |

### 架構對比

| 項目 | 舊架構 | 新架構（完整版） | 改善 |
|------|--------|---------------|------|
| **事件類型** | 2 個（ClipUpdate, Seek） | **4 個**（Start, Stop, Update, RateChange） | ✅ 更清晰 |
| **播放 100 幀** | 100 次 ClipUpdate | **0 次** | ⬇️ 100% |
| **耦合度** | 高（直接訪問元素狀態） | **低**（只透過事件） | ✅ 易擴展 |
| **錯誤處理** | 無 | **完整**（動作不存在、記憶體洩漏等） | ✅ 更穩定 |
| **效能優化** | 無 | **多重**（節流、快取、Set 優化） | ✅ 更高效 |
| **測試覆蓋** | 無系統性測試 | **24 項測試**（涵蓋各種場景） | ✅ 更可靠 |

### 不實現的功能

為了保持核心簡潔，以下功能**不在此架構中實現**：

| 功能 | 原因 | 可能性 |
|------|------|--------|
| ❌ `ClipFinish` 事件 | Director 不需要知道動作何時結束 | 未來可擴展 |
| ❌ 自動切換下一個動作 | Director 只管進入/離開 Clip | 未來可擴展 |
| ❌ 動作混合過渡 | 需要更複雜的狀態管理 | Phase 8 可選 |
| ❌ Clip 優先級系統 | 簡化為「後者覆蓋前者」 | 未來可擴展 |

---

## ⚠️ 關鍵注意事項

### 1. Seek 後的播放狀態
```typescript
// ❌ 錯誤：Seek 後直接暫停
onSeek() {
  action.paused = true;  // 問題：如果當時在播放中，應該繼續播放
}

// ✅ 正確：根據 Director 的 isPlaying 狀態決定
onSeek() {
  action.time = localTime;
  action.paused = !directorStore.isPlaying;  // 保持原本的播放狀態
}
```

### 2. Clip 進入時的起始時間
```typescript
// ❌ 錯誤：總是從 Clip 開頭播放
// Clip 範圍：幀 100-200
// 影軌針從幀 150 進入
startTime = 0;  // 錯誤！會從頭播放

// ✅ 正確：計算局部時間
const localFrame = currentFrame - clip.startFrame;
const startTime = localFrame / fps;
```

### 3. 播放速度傳遞
```typescript
// 需要確保播放速度（playbackRate）傳遞給元素
// 3D:
mixer.timeScale = playbackRate;

// Spine:
adapter.setTimeScale(instanceId, playbackRate);
```

### 4. 元素卸載時的清理
```typescript
// 必須在組件卸載時清理
useEffect(() => {
  return () => {
    // 取消訂閱
    directorEventBus.off('playbackStart', handleStart);
    directorEventBus.off('playbackStop', handleStop);
    directorEventBus.off('clipUpdate', handleUpdate);
  };
}, []);
```

---

## 📌 總結

### 核心設計理念

```
┌─────────────────────────────────────────────────────────────────┐
│                      新架構核心思想                              │
│                                                                  │
│   🎯 Director 只做「路標」，不做「引擎」                          │
│                                                                  │
│   • 進入 Clip → 告訴元素「播這個動作，從這個時間開始」            │
│   • 播放中   → 什麼都不做，讓元素自己更新                        │
│   • 離開 Clip → 告訴元素「停」                                   │
│   • Seek     → 告訴元素「跳到這個時間」                          │
│                                                                  │
│   結果：事件廣播減少 ~90%，播放流暢度大幅提升                    │
└─────────────────────────────────────────────────────────────────┘
```

### 五大設計原則實現

| 原則 | 實現方式 | 體現在 |
|------|---------|--------|
| 🎯 **擴充性** | 事件系統易於添加新類型；元素處理邏輯統一 | Phase 1 事件架構 |
| 🔌 **低耦合** | Director 與元素只透過事件通訊；元素不依賴 Director 內部狀態 | 所有 Phase |
| ⚡ **高效能** | 播放時 0 事件；事件節流；記憶體清理；快取優化 | Phase 2, 6 |
| ✅ **邏輯正確** | Seek 狀態保持；暫停續播；進入時間計算；錯誤處理 | Phase 2, 3, 4, 5 |
| 🎬 **符合需求** | Director 只發送指令；播放邏輯由元素自主管理 | 核心設計 |

### 關鍵成功因素

1. ✅ **事件驅動**：Director 和元素完全解耦
2. ✅ **狀態保持**：Seek 後保持播放/暫停狀態
3. ✅ **時間準確**：Clip 進入時計算正確的局部時間
4. ✅ **錯誤容錯**：動作不存在、記憶體洩漏等邊界情況處理
5. ✅ **效能優化**：事件節流、快取、Set 優化
6. ✅ **全面測試**：24 項測試確保品質

### 預期效果

| 指標 | 預期結果 |
|------|---------|
| 播放流暢度 | ⬆️ 顯著提升（消除每幀事件開銷） |
| CPU 使用率 | ⬇️ 降低 30-50%（減少事件處理） |
| 程式碼可維護性 | ⬆️ 提升（低耦合、職責清晰） |
| 擴展性 | ⬆️ 易於添加新元素類型 |
| 記憶體使用 | ➡️ 穩定（無洩漏） |

---

## 🚀 下一步行動

1. **閱讀此文件**：理解架構設計和 TODO List
2. **準備環境**：確保開發環境就緒
3. **開始 Phase 1**：實作事件系統（預估 1-2 天）
4. **循序漸進**：按照路線圖執行，每個 Phase 完成後測試
5. **持續優化**：完成 P0 後再考慮 P1、P2 項目

**預估總工時**：5-7 天（P0 項目）+ 3-5 天（P1 項目）= **8-12 天**

