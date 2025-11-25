# 多模型架構優化計劃

## 📋 目錄
1. [概述](#概述)
2. [當前狀態分析](#當前狀態分析)
3. [目標架構](#目標架構)
4. [資料結構設計](#資料結構設計)
5. [詳細實施步驟](#詳細實施步驟)
6. [驗證檢查清單](#驗證檢查清單)

---

## 概述

### 目標
將現有單模型架構升級為**多模型管理系統**，實作在**右側「模型管理」分頁**中。

每個模型擁有完全獨立的：
- ✅ Mesh 管理
- ✅ Bone（骨骼）管理
- ✅ 動作片段（Animation Clips）
- ✅ Shader 組合
- ✅ 音效軌道（Audio Tracks）
- ✅ 特效（Effects）

**例外**：相機參數保持全域統一（所有模型共用）

### 核心原則
1. **模型隔離**：每個模型的資料完全獨立
2. **統一相機**：相機設定為全域共享
3. **漸進式遷移**：每個步驟完成後都可運行並驗證
4. **可視化驗證**：每個步驟都有明確的 UI 變化可驗證

---

## 當前狀態分析

### 現有結構

**右側面板分頁**（App.tsx 第 954-991 行）：
- 「模型管理」分頁（`activeTab === 'optimization'`）
- 目前顯示：`OptimizationControls` 組件（檔案上傳功能）

**單一模型狀態**（App.tsx）：
```typescript
const [model, setModel] = useState<THREE.Group | null>(null);
const [meshNames, setMeshNames] = useState<string[]>([]);
const [shaderGroups, setShaderGroups] = useState<ShaderGroup[]>([]);
const [createdClips, setCreatedClips] = useState<IdentifiableClip[]>([]);
const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
const [effects, setEffects] = useState<EffectItem[]>([]);
```

---

## 目標架構

### 右側「模型管理」分頁 UI 設計

```
┌─────────────────────────────────────┐
│  模型管理  │ Material Shader │ ... │ ← 分頁標籤
├─────────────────────────────────────┤
│                                      │
│  📦 當前活動模型                      │
│  ┌──────────────────────────────┐  │
│  │ 🟢 Character_01.fbx          │  │ ← 活動模型（綠色指示器）
│  │    Mesh: 15  │ Bones: 23     │  │
│  │    Clips: 3  │ Effects: 2    │  │
│  └──────────────────────────────┘  │
│                                      │
│  📋 所有模型                         │
│  ┌──────────────────────────────┐  │
│  │ ⚪ Character_01.fbx          │  │ ← 非活動模型
│  │    [切換] [重新命名] [刪除]   │  │
│  ├──────────────────────────────┤  │
│  │ ⚪ Monster_01.fbx            │  │
│  │    [切換] [重新命名] [刪除]   │  │
│  └──────────────────────────────┘  │
│                                      │
│  [+ 新增模型]                         │ ← 新增按鈕
│                                      │
└─────────────────────────────────────┘
```

---

## 資料結構設計

### ModelInstance 介面

```typescript
// domain/value-objects/ModelInstance.ts

export interface ModelInstance {
  // 基本資訊
  id: string;                    // 唯一識別碼
  name: string;                   // 顯示名稱（預設為檔名）
  file: File | null;              // 原始檔案（用於重新載入）
  
  // 模型資料
  model: THREE.Group | null;      // Three.js 模型群組
  meshNames: string[];            // Mesh 名稱列表
  bones: THREE.Object3D[];        // 骨骼列表
  
  // 動畫相關
  originalClip: IdentifiableClip | null;
  masterClip: IdentifiableClip | null;
  optimizedClip: IdentifiableClip | null;
  createdClips: IdentifiableClip[];
  tolerance: number;
  
  // Shader 相關
  shaderGroups: ShaderGroup[];
  isShaderEnabled: boolean;
  
  // 音效相關
  audioTracks: AudioTrack[];
  
  // 特效相關
  effects: EffectItem[];
  
  // 播放狀態（每個模型獨立）
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLoopEnabled: boolean;
  
  // 元資料
  createdAt: number;
  updatedAt: number;
}
```

---

## 詳細實施步驟

### 🎯 階段一：基礎架構準備

#### Step 1.1：創建 ModelInstance 類型定義

**檔案**：`domain/value-objects/ModelInstance.ts`

**實作內容**：
```typescript
import * as THREE from 'three';
import type { IdentifiableClip } from '../../../utils/clip/clipIdentifierUtils';
import type { ShaderGroup } from './ShaderFeature';
import type { AudioTrack } from './AudioTrack';
import type { EffectItem } from '../../../presentation/features/effect-panel/components/EffectTestPanel';

export interface ModelInstance {
  // ... 完整介面定義（見上方）
}
```

**驗證方式**：
- ✅ 檔案成功創建
- ✅ TypeScript 編譯無錯誤
- ✅ 可以在其他檔案中 import `ModelInstance` 類型

**可視化驗證**：
- 開啟 VS Code，確認檔案存在且無紅色錯誤標記
- 在 App.tsx 中 import，確認類型提示正常

---

#### Step 1.2：創建 useModelsManager Hook

**檔案**：`presentation/hooks/useModelsManager.ts`

**實作內容**：
```typescript
import { useState, useCallback } from 'react';
import type { ModelInstance } from '../../domain/value-objects/ModelInstance';

export function useModelsManager() {
  const [models, setModels] = useState<Map<string, ModelInstance>>(new Map());
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  
  const addModel = useCallback((instance: ModelInstance) => {
    setModels(prev => {
      const next = new Map(prev);
      next.set(instance.id, instance);
      return next;
    });
    if (!activeModelId) {
      setActiveModelId(instance.id);
    }
  }, [activeModelId]);
  
  const removeModel = useCallback((id: string) => {
    setModels(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    if (activeModelId === id) {
      const remaining = Array.from(models.keys()).filter(k => k !== id);
      setActiveModelId(remaining.length > 0 ? remaining[0] : null);
    }
  }, [activeModelId, models]);
  
  const updateModel = useCallback((id: string, updates: Partial<ModelInstance>) => {
    setModels(prev => {
      const next = new Map(prev);
      const model = next.get(id);
      if (model) {
        next.set(id, {
          ...model,
          ...updates,
          updatedAt: Date.now()
        });
      }
      return next;
    });
  }, []);
  
  const activeModel = activeModelId ? models.get(activeModelId) || null : null;
  
  return {
    models: Array.from(models.values()),
    activeModel,
    activeModelId,
    setActiveModelId,
    addModel,
    removeModel,
    updateModel,
    getModel: (id: string) => models.get(id) || null
  };
}
```

**驗證方式**：
- ✅ 檔案成功創建
- ✅ TypeScript 編譯無錯誤
- ✅ Hook 可以正常匯出

**可視化驗證**：
- 在 App.tsx 中 import 並使用：
  ```typescript
  const { models, activeModel } = useModelsManager();
  console.log('Models:', models.length); // 應該顯示 0
  ```
- 開啟瀏覽器 Console，確認無錯誤

---

#### Step 1.3：擴展 LoadModelUseCase

**檔案**：`application/use-cases/LoadModelUseCase.ts`

**實作內容**：在現有 `execute` 方法後新增

```typescript
import type { ModelInstance } from '../../domain/value-objects/ModelInstance';
import { setClipIdentifier } from '../../utils/clip/clipIdentifierUtils';

export class LoadModelUseCase {
  // ... 現有 execute 方法保持不變
  
  /**
   * 載入模型並創建 ModelInstance
   */
  static async executeAndCreateInstance(
    files: FileList,
    modelName?: string
  ): Promise<ModelInstance> {
    const result = await this.execute(files);
    const { fbxFile } = ModelLoaderService.classifyFiles(files);
    
    return {
      id: `model_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: modelName || fbxFile?.name || '未命名模型',
      file: fbxFile || null,
      model: result.model,
      meshNames: result.meshNames,
      bones: [],
      originalClip: result.animations[0] ? setClipIdentifier(result.animations[0]) : null,
      masterClip: null,
      optimizedClip: null,
      createdClips: [],
      tolerance: 0,
      shaderGroups: result.defaultShaderGroup ? [result.defaultShaderGroup] : [],
      isShaderEnabled: true,
      audioTracks: [],
      effects: [],
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      isLoopEnabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }
}
```

**驗證方式**：
- ✅ 方法成功新增
- ✅ TypeScript 編譯無錯誤
- ✅ 可以正常調用

**可視化驗證**：
- 在瀏覽器 Console 中測試：
  ```typescript
  // 模擬測試（需要實際檔案）
  const instance = await LoadModelUseCase.executeAndCreateInstance(files);
  console.log('Instance ID:', instance.id);
  console.log('Instance Name:', instance.name);
  ```
- 確認返回的 ModelInstance 包含所有必要欄位

---

### 🎯 階段二：App.tsx 狀態管理重構

#### Step 2.1：引入 useModelsManager Hook

**檔案**：`src/App.tsx`

**實作內容**：在 App 組件開頭添加

```typescript
import { useModelsManager } from './presentation/hooks/useModelsManager';

function App() {
  // 新增：多模型管理
  const { 
    models, 
    activeModel, 
    activeModelId, 
    setActiveModelId,
    addModel, 
    removeModel, 
    updateModel 
  } = useModelsManager();
  
  // 保留：相機設定（全域）
  const [cameraSettings, setCameraSettings] = useState({
    fov: 50,
    near: 0.1,
    far: 1000
  });
  
  // ... 其他現有狀態暫時保留（逐步遷移）
}
```

**驗證方式**：
- ✅ 編譯無錯誤
- ✅ Hook 正常初始化

**可視化驗證**：
- 開啟瀏覽器 Console，添加臨時日誌：
  ```typescript
  console.log('Active Model:', activeModel?.name || 'None');
  console.log('Total Models:', models.length);
  ```
- 確認顯示 "None" 和 0

---

#### Step 2.2：更新 handleFileUpload 函數

**檔案**：`src/App.tsx`

**實作內容**：修改現有的 `handleFileUpload`

```typescript
const handleFileUpload = async (files: FileList) => {
  setIsLoading(true);
  try {
    // 使用新方法創建 ModelInstance
    const instance = await LoadModelUseCase.executeAndCreateInstance(files);
    
    // 提取骨骼（使用現有的 useBoneExtraction 邏輯）
    const bones = extractBonesFromModel(instance.model);
    updateModel(instance.id, { bones });
    
    // 添加到模型列表
    addModel(instance);
    
    // 設為活動模型
    setActiveModelId(instance.id);
    
    console.log('✅ 模型載入成功:', instance.name);
  } catch (error) {
    console.error('❌ 載入失敗:', error);
    alert(`載入失敗: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    setIsLoading(false);
  }
};

// 輔助函數：提取骨骼
function extractBonesFromModel(model: THREE.Group | null): THREE.Object3D[] {
  if (!model) return [];
  const bones: THREE.Object3D[] = [];
  model.traverse((child) => {
    if (child.type === 'Bone' || (child as any).isBone) {
      bones.push(child);
    }
  });
  return bones;
}
```

**驗證方式**：
- ✅ 編譯無錯誤
- ✅ 可以上傳檔案

**可視化驗證**：
1. **上傳一個 FBX 檔案**
2. **檢查 Console**：應該看到 "✅ 模型載入成功: [檔名]"
3. **檢查狀態**：在 Console 中輸入：
   ```typescript
   console.log('Models:', models.length); // 應該顯示 1
   console.log('Active:', activeModel?.name); // 應該顯示檔名
   ```

---

#### Step 2.3：暫時保留舊狀態（向後兼容）

**檔案**：`src/App.tsx`

**實作內容**：暫時保留舊狀態，但添加同步邏輯

```typescript
// 暫時保留（用於向後兼容）
const [model, setModel] = useState<THREE.Group | null>(null);
const [meshNames, setMeshNames] = useState<string[]>([]);
const [shaderGroups, setShaderGroups] = useState<ShaderGroup[]>([]);
// ... 其他舊狀態

// 同步 activeModel 到舊狀態（臨時方案）
useEffect(() => {
  if (activeModel) {
    setModel(activeModel.model);
    setMeshNames(activeModel.meshNames);
    setShaderGroups(activeModel.shaderGroups);
    // ... 同步其他狀態
  } else {
    setModel(null);
    setMeshNames([]);
    setShaderGroups([]);
    // ... 重置其他狀態
  }
}, [activeModel]);
```

**驗證方式**：
- ✅ 現有功能不受影響
- ✅ 模型載入後，舊狀態自動同步

**可視化驗證**：
1. **上傳模型後**，檢查 SceneViewer 是否正常顯示模型
2. **確認**：所有現有功能（Shader、Audio、Effect）仍然正常運作

---

### 🎯 階段三：創建模型管理面板組件

#### Step 3.1：創建 ModelManagerPanel 組件骨架

**檔案**：`presentation/features/model-manager/components/ModelManagerPanel.tsx`

**實作內容**：創建基本結構

```typescript
import React from 'react';
import { Plus, Trash2, Edit2, Check, X, Package } from 'lucide-react';
import type { ModelInstance } from '../../../../domain/value-objects/ModelInstance';

interface ModelManagerPanelProps {
  models: ModelInstance[];
  activeModelId: string | null;
  onSelectModel: (id: string) => void;
  onAddModel: (files: FileList) => Promise<void>;
  onRemoveModel: (id: string) => void;
  onRenameModel: (id: string, newName: string) => void;
  isLoading?: boolean;
}

export default function ModelManagerPanel({
  models,
  activeModelId,
  onSelectModel,
  onAddModel,
  onRemoveModel,
  onRenameModel,
  isLoading = false
}: ModelManagerPanelProps) {
  return (
    <div className="flex flex-col gap-4 h-full">
      <h2 className="text-lg font-bold text-white flex items-center gap-2">
        <Package className="w-5 h-5" />
        模型管理
      </h2>
      
      {/* 這裡將添加更多內容 */}
      <div className="text-gray-400 text-sm">
        模型管理面板（開發中...）
      </div>
    </div>
  );
}
```

**驗證方式**：
- ✅ 檔案成功創建
- ✅ 組件可以正常渲染

**可視化驗證**：
1. **在 App.tsx 中引入並使用**：
   ```typescript
   import ModelManagerPanel from './presentation/features/model-manager/components/ModelManagerPanel';
   
   // 在右側面板中
   {activeTab === 'optimization' && (
     <ModelManagerPanel
       models={models}
       activeModelId={activeModelId}
       onSelectModel={setActiveModelId}
       onAddModel={handleFileUpload}
       onRemoveModel={removeModel}
       onRenameModel={(id, name) => updateModel(id, { name })}
       isLoading={isLoading}
     />
   )}
   ```
2. **切換到「模型管理」分頁**，應該看到標題和「開發中...」文字

---

#### Step 3.2：實作當前活動模型顯示區塊

**檔案**：`presentation/features/model-manager/components/ModelManagerPanel.tsx`

**實作內容**：添加活動模型顯示

```typescript
// 在組件中添加
{activeModel && (
  <div className="bg-gray-800 rounded-lg p-4 border-2 border-green-500">
    <div className="flex items-center gap-2 mb-2">
      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
      <span className="text-xs text-gray-400 font-medium">當前活動模型</span>
    </div>
    <div className="text-white font-semibold mb-2">{activeModel.name}</div>
    <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
      <div>Mesh: {activeModel.meshNames.length}</div>
      <div>Bones: {activeModel.bones.length}</div>
      <div>Clips: {activeModel.createdClips.length}</div>
      <div>Effects: {activeModel.effects.length}</div>
    </div>
  </div>
)}
```

**驗證方式**：
- ✅ 活動模型正確顯示
- ✅ 統計數據正確

**可視化驗證**：
1. **上傳一個模型**
2. **切換到「模型管理」分頁**
3. **應該看到**：
   - 綠色邊框的卡片
   - 綠色圓點 + "當前活動模型" 標籤
   - 模型名稱
   - Mesh、Bones、Clips、Effects 的數量統計

---

#### Step 3.3：實作模型列表顯示

**檔案**：`presentation/features/model-manager/components/ModelManagerPanel.tsx`

**實作內容**：添加模型列表

```typescript
<div className="flex flex-col gap-2">
  <div className="text-sm text-gray-400 font-medium mb-2">所有模型 ({models.length})</div>
  
  {models.length === 0 ? (
    <div className="text-center py-8 text-gray-500 text-sm">
      <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
      <p>尚未載入任何模型</p>
      <p className="text-xs mt-1">點擊下方按鈕新增模型</p>
    </div>
  ) : (
    <div className="space-y-2">
      {models.map((model) => (
        <div
          key={model.id}
          className={`bg-gray-800 rounded-lg p-3 border ${
            model.id === activeModelId
              ? 'border-green-500 bg-gray-750'
              : 'border-gray-700 hover:border-gray-600'
          } transition-colors`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div
                className={`w-2 h-2 rounded-full ${
                  model.id === activeModelId ? 'bg-green-500' : 'bg-gray-500'
                }`}
              />
              <span className="text-white text-sm truncate">{model.name}</span>
            </div>
            <div className="flex items-center gap-1">
              {model.id !== activeModelId && (
                <button
                  onClick={() => onSelectModel(model.id)}
                  className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded transition-colors"
                  title="切換到此模型"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => onRemoveModel(model.id)}
                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
                title="刪除模型"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )}
</div>
```

**驗證方式**：
- ✅ 模型列表正確顯示
- ✅ 活動模型有綠色標記
- ✅ 切換和刪除按鈕正常

**可視化驗證**：
1. **上傳 2-3 個模型**
2. **切換到「模型管理」分頁**
3. **應該看到**：
   - "所有模型 (3)" 標題
   - 3 個模型卡片
   - 活動模型有綠色圓點和綠色邊框
   - 非活動模型有灰色圓點
   - 每個模型有「切換」和「刪除」按鈕
4. **點擊非活動模型的「切換」按鈕**，該模型應該變成活動模型（綠色標記移動）

---

#### Step 3.4：實作新增模型按鈕

**檔案**：`presentation/features/model-manager/components/ModelManagerPanel.tsx`

**實作內容**：添加檔案上傳按鈕

```typescript
<div className="mt-4">
  <input
    type="file"
    accept=".fbx,.png,.jpg,.jpeg,.tga"
    multiple
    onChange={(e) => {
      if (e.target.files && e.target.files.length > 0) {
        onAddModel(e.target.files);
        e.target.value = ''; // 重置 input
      }
    }}
    className="hidden"
    id="model-upload-input"
    disabled={isLoading}
  />
  <label
    htmlFor="model-upload-input"
    className={`flex items-center justify-center gap-2 w-full py-3 px-4 rounded-md font-medium transition-colors cursor-pointer ${
      isLoading
        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
    }`}
  >
    {isLoading ? (
      <>
        <Loader2 className="w-4 h-4 animate-spin" />
        載入中...
      </>
    ) : (
      <>
        <Plus className="w-4 h-4" />
        新增模型
      </>
    )}
  </label>
  <p className="text-[10px] text-gray-500 mt-1 text-center">
    *支援 FBX 檔案與貼圖檔案
  </p>
</div>
```

**驗證方式**：
- ✅ 按鈕正常顯示
- ✅ 點擊可以選擇檔案
- ✅ 載入時顯示載入狀態

**可視化驗證**：
1. **點擊「新增模型」按鈕**
2. **選擇 FBX 檔案**
3. **應該看到**：
   - 按鈕文字變為「載入中...」
   - 按鈕變為灰色且不可點擊
   - 載入完成後，新模型出現在列表中
   - 新模型自動設為活動模型

---

#### Step 3.5：實作模型重新命名功能

**檔案**：`presentation/features/model-manager/components/ModelManagerPanel.tsx`

**實作內容**：添加重新命名功能

```typescript
const [editingId, setEditingId] = useState<string | null>(null);
const [editName, setEditName] = useState('');

// 在模型卡片中添加編輯按鈕和輸入框
{model.id === editingId ? (
  <div className="flex items-center gap-1 flex-1">
    <input
      type="text"
      value={editName}
      onChange={(e) => setEditName(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onRenameModel(model.id, editName);
          setEditingId(null);
        } else if (e.key === 'Escape') {
          setEditingId(null);
        }
      }}
      className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-blue-500"
      autoFocus
    />
    <button
      onClick={() => {
        onRenameModel(model.id, editName);
        setEditingId(null);
      }}
      className="p-1 text-green-400 hover:bg-gray-700 rounded"
    >
      <Check className="w-4 h-4" />
    </button>
    <button
      onClick={() => setEditingId(null)}
      className="p-1 text-red-400 hover:bg-gray-700 rounded"
    >
      <X className="w-4 h-4" />
    </button>
  </div>
) : (
  <>
    <span className="text-white text-sm truncate">{model.name}</span>
    <button
      onClick={() => {
        setEditingId(model.id);
        setEditName(model.name);
      }}
      className="p-1.5 text-gray-400 hover:text-yellow-400 hover:bg-gray-700 rounded transition-colors"
      title="重新命名"
    >
      <Edit2 className="w-4 h-4" />
    </button>
  </>
)}
```

**驗證方式**：
- ✅ 可以點擊編輯按鈕
- ✅ 可以輸入新名稱
- ✅ 可以確認或取消

**可視化驗證**：
1. **點擊模型名稱旁的「編輯」按鈕**
2. **應該看到**：
   - 名稱變為輸入框
   - 出現「確認」（綠色）和「取消」（紅色）按鈕
3. **輸入新名稱並按 Enter 或點擊確認**
4. **應該看到**：模型名稱更新為新名稱
5. **按 Esc 或點擊取消**：應該取消編輯，名稱恢復原樣

---

### 🎯 階段四：更新 SceneViewer 使用 activeModel

#### Step 4.1：修改 SceneViewer Props

**檔案**：`presentation/features/scene-viewer/components/SceneViewer.tsx`

**實作內容**：更新介面定義

```typescript
import type { ModelInstance } from '../../../../domain/value-objects/ModelInstance';

interface SceneViewerProps {
  activeModel: ModelInstance | null;  // 取代單獨的 model, shaderGroups 等
  cameraSettings: {
    fov: number;
    near: number;
    far: number;
  };
  // ... 其他全域設定（保持不變）
}
```

**驗證方式**：
- ✅ TypeScript 編譯無錯誤
- ✅ Props 類型正確

**可視化驗證**：
- 在 App.tsx 中更新 SceneViewer 調用：
  ```typescript
  <SceneViewer
    activeModel={activeModel}
    cameraSettings={cameraSettings}
    // ... 其他 props
  />
  ```
- 確認無 TypeScript 錯誤

---

#### Step 4.2：更新 Model 組件內部邏輯

**檔案**：`presentation/features/scene-viewer/components/SceneViewer.tsx`

**實作內容**：在 Model 組件中使用 activeModel

```typescript
const Model = forwardRef<ModelRef, ModelProps>(
  ({ activeModel, clip, onTimeUpdate, isShaderEnabled = true, loop = true, onFinish, enableShadows }, ref) => {
    // 從 activeModel 取得資料
    const model = activeModel?.model || null;
    const shaderGroups = activeModel?.shaderGroups || [];
    const createdClips = activeModel?.createdClips || [];
    
    // ... 其餘邏輯保持不變，但使用上述變數
  }
);
```

**驗證方式**：
- ✅ 模型正常渲染
- ✅ Shader 正常應用

**可視化驗證**：
1. **上傳模型**
2. **應該看到**：SceneViewer 中正常顯示模型
3. **切換到「Material Shader」分頁**，設定 Shader
4. **應該看到**：Shader 效果正常應用在模型上

---

#### Step 4.3：更新動畫播放邏輯

**檔案**：`presentation/features/scene-viewer/components/SceneViewer.tsx`

**實作內容**：使用 activeModel 的播放狀態

```typescript
// 在 Model 組件中
const isPlaying = activeModel?.isPlaying || false;
const currentTime = activeModel?.currentTime || 0;
const isLoopEnabled = activeModel?.isLoopEnabled || true;

// 更新時間時，透過回調更新 activeModel
useEffect(() => {
  if (onTimeUpdate && activeModel) {
    onTimeUpdate(currentTime);
    // 在 App.tsx 中會透過 updateModel 更新 activeModel.currentTime
  }
}, [currentTime, activeModel, onTimeUpdate]);
```

**驗證方式**：
- ✅ 動畫正常播放
- ✅ 時間更新正常

**可視化驗證**：
1. **上傳有動畫的模型**
2. **在 ModelInspector 中播放動畫**
3. **應該看到**：
   - 動畫正常播放
   - 時間軸正常更新
   - 循環播放正常運作

---

### 🎯 階段五：更新功能面板使用 activeModel

#### Step 5.1：更新 MaterialShaderTool

**檔案**：`presentation/features/shader-panel/components/MaterialShaderTool.tsx`

**實作內容**：更新 Props 和內部邏輯

```typescript
import type { ModelInstance } from '../../../../domain/value-objects/ModelInstance';

interface MaterialShaderToolProps {
  activeModel: ModelInstance | null;
  updateModel: (id: string, updates: Partial<ModelInstance>) => void;
}

export default function MaterialShaderTool({
  activeModel,
  updateModel
}: MaterialShaderToolProps) {
  if (!activeModel) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>請先載入模型</p>
      </div>
    );
  }
  
  const shaderGroups = activeModel.shaderGroups;
  const meshNames = activeModel.meshNames;
  const isShaderEnabled = activeModel.isShaderEnabled;
  
  const handleGroupsChange = (newGroups: ShaderGroup[]) => {
    updateModel(activeModel.id, { shaderGroups: newGroups });
  };
  
  const handleToggleShader = (enabled: boolean) => {
    updateModel(activeModel.id, { isShaderEnabled: enabled });
  };
  
  // ... 其餘邏輯保持不變
}
```

**驗證方式**：
- ✅ 編譯無錯誤
- ✅ Shader 設定正常

**可視化驗證**：
1. **切換到「Material Shader」分頁**
2. **應該看到**：
   - 如果沒有活動模型：顯示「請先載入模型」
   - 如果有活動模型：正常顯示 Shader 設定介面
3. **修改 Shader 設定**
4. **切換到其他模型，再切換回來**
5. **應該看到**：Shader 設定保持獨立（每個模型有自己的設定）

---

#### Step 5.2：更新 AudioPanel

**檔案**：`presentation/features/audio-panel/components/AudioPanel.tsx`

**實作內容**：類似 MaterialShaderTool 的更新方式

```typescript
interface AudioPanelProps {
  activeModel: ModelInstance | null;
  updateModel: (id: string, updates: Partial<ModelInstance>) => void;
  audioController: InstanceType<typeof AudioController>;
}

export default function AudioPanel({
  activeModel,
  updateModel,
  audioController
}: AudioPanelProps) {
  if (!activeModel) {
    return <div className="text-center py-8 text-gray-500">請先載入模型</div>;
  }
  
  const audioTracks = activeModel.audioTracks;
  const createdClips = activeModel.createdClips;
  
  const setAudioTracks = (tracks: AudioTrack[]) => {
    updateModel(activeModel.id, { audioTracks: tracks });
  };
  
  // ... 其餘邏輯保持不變
}
```

**驗證方式**：
- ✅ Audio 功能正常
- ✅ 每個模型獨立

**可視化驗證**：
1. **上傳兩個模型**
2. **切換到第一個模型，在「Audio」分頁添加音效軌道**
3. **切換到第二個模型**
4. **應該看到**：第二個模型的 Audio 分頁是空的（獨立）
5. **切換回第一個模型**
6. **應該看到**：之前添加的音效軌道還在

---

#### Step 5.3：更新 EffectTestPanel

**檔案**：`presentation/features/effect-panel/components/EffectTestPanel.tsx`

**實作內容**：更新 Props

```typescript
interface EffectTestPanelProps {
  activeModel: ModelInstance | null;
  updateModel: (id: string, updates: Partial<ModelInstance>) => void;
}

export default function EffectTestPanel({
  activeModel,
  updateModel
}: EffectTestPanelProps) {
  if (!activeModel) {
    return <div className="text-center py-8 text-gray-500">請先載入模型</div>;
  }
  
  const effects = activeModel.effects;
  const model = activeModel.model;
  const bones = activeModel.bones;
  const createdClips = activeModel.createdClips;
  
  const setEffects = (newEffects: EffectItem[]) => {
    updateModel(activeModel.id, { effects: newEffects });
  };
  
  // ... 其餘邏輯保持不變
}
```

**驗證方式**：
- ✅ Effect 功能正常
- ✅ 每個模型獨立

**可視化驗證**：
1. **類似 AudioPanel 的測試流程**
2. **確認每個模型的 Effect 設定完全獨立**

---

#### Step 5.4：更新 ModelInspector

**檔案**：`presentation/features/model-inspector/components/ModelInspector.tsx`

**實作內容**：更新 Props

```typescript
interface ModelInspectorProps {
  activeModel: ModelInstance | null;
  updateModel: (id: string, updates: Partial<ModelInstance>) => void;
  // ... 其他 props（播放控制等）
}

export default function ModelInspector({
  activeModel,
  updateModel,
  // ... 其他 props
}: ModelInspectorProps) {
  if (!activeModel) {
    return <div className="text-center py-8 text-gray-500">請先載入模型</div>;
  }
  
  const model = activeModel.model;
  const createdClips = activeModel.createdClips;
  const audioTracks = activeModel.audioTracks;
  const effects = activeModel.effects;
  
  const handleCreateClip = (name: string, start: number, end: number) => {
    // 創建 clip 並更新 activeModel.createdClips
    const newClip = CreateClipUseCase.execute(/* ... */);
    updateModel(activeModel.id, {
      createdClips: [...activeModel.createdClips, newClip]
    });
  };
  
  // ... 其餘邏輯保持不變
}
```

**驗證方式**：
- ✅ ModelInspector 功能正常
- ✅ Clips 獨立管理

**可視化驗證**：
1. **上傳兩個模型**
2. **在第一個模型中創建動作片段**
3. **切換到第二個模型**
4. **應該看到**：第二個模型的 Clips 列表是空的
5. **切換回第一個模型**
6. **應該看到**：之前創建的 Clips 還在

---

### 🎯 階段六：清理和優化

#### Step 6.1：移除舊狀態同步邏輯

**檔案**：`src/App.tsx`

**實作內容**：移除 Step 2.3 中添加的臨時同步邏輯

```typescript
// 刪除這些舊狀態
// const [model, setModel] = useState<THREE.Group | null>(null);
// const [meshNames, setMeshNames] = useState<string[]>([]);
// ... 其他舊狀態

// 刪除同步 useEffect
// useEffect(() => { ... }, [activeModel]);
```

**驗證方式**：
- ✅ 編譯無錯誤
- ✅ 功能正常

**可視化驗證**：
- 確認所有功能仍然正常運作
- 確認沒有遺漏的舊狀態引用

---

#### Step 6.2：更新所有組件調用

**檔案**：`src/App.tsx`

**實作內容**：確保所有組件都使用 activeModel

```typescript
// 檢查所有組件調用
<SceneViewer activeModel={activeModel} ... />
<MaterialShaderTool activeModel={activeModel} updateModel={updateModel} />
<AudioPanel activeModel={activeModel} updateModel={updateModel} ... />
<EffectTestPanel activeModel={activeModel} updateModel={updateModel} />
<ModelInspector activeModel={activeModel} updateModel={updateModel} ... />
```

**驗證方式**：
- ✅ 所有組件正確更新
- ✅ 無遺漏

**可視化驗證**：
- 逐一測試每個分頁功能
- 確認都正常運作

---

#### Step 6.3：添加錯誤處理和邊界情況

**檔案**：各相關組件

**實作內容**：處理邊界情況

```typescript
// 在 ModelManagerPanel 中
const handleRemoveModel = (id: string) => {
  if (models.length === 1) {
    if (confirm('這是最後一個模型，確定要刪除嗎？')) {
      onRemoveModel(id);
    }
  } else {
    onRemoveModel(id);
  }
};

// 在 App.tsx 中
const handleRemoveModel = (id: string) => {
  removeModel(id);
  // 如果刪除的是活動模型，自動切換到第一個模型
  if (activeModelId === id && models.length > 1) {
    const remaining = models.filter(m => m.id !== id);
    if (remaining.length > 0) {
      setActiveModelId(remaining[0].id);
    }
  }
};
```

**驗證方式**：
- ✅ 邊界情況正確處理
- ✅ 用戶體驗良好

**可視化驗證**：
1. **刪除活動模型**：應該自動切換到其他模型
2. **刪除最後一個模型**：應該顯示確認對話框
3. **載入失敗**：應該顯示錯誤訊息

---

## 驗證檢查清單

### 基礎功能驗證

- [ ] **Step 1.1-1.3**：基礎架構創建成功，無編譯錯誤
- [ ] **Step 2.1-2.3**：可以上傳模型，activeModel 正確設置
- [ ] **Step 3.1-3.5**：模型管理面板正常顯示，可以新增/切換/刪除/重新命名模型

### 功能獨立性驗證

- [ ] **多模型載入**：可以同時載入多個模型
- [ ] **模型切換**：切換模型時，SceneViewer 正確更新
- [ ] **Shader 獨立**：每個模型的 Shader 設定完全獨立
- [ ] **Audio 獨立**：每個模型的 Audio 軌道完全獨立
- [ ] **Effect 獨立**：每個模型的 Effect 設定完全獨立
- [ ] **Clips 獨立**：每個模型的動作片段完全獨立

### UI 驗證

- [ ] **模型管理面板**：
  - [ ] 活動模型有綠色標記
  - [ ] 模型列表正確顯示
  - [ ] 統計數據正確（Mesh、Bones、Clips、Effects 數量）
  - [ ] 新增/切換/刪除/重新命名功能正常

- [ ] **其他分頁**：
  - [ ] Material Shader 分頁正常
  - [ ] Audio 分頁正常
  - [ ] Effect 分頁正常
  - [ ] ModelInspector 正常

### 邊界情況驗證

- [ ] **無模型時**：所有分頁顯示「請先載入模型」
- [ ] **刪除活動模型**：自動切換到其他模型
- [ ] **刪除最後一個模型**：顯示確認對話框
- [ ] **模型載入失敗**：顯示錯誤訊息
- [ ] **模型切換**：狀態正確保存和恢復

### 相機設定驗證

- [ ] **相機設定全域**：修改相機設定，所有模型共用
- [ ] **相機設定獨立**：確認相機設定不在 ModelInstance 中

---

## 完成標準

### 每個階段完成標準

1. **階段一**：✅ 所有檔案創建成功，無編譯錯誤
2. **階段二**：✅ 可以上傳模型，activeModel 正確管理
3. **階段三**：✅ 模型管理面板完整顯示，所有功能正常
4. **階段四**：✅ SceneViewer 正確使用 activeModel
5. **階段五**：✅ 所有功能面板正確使用 activeModel
6. **階段六**：✅ 清理完成，無遺留舊代碼

### 最終驗證

- [ ] 可以載入多個模型
- [ ] 可以切換模型
- [ ] 每個模型的資料完全獨立
- [ ] 相機設定全域共享
- [ ] 所有功能正常運作
- [ ] UI 美觀且易用
- [ ] 無明顯效能問題

---

## 預估時間

- **階段一**：0.5-1 天
- **階段二**：1-1.5 天
- **階段三**：2-3 天
- **階段四**：1-2 天
- **階段五**：2-3 天
- **階段六**：1 天

**總計**：約 7.5-11.5 個工作天

---

## 注意事項

1. **每個步驟完成後立即驗證**：確保 UI 變化可見
2. **保持向後兼容**：在完全遷移前，舊功能應該仍然可用
3. **逐步遷移**：不要一次性修改所有檔案
4. **測試優先**：每個功能完成後立即測試
5. **文檔更新**：完成後更新 PROJECT_CONTEXT.md

---

## 下一步

1. ✅ 審查此規劃文檔
2. ⏭️ 開始階段一：創建基礎架構
3. ⏭️ 逐步實施，每個步驟完成後驗證
4. ⏭️ 完成後進行全面測試
