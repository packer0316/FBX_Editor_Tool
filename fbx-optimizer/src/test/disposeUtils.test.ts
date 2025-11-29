import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { disposeModel } from '../utils/three/disposeUtils';

describe('disposeUtils', () => {
  describe('disposeModel', () => {
    it('應該正確處理 null 輸入', () => {
      expect(() => disposeModel(null)).not.toThrow();
    });

    it('應該釋放 Geometry', () => {
      const group = new THREE.Group();
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshBasicMaterial();
      const mesh = new THREE.Mesh(geometry, material);
      
      const geometryDisposeSpy = vi.spyOn(geometry, 'dispose');
      
      group.add(mesh);
      disposeModel(group);
      
      expect(geometryDisposeSpy).toHaveBeenCalled();
    });

    it('應該釋放 Material', () => {
      const group = new THREE.Group();
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshBasicMaterial();
      const mesh = new THREE.Mesh(geometry, material);
      
      const materialDisposeSpy = vi.spyOn(material, 'dispose');
      
      group.add(mesh);
      disposeModel(group);
      
      expect(materialDisposeSpy).toHaveBeenCalled();
    });

    it('應該釋放多個 Material', () => {
      const group = new THREE.Group();
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const materials = [
        new THREE.MeshBasicMaterial(),
        new THREE.MeshBasicMaterial(),
      ];
      const mesh = new THREE.Mesh(geometry, materials);
      
      const disposeSpies = materials.map(m => vi.spyOn(m, 'dispose'));
      
      group.add(mesh);
      disposeModel(group);
      
      disposeSpies.forEach(spy => {
        expect(spy).toHaveBeenCalled();
      });
    });

    it('應該釋放 userData.originalMaterial（單材質）', () => {
      const group = new THREE.Group();
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const currentMaterial = new THREE.ShaderMaterial();
      const originalMaterial = new THREE.MeshBasicMaterial();
      const mesh = new THREE.Mesh(geometry, currentMaterial);
      
      // 模擬 Shader 切換時保存的原始材質
      mesh.userData.originalMaterial = originalMaterial;
      
      const originalMaterialDisposeSpy = vi.spyOn(originalMaterial, 'dispose');
      
      group.add(mesh);
      disposeModel(group);
      
      expect(originalMaterialDisposeSpy).toHaveBeenCalled();
      expect(mesh.userData.originalMaterial).toBeUndefined();
    });

    it('應該釋放 userData.originalMaterial（多材質陣列）', () => {
      const group = new THREE.Group();
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const currentMaterial = new THREE.ShaderMaterial();
      const originalMaterials = [
        new THREE.MeshBasicMaterial(),
        new THREE.MeshBasicMaterial(),
      ];
      const mesh = new THREE.Mesh(geometry, currentMaterial);
      
      // 模擬 Shader 切換時保存的原始材質陣列
      mesh.userData.originalMaterial = originalMaterials;
      
      const disposeSpies = originalMaterials.map(m => vi.spyOn(m, 'dispose'));
      
      group.add(mesh);
      disposeModel(group);
      
      disposeSpies.forEach(spy => {
        expect(spy).toHaveBeenCalled();
      });
      expect(mesh.userData.originalMaterial).toBeUndefined();
    });

    it('應該釋放 ShaderMaterial 的 uniforms 中的貼圖', () => {
      const group = new THREE.Group();
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const texture = new THREE.Texture();
      const material = new THREE.ShaderMaterial({
        uniforms: {
          testTexture: { value: texture }
        }
      });
      const mesh = new THREE.Mesh(geometry, material);
      
      const textureDisposeSpy = vi.spyOn(texture, 'dispose');
      
      group.add(mesh);
      disposeModel(group);
      
      expect(textureDisposeSpy).toHaveBeenCalled();
    });

    it('應該清空 Group 的子節點', () => {
      const group = new THREE.Group();
      const mesh1 = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
      const mesh2 = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
      
      group.add(mesh1);
      group.add(mesh2);
      
      expect(group.children.length).toBe(2);
      
      disposeModel(group);
      
      expect(group.children.length).toBe(0);
    });
  });
});

