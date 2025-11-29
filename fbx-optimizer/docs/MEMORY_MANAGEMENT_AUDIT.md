# 🧹 模型資源管理審計報告

> 審計日期：2024-11-29  
> 審計範圍：模型載入、資源管理、刪除清理

---

## 📋 總覽

本報告分析模型從載入到刪除的完整資源生命週期，檢查是否存在記憶體洩漏風險。

### 評分摘要

| 類別 | 狀態 | 評分 |
|------|------|------|
| Three.js 模型資源 | ⚠️ 部分問題 | 7/10 |
| 動畫資源 | ✅ 良好 | 9/10 |
| 音效資源 | ✅ 良好 | 9/10 |
| 特效資源 | ✅ 良好 | 9/10 |
| Director Mode Clips | ✅ 良好 | 10/10 |
| Shader 材質 | ⚠️ 有問題 | 5/10 |
| 貼圖資源 | ⚠️ 有問題 | 6/10 |

---

## 🔍 詳細分析

### 1. 模型載入時創建的資源

當調用 `LoadModelUseCase.executeAndCreateInstance()` 時，會創建以下資源：

```typescript
// ModelInstance 包含的資源
{
  model: THREE.Group,           // GPU: Geometry, Material, Texture
  bones: THREE.Object3D[],      // 骨骼引用（不佔額外記憶體）
  originalClip: IdentifiableClip,  // CPU: 動畫數據
  masterClip: IdentifiableClip,    // CPU: 動畫數據
  optimizedClip: IdentifiableClip, // CPU: 動畫數據
  createdClips: IdentifiableClip[], // CPU: 用戶創建的動畫
  shaderGroups: ShaderGroup[],  // CPU: Shader 配置
  audioTracks: AudioTrack[],    // CPU: 音軌配置 + AudioBuffer
  effects: EffectItem[],        // GPU: Effekseer 特效
}
```

### 2. 模型刪除時的清理邏輯

位置：`App.tsx` 第 1530-1554 行

```typescript
// 刪除模型時執行的清理
if (modelToRemove) {
  // 1. ✅ 清理 Three.js 模型資源
  disposeModel(modelToRemove.model);
  
  // 2. ✅ 清理音效資源
  modelToRemove.audioTracks?.forEach((track) => {
    audioControllerRef.current.cleanup(track.id);
  });
  
  // 3. ✅ 清理特效資源
  modelToRemove.effects?.forEach((effect) => {
    effekseerAdapter.cleanup(effect.id);
  });
  
  // 4. ✅ 清理 Director Mode Clips
  useDirectorStore.getState().removeClipsByModelId(id);
}

// 5. ✅ 從狀態中移除模型
removeModel(id);
```

---

## ⚠️ 發現的問題

### 問題 1：Shader 創建的 ShaderMaterial 未釋放

**嚴重程度：🔴 高**

**位置**：`SceneViewer.tsx` 第 627-1050 行

**問題描述**：
當 Shader 功能啟用時，會為每個 Mesh 創建新的 `ShaderMaterial`，但這些材質在模型刪除時沒有被釋放。

```typescript
// 問題代碼：每次 features 變化都會創建新的 ShaderMaterial
shaderMat = new THREE.ShaderMaterial({...});
child.material = shaderMat;
// ❌ 舊的 shaderMat 沒有被 dispose()
```

**影響**：
- GPU 記憶體洩漏
- 每次更改 Shader 設定都會累積未釋放的材質

**建議修復**：
```typescript
// 在創建新 ShaderMaterial 前，先釋放舊的
if (child.material instanceof THREE.ShaderMaterial) {
  child.material.dispose();
}
shaderMat = new THREE.ShaderMaterial({...});
```

---

### 問題 2：動態載入的貼圖未釋放

**嚴重程度：🟠 中**

**位置**：`SceneViewer.tsx` 第 575-616 行

