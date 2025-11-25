# Effekseer 整合問題排查

## 當前問題

### texImage2D 錯誤（持續出現）

**錯誤訊息**：
```
Uncaught TypeError: Failed to execute 'texImage2D' on 'WebGLRenderingContext': Overload resolution failed.
at EffekseerEffect._reload
```

**已嘗試的解決方案**：
1. ✗ 使用 Blob URL + redirect
2. ✗ 使用 Data URI + redirect  
3. ✗ 預載入圖片並轉換為 Data URI
4. ✗ 將圖片儲存為 HTMLImageElement 快取
5. ✗ 嘗試註冊到 Module.resourcesMap（無法存取內部變數）

**問題分析**：
- 錯誤持續出現在 `_reload` 階段
- 所有資源載入方式都已嘗試
- 圖片已完全載入並驗證（有尺寸資訊）
- 問題很可能是 Effekseer WebGL Runtime 本身的 bug 或版本問題

## 建議解決方案

### 方案 1：更新 Effekseer Runtime（推薦）

從官方 GitHub 下載最新版本：
```
https://github.com/effekseer/EffekseerForWebGL/releases
```

步驟：
1. 下載最新的 `effekseer.min.js` 和 `effekseer.wasm`
2. 替換 `public/effekseer/` 下的檔案
3. 重新測試

### 方案 2：使用 .efkpkg Package 格式

Effekseer 官方推薦在 WebGL 中使用 Package 格式：

1. 在 Effekseer Editor 中開啟專案
2. 選擇 File → Export → Package (for Web)
3. 匯出為 `.efkpkg` 檔案
4. 修改 loader 使用 `loadEffectPackage()` API

優點：
- 所有資源打包在一起
- Effekseer 自動處理資源映射
- 避免路徑對應問題

### 方案 3：改用其他特效庫

考慮使用 Three.js 生態系統的特效庫：

**three-nebula**（粒子系統）：
```bash
npm install three-nebula
```

**@react-three/drei**（內建特效組件）：
```tsx
import { Sparkles } from '@react-three/drei'

<Sparkles 
  count={100}
  scale={10}
  size={2}
  speed={0.4}
/>
```

優點：
- 與 React Three Fiber 無縫整合
- 不需要額外的 WebGL Context
- 更好的 TypeScript 支援

### 方案 4：暫時跳過特效功能

先完成其他功能開發，待 Effekseer 官方修復或釋出新版本後再整合。

## 相關資源

- [Effekseer 官方網站](https://effekseer.github.io/)
- [EffekseerForWebGL GitHub](https://github.com/effekseer/EffekseerForWebGL)
- [Three.js 粒子系統文件](https://threejs.org/docs/#api/en/objects/Points)
- [@react-three/drei 文件](https://github.com/pmndrs/drei)

## 開發紀錄

**Phase 1-5 狀態**：部分完成
- ✓ Effekseer Runtime 初始化成功
- ✓ UI 載入介面完成
- ✗ .efk 散檔載入失敗（texImage2D 錯誤）
- ⏳ 待測試 .efkpkg 格式
- ⏳ 待測試其他特效庫

**最後更新**：2024


