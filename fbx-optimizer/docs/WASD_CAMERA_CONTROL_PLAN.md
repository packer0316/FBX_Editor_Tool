# WASD 鍵盤相機控制功能規劃

## 📋 功能需求

### 核心功能
- ✅ **WASD** 控制相機前後左右移動
- ✅ **Q/E** 控制相機上下移動
- ✅ **Shift** 加速移動（2x 速度）
- ✅ **滑鼠右鍵拖曳** 旋轉視角（類似 Blender）
- ✅ **平滑移動** 提供良好的使用體驗
- ✅ **可切換啟用/停用** 避免與輸入框等元素衝突

### 操作方式（參考 Blender）
```
W - 向前移動（相機朝向方向）
S - 向後移動
A - 向左平移
D - 向右平移
Q - 向上移動
E - 向下移動
Shift + 移動鍵 - 加速移動
滑鼠中鍵/右鍵拖曳 - 旋轉視角（保持 OrbitControls）
```

## 🏗️ 技術架構

### 1. 新增文件結構
```
fbx-optimizer/src/
├── presentation/
│   └── features/
│       └── scene-viewer/
│           ├── hooks/
│           │   └── useKeyboardCameraControls.ts    [新增] 鍵盤控制邏輯
│           └── components/
│               ├── KeyboardCameraControls.tsx      [新增] 相機控制組件
│               └── SceneViewer.tsx                 [修改] 整合鍵盤控制
```

### 2. 核心組件設計

#### 2.1 Custom Hook: `useKeyboardCameraControls`
```typescript
// hooks/useKeyboardCameraControls.ts
interface KeyboardState {
  forward: boolean;    // W
  backward: boolean;   // S
  left: boolean;       // A
  right: boolean;      // D
  up: boolean;         // Q
  down: boolean;       // E
  shift: boolean;      // Shift (加速)
}

interface UseKeyboardCameraControlsOptions {
  enabled?: boolean;
  moveSpeed?: number;
  sprintMultiplier?: number;
}

export function useKeyboardCameraControls(
  options: UseKeyboardCameraControlsOptions
) {
  // 追蹤按鍵狀態
  // 處理 keydown/keyup 事件
  // 返回當前移動向量
}
```

#### 2.2 React Component: `KeyboardCameraControls`
```typescript
// components/KeyboardCameraControls.tsx
interface KeyboardCameraControlsProps {
  enabled?: boolean;
  moveSpeed?: number;
  sprintMultiplier?: number;
}

export function KeyboardCameraControls({
  enabled = true,
  moveSpeed = 5.0,
  sprintMultiplier = 2.0
}: KeyboardCameraControlsProps) {
  // 使用 useThree 獲取 camera 和 controls
  // 使用 useFrame 更新相機位置
  // 根據按鍵狀態計算移動向量
}
```

### 3. 整合到現有系統

#### 3.1 修改 `SceneViewer.tsx`
```typescript
// 添加新的 props
interface SceneViewerProps {
  // ... 現有 props
  keyboardControlsEnabled?: boolean;
  cameraMoveSpeed?: number;
}

// 在 Canvas 內添加組件
<Canvas>
  {/* ... 現有組件 */}
  <OrbitControls />
  <KeyboardCameraControls 
    enabled={keyboardControlsEnabled}
    moveSpeed={cameraMoveSpeed}
  />
</Canvas>
```

#### 3.2 修改 `App.tsx`
```typescript
// 添加狀態管理
const [keyboardControlsEnabled, setKeyboardControlsEnabled] = useState(true);
const [cameraMoveSpeed, setCameraMoveSpeed] = useState(5.0);

// 傳遞到 SceneViewer
<SceneViewer
  // ... 現有 props
  keyboardControlsEnabled={keyboardControlsEnabled}
  cameraMoveSpeed={cameraMoveSpeed}
/>
```

## 🔧 實現細節

### 1. 鍵盤事件處理
```typescript
useEffect(() => {
  if (!enabled) return;

  const handleKeyDown = (e: KeyboardEvent) => {
    // 忽略在輸入框內的按鍵
    if (e.target instanceof HTMLInputElement || 
        e.target instanceof HTMLTextAreaElement) {
      return;
    }
    
    switch (e.code) {
      case 'KeyW': keyState.forward = true; break;
      case 'KeyS': keyState.backward = true; break;
      case 'KeyA': keyState.left = true; break;
      case 'KeyD': keyState.right = true; break;
      case 'KeyQ': keyState.up = true; break;
      case 'KeyE': keyState.down = true; break;
      case 'ShiftLeft':
      case 'ShiftRight': keyState.shift = true; break;
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    // 類似處理...
  };

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  };
}, [enabled]);
```

