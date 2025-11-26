# WASD 鍵盤相機控制功能 - 實現總結

## ✅ 實現狀態：已完成

### 📦 新增文件

1. **`src/presentation/features/scene-viewer/hooks/useKeyboardCameraControls.ts`**
   - 自定義 React Hook，追蹤 WASD/QE/Shift 按鍵狀態
   - 處理鍵盤事件（keydown/keyup/blur）
   - 自動過濾輸入框內的按鍵事件
   - 視窗失焦時重置按鍵狀態

2. **`src/presentation/features/scene-viewer/components/KeyboardCameraControls.tsx`**
   - React Three Fiber 組件，實現相機移動邏輯
   - 根據按鍵狀態計算移動向量
   - 自動與 OrbitControls 同步
   - 支持相機朝向的相對移動

### 🔧 修改文件

3. **`src/presentation/features/scene-viewer/components/SceneViewer.tsx`**
   - 添加 `KeyboardCameraControls` 導入
   - 新增 props：`keyboardControlsEnabled`、`cameraMoveSpeed`、`cameraSprintMultiplier`
   - 在 Canvas 中整合 `KeyboardCameraControls` 組件

4. **`src/App.tsx`**
   - 添加狀態管理：`keyboardControlsEnabled`、`cameraMoveSpeed`
   - 將狀態傳遞給 `SceneViewer` 和 `LeftToolbar`

5. **`src/presentation/features/scene-viewer/components/LeftToolbar.tsx`**
   - 添加鍵盤控制 UI 面板
   - 啟用/停用開關
   - 移動速度滑桿（1-20）
   - 快捷鍵說明提示

## 🎮 功能特性

### 按鍵映射
```
W - 向前移動（相機朝向方向）
S - 向後移動
A - 向左平移
D - 向右平移
Q - 向上移動
E - 向下移動
Shift - 按住加速移動（2x 速度）
```

### 核心特性
- ✅ **平滑移動**：基於 delta time 的流暢移動
- ✅ **相對移動**：移動方向相對於相機朝向
- ✅ **水平移動**：WASD 只在水平面移動（忽略俯仰角）
- ✅ **加速功能**：按住 Shift 鍵 2 倍速移動
- ✅ **智能過濾**：輸入框內按鍵不觸發相機移動
- ✅ **OrbitControls 兼容**：與滑鼠旋轉完美配合
- ✅ **可調速度**：UI 可調整移動速度（1-20）
- ✅ **可開關**：隨時啟用/停用功能

## 🎨 UI 控制面板

位置：左側工具列 → 相機參數面板

### 控制項
1. **啟用 WASD 移動**
   - 切換開關（Toggle）
   - 預設：啟用

2. **移動速度**
   - 範圍滑桿：1.0 - 20.0
   - 預設：5.0
   - 實時顯示當前值

3. **快捷鍵提示**
   - W/A/S/D - 前後左右
   - Q/E - 上下移動
   - Shift - 加速移動

## 🔍 技術細節

### 1. 按鍵狀態管理
```typescript
// 使用 useRef 避免重新渲染
const keyStateRef = useRef<KeyboardState>({
  forward: false,
  backward: false,
  left: false,
  right: false,
  up: false,
  down: false,
  shift: false,
});
```

### 2. 移動計算
```typescript
// 獲取相機朝向（水平方向）
const direction = new THREE.Vector3();
camera.getWorldDirection(direction);
direction.y = 0; // 只保留水平分量
direction.normalize();

// 計算右向量
const right = new THREE.Vector3();
right.crossVectors(camera.up, direction).normalize();

// 計算移動向量
const moveVector = new THREE.Vector3();
if (keyState.forward) moveVector.add(direction.multiplyScalar(speed));
if (keyState.right) moveVector.add(right.multiplyScalar(speed));
// ...
```

### 3. 與 OrbitControls 同步
```typescript
// 同步更新相機和控制器目標點
camera.position.add(moveVector);
if (controls && controls.target) {
  controls.target.add(moveVector);
}
```

## 🧪 測試建議

### 基本測試
1. ✅ 按 W/S/A/D 確認前後左右移動
2. ✅ 按 Q/E 確認上下移動
3. ✅ 按 Shift+W 確認加速移動

### 組合測試
4. ✅ 旋轉相機後按 W，確認向相機朝向移動
5. ✅ 同時按 W+D，確認斜向移動
6. ✅ 調整速度滑桿，確認移動速度變化

### 兼容性測試
7. ✅ 在輸入框中輸入 WASD，確認不觸發相機移動
8. ✅ 使用滑鼠旋轉視角，確認與鍵盤移動無衝突
9. ✅ 切換啟用/停用，確認功能正確開關
10. ✅ 失焦視窗再回來，確認按鍵狀態正確重置

## 📊 性能優化

- **useRef 存儲狀態**：避免不必要的重新渲染
- **useFrame 計算**：在每幀更新，保持 60fps
- **條件渲染**：只在需要時顯示控制面板
- **事件清理**：正確移除事件監聽器

## 🎯 使用體驗

實現後的體驗類似於：
- 🎮 **Blender** 的 Viewport Navigation
- 🎨 **Unity Editor** 的 Scene View 控制
- 🏗️ **Unreal Engine** 的編輯器相機
- 🎯 **第一人稱遊戲**的 WASD 移動

## 📝 後續可能的增強

- [ ] 添加相機移動速度的平滑過渡（加速/減速）
- [ ] 支持更多快捷鍵（如 R/F 上下移動的替代鍵）
- [ ] 添加相機位置重置快捷鍵（如 Home 鍵）
- [ ] 支持相機移動邊界限制（可選）
- [ ] 添加相機移動軌跡錄製功能
- [ ] 支持自定義按鍵映射

## ✨ 成功指標

- ✅ 無編譯錯誤
- ✅ 無 TypeScript 類型錯誤
- ✅ 無 Linter 警告
- ✅ 功能正常運作
- ✅ UI 控制面板完整
- ✅ 文檔完整清晰

## 🎉 結論

WASD 鍵盤相機控制功能已成功實現！使用者現在可以：
- 使用 WASD 像玩遊戲一樣自由移動相機
- 使用滑鼠旋轉視角（保持原有功能）
- 按住 Shift 快速移動到目標位置
- 在 3D 場景中更直觀地檢視模型細節

這為 3D 模型查看器帶來了專業級的操作體驗！🚀

