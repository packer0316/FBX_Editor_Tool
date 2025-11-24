import { useState, useEffect } from 'react';
import * as THREE from 'three';

/**
 * 骨骼提取 Hook
 * 
 * 從 Three.js 模型中提取骨骼資訊。此 Hook 會遍歷模型樹狀結構，
 * 找出所有可能的骨骼節點（Bone、Object3D、以及名稱包含 'bone'、'root'、'bip'、'dummy' 的節點）。
 * 
 * 提取邏輯：
 * - 包含類型為 'Bone' 或 'Object3D' 的節點
 * - 包含父節點為 'Bone' 的節點
 * - 包含名稱中帶有骨骼相關關鍵字的節點
 * - 排除模型根節點和 Mesh 節點
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
      const foundBones: THREE.Object3D[] = [];
      model.traverse((child) => {
        // Include all Object3D that could be part of skeleton hierarchy
        // This includes Bone, Object3D, and Group nodes that are part of the armature
        if (
          child.type === 'Bone' ||
          child.type === 'Object3D' ||
          child.parent?.type === 'Bone' ||
          child.name.toLowerCase().includes('bone') ||
          child.name.toLowerCase().includes('root') ||
          child.name.toLowerCase().includes('bip') ||
          child.name.toLowerCase().includes('dummy')
        ) {
          // Exclude the model root itself and meshes
          if (child !== model && !child.isMesh && !child.isSkinnedMesh) {
            foundBones.push(child);
          }
        }
      });
      setBones(foundBones as THREE.Bone[]);
    } else {
      setBones([]);
    }
  }, [model]);

  return bones;
}

