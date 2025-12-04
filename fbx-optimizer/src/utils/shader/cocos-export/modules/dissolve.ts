/**
 * Dissolve (溶解效果) 功能模組
 */
import type { ShaderFeatureModule } from '../types';

/**
 * 將 hex 顏色轉換為 RGBA 陣列
 */
function hexToRGBA(hex: string): [number, number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return [
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255,
      1
    ];
  }
  return [1, 1, 1, 1];
}

export const dissolveModule: ShaderFeatureModule = {
  name: 'dissolve',
  
  properties: (params) => {
    const color1 = hexToRGBA(params.color1 || '#ffff00');
    const color2 = hexToRGBA(params.color2 || '#ff0000');
    return `
        dissolveTexture: { value: grey }
        dissolveThreshold: { value: ${(params.threshold ?? 0).toFixed(2)}, range: [0.0, 1.0], editor: { type: slider, parent: USE_DISSOLVE } }
        dissolveEdgeWidth: { value: ${(params.edgeWidth ?? 0.15).toFixed(2)}, range: [0.0, 0.5], editor: { type: slider, parent: USE_DISSOLVE } }
        dissolveColor1:  { value: [${color1[0].toFixed(2)}, ${color1[1].toFixed(2)}, ${color1[2].toFixed(2)}, ${color1[3].toFixed(2)}], linear: true, editor: { type: color, parent: USE_DISSOLVE } }
        dissolveColor2:  { value: [${color2[0].toFixed(2)}, ${color2[1].toFixed(2)}, ${color2[2].toFixed(2)}, ${color2[3].toFixed(2)}], linear: true, editor: { type: color, parent: USE_DISSOLVE } }`;
  },
  
  uniforms: `
  #if USE_DISSOLVE
    uniform sampler2D dissolveTexture;
  #endif`,
  
  vertexDeclarations: '',
  
  vertexMain: '',
  
  fragmentDeclarations: `
  #if USE_DISSOLVE
    uniform DissolveValue {
      vec4 dissolveColor1;
      vec4 dissolveColor2;
      float dissolveThreshold;
      float dissolveEdgeWidth;
    };
  #endif`,
  
  fragmentMain: `
    #if USE_DISSOLVE
      float dissolveValue = texture(dissolveTexture, v_uv).r;
      float edge = dissolveThreshold + dissolveEdgeWidth;
      
      if (dissolveValue < dissolveThreshold) {
        discard;
      }
      
      if (dissolveValue < edge) {
        float edgeFactor = (dissolveValue - dissolveThreshold) / dissolveEdgeWidth;
        vec3 edgeColor = mix(dissolveColor1.rgb, dissolveColor2.rgb, edgeFactor);
        o.rgb = mix(edgeColor, o.rgb, edgeFactor);
      }
    #endif`,
  
  dependencies: []
};

