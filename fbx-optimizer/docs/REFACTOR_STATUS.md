# 策略 B：重構為單一狀態源 - 實施狀態

## ✅ 已完成項目

### 1. 創建 useClipOptimizer Hook ✅
**檔案**: `src/presentation/hooks/useClipOptimizer.ts`

**功能**:
- 提供帶快取的動畫片段優化功能
- 使用 `clipId + tolerance` 作為快取 key
- 避免重複計算相同的 clip+tolerance 組合
- 提供 `clearCache()` 和 `getCacheSize()` 工具方法

**使用方式**:
```typescript
const { optimize } = useClipOptimizer();
const optimizedClip = optimize(originalClip, 0.01);
```

**記憶體優化**:
- 切換模型時，相同的 clip+tolerance 組合會命中快取
- 大幅減少 `Float32Array` 分配
- 降低 CPU 計算負擔

---

### 2. 創建 useAnimationMixer Hook ✅
**檔案**: `src/presentation/hooks/useAnimationMixer.ts`

**功能**:
- 封裝 Three.js AnimationMixer 生命週期管理
- 自動追蹤使用過的 clips
- 組件卸載時統一清理快取（避免 `_cacheIndex` 錯誤）
- 防禦性錯誤處理（try-catch）
- 提供完整的播放控制 API

**使用方式**:
```typescript
const {
  play,
  pause,
  seekTo,
  setAnimationTime,
  getCurrentTime,
  getDuration,
  update
} = useAnimationMixer(model, clip, {
  loop: true,
  autoPlay: true,
  initialTime: 0,
  onFinish: () => console.log('Animation finished')
});
```

**記憶體優化**:
- 在 `model` 變更時自動呼叫 `mixer.uncacheRoot(model)`
- 追蹤所有使用過的 clips，統一清理
- **不在 clip 切換時立即 uncache**（避免錯誤）

---

### 3. 創建 ModelWithMixer 組件 ✅
**檔案**: `src/presentation/features/scene-viewer/components/ModelWithMixer.tsx`

**功能**:
- 使用新的 `useAnimationMixer` Hook 的重構版 Model 組件
- 更簡潔的程式碼（相比原版減少 ~200 行）
- 自動管理 Mixer 快取
- 防禦性錯誤處理

**優勢**:
- 邏輯分離：Hook 負責 Mixer 管理，組件負責渲染
- 可測試性：Hook 可以單獨測試
- 可重用性：其他組件也可以使用 `useAnimationMixer`

---

### 4. App.tsx 整合 useClipOptimizer ✅
**修改內容**:
- 導入 `useClipOptimizer` Hook
- 將 `optimizeAnimationClip` 替換為 `optimizeClip`
- 自動獲得快取功能

**程式碼**:
```typescript
// App.tsx line ~87
const { optimize: optimizeClip } = useClipOptimizer();

// line ~607
useEffect(() => {
  if (originalClip) {
    const timer = setTimeout(() => {
      const optimized = optimizeClip(originalClip, tolerance);
      if (optimized) {
        setOptimizedClip(optimized);
      }
    }, 50);
    return () => clearTimeout(timer);
  }
}, [tolerance, originalClip, optimizeClip]);
```

---

### 5. 修復 ModelPreview Mixer 清理 ✅
**檔案**: `src/presentation/features/model-manager/components/ModelPreview.tsx`

**修改內容**:
- 在 cleanup 函數中加入 `mixer.uncacheRoot(clonedModel)`
- 確保預覽窗口的 mixer 也會正確釋放資源

**程式碼**:
```typescript
return () => {
  if (mixerRef.current && clonedModelRef.current) {
    mixerRef.current.stopAllAction();
    mixerRef.current.uncacheRoot(clonedModelRef.current);
  }
  // ... 其他清理邏輯
};
```

---

## 🚧 進行中項目

### 6. App.tsx 移除雙重狀態 🚧
**狀態**: 準備實施

**目標**:
- 移除 `App.tsx` 中的舊 state（`model`, `originalClip`, `optimizedClip` 等）
- 所有組件直接使用 `activeModel` 的資料
- 移除 `isSyncingRef` 和複雜的同步邏輯
- 簡化狀態管理流程

**影響範圍**:
- `App.tsx`（主要）
- `SceneViewer.tsx`（props 變更）
- 其他消費這些 props 的組件

**優先順序**: 高（但需要大量測試）

**風險**:
- 可能破壞現有功能
- 需要全面回歸測試

---

## 📋 待實施項目

