/**
 * Bleach (漂白/受擊閃白) 功能模組
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

export const bleachModule: ShaderFeatureModule = {
  name: 'bleach',
  
  properties: (params) => {
    const color = hexToRGBA(params.color || '#ffffff');
    const intensity = params.intensity ?? 0;
    return `
        bleachColor:    { value: [${color[0].toFixed(2)}, ${color[1].toFixed(2)}, ${color[2].toFixed(2)}, ${intensity.toFixed(2)}], linear: true, editor: { type: color } }`;
  },
  
  uniforms: '',
  
  vertexDeclarations: '',
  
  vertexMain: '',
  
  fragmentDeclarations: `
  #if USE_BLEACH_COLOR
    uniform BleachValue {
      vec4 bleachColor;
    };

    vec3 bleach(vec3 oldColor, float lerpValue, vec3 normal) {
      vec3 worldNor = normalize(normal);
      vec3 viewDir = normalize(cc_cameraPos.xyz - v_worldPos);
      float theta = 1.0 - clamp(dot(worldNor, viewDir), 0.0, 1.0);
      float scalar = 1.7;
      return mix(oldColor, bleachColor.rgb * scalar, lerpValue * pow(theta, 2.7));
    }
  #endif`,
  
  fragmentMain: `
    #if USE_BLEACH_COLOR
      if (bleachColor.w > 0.0) o.rgb = bleach(o.rgb, bleachColor.w, finalNormal);
    #endif`,
  
  dependencies: []
};

