/**
 * Rim Light 功能模組
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

export const rimLightModule: ShaderFeatureModule = {
  name: 'rim_light',
  
  properties: (params) => {
    const color = hexToRGBA(params.color || '#ffffff');
    return `
        rimLightTexture: { value: grey, editor: { parent: USE_RIM_LIGHT } }
        rimLightColor:  { value: [${color[0].toFixed(2)}, ${color[1].toFixed(2)}, ${color[2].toFixed(2)}, ${color[3].toFixed(2)}], linear: true, editor: { type: color, parent: USE_RIM_LIGHT } }
        rimPower:       { value: ${params.power?.toFixed(2) ?? '2.70'}, range: [0.1, 10.0], editor: { type: slider, parent: USE_RIM_LIGHT } }
        rimIntensity:   { value: ${params.intensity?.toFixed(2) ?? '1.00'}, range: [0.0, 5.0], editor: { type: slider, parent: USE_RIM_LIGHT } }`;
  },
  
  uniforms: `
  #if USE_RIM_LIGHT
    uniform sampler2D rimLightTexture;
  #endif`,
  
  vertexDeclarations: '',
  
  vertexMain: '',
  
  fragmentDeclarations: `
  #if USE_RIM_LIGHT
    uniform RimLightValue {
      vec4 rimLightColor;
      float rimPower;
      float rimIntensity;
    };

    vec3 applyRimLight(vec3 baseColor, vec3 normal) {
      vec3 worldNor = normalize(normal);
      vec3 viewDir = normalize(cc_cameraPos.xyz - v_worldPos);
      
      float rimValue = 1.0 - clamp(dot(worldNor, viewDir), 0.0, 1.0);
      rimValue = pow(rimValue, 1.0 / max(rimPower, 0.01));
      
      vec3 viewNormal = normalize(mat3(cc_matView) * worldNor);
      vec2 rimUV = viewNormal.xy * 0.5 + 0.5;
      vec3 rimTexColor = SRGBToLinear(texture(rimLightTexture, vec2(rimUV.x, 1.0 - rimUV.y)).rgb);
      
      vec3 finalRimColor = rimTexColor * rimLightColor.rgb;
      vec3 rimContribution = finalRimColor * rimValue * rimIntensity;
      
      return baseColor + rimContribution;
    }
  #endif`,
  
  fragmentMain: `
    #if USE_RIM_LIGHT
      o.rgb = applyRimLight(o.rgb, finalNormal);
    #endif`,
  
  dependencies: []
};

