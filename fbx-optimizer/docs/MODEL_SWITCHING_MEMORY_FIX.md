# 模型切換記憶體洩漏完整修復方案

## 🔍 根本原因分析

### 問題 1：雙重狀態管理導致的複雜性
**現況**：
- `App.tsx` 維護兩套狀態：
  1. **新系統**：`useModelsManager()` 返回的 `Map<string, ModelInstance>`
  2. **舊系統**：單一模型的 `useState`（`model`, `originalClip`, `optimizedClip` 等）
  
- 當切換活動模型時，透過 `useEffect` 將 `activeModel` 的資料同步到舊狀態
- 這導致大量不必要的 state 更新和重新計算

**根本問題**：
```typescript
// App.tsx line 471-514
useEffect(() => {
  if (activeModel && !isSyncingRef.current) {
    isSyncingRef.current = true;
    setOriginalClip(activeModel.originalClip);  // ← 觸發優化計算
    setOptimizedClip(activeModel.optimizedClip);
    setCurrentTime(activeModel.currentTime);    // ← 觸發 MultiModel seekTo
    // ... 等 10+ 個 state 更新
  }
}, [activeModelId]);

// 然後觸發
useEffect(() => {
  if (originalClip) {
    const optimized = optimizeAnimationClip(originalClip, tolerance);
    setOptimizedClip(optimized);  // ← 創建新的 AnimationClip！
  }
}, [tolerance, originalClip]);  // ← originalClip 變了就重算
```

### 問題 2：AnimationMixer 快取機制
**Three.js 行為**：
- `mixer.clipAction(clip)` 會將 clip 快取在 `mixer._actions` 中
- 快取 key 包含 clip 和 target object 的內部索引
- 即使 `action.stop()`，快取仍然保留
- 只有呼叫 `uncacheClip()` / `uncacheRoot()` 才會釋放

**當前問題**：
- 每次切換模型都創建新的 `optimizedClip`
- 舊 clip 留在 mixer 快取中
- 記憶體快照顯示大量 `AnimationMixer`、`QuaternionKeyframeTrack`、`Float32Array`

### 問題 3：時間同步觸發 seekTo 的時機問題
**執行流程**：
1. 用戶點擊模型卡片 → `setActiveModelId(newId)`
2. `App.tsx` useEffect 觸發 → `setCurrentTime(activeModel.currentTime)`
3. `MultiModel` useEffect 觸發 → `modelRef.current?.seekTo(currentTime)`
4. 此時 `Model` 組件正在切換 clip，`actionRef.current` 可能：
   - 指向舊的已被 stop 的 action
   - 或是 clip 剛變更，新 action 還沒建立
5. `seekTo` 內部呼叫 `play()` → `_cacheIndex` 錯誤

### 問題 4：ModelPreview 也有相同問題
- `ModelPreview.tsx` 創建克隆模型和獨立 mixer
- 也沒有清理 mixer 快取
- 每次展開/收合預覽都會洩漏記憶體

---

## 🎯 完整解決方案

### 策略 A：保持雙狀態架構（最小改動）

#### A1. 優化 Clip 快取機制
**目標**：切換模型時沿用已有的 `optimizedClip`，只在必要時重新計算

```typescript
// App.tsx
const clipOptimizeCacheRef = useRef<Map<string, IdentifiableClip>>(new Map());

useEffect(() => {
  if (!originalClip) return;

  const clipId = getClipId(originalClip);
  const cacheKey = `${clipId}-${tolerance}`;

  // 1. 先檢查快取
  const cached = clipOptimizeCacheRef.current.get(cacheKey);
  if (cached) {
    setOptimizedClip(cached);
    return;
  }

  // 2. 檢查 activeModel 是否已有相同結果
  if (activeModel?.optimizedClip && 
      getClipId(activeModel.optimizedClip) === clipId &&
      activeModel.tolerance === tolerance) {
    clipOptimizeCacheRef.current.set(cacheKey, activeModel.optimizedClip);
    setOptimizedClip(activeModel.optimizedClip);
    return;
  }

  // 3. 真的需要才計算
  const timer = setTimeout(() => {
    const optimized = optimizeAnimationClip(originalClip, tolerance);
    clipOptimizeCacheRef.current.set(cacheKey, optimized);
    setOptimizedClip(optimized);
  }, 50);

  return () => clearTimeout(timer);
}, [tolerance, originalClip, activeModel]);
```

#### A2. 修復時間同步的競態條件
**問題**：`setCurrentTime` 觸發 `seekTo` 時，clip 可能還在切換中