**問題描述**：
Shader 效果中動態載入的貼圖（Matcap、Flash、Dissolve、Normal Map）在以下情況未被釋放：
1. 更換貼圖時
2. 關閉 Shader 功能時
3. 刪除模型時

```typescript
// 這些貼圖被創建但從未被追蹤或釋放
const baseMatcapTex = loadTexture(textureLoader, baseMatcapFeature?.params.texture);
const addMatcapTex = loadTexture(textureLoader, addMatcapFeature?.params.texture);
const dissolveTex = loadTexture(textureLoader, dissolveFeature?.params.texture);
const normalMapTex = loadTexture(textureLoader, normalMapFeature?.params.texture);
const flashTex = loadTexture(textureLoader, flashFeature?.params.texture);
const flashMaskTex = loadTexture(textureLoader, flashFeature?.params.maskTexture);
```

**建議修復**：
1. 使用 `useRef` 追蹤已載入的貼圖
2. 在 `useEffect` cleanup 中釋放貼圖
3. 在 `disposeModel` 中添加對 `uniforms` 中貼圖的清理

---

### 問題 3：userData.originalMaterial 未釋放

**嚴重程度：🟡 低**

**位置**：`SceneViewer.tsx` 第 534 行

**問題描述**：
原始材質被保存在 `userData.originalMaterial` 中以便切換，但這個引用在模型刪除時不會被自動釋放。

```typescript
child.userData.originalMaterial = child.material;
// ❌ 這個材質在 disposeModel 中不會被處理
```

**影響**：
- 材質對象無法被垃圾回收

**建議修復**：
在 `disposeModel` 中添加：
```typescript
if (child.userData?.originalMaterial) {
  disposeMaterial(child.userData.originalMaterial);
  delete child.userData.originalMaterial;
}
```

---

### 問題 4：Audio Blob URL 未釋放

**嚴重程度：🟡 低**

**位置**：`AudioTrack` 使用的 `url` 屬性

**問題描述**：
音效檔案透過 `URL.createObjectURL()` 創建的 Blob URL 在清理時未調用 `URL.revokeObjectURL()`。

**建議修復**：
在 `WebAudioAdapter.cleanup()` 中添加：
```typescript
public cleanup(trackId: string) {
  this.stop(trackId);
  delete this.audioBuffers[trackId];
  // 如果有 Blob URL，也要釋放
  // URL.revokeObjectURL(blobUrl);
}
```

---

## ✅ 正確處理的資源

### 1. Three.js 核心資源
`disposeModel()` 正確處理了：
- ✅ Geometry (`geometry.dispose()`)
- ✅ 標準材質及其貼圖
- ✅ ShaderMaterial 的 uniforms 中的貼圖
- ✅ Skeleton (`skeleton.dispose()`)
- ✅ 子節點清理 (`model.clear()`)

### 2. 音效資源
`WebAudioAdapter.cleanup()` 正確處理了：
- ✅ 停止播放中的音源
- ✅ 刪除 AudioBuffer 快取

### 3. 特效資源
`EffekseerRuntimeAdapter.cleanup()` 正確處理了：
- ✅ 釋放 Effekseer Effect
- ✅ 從載入列表中移除

### 4. Director Mode
`removeClipsByModelId()` 正確處理了：
- ✅ 從所有 Track 中移除該模型的 Clips

---

## 🔧 建議的修復方案

### 修復 1：增強 disposeModel 函數

```typescript
// src/utils/three/disposeUtils.ts

export function disposeModel(model: THREE.Group | null): void {
  if (!model) return;

  model.traverse((child) => {
    // 釋放 userData 中保存的原始材質
    if ((child as any).userData?.originalMaterial) {
      disposeMaterial((child as any).userData.originalMaterial);
      delete (child as any).userData.originalMaterial;
    }

    // 釋放 Geometry
    if ((child as any).geometry) {
      (child as any).geometry.dispose();
    }

    // 釋放 Material（包含當前的 ShaderMaterial）
    if ((child as any).material) {
      const material = (child as any).material;
      if (Array.isArray(material)) {
        material.forEach((mat) => disposeMaterial(mat));
      } else {
        disposeMaterial(material);
      }
    }

    // 釋放 Skeleton
    if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
      const skinnedMesh = child as THREE.SkinnedMesh;
      if (skinnedMesh.skeleton) {
        skinnedMesh.skeleton.dispose();
      }
    }
  });

  model.clear();
}
```

