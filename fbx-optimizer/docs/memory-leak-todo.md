# 模型切換記憶體洩漏修復計畫

> ⚠️ **此文件已過時**，請參考 [REFACTOR_STATUS.md](./REFACTOR_STATUS.md) 以獲取最新狀態。

---

## 🎯 修復策略

本專案採用**策略 B：重構為單一狀態源**，詳見 [MODEL_SWITCHING_MEMORY_FIX.md](./MODEL_SWITCHING_MEMORY_FIX.md)

---

## ✅ 已完成項目（2025-11-29）

### Phase 1: 核心 Hook 開發

1. **創建 useClipOptimizer Hook** ✅
   - 位置：`src/presentation/hooks/useClipOptimizer.ts`
   - 功能：帶快取的動畫片段優化
   - 效果：避免重複計算相同的 clip+tolerance 組合

2. **創建 useAnimationMixer Hook** ✅
   - 位置：`src/presentation/hooks/useAnimationMixer.ts`
   - 功能：封裝 Mixer 生命週期管理
   - 效果：自動清理快取，避免記憶體洩漏

3. **創建 ModelWithMixer 組件** ✅
   - 位置：`src/presentation/features/scene-viewer/components/ModelWithMixer.tsx`
   - 功能：使用新 Hook 的重構版 Model 組件
   - 效果：程式碼簡化，邏輯分離

4. **App.tsx 整合 useClipOptimizer** ✅
   - 修改：使用 `optimizeClip` 替代直接呼叫 `optimizeAnimationClip`
   - 效果：自動獲得快取功能

5. **修復 ModelPreview Mixer 清理** ✅
   - 修改：在 cleanup 中加入 `mixer.uncacheRoot(clonedModel)`
   - 效果：預覽窗口也正確釋放資源

---

## 🚧 待完成項目

### Phase 2: 狀態重構（選擇性）

6. **App.tsx 移除雙重狀態管理**
   - [ ] 移除舊 state（`model`, `originalClip` 等）
   - [ ] 所有組件直接使用 `activeModel`
   - [ ] 移除 `isSyncingRef` 同步邏輯

### Phase 3: 驗證與監控

7. **記憶體測試驗證**
   - [ ] 載入兩個模型，切換 50 次
   - [ ] 拍攝 Heap Snapshot 比較
   - [ ] 確認 AnimationMixer 數量穩定
   - [ ] 確認無 `_cacheIndex` 錯誤

8. **建立記憶體監控工具**
   - [ ] PerformanceMonitor 顯示 clip 快取大小
   - [ ] 追蹤 AnimationMixer 數量
   - [ ] 顯示 renderer.info.memory

9. **編寫自動化測試**
   - [ ] useClipOptimizer 快取測試
   - [ ] useAnimationMixer 清理測試
   - [ ] E2E 記憶體穩定性測試

---

## 📊 預期改善

| 指標 | 修復前 | 修復後 | 改善率 |
|------|--------|--------|--------|
| 切換 10 次記憶體增長 | 50-200 MB | 5-10 MB | **90%+** |
| AnimationClip 數量 | ~10 個 | ~2 個 | **80%** |
| Mixer 清理 | ❌ 不清理 | ✅ 自動清理 | **100%** |

---

## 🔗 相關文件

- **[REFACTOR_STATUS.md](./REFACTOR_STATUS.md)** - 最新實施狀態（推薦閱讀）
- **[MODEL_SWITCHING_MEMORY_FIX.md](./MODEL_SWITCHING_MEMORY_FIX.md)** - 完整修復方案
- **[MEMORY_MANAGEMENT_AUDIT.md](./MEMORY_MANAGEMENT_AUDIT.md)** - 記憶體審計報告

---

**最後更新**: 2025-11-29  
**狀態**: Phase 1 完成 ✅