**解決方案**：延遲時間同步，等待 clip 切換完成

```typescript
// App.tsx - 同步活動模型狀態
useEffect(() => {
  if (activeModel && !isSyncingRef.current) {
    isSyncingRef.current = true;
    
    // 立即同步不會觸發其他 effect 的狀態
    setFile(activeModel.file);
    setModel(activeModel.model);
    setMeshNames(activeModel.meshNames);
    // ...
    
    // 延遲同步時間相關狀態，等待 clip 準備好
    requestAnimationFrame(() => {
      setIsPlaying(activeModel.isPlaying);
      setDuration(activeModel.duration);
      setIsLoopEnabled(activeModel.isLoopEnabled);
      
      // 最後才設置 currentTime，確保 clip 已經載入
      setTimeout(() => {
        setCurrentTime(activeModel.currentTime);
        isSyncingRef.current = false;
      }, 100);
    });
  }
}, [activeModelId]);
```

#### A3. AnimationMixer 快取清理（安全版本）
**策略**：只在組件完全卸載時清理，不在 clip 切換時清理

```typescript
// SceneViewer.tsx - Model 組件
const Model = forwardRef<ModelRef, ModelProps>(({ ... }) => {
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionRef = useRef<THREE.AnimationAction | null>(null);
  
  // 追蹤使用過的 clips
  const usedClipsRef = useRef<THREE.AnimationClip[]>([]);
  
  useEffect(() => {
    if (model) {
      mixerRef.current = new THREE.AnimationMixer(model);
    }
    
    return () => {
      // 組件卸載時統一清理
      const mixer = mixerRef.current;
      if (mixer && model) {
        mixer.stopAllAction();
        
        // 清理所有使用過的 clips
        usedClipsRef.current.forEach(clip => {
          try {
            mixer.uncacheClip(clip);
          } catch (e) {
            // 忽略已經被清理的錯誤
          }
        });
        
        // 清理整個模型
        mixer.uncacheRoot(model);
      }
      mixerRef.current = null;
      usedClipsRef.current = [];
    };
  }, [model]);
  
  // 當使用新 clip 時記錄
  useEffect(() => {
    if (clip && !usedClipsRef.current.includes(clip)) {
      usedClipsRef.current.push(clip);
    }
  }, [clip]);
  
  // 修復 seekTo：增加防禦性檢查
  useImperativeHandle(ref, () => ({
    seekTo: (time: number) => {
      if (!actionRef.current || !mixerRef.current) return;
      
      try {
        actionRef.current.time = time;
        const wasPaused = actionRef.current.paused;
        actionRef.current.paused = false;
        mixerRef.current.update(0.001);
        actionRef.current.paused = wasPaused;
      } catch (e) {
        console.warn('[Model] seekTo failed:', e);
        // 失敗時不拋出錯誤，避免崩潰
      }
    },
    // ...
  }));
});
```

#### A4. ModelPreview 記憶體清理
```typescript
// ModelPreview.tsx - ModelRenderer 組件
useEffect(() => {
  // ... 克隆模型和創建 mixer 的邏輯 ...
  
  return () => {
    // 清理 mixer 快取
    if (mixerRef.current) {
      mixerRef.current.stopAllAction();
      if (clonedModelRef.current) {
        mixerRef.current.uncacheRoot(clonedModelRef.current);
      }
    }
    
    // 清理克隆的資源
    if (clonedModelRef.current) {
      clonedModelRef.current.traverse((child) => {
        if ((child as any).geometry) {
          (child as any).geometry.dispose();
        }
        if ((child as any).material) {
          const material = (child as any).material;
          if (Array.isArray(material)) {
            material.forEach(m => m.dispose());
          } else {
            material.dispose();
          }
        }
      });
    }
  };
}, [model]);
```

---

### 策略 B：重構為單一狀態源（推薦，長期方案）

#### B1. 移除舊狀態系統
**目標**：所有狀態都存在 `ModelInstance` 中，移除 `App.tsx` 的重複 state

