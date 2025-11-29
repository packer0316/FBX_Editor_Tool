import * as THREE from 'three';

/**
 * Three.js 资源释放工具
 * 
 * 提供完整的 Three.js 对象资源释放功能，防止内存泄漏。
 */

/**
 * 释放 Three.js 模型的所有资源
 * 
 * 遍历模型树，释放所有 Geometry、Material、Texture 等资源。
 * 
 * @param model - 要释放的 Three.js Group 对象
 * 
 * @example
 * ```typescript
 * const model = await loadFBX();
 * // ... 使用模型
 * disposeModel(model); // 释放资源
 * ```
 */
export function disposeModel(model: THREE.Group | null): void {
  if (!model) return;

  model.traverse((child) => {
    // 釋放 userData 中保存的原始材質（Shader 切換時會保存）
    if ((child as any).userData?.originalMaterial) {
      const originalMat = (child as any).userData.originalMaterial;
      if (Array.isArray(originalMat)) {
        originalMat.forEach((mat) => disposeMaterial(mat));
      } else {
        disposeMaterial(originalMat);
      }
      delete (child as any).userData.originalMaterial;
    }

    // 释放 Geometry
    if ((child as any).geometry) {
      (child as any).geometry.dispose();
    }

    // 释放 Material
    if ((child as any).material) {
      const material = (child as any).material;
      
      if (Array.isArray(material)) {
        // 多材质情况
        material.forEach((mat) => {
          disposeMaterial(mat);
        });
      } else {
        // 单材质情况
        disposeMaterial(material);
      }
    }

    // 释放 Skeleton（如果有骨骼动画）
    if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
      const skinnedMesh = child as THREE.SkinnedMesh;
      if (skinnedMesh.skeleton) {
        skinnedMesh.skeleton.dispose();
      }
    }
  });

  // 清空子节点
  model.clear();
}

/**
 * 释放材质及其关联的贴图
 * 
 * @param material - 要释放的材质
 */
function disposeMaterial(material: THREE.Material): void {
  // 释放材质上的所有贴图
  if (material instanceof THREE.MeshStandardMaterial || 
      material instanceof THREE.MeshPhongMaterial ||
      material instanceof THREE.MeshBasicMaterial) {
    
    const textureProperties = [
      'map',
      'normalMap',
      'roughnessMap',
      'metalnessMap',
      'aoMap',
      'emissiveMap',
      'alphaMap',
      'bumpMap',
      'displacementMap',
      'lightMap',
      'envMap',
    ];

    textureProperties.forEach((prop) => {
      const texture = (material as any)[prop];
      if (texture && texture.dispose) {
        texture.dispose();
      }
    });
  }

  // 如果是 ShaderMaterial，释放 uniforms 中的贴图
  if (material instanceof THREE.ShaderMaterial && material.uniforms) {
    Object.values(material.uniforms).forEach((uniform: any) => {
      if (uniform.value && uniform.value.dispose && typeof uniform.value.dispose === 'function') {
        uniform.value.dispose();
      }
    });
  }

  // 释放材质本身
  material.dispose();
}

/**
 * 释放 AnimationClip 资源（如果需要）
 * 
 * 注意：AnimationClip 通常不需要手动释放，
 * 因为它们只是数据，不占用 GPU 资源。
 * 但如果需要，可以清空引用。
 * 
 * @param clip - 动画片段
 */
export function disposeAnimationClip(clip: THREE.AnimationClip | null): void {
  if (!clip) return;
  
  // AnimationClip 主要是 CPU 数据，不需要显式 dispose
  // 但可以清空 tracks 数组来帮助 GC
  if (clip.tracks) {
    clip.tracks.length = 0;
  }
}

