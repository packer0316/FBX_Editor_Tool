# 🎬 Director Mode 效能優化報告

> 分析日期：2024-11-29  
> 問題類型：雙重動畫循環導致 FPS 砍半

---

## 📋 問題摘要

在 Director Mode 下，FPS 從 ~350 降至 ~175，即使只有單一模型也會發生。

### 根本原因：雙重動畫循環衝突

| 循環 | 來源 | 作用 |
|------|------|------|
| **循環 1** | Three.js `useFrame` | 每幀更新 `AnimationMixer`、渲染場景 |
| **循環 2** | Director `requestAnimationFrame` | 每幀調用 `seekTo` 強制重置動畫 |

### 具體影響

```
每幀執行流程（目前）：

┌─────────────────────────────────────────────────────────────┐
│  requestAnimationFrame (瀏覽器 ~60fps)                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────┐    ┌─────────────────────┐        │
│  │  Three.js useFrame  │    │  Director RAF Loop  │        │
│  ├─────────────────────┤    ├─────────────────────┤        │
│  │ • mixer.update()    │    │ • setCurrentFrame() │        │
│  │ • 骨骼更新          │    │ • updateModel()     │        │
│  │ • 渲染場景          │    │ • seekTo() 強制重置 │        │
│  └─────────────────────┘    └─────────────────────┘        │
│           ↓                          ↓                      │
│     動畫正常播放              動畫被強制跳轉到指定時間        │
│                                                             │
│  ❌ 結果：動畫位置被覆蓋、CPU 負擔 2x、React 狀態頻繁更新    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔍 問題代碼分析

### 1. Director 的獨立動畫循環

**檔案**：`src/presentation/features/director/hooks/useTimelinePlayback.ts`

```typescript
// 問題：獨立的 requestAnimationFrame 循環
useEffect(() => {
  if (!isPlaying) return;
  
  const animate = (currentTime: number) => {
    // 計算新幀
    let newFrame = currentFrameRef.current + frameDelta;
    
    // ❌ 每幀都觸發 React 狀態更新
    state.setCurrentFrame(frameInt);
    
    // ❌ 每幀都調用回調，導致 updateModel
    updateActiveClips(frameInt);
    
    // 繼續循環
    animationFrameRef.current = requestAnimationFrame(animate);
  };
  
  animationFrameRef.current = requestAnimationFrame(animate);
}, [isPlaying]);
```

### 2. 回調導致的連鎖反應

**檔案**：`src/App.tsx` (第 1284-1299 行)

```typescript
onUpdateModelAnimation={(modelId, animationId, localTime, localFrame) => {
  // ❌ 每幀都更新 React 狀態
  updateModel(modelId, {
    currentTime: localTime,
  });
  
  // 這會觸發 SceneViewer 重新渲染
  // → MultiModel 組件重新渲染
  // → Model 組件調用 seekTo
}
```

### 3. seekTo 與 useFrame 的衝突

**檔案**：`src/presentation/features/scene-viewer/components/SceneViewer.tsx`

```typescript
// Three.js useFrame 正在播放動畫
useFrame((_state, delta) => {
  if (mixerRef.current && isPlayingRef.current) {
    mixerRef.current.update(delta);  // 正常推進動畫
  }
});

// 同時，Director 通過 updateModel 傳入新的 currentTime
// → useEffect 監聽 currentTime 變化
// → 調用 modelRef.current.seekTo(currentTime)
// → 動畫被強制跳轉到指定時間
// ❌ 結果：動畫閃爍、不連貫
```

---

## 🎯 優化方案：Event Bus 架構

### 方案概述

**核心思想**：使用 Event Bus 解耦 SceneViewer 和 Director，讓兩者透過事件通訊，避免高耦合。

```
優化後的架構：

┌──────────────────────────────────────────────────────────────┐
│                    DirectorEventBus                          │
│                                                              │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│   │ frame:tick  │    │ frame:seek  │    │ clip:update │     │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘     │
└──────────┼──────────────────┼──────────────────┼─────────────┘
           │                  │                  │
    ┌──────┴──────┐    ┌──────┴──────┐    ┌──────┴──────┐
    │ SceneViewer │    │  Director   │    │   Model     │
    │ (emit tick) │    │ (emit seek) │    │ (subscribe) │
    │             │    │             │    │             │
    │ 不知道      │    │ 不知道      │    │ 事件驅動    │
    │ Director    │    │ Scene       │    │ 動畫更新    │
    └─────────────┘    └─────────────┘    └─────────────┘

✅ 優點：
  • 完全解耦，符合 DDD 分層原則
  • 單一動畫循環（useFrame）
  • 無 Props 穿透
  • 易於測試和擴展
```

---

## 📝 詳細實作計劃

### TODO LIST

#### Phase 1：建立 Event Bus 基礎設施（高優先級）✅ 已完成

- [x] **1.1 創建 DirectorEventBus** ✅
  - 檔案：`src/infrastructure/events/DirectorEventBus.ts`
  - 單元測試：9 tests passed

- [x] **1.2 創建 FrameEmitter 組件** ✅
  - 檔案：`src/presentation/features/scene-viewer/components/FrameEmitter.tsx`

- [x] **1.3 創建 index.ts 導出** ✅
  - 檔案：`src/infrastructure/events/index.ts`

#### Phase 2：重構 useTimelinePlayback（高優先級）✅ 已完成

- [x] **2.1 移除 requestAnimationFrame 循環** ✅
  - 改為訂閱 EventBus 的 `tick` 事件
  - SceneViewer 添加 FrameEmitter 組件

- [x] **2.2 發送 clipUpdate 事件** ✅
  - 計算活躍 clips 並發送 `clipUpdate` 事件
  - 保持向後兼容（同時調用 callback）

#### Phase 3：重構動畫更新機制（中優先級）✅ 已完成

- [x] **3.1 Model 組件訂閱 clipUpdate** ✅
  - 添加 `setAnimationTime` 方法（直接設置 action.time）
  - MultiModel 訂閱 clipUpdate 事件
  - Director Mode 下跳過 currentTime prop 觸發的 seekTo

- [x] **3.2 移除 App.tsx 中的 onUpdateModelAnimation** ✅
  - 刪除 80+ 行 callback 代碼
  - 改用 EventBus 驅動

- [x] **3.3 創建 DirectorAudioTrigger Hook** ✅
  - 檔案：`src/presentation/features/director/hooks/useDirectorAudioTrigger.ts`

- [x] **3.4 創建 DirectorEffectTrigger Hook** ✅
  - 檔案：`src/presentation/features/director/hooks/useDirectorEffectTrigger.ts`

#### Phase 4：整合與優化（低優先級）✅ 已完成

- [x] **4.1 添加 Seek 事件支援** ✅
  - Seek 已內建於 currentFrame 變化 + updateActiveClips

- [x] **4.2 節流 Store 更新** ✅
  - 已在 Phase 2 實現（只在整數幀變化時更新 store）

- [x] **4.3 添加事件類型定義** ✅
  - 檔案：`src/domain/entities/director/directorEvents.types.ts`
  - 類型移至 Domain 層，符合 DDD

---

## 🔧 實作範例

### 1.1 DirectorEventBus

```typescript
// src/infrastructure/events/DirectorEventBus.ts

export interface TickEvent {
  delta: number;  // 距離上一幀的時間（秒）
}

export interface SeekEvent {
  frame: number;  // 目標幀
}

export interface ClipUpdateEvent {
  modelId: string;
  animationId: string;
  localTime: number;
  localFrame: number;
}

type EventHandler<T> = (event: T) => void;

class DirectorEventBus {
  private tickHandlers = new Set<EventHandler<TickEvent>>();
  private seekHandlers = new Set<EventHandler<SeekEvent>>();
  private clipUpdateHandlers = new Set<EventHandler<ClipUpdateEvent>>();

  // === Tick 事件（由 SceneViewer 發送）===
  emitTick(event: TickEvent) {
    this.tickHandlers.forEach(handler => handler(event));
  }

  onTick(handler: EventHandler<TickEvent>) {
    this.tickHandlers.add(handler);
    return () => this.tickHandlers.delete(handler);
  }

  // === Seek 事件（由 Director UI 發送）===
  emitSeek(event: SeekEvent) {
    this.seekHandlers.forEach(handler => handler(event));
  }

  onSeek(handler: EventHandler<SeekEvent>) {
    this.seekHandlers.add(handler);
    return () => this.seekHandlers.delete(handler);
  }

  // === ClipUpdate 事件（由 useTimelinePlayback 發送）===
  emitClipUpdate(event: ClipUpdateEvent) {
    this.clipUpdateHandlers.forEach(handler => handler(event));
  }

  onClipUpdate(handler: EventHandler<ClipUpdateEvent>) {
    this.clipUpdateHandlers.add(handler);
    return () => this.clipUpdateHandlers.delete(handler);
  }

  // === 清理所有監聽器 ===
  clear() {
    this.tickHandlers.clear();
    this.seekHandlers.clear();
    this.clipUpdateHandlers.clear();
  }
}

// 單例模式
export const directorEventBus = new DirectorEventBus();
```

### 1.2 FrameEmitter 組件

```tsx
// src/presentation/features/scene-viewer/components/FrameEmitter.tsx

import { useFrame } from '@react-three/fiber';
import { directorEventBus } from '../../../../infrastructure/events/DirectorEventBus';

interface FrameEmitterProps {
  enabled?: boolean;  // 是否發送事件（Director Mode 時為 true）
}

export function FrameEmitter({ enabled = false }: FrameEmitterProps) {
  useFrame((_, delta) => {
    if (enabled) {
      directorEventBus.emitTick({ delta });
    }
  });
  
  return null;
}
```

### 2.1 重構後的 useTimelinePlayback

```typescript
// src/presentation/features/director/hooks/useTimelinePlayback.ts

import { useEffect, useRef } from 'react';
import { useDirectorStore } from '../../../stores/directorStore';
import { directorEventBus } from '../../../../infrastructure/events/DirectorEventBus';
import { getClipLocalTime } from '../../../../utils/director/directorUtils';

export function useTimelinePlayback() {
  const { timeline, tracks } = useDirectorStore();
  const frameRef = useRef(timeline.currentFrame);
  const lastIntFrameRef = useRef(Math.floor(timeline.currentFrame));

  // 同步外部 currentFrame 變化（如 seek）
  useEffect(() => {
    frameRef.current = timeline.currentFrame;
    lastIntFrameRef.current = Math.floor(timeline.currentFrame);
  }, [timeline.currentFrame]);

  // 訂閱 tick 事件
  useEffect(() => {
    if (!timeline.isPlaying) return;

    const unsubscribe = directorEventBus.onTick(({ delta }) => {
      const state = useDirectorStore.getState();
      const { fps, totalFrames, isLooping } = state.timeline;

      // 計算新幀
      let newFrame = frameRef.current + delta * fps;

      // 處理循環/結束
      if (newFrame >= totalFrames) {
        if (isLooping) {
          newFrame = newFrame % totalFrames;
        } else {
          state.pause();
          return;
        }
      }

      frameRef.current = newFrame;

      // 只在整數幀變化時更新 store
      const frameInt = Math.floor(newFrame);
      if (frameInt !== lastIntFrameRef.current) {
        lastIntFrameRef.current = frameInt;
        state.setCurrentFrame(frameInt);
      }

      // 發送 clipUpdate 事件
      for (const track of state.tracks) {
        if (track.isMuted) continue;
        for (const clip of track.clips) {
          const result = getClipLocalTime(newFrame, clip, fps);
          if (result.isActive && result.localTime !== null) {
            directorEventBus.emitClipUpdate({
              modelId: clip.sourceModelId,
              animationId: clip.sourceAnimationId,
              localTime: result.localTime,
              localFrame: Math.floor(result.localTime * fps),
            });
          }
        }
      }
    });

    return unsubscribe;
  }, [timeline.isPlaying]);
}
```

### 3.1 Model 訂閱 clipUpdate

```tsx
// 在 Model 組件內

useEffect(() => {
  if (!isDirectorMode) return;

  const unsubscribe = directorEventBus.onClipUpdate((event) => {
    // 檢查是否為當前模型
    if (event.modelId !== modelId) return;
    
    // 找到對應的 action
    const action = actionsRef.current.get(event.animationId);
    if (action) {
      // 直接設置時間，不調用 seekTo
      action.time = event.localTime;
      mixerRef.current?.update(0);
    }
  });

  return unsubscribe;
}, [isDirectorMode, modelId]);

---

## 📊 預期效能提升

| 指標 | 優化前 | 優化後 | 提升 |
|------|--------|--------|------|
| FPS | ~175 | ~350+ | **+100%** |
| CPU 使用率 | 高 | 正常 | **-50%** |
| React 重渲染 | 每幀 | 僅整數幀變化 | **-90%** |
| 動畫流暢度 | 閃爍 | 流暢 | ✅ |
| 耦合度 | 高 | 低 | ✅ |
| 可測試性 | 困難 | 容易 | ✅ |

---

## 🏗️ 架構優勢

### 解耦效果

| 組件 | 優化前依賴 | 優化後依賴 |
|------|------------|------------|
| SceneViewer | Director Store, Callbacks | EventBus (僅發送) |
| Director | SceneViewer Ref, Model Ref | EventBus (僅訂閱) |
| Model | Props, isDirectorMode | EventBus (僅訂閱) |
| App.tsx | 串接所有 | 初始化 EventBus |

### 符合 DDD 分層

```
src/
├── infrastructure/
│   └── events/
│       └── DirectorEventBus.ts    ← 新增（基礎設施層）
├── presentation/
│   ├── features/
│   │   ├── director/
│   │   │   └── hooks/
│   │   │       └── useTimelinePlayback.ts  ← 重構
│   │   └── scene-viewer/
│   │       └── components/
│   │           └── FrameEmitter.tsx        ← 新增
```

---

## 🧪 測試計劃

### 效能測試

1. 載入單一模型，進入 Director Mode
2. 播放動畫，記錄 FPS
3. 載入多個模型，重複測試
4. 確認 FPS 接近非 Director Mode

### 功能測試

1. Director Mode 播放/暫停功能
2. 時間軸拖曳定位
3. 多模型同時播放
4. 音效/特效觸發時機

### 單元測試

```typescript
// DirectorEventBus.test.ts
describe('DirectorEventBus', () => {
  it('should emit and receive tick events', () => {
    const handler = vi.fn();
    directorEventBus.onTick(handler);
    directorEventBus.emitTick({ delta: 0.016 });
    expect(handler).toHaveBeenCalledWith({ delta: 0.016 });
  });

  it('should unsubscribe correctly', () => {
    const handler = vi.fn();
    const unsubscribe = directorEventBus.onTick(handler);
    unsubscribe();
    directorEventBus.emitTick({ delta: 0.016 });
    expect(handler).not.toHaveBeenCalled();
  });
});
```

---

## 📅 實施時程

| Phase | 任務 | 預估時間 | 優先級 | 狀態 |
|-------|------|----------|--------|------|
| Phase 1 | Event Bus 基礎設施 | 1 小時 | 🔴 高 | ✅ 完成 |
| Phase 2 | 重構 useTimelinePlayback | 1.5 小時 | 🔴 高 | ✅ 完成 |
| Phase 3 | 重構動畫更新機制 | 2.5 小時 | 🟠 中 | ✅ 完成 |
| Phase 4 | 整合與優化 | 1 小時 | 🟡 低 | ✅ 完成 |

**總計**：約 6 小時

**建議**：
1. Phase 1 + 2 完成後即可測試效能提升
2. Phase 3 完成後可移除舊的 callback 機制
3. Phase 4 為進階優化，可視需求實施

---

## 🔗 相關檔案

### 需新增
- `src/infrastructure/events/DirectorEventBus.ts` - Event Bus 核心
- `src/infrastructure/events/index.ts` - 統一導出
- `src/presentation/features/scene-viewer/components/FrameEmitter.tsx` - 幀事件發送器
- `src/presentation/features/director/hooks/useDirectorAudioTrigger.ts` - 音效觸發 Hook
- `src/presentation/features/director/hooks/useDirectorEffectTrigger.ts` - 特效觸發 Hook

### 需修改
- `src/presentation/features/director/hooks/useTimelinePlayback.ts` - 移除 RAF，改用 EventBus
- `src/presentation/features/scene-viewer/components/SceneViewer.tsx` - 添加 FrameEmitter、訂閱事件
- `src/App.tsx` - 移除 onUpdateModelAnimation callback

### 可刪除（Phase 3 完成後）
- `onUpdateModelAnimation` callback 及相關邏輯