```typescript
// App.tsx - 簡化後
function App() {
  const { models, activeModel, activeModelId, setActiveModelId, updateModel } = useModelsManager();
  const sceneViewerRef = useRef<SceneViewerRef>(null);
  
  // 只保留全域設置
  const [isLoading, setIsLoading] = useState(false);
  const [themeMode, setThemeMode] = useState('dark');
  // ...
  
  // 直接使用 activeModel 的資料，不再同步到 local state
  const handleTimeUpdate = useCallback((time: number) => {
    if (activeModelId) {
      updateModel(activeModelId, { currentTime: time });
    }
  }, [activeModelId, updateModel]);
  
  // 渲染時直接使用 activeModel
  return (
    <SceneViewer
      models={models}
      activeModelId={activeModelId}
      onTimeUpdate={handleTimeUpdate}
      // ...
    />
  );
}
```

#### B2. 創建 useClipOptimizer Hook
**封裝優化邏輯**，避免重複計算

```typescript
// presentation/hooks/useClipOptimizer.ts
export function useClipOptimizer() {
  const cacheRef = useRef<Map<string, IdentifiableClip>>(new Map());
  
  const optimize = useCallback((
    clip: IdentifiableClip | null, 
    tolerance: number
  ): IdentifiableClip | null => {
    if (!clip) return null;
    
    const clipId = getClipId(clip);
    const cacheKey = `${clipId}-${tolerance}`;
    
    const cached = cacheRef.current.get(cacheKey);
    if (cached) return cached;
    
    const optimized = optimizeAnimationClip(clip, tolerance);
    cacheRef.current.set(cacheKey, optimized);
    return optimized;
  }, []);
  
  return { optimize };
}
```

#### B3. 創建 useAnimationMixer Hook
**封裝 Mixer 生命週期管理**

```typescript
// presentation/hooks/useAnimationMixer.ts
export function useAnimationMixer(
  model: THREE.Group | null,
  clip: THREE.AnimationClip | null,
  options: {
    loop?: boolean;
    autoPlay?: boolean;
    initialTime?: number;
  }
) {
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionRef = useRef<THREE.AnimationAction | null>(null);
  const usedClipsRef = useRef<THREE.AnimationClip[]>([]);
  
  // 創建 mixer
  useEffect(() => {
    if (!model) return;
    
    const mixer = new THREE.AnimationMixer(model);
    mixerRef.current = mixer;
    
    return () => {
      // 清理所有快取
      usedClipsRef.current.forEach(clip => {
        try { mixer.uncacheClip(clip); } catch {}
      });
      mixer.uncacheRoot(model);
      mixerRef.current = null;
      usedClipsRef.current = [];
    };
  }, [model]);
  
  // 管理 clip
  useEffect(() => {
    if (!mixerRef.current || !clip) return;
    
    const action = mixerRef.current.clipAction(clip);
    usedClipsRef.current.push(clip);
    
    action.setLoop(
      options.loop ? THREE.LoopRepeat : THREE.LoopOnce,
      options.loop ? Infinity : 1
    );
    
    if (options.initialTime !== undefined) {
      action.time = options.initialTime;
    }
    
    if (options.autoPlay) {
      action.play();
    }
    
    actionRef.current = action;
    
    return () => {
      action.stop();
      actionRef.current = null;
    };
  }, [clip, options.loop, options.autoPlay, options.initialTime]);
  
  return {
    mixer: mixerRef.current,
    action: actionRef.current,
    seekTo: (time: number) => {
      if (actionRef.current) {
        actionRef.current.time = time;
      }
    }
  };
}
```

---

## 📋 完整實施計畫

### Phase 1：緊急修復（1-2 小時）
✅ **目標**：停止記憶體洩漏，保持現有功能正常運作

1. **App.tsx：加入 Clip 優化快取**
   - [ ] 加入 `clipOptimizeCacheRef`
   - [ ] 修改 `tolerance/originalClip` effect，先檢查快取和 activeModel
   - [ ] 避免重複計算相同的 clip+tolerance 組合

2. **SceneViewer.tsx：安全的 Mixer 清理**
   - [ ] 在 `Model` 組件的 model effect cleanup 中加入 `uncacheRoot`
   - [ ] 追蹤使用過的 clips，在組件卸載時統一清理
   - [ ] **不在 clip 切換時呼叫 uncache**（會導致 _cacheIndex 錯誤）

3. **SceneViewer.tsx：防禦性 seekTo**
   - [ ] 在 `seekTo` 中用 try-catch 包裹可能失敗的操作
   - [ ] 檢查 `initializedRef` 確保 action 已準備好
   - [ ] 失敗時靜默處理，不拋出錯誤

4. **ModelPreview.tsx：補充 Mixer 清理**
   - [ ] 在 cleanup 中加入 `mixer.uncacheRoot(clonedModel)`

