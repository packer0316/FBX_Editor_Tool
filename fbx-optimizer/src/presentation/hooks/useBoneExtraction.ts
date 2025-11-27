import { useState, useEffect } from 'react';
import * as THREE from 'three';

/**
 * 骨骼提取 Hook
 * 
 * 從 Three.js 模型中提取骨骼資訊。此 Hook 會從兩個來源提取骨骼：
 * 1. 模型樹狀結構中的 Bone 節點（type === 'Bone' 或 isBone === true）
 * 2. SkinnedMesh 的 skeleton.bones 陣列
 * 
 * 這個計算方式與 3DS Max 和 Blender 相同，確保計算所有真正的骨骼節點。
 * 
 * @param model - Three.js 模型群組，將從中提取骨骼，如果為 null 則返回空陣列
 * @returns 骨骼陣列，當模型改變時會自動更新
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
  const [bones, setBones] = useState<THREE.Bone[]>([]);

  useEffect(() => {
    if (model) {
      const boneSet = new Set<THREE.Bone>();
      
      model.traverse((child) => {
        // 來源1: 樹狀結構中的 Bone 節點
        if (child.type === 'Bone' || (child as any).isBone) {
          boneSet.add(child as THREE.Bone);
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
      });
      
      setBones(Array.from(boneSet));
    } else {
      setBones([]);
    }
  }, [model]);

  return bones;
}

