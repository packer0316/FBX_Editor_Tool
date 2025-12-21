# 🎇 Effekseer 特效系統整合架構

> 本文檔記錄 Effekseer 粒子特效系統與 JR 3D Viewer 的整合架構、實現細節和注意事項。

---

## 📋 概述

**Effekseer** 是一個開源的粒子特效製作工具，本專案整合其 WebGL Runtime 以支援 `.efk` 特效檔案的載入與播放。

### 核心功能
- ✅ 特效載入與播放
- ✅ 資源追蹤與管理
- ✅ 引用資源列表查看
- ✅ 圖片資源預覽
- ✅ 缺失資源錯誤報告
- ✅ 快取管理（清除快取）
- ✅ 打包匯出（ZIP）
- ✅ 動畫觸發器（根據幀數自動播放）
- ✅ Director Mode 時間軸同步

---

## 🏗️ 架構設計

### 分層結構

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ EffectTestPanel.tsx                                      ││
│  │  ├── EffectCard (特效卡片組件)                           ││
│  │  ├── effectResourceCache (全域資源快取 Map)              ││
│  │  ├── handleLoad() - 載入特效                             ││
│  │  ├── handleClearCache() - 清除快取                       ││
│  │  └── handleExportEffects() - 打包匯出                    ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Infrastructure Layer                       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ EffekseerRuntimeAdapter.ts                               ││
│  │  ├── initRuntime() - 初始化 Runtime                      ││
│  │  ├── loadEffect() - 載入特效（支援 redirect 回調）       ││
│  │  ├── playEffect() - 播放特效                             ││
│  │  ├── stopEffect() - 停止特效                             ││
│  │  ├── cleanup() - 清理單一特效                            ││
│  │  └── clearAllCache() - 清除所有快取                      ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    External Library                          │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ effekseer.min.js (Effekseer WebGL Runtime)               ││
│  │  └── 透過 <script> 標籤全域載入                          ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 檔案結構

```
src/
├── infrastructure/
│   └── effect/
│       └── EffekseerRuntimeAdapter.ts   # Effekseer Runtime 封裝
├── presentation/
│   └── features/
│       └── effect-panel/
│           └── components/
│               └── EffectTestPanel.tsx  # 特效測試面板
├── types/
│   └── effekseer.d.ts                   # Effekseer 類型定義
└── domain/
    └── value-objects/
        └── EffectTrigger.ts             # 特效觸發器類型

public/
└── effekseer/
    ├── effekseer.min.js                 # Effekseer Runtime
    ├── effekseer.wasm                   # WebAssembly 模組
    ├── manifest.json                    # 特效清單（可選）
    └── [效果資料夾]/
        ├── *.efk                        # 特效檔案
        ├── *.png / *.jpg                # 貼圖資源
        ├── *.efkmat                     # 材質檔案
        └── *.efkmodel                   # 模型檔案
```

---

## 💾 核心資料結構

### EffectItem（特效項目）

```typescript
export interface EffectItem {
    id: string;                          // 唯一識別碼
    name: string;                        // 顯示名稱
    path: string;                        // 相對路徑（如 "Boss/BigExplosion.efk"）
    isLoaded: boolean;                   // 是否已載入
    isLoading: boolean;                  // 是否正在載入
    triggers: EffectTrigger[];           // 動畫觸發器列表
    resourceStatus?: ResourceStatus[];   // 引用資源狀態列表
}
```

### ResourceStatus（資源狀態）

```typescript
interface ResourceStatus {
    path: string;      // 資源路徑
    exists: boolean;   // 是否存在
    type: 'image' | 'material' | 'model' | 'other';  // 資源類型
}
```

### EffectTrigger（特效觸發器）

```typescript
interface EffectTrigger {
    id: string;           // 觸發器 ID
    clipId: string;       // 關聯的動畫片段 ID
    clipName: string;     // 動畫片段名稱（顯示用）
    frame: number;        // 觸發幀數
    durationFrames: number;  // 持續幀數
}
```

---

## 🔄 資源追蹤機制

### 問題背景

Effekseer Runtime 有內部快取機制：
- 第一次載入特效時，會透過 `redirect` 回調請求資源
- 第二次載入相同特效時，直接使用快取，**不會呼叫 `redirect`**

這導致：
1. 同一特效載入第二次時，無法追蹤資源列表
2. 不同模型載入相同特效時，後者的資源列表會是空的

### 解決方案：全域資源快取