### Phase 2：架構優化（3-5 小時）
🎯 **目標**：簡化狀態管理，降低複雜度

5. **移除雙重狀態同步**
   - [ ] 移除 `App.tsx` 中的舊 state（`model`, `originalClip` 等）
   - [ ] 所有組件直接使用 `activeModel` 的資料
   - [ ] 移除 `isSyncingRef` 和複雜的同步邏輯

6. **創建 useClipOptimizer Hook**
   - [ ] 封裝優化邏輯和快取管理
   - [ ] 提供 `optimize(clip, tolerance)` 方法
   - [ ] 內建防重複計算機制

7. **優化時間同步機制**
   - [ ] 讓 `MultiModel` 直接讀取 `modelInstance.currentTime`
   - [ ] 移除透過 props 傳遞 `currentTime` 再觸發 effect 的方式
   - [ ] 減少不必要的 re-render

### Phase 3：記憶體監控（1-2 小時）
📊 **目標**：建立長期監控機制

8. **開發環境記憶體監控**
   - [ ] 在 PerformanceMonitor 中顯示 `renderer.info.memory`
   - [ ] 追蹤 AnimationMixer 數量（透過全域 WeakSet）
   - [ ] 顯示 clip 快取大小

9. **自動化測試**
   - [ ] 編寫記憶體洩漏測試（Vitest + Puppeteer）
   - [ ] 模擬切換模型 100 次，檢查記憶體增長
   - [ ] CI/CD 整合

---

## 🚀 立即執行步驟（Phase 1）

### Step 1: 修復 App.tsx Clip 優化
```typescript
// 在 App.tsx 頂部加入
const clipOptimizeCacheRef = useRef<Map<string, IdentifiableClip>>(new Map());

// 替換現有的 tolerance effect
useEffect(() => {
  if (!originalClip) return;

  const clipId = getClipId(originalClip);
  const cacheKey = `${clipId}-${tolerance}`;
  const cached = clipOptimizeCacheRef.current.get(cacheKey);

  if (cached) {
    setOptimizedClip(cached);
    return;
  }

  if (activeModel?.optimizedClip && 
      getClipId(activeModel.optimizedClip) === clipId &&
      activeModel.tolerance === tolerance) {
    clipOptimizeCacheRef.current.set(cacheKey, activeModel.optimizedClip);
    setOptimizedClip(activeModel.optimizedClip);
    return;
  }

  const timer = setTimeout(() => {
    const optimized = optimizeAnimationClip(originalClip, tolerance) as IdentifiableClip;
    clipOptimizeCacheRef.current.set(cacheKey, optimized);
    setOptimizedClip(optimized);
  }, 50);

  return () => clearTimeout(timer);
}, [tolerance, originalClip, activeModel]);
```

### Step 2: 延遲時間同步
```typescript
// App.tsx - 修改同步 effect
useEffect(() => {
  if (activeModel && !isSyncingRef.current) {
    isSyncingRef.current = true;
    
    // 立即同步基本資料
    setFile(activeModel.file);
    setModel(activeModel.model);
    setMeshNames(activeModel.meshNames);
    setShaderGroups(activeModel.shaderGroups);
    setIsShaderEnabled(activeModel.isShaderEnabled);
    setOriginalClip(activeModel.originalClip);
    setMasterClip(activeModel.masterClip);
    setOptimizedClip(activeModel.optimizedClip);
    setCreatedClips(activeModel.createdClips);
    setTolerance(activeModel.tolerance);
    setAudioTracks(activeModel.audioTracks);
    setEffects(activeModel.effects);
    setIsPlaying(activeModel.isPlaying);
    setDuration(activeModel.duration);
    setIsLoopEnabled(activeModel.isLoopEnabled);

    // 延遲設置 currentTime，等待 clip 初始化完成
    setTimeout(() => {
      setCurrentTime(activeModel.currentTime);
      isSyncingRef.current = false;
    }, 150);
  }
}, [activeModelId]);
```

### Step 3: 安全的 seekTo
```typescript
// SceneViewer.tsx - Model 組件
seekTo: (time: number) => {
  if (!actionRef.current || !mixerRef.current) return;
  
  try {
    actionRef.current.time = time;
    
    if (model) {
      model.userData.animationTime = time;
    }
    
    const wasPaused = actionRef.current.paused;
    actionRef.current.paused = false;
    mixerRef.current.update(0.001);
    actionRef.current.paused = wasPaused;
  } catch (error) {
    // 靜默處理錯誤，避免崩潰
    console.warn('[Model.seekTo] Error:', error);
  }
},
```

