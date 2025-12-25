import { useState, useEffect } from 'react';
import * as THREE from 'three';

/**
 * 骨骼提取 Hook
 * 
 * 從 Three.js 模型中提取骨骼與可綁定節點資訊。此 Hook 會從以下來源提取：
 * 1. 模型樹狀結構中的 Bone 節點（type === 'Bone' 或 isBone === true）
 * 2. SkinnedMesh 的 skeleton.bones 陣列
 * 3. Dummy 節點（3DS Max 輔助物件，名稱包含 'dummy'）
 * 4. Camera 節點（名稱包含 'camera'，用於相機綁定）
 * 
 * 這個計算方式與 3DS Max 和 Blender 相同，確保計算所有真正的骨骼節點，
 * 同時也包含 Dummy 輔助物件和 Camera 節點以便相機綁定等用途。
 * 
 * @param model - Three.js 模型群組，將從中提取骨骼，如果為 null 則返回空陣列
 * @returns 可綁定節點陣列（包含 Bone 和 Dummy），當模型改變時會自動更新
 * 
 * @example
 * ```typescript
 * const bones = useBoneExtraction(model);
 * 
 * return (
 *   <select>
 *     {bones.map(bone => (
 *       <option key={bone.uuid} value={bone.uuid}>{bone.name}</option>
 *     ))}
 *   </select>
 * );
 * ```
 */
export function useBoneExtraction(model: THREE.Group | null) {
  const [bones, setBones] = useState<THREE.Object3D[]>([]);

  useEffect(() => {
    if (model) {
      const boneSet = new Set<THREE.Object3D>();
      
      model.traverse((child) => {
        // 來源1: 樹狀結構中的 Bone 節點
        if (child.type === 'Bone' || (child as any).isBone) {
          boneSet.add(child);
        }
        
        // 來源2: SkinnedMesh 的 skeleton.bones
        if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
          const skinnedMesh = child as THREE.SkinnedMesh;
          if (skinnedMesh.skeleton && skinnedMesh.skeleton.bones) {
            skinnedMesh.skeleton.bones.forEach((bone) => {
              boneSet.add(bone);
            });
          }
        }
        
        // 來源3: Dummy 節點（3DS Max 輔助物件）
        // Dummy 在 FBX 匯入後會變成普通的 Object3D，透過名稱識別
        if (child.name.toLowerCase().includes('dummy')) {
          boneSet.add(child);
        }
        
        // 來源4: Camera 節點（用於相機綁定）
        // Camera 輔助物件在 FBX 匯入後可能是普通 Object3D，透過名稱識別
        if (child.name.toLowerCase().includes('camera')) {
          boneSet.add(child);
        }
      });
      
      setBones(Array.from(boneSet));
    } else {
      setBones([]);
    }
  }, [model]);

  return bones;
}

