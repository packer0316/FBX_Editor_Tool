# Spine TypeScript Runtime 3.8 ✅

## 安裝狀態

✅ **已安裝** - Spine Runtime 3.8 已成功整合到專案中。

## 目錄結構

```
src/vendor/spine-ts-3.8/
├── index.ts          # 統一匯出入口
├── core/             # 核心模組
│   └── src/
│       ├── Animation.ts
│       ├── AnimationState.ts
│       ├── Skeleton.ts
│       ├── SkeletonBinary.ts
│       ├── SkeletonJson.ts
│       └── ... (其他核心類型)
├── canvas/           # Canvas 渲染模組
│   └── src/
│       ├── AssetManager.ts
│       ├── CanvasTexture.ts
│       └── SkeletonRenderer.ts
└── README.md
```

## 使用方式

```typescript
// 從本地 vendor 匯入
import { 
  Skeleton, 
  SkeletonBinary, 
  AnimationState, 
  TextureAtlas,
  SkeletonRenderer 
} from '../../vendor/spine-ts-3.8';

// 或匯入特定模組
import { Skeleton } from '../../vendor/spine-ts-3.8/core/src/Skeleton';
```

## 版本資訊

- **Spine Runtime 版本**: 3.8
- **來源**: https://github.com/EsotericSoftware/spine-runtimes/tree/3.8/spine-ts
- **安裝日期**: 2024

## 授權

Spine Runtime 需要有效的 Spine 授權才能使用。
詳見：https://esotericsoftware.com/spine-runtimes-license