### Step 4: Mixer 清理
```typescript
// SceneViewer.tsx - Model 組件
const usedClipsRef = useRef<THREE.AnimationClip[]>([]);

useEffect(() => {
  if (model) {
    mixerRef.current = new THREE.AnimationMixer(model);
  }
  
  return () => {
    const mixer = mixerRef.current;
    if (mixer && model) {
      mixer.stopAllAction();
      
      usedClipsRef.current.forEach(clip => {
        try {
          mixer.uncacheClip(clip);
        } catch {}
      });
      
      mixer.uncacheRoot(model);
    }
    mixerRef.current = null;
    usedClipsRef.current = [];
  };
}, [model]);

// 記錄使用過的 clips
useEffect(() => {
  if (clip && !usedClipsRef.current.includes(clip)) {
    usedClipsRef.current.push(clip);
  }
}, [clip]);
```

### Step 5: ModelPreview 清理
```typescript
// ModelPreview.tsx line 147-167
return () => {
  if (mixerRef.current && clonedModelRef.current) {
    mixerRef.current.stopAllAction();
    mixerRef.current.uncacheRoot(clonedModelRef.current);
  }
  
  if (clonedModelRef.current) {
    clonedModelRef.current.traverse((child) => {
      // ... 現有的清理邏輯
    });
  }
};
```

---

## ⚠️ 關鍵注意事項

### 1. 不要在 clip 切換時立即 uncache
❌ **錯誤做法**：
```typescript
useEffect(() => {
  if (clip) {
    if (actionRef.current) {
      // 立即清理舊 clip
      const oldClip = actionRef.current.getClip();
      mixerRef.current?.uncacheClip(oldClip);  // ← 會導致 _cacheIndex 錯誤
    }
    const action = mixerRef.current.clipAction(clip);
  }
}, [clip]);
```

✅ **正確做法**：
```typescript
// 只在組件卸載時統一清理
useEffect(() => {
  return () => {
    usedClipsRef.current.forEach(clip => {
      mixer.uncacheClip(clip);
    });
  };
}, [model]);
```

### 2. 時間同步要等待 clip 準備好
- 切換模型時，`currentTime` 的設置要延遲到 clip 初始化完成後
- 使用 `setTimeout` 或 `requestAnimationFrame` 延遲執行

### 3. seekTo 要有防禦性錯誤處理
- 用 try-catch 包裹
- 檢查 action 是否已初始化
- 失敗時靜默處理，記錄 warning

### 4. ModelPreview 也要清理
- 不要忘記預覽窗口的 mixer
- 每次 model 變更都會創建新的克隆和 mixer

---

## 🧪 驗證清單

### 記憶體測試步驟
1. 開啟 Chrome DevTools → Performance → Memory
2. 載入兩個不同的 FBX 模型
3. 拍攝 Heap Snapshot 1
4. 來回點擊兩個模型卡片 50 次
5. 強制 GC（垃圾回收）
6. 拍攝 Heap Snapshot 2
7. 比較兩個快照：
   - `AnimationMixer` 數量應該 ≤ 2（每個模型一個）
   - `AnimationClip` 數量應該穩定（不隨切換次數增長）
   - `Float32Array` 不應該線性增長

### 功能測試清單
- [ ] 載入模型正常
- [ ] 切換模型卡片正常
- [ ] 動畫播放正常
- [ ] 時間軸拖動正常
- [ ] Shader 切換正常
- [ ] 音效觸發正常
- [ ] 特效觸發正常
- [ ] Director Mode 正常
- [ ] 模型預覽正常
- [ ] 無控制台錯誤

---

## 📊 預期效果

### 修復前
- 切換模型 10 次 → 創建 10 個 AnimationClip（每個約 1-5 MB）
- 記憶體持續增長 50-200 MB
- AnimationMixer 數量 = 切換次數

### 修復後
- 切換模型 10 次 → 重用現有 clip（快取命中）
- 記憶體穩定，僅微量波動（< 10 MB）
- AnimationMixer 數量 = 模型數量（2-3 個）

---

## 🔄 後續優化方向

1. **WeakMap 快取**：使用 WeakMap 替代 Map，自動 GC
2. **Clip 池化**：預先計算常用 tolerance 值的 clip
3. **懶載入**：只在需要時才優化 clip
4. **Worker 優化**：將 optimizeAnimationClip 移到 Web Worker
5. **虛擬化列表**：模型數量多時使用虛擬滾動