```typescript
// EffectTestPanel.tsx
const [effectResourceCache, setEffectResourceCache] = 
    useState<Map<string, ResourceStatus[]>>(new Map());
```

**工作流程**：

```
載入特效 handleLoad()
    │
    ├─► 檢查 effectResourceCache.get(localPath)
    │       │
    │       ├─► 有快取 → 直接使用快取的資源列表
    │       │
    │       └─► 無快取 → 透過 redirect 追蹤資源
    │                       │
    │                       └─► 存入 effectResourceCache
    │
    └─► 更新 item.resourceStatus
```

### redirect 回調實現

```typescript
const loadResult = await adapter.loadEffect(effectUrl, {
    redirect: (path: string) => {
        // 1. 解析資源路徑
        const resourcePath = decodeURIComponent(path);
        
        // 2. 判斷資源類型
        const ext = resourcePath.split('.').pop()?.toLowerCase();
        let type: 'image' | 'material' | 'model' | 'other' = 'other';
        if (['png', 'jpg', 'jpeg', 'dds'].includes(ext)) type = 'image';
        else if (ext === 'efkmat') type = 'material';
        else if (ext === 'efkmodel') type = 'model';
        
        // 3. 檢查資源是否存在（非同步）
        fetch(fullUrl, { method: 'HEAD' })
            .then(res => {
                resourceStatusMap.set(resourcePath, {
                    path: resourcePath,
                    exists: res.ok,
                    type
                });
            });
        
        // 4. 返回重定向後的 URL
        return fullUrl;
    },
    onerror: (msg, path) => {
        // 記錄缺失資源
        missingResources.push(path);
    }
});
```

---

## ⚠️ 重要注意事項

### 1. Effekseer 快取是全域共用的

**問題**：當選中 B 模型並點擊「清除快取」時，所有模型的特效都需要重置。

**解決方案**：

```typescript
// EffectTestPanel.tsx
interface EffectTestPanelProps {
    // ...
    onClearAllModelsEffects?: () => void;  // 清除所有模型的特效回調
}

const handleClearCache = () => {
    // 1. 清除 Effekseer Runtime 快取
    adapter.clearAllCache();
    
    // 2. 清除應用層資源快取
    setEffectResourceCache(new Map());
    
    // 3. 清除所有模型的特效狀態
    if (onClearAllModelsEffects) {
        onClearAllModelsEffects();  // 由 App.tsx 實現
    }
};
```

```typescript
// App.tsx
<EffectTestPanel
    onClearAllModelsEffects={() => {
        models.forEach(m => {
            updateModel(m.id, {
                effects: m.effects.map(effect => ({
                    ...effect,
                    isLoaded: false,
                    resourceStatus: undefined
                }))
            });
        });
    }}
/>
```

### 2. 資源路徑可能包含相對路徑

**問題**：有些 .efk 檔案內部引用資源時使用 `../../../` 相對路徑。

**現象**：
```
引用資源列表顯示：
../../../#BossVfxExport 0528/BS03_04_BigWinRe...
```

**原因**：這是 .efk 檔案製作時的路徑設定問題，需要在 Effekseer 編輯器中修正。

**建議**：
- 確保 .efk 檔案的資源引用使用相對於 .efk 檔案的路徑
- 所有資源應放在 .efk 檔案的同目錄或子目錄中

### 3. 圖片預覽路徑處理

```typescript
// 正確處理圖片 URL
const imageUrl = resource.path.startsWith('/effekseer/')
    ? resource.path                          // 已是完整路徑
    : `${effectDir}${resource.path}`;        // 需要拼接目錄
```

### 4. 快取後的資源顯示

當資源已被其他特效快取時，會顯示特殊提示：

```typescript
resourceStatus: [{
    path: '(資源已快取，by其他特效檔)',
    exists: true,
    type: 'other'
}]
```

### 5. 多模型共用特效的處理

**場景**：A 和 B 兩個模型都載入相同的特效。

**處理流程**：
1. A 模型載入特效 → redirect 被呼叫 → 資源列表存入 effectResourceCache
2. B 模型載入相同特效 → redirect 不被呼叫 → 從 effectResourceCache 讀取

**關鍵程式碼**：
```typescript
const cachedResources = effectResourceCache.get(localPath);
if (cachedResources && cachedResources.length > 0) {
    // 使用快取
    onUpdate(item.id, { resourceStatus: cachedResources });
}
```

---

## 📦 打包匯出功能

### 功能說明

將當前頁面所有已載入的特效及其引用資源打包成 ZIP 檔案。

### 實現邏輯