### 修復 2：SceneViewer 中的 Shader 材質管理

```typescript
// 在 SceneViewer.tsx 中追蹤並清理 ShaderMaterial
const shaderMaterialsRef = useRef<Map<string, THREE.ShaderMaterial>>(new Map());

useEffect(() => {
  return () => {
    // cleanup：釋放所有追蹤的 ShaderMaterial
    shaderMaterialsRef.current.forEach((mat) => {
      mat.dispose();
    });
    shaderMaterialsRef.current.clear();
  };
}, [model]);
```

---

## 📊 記憶體監控建議

### 在 PerformanceMonitor 中添加記憶體追蹤

已實作的效能監控面板可以幫助偵測記憶體洩漏：
- **Geometries**: 應該隨模型刪除而減少
- **Textures**: 應該隨模型/Shader 刪除而減少
- **JS Memory**: 長期趨勢應該穩定

### 測試步驟

1. 載入一個模型
2. 記錄 Geometries、Textures、JS Memory 數值
3. 刪除模型
4. 等待 5 秒後再次檢查數值
5. 如果數值沒有下降，表示存在記憶體洩漏

---

## 📝 總結

### 必須修復（高優先級）
1. **ShaderMaterial 釋放** - 每次更新 Shader 都會洩漏材質
2. **動態貼圖釋放** - Shader 效果的貼圖未被追蹤

### 建議修復（中優先級）
3. **userData.originalMaterial** - 在 disposeModel 中處理
4. **Audio Blob URL** - 添加 revokeObjectURL 調用

### 已正確處理
- Three.js 核心資源（Geometry、標準 Material、Skeleton）
- 音效 AudioBuffer
- Effekseer 特效
- Director Mode Clips

---

## 🔗 相關檔案

- `src/utils/three/disposeUtils.ts` - 資源釋放工具
- `src/presentation/features/scene-viewer/components/SceneViewer.tsx` - Shader 材質管理
- `src/infrastructure/audio/WebAudioAdapter.ts` - 音效資源管理
- `src/infrastructure/effect/EffekseerRuntimeAdapter.ts` - 特效資源管理
- `src/presentation/stores/directorStore.ts` - Director Mode 狀態管理
- `src/App.tsx` - 模型刪除邏輯（第 1530-1554 行）

---

## ✅ TODO LIST（待修復問題）

> 以下為評分摘要中標記為「⚠️ 有問題」的類別

### 1. Three.js 模型資源（7/10）

- [ ] **修復 `userData.originalMaterial` 未釋放**
  - 檔案：`src/utils/three/disposeUtils.ts`
  - 問題：原始材質保存在 `userData.originalMaterial` 中，刪除模型時未釋放
  - 修復：在 `disposeModel()` 中添加對 `userData.originalMaterial` 的清理

### 2. Shader 材質（5/10）

- [ ] **修復 ShaderMaterial 洩漏**
  - 檔案：`src/presentation/features/scene-viewer/components/SceneViewer.tsx`
  - 問題：每次更新 Shader 設定時創建新 `ShaderMaterial`，舊的未被 `dispose()`
  - 修復：在創建新 `ShaderMaterial` 前，先釋放舊的材質

### 3. 貼圖資源（6/10）

- [ ] **修復動態貼圖洩漏**
  - 檔案：`src/presentation/features/scene-viewer/components/SceneViewer.tsx`
  - 問題：Shader 效果的貼圖（Matcap、Flash、Dissolve、Normal Map）未被追蹤和釋放
  - 修復：使用 `useRef` 追蹤載入的貼圖，在 cleanup 時釋放