### 7. 優化時間同步機制 ⏳
**目標**:
- 讓 `MultiModel` 直接讀取 `modelInstance.currentTime`
- 移除透過 props 傳遞 `currentTime` 再觸發 effect 的方式
- 減少不必要的 re-render

**預期效果**:
- 切換模型時不再觸發 `seekTo`
- 避免 `_cacheIndex` 錯誤
- 提升效能

---

### 8. 創建記憶體監控工具 ⏳
**目標**:
- 在 PerformanceMonitor 中顯示 `renderer.info.memory`
- 追蹤 AnimationMixer 數量
- 顯示 clip 快取大小（透過 `getCacheSize()`）

**實施**:
```typescript
// PerformanceMonitor.tsx
const clipCacheSize = useClipOptimizer().getCacheSize();

return (
  <div>
    <div>Geometries: {rendererInfo.memory.geometries}</div>
    <div>Textures: {rendererInfo.memory.textures}</div>
    <div>Clip Cache: {clipCacheSize}</div>
  </div>
);
```

---

### 9. 編寫自動化測試 ⏳
**測試項目**:
- useClipOptimizer 快取行為
- useAnimationMixer 清理機制
- 模型切換記憶體穩定性

**工具**:
- Vitest（單元測試）
- Puppeteer（E2E 測試）
- Chrome DevTools Protocol（記憶體分析）

---

## 📊 效果評估

### 預期記憶體改善
| 場景 | 修復前 | 修復後 | 改善 |
|------|--------|--------|------|
| 切換模型 10 次 | +50-200 MB | +5-10 MB | **90%+** |
| AnimationClip 數量 | ~10 個 | ~2 個 | **80%** |
| AnimationMixer 數量 | 隨切換次數增長 | = 模型數量 | **穩定** |

### 程式碼品質改善
- **可讀性**: ⭐⭐⭐⭐⭐ (原版 ⭐⭐⭐)
- **可維護性**: ⭐⭐⭐⭐⭐ (原版 ⭐⭐)
- **可測試性**: ⭐⭐⭐⭐⭐ (原版 ⭐⭐)
- **效能**: ⭐⭐⭐⭐⭐ (原版 ⭐⭐⭐)

---

## 🎯 下一步行動

### 立即可執行（Phase 1 完成）
✅ 1. 創建 useClipOptimizer Hook
✅ 2. 創建 useAnimationMixer Hook
✅ 3. 創建 ModelWithMixer 組件
✅ 4. App.tsx 整合 useClipOptimizer
✅ 5. 修復 ModelPreview Mixer 清理

### 需要測試驗證
🔍 6. 載入兩個模型，切換 50 次，觀察記憶體
🔍 7. 檢查 Chrome DevTools → Memory → Heap Snapshot
🔍 8. 確認無 `_cacheIndex` 錯誤
🔍 9. 確認所有功能正常

### 長期優化（Phase 2）
📅 10. 重構 App.tsx 雙重狀態
📅 11. 優化時間同步機制
📅 12. 建立記憶體監控
📅 13. 編寫自動化測試

---

## ⚠️ 注意事項

### 關於 Mixer 快取清理
1. **不要在 clip 切換時立即 uncache**
   - 會導致 Three.js 內部 `_cacheIndex` 錯誤
   - 應該在組件卸載時統一清理

2. **清理順序很重要**
   ```typescript
   // 正確順序
   mixer.stopAllAction();
   clips.forEach(clip => mixer.uncacheClip(clip));
   mixer.uncacheRoot(model);
   ```

3. **防禦性錯誤處理**
   - `seekTo` 和 `setAnimationTime` 用 try-catch 包裹
   - 檢查 `initializedRef` 確保 action 已準備好
   - 失敗時靜默處理，記錄 warning

### 關於快取策略
1. **useClipOptimizer 使用 Map**
   - 不會自動 GC
   - 如需自動清理，改用 WeakMap（但 key 必須是物件）

2. **快取 key 設計**
   - 使用 `clipId + tolerance` 組合
   - 確保唯一性

3. **快取清理時機**
   - 目前：手動呼叫 `clearCache()`
   - 未來：可在記憶體壓力大時自動清理

---

## 📚 相關文件

- [MODEL_SWITCHING_MEMORY_FIX.md](./MODEL_SWITCHING_MEMORY_FIX.md) - 完整修復方案
- [MEMORY_MANAGEMENT_AUDIT.md](./MEMORY_MANAGEMENT_AUDIT.md) - 記憶體審計
- [memory-leak-todo.md](./memory-leak-todo.md) - 舊版 TODO（已過時）

---

**最後更新**: 2025-11-29
**狀態**: Phase 1 完成 ✅，進入測試驗證階段