```typescript
const handleExportEffects = async () => {
    const zip = new JSZip();
    const addedFiles = new Set<string>();
    
    // 1. 遍歷所有已載入的特效
    for (const effect of effects) {
        if (!effect.isLoaded) continue;
        
        // 2. 加入 .efk 檔案
        const efkUrl = `/effekseer/${effect.path}`;
        const efkBlob = await fetch(efkUrl).then(r => r.blob());
        zip.file(effect.path, efkBlob);
        
        // 3. 從 effectResourceCache 獲取資源列表
        const resources = effectResourceCache.get(effect.path) || [];
        
        // 4. 加入所有引用資源
        for (const resource of resources) {
            if (!resource.exists) continue;
            if (addedFiles.has(resource.path)) continue;
            
            const resourceBlob = await fetch(resourceUrl).then(r => r.blob());
            zip.file(relativePath, resourceBlob);
            addedFiles.add(resource.path);
        }
    }
    
    // 5. 生成並下載 ZIP
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, 'effects_export.zip');
};
```

### 注意事項

- 必須使用 `effectResourceCache` 而非 `item.resourceStatus`
- 原因：快取命中時 `item.resourceStatus` 可能顯示「資源已快取」而非實際資源列表
- `effectResourceCache` 保存的是完整的資源列表

---

## 🎬 與 Director Mode 整合

### 特效觸發同步

```typescript
// EffectSyncUseCase.ts
handleTimeUpdate(time, isPlaying, clip, effects) {
    for (const effect of effects) {
        for (const trigger of effect.triggers) {
            // 檢查是否應該觸發
            if (trigger.clipId === getClipId(clip)) {
                const triggerTime = trigger.frame / fps;
                if (lastTime < triggerTime && time >= triggerTime) {
                    // 播放特效
                    adapter.playEffect(effect.id, trigger.durationFrames / fps);
                }
            }
        }
    }
}
```

### Director Mode 時間軸計算

```typescript
// 全域幀 → 特效局部時間
const localTime = (currentFrame - clip.startFrame) / fps;

// 檢查 Trigger 是否在播放範圍內
if (localTime >= trigger.frame / fps) {
    // 觸發特效
}
```

---

## 🔧 API 參考

### EffekseerRuntimeAdapter

| 方法 | 說明 |
|------|------|
| `initRuntime(gl, settings)` | 初始化 Effekseer Runtime |
| `loadEffect(url, options)` | 載入特效檔案 |
| `playEffect(id, duration)` | 播放特效 |
| `stopEffect(id)` | 停止特效 |
| `cleanup(id)` | 清理單一特效資源 |
| `clearAllCache()` | 清除所有快取（全域） |
| `update(deltaTime)` | 更新所有特效 |
| `draw()` | 繪製所有特效 |

### EffectTestPanel Props

| Prop | 類型 | 說明 |
|------|------|------|
| `model` | `THREE.Group \| null` | 當前模型 |
| `bones` | `THREE.Object3D[]` | 骨骼列表 |
| `effects` | `EffectItem[]` | 特效列表 |
| `setEffects` | `Dispatch<SetStateAction<EffectItem[]>>` | 更新特效 |
| `createdClips` | `IdentifiableClip[]` | 動畫片段列表 |
| `theme` | `ThemeStyle` | 主題樣式 |
| `duration` | `number` | 動畫總時長 |
| `fps` | `number` | 幀率（預設 30） |
| `onClearAllModelsEffects` | `() => void` | 清除所有模型特效的回調 |

---

## 📝 更新日誌

### 2025.12.12 - 資源管理系統完善

**新增功能**：
1. ✅ 資源追蹤系統（使用 redirect 回調）
2. ✅ 全域資源快取（effectResourceCache Map）
3. ✅ 引用資源列表彈窗
4. ✅ 圖片資源預覽
5. ✅ 缺失資源詳細錯誤報告
6. ✅ 清除快取功能（全域生效）
7. ✅ 打包匯出功能（ZIP）
8. ✅ 快取提示改進（顯示「資源已快取，by其他特效檔」）

**問題修復**：
- 修復：相同特效載入多次時資源列表為空
- 修復：圖片預覽路徑錯誤
- 修復：清除快取只影響當前模型（改為全域生效）

**注意事項新增**：
- Effekseer 快取是全域共用的
- 資源路徑可能包含相對路徑（需在編輯器修正）
- 打包匯出必須使用 effectResourceCache

---

**最後更新**：2025.12.12  
**維護者**：JR.H


