/**
 * Alpha Test (透明度測試) 功能模組
 */
import type { ShaderFeatureModule } from '../types';

export const alphaTestModule: ShaderFeatureModule = {
  name: 'alpha_test',
  
  properties: (params) => `
        alphaThreshold: { value: ${(params.threshold ?? 0.5).toFixed(2)}, target: colorScaleAndCutoff.w, editor: { parent: USE_ALPHA_TEST } }`,
  
  uniforms: '',
  
  vertexDeclarations: '',
  
  vertexMain: '',
  
  fragmentDeclarations: '',
  
  fragmentMain: '', // Alpha test 已經內建在基礎模板中
  
  dependencies: []
};