### 2. 相機移動計算（每幀更新）
```typescript
useFrame((state, delta) => {
  if (!enabled) return;

  const { camera } = state;
  const controls = state.controls as any; // OrbitControls

  // 計算速度（考慮加速）
  const speed = moveSpeed * delta * (keyState.shift ? sprintMultiplier : 1);

  // 獲取相機朝向和右向量
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  direction.y = 0; // 水平移動
  direction.normalize();

  const right = new THREE.Vector3();
  right.crossVectors(camera.up, direction).normalize();

  // 計算移動向量
  const moveVector = new THREE.Vector3();

  if (keyState.forward) moveVector.add(direction.clone().multiplyScalar(speed));
  if (keyState.backward) moveVector.sub(direction.clone().multiplyScalar(speed));
  if (keyState.right) moveVector.add(right.clone().multiplyScalar(speed));
  if (keyState.left) moveVector.sub(right.clone().multiplyScalar(speed));
  if (keyState.up) moveVector.y += speed;
  if (keyState.down) moveVector.y -= speed;

  // 更新相機和 OrbitControls 目標點
  camera.position.add(moveVector);
  if (controls && controls.target) {
    controls.target.add(moveVector);
  }
});
```

### 3. 與 OrbitControls 協同工作
- 保持 OrbitControls 的旋轉功能
- WASD 移動時同步更新 `controls.target`
- 確保移動和旋轉不衝突

## 🎨 UI 控制面板（可選）

### 在 LeftToolbar 或設置面板中添加：
```typescript
<div className="camera-keyboard-controls">
  <label>
    <input
      type="checkbox"
      checked={keyboardControlsEnabled}
      onChange={(e) => setKeyboardControlsEnabled(e.target.checked)}
    />
    啟用 WASD 鍵盤控制
  </label>
  
  <label>
    移動速度
    <input
      type="range"
      min="1"
      max="20"
      value={cameraMoveSpeed}
      onChange={(e) => setCameraMoveSpeed(Number(e.target.value))}
    />
    {cameraMoveSpeed.toFixed(1)}
  </label>
</div>
```

## 📝 實現步驟

### Phase 1: 基礎實現
1. ✅ 創建 `useKeyboardCameraControls` hook
2. ✅ 創建 `KeyboardCameraControls` 組件
3. ✅ 實現基本的 WASD 移動
4. ✅ 整合到 `SceneViewer`

### Phase 2: 增強功能
5. ✅ 添加 Q/E 上下移動
6. ✅ 添加 Shift 加速功能
7. ✅ 優化移動平滑度
8. ✅ 處理邊界情況（輸入框焦點等）

### Phase 3: UI 和配置
9. ✅ 添加啟用/停用開關
10. ✅ 添加速度調整滑桿
11. ✅ 添加快捷鍵提示
12. ✅ 測試和優化

## 🔍 注意事項

### 1. 輸入衝突處理
```typescript
// 當焦點在輸入框時，禁用鍵盤控制
const isInputActive = document.activeElement instanceof HTMLInputElement ||
                      document.activeElement instanceof HTMLTextAreaElement;
if (isInputActive) return;
```

### 2. 相機邊界限制（可選）
```typescript
// 限制相機移動範圍
const maxDistance = 100;
if (camera.position.length() > maxDistance) {
  camera.position.normalize().multiplyScalar(maxDistance);
}
```

### 3. 性能優化
- 使用 `useRef` 存儲按鍵狀態，避免重新渲染
- 在 `useFrame` 中計算，保持 60fps 流暢度
- 只在需要時監聽事件

## 🧪 測試場景

1. **基本移動測試**
   - 按 W/S/A/D 確認前後左右移動
   - 按 Q/E 確認上下移動

2. **組合測試**
   - 按 W+D 確認斜向移動
   - 按 Shift+W 確認加速移動

3. **兼容性測試**
   - 旋轉相機後確認移動方向正確（相對相機朝向）
   - 在輸入框中輸入時不觸發相機移動
   - 與 OrbitControls 同時使用無衝突

4. **性能測試**
   - 長時間按住按鍵確認流暢度
   - 快速切換按鍵確認響應速度

## 📚 參考資料

- **Three.js OrbitControls**: https://threejs.org/docs/#examples/en/controls/OrbitControls
- **React Three Fiber**: https://docs.pmnd.rs/react-three-fiber
- **Blender 相機控制**: 參考 Blender 的 Viewport Navigation
- **FPS 相機控制**: 類似第一人稱遊戲的 WASD 移動

## 🎯 預期效果

實現後，使用者將能夠：
- 🎮 使用 WASD 像玩遊戲一樣自由移動相機
- 🔄 使用滑鼠旋轉視角（保持原有功能）
- ⚡ 按住 Shift 快速移動到目標位置
- 🎨 在 3D 場景中更直觀地檢視模型細節

類似於在 Blender、Unity、Unreal Engine 等專業 3D 軟體中的操作體驗！

