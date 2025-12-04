/**
 * Matcap Add 功能模組
 * 支援單一模式和 RGB 通道遮罩模式
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

export const matcapAddModule: ShaderFeatureModule = {
  name: 'matcap_add',
  
  properties: (params) => {
    const isRGBMode = params.isRGBMode === true;
    const color = hexToRGBA(params.color || '#ffffff');
    
    if (isRGBMode) {
      // RGB 模式：遮罩 + 三個通道貼圖 + 三個通道強度 + 顏色
      const strengthR = params.strengthR ?? 1.0;
      const strengthG = params.strengthG ?? 1.0;
      const strengthB = params.strengthB ?? 1.0;
      return `
        matcapAddMaskTexture:   { value: grey }
        matcapAddTextureR:      { value: grey }
        matcapAddTextureG:      { value: grey }
        matcapAddTextureB:      { value: grey }
        matcapAddStrengthR:     { value: ${strengthR.toFixed(2)}, range: [0.0, 2.0], editor: { type: slider } }
        matcapAddStrengthG:     { value: ${strengthG.toFixed(2)}, range: [0.0, 2.0], editor: { type: slider } }
        matcapAddStrengthB:     { value: ${strengthB.toFixed(2)}, range: [0.0, 2.0], editor: { type: slider } }
        matcapAddColor:         { value: [${color[0].toFixed(2)}, ${color[1].toFixed(2)}, ${color[2].toFixed(2)}, ${color[3].toFixed(2)}], linear: true, editor: { type: color } }`;
    } else {
      // 單一模式：主貼圖 + 遮罩 + 強度 + 顏色
      return `
        matcapAddTexture:       { value: grey, editor: { parent: USE_MATCAP_ADD } }
        matcapAddMaskTexture:   { value: white, editor: { parent: USE_MATCAP_ADD_MASK } }
        matcapAddStrength:      { value: ${params.strength?.toFixed(2) ?? '1.00'}, range: [0.0, 3.0], editor: { type: slider, parent: USE_MATCAP_ADD } }
        matcapAddColor:         { value: [${color[0].toFixed(2)}, ${color[1].toFixed(2)}, ${color[2].toFixed(2)}, ${color[3].toFixed(2)}], linear: true, editor: { type: color, parent: USE_MATCAP_ADD } }`;
    }
  },
  
  uniforms: (params) => {
    const isRGBMode = params.isRGBMode === true;
    
    if (isRGBMode) {
      return `
  uniform sampler2D matcapAddMaskTexture;
  uniform sampler2D matcapAddTextureR;
  uniform sampler2D matcapAddTextureG;
  uniform sampler2D matcapAddTextureB;`;
    } else {
      return `
  #if USE_MATCAP_ADD
    uniform sampler2D matcapAddTexture;
  #endif
  #if USE_MATCAP_ADD_MASK
    uniform sampler2D matcapAddMaskTexture;
  #endif`;
    }
  },
  
  vertexDeclarations: '',
  
  vertexMain: '',
  
  fragmentDeclarations: (params) => {
    const isRGBMode = params.isRGBMode === true;
    
    if (isRGBMode) {
      return `
  uniform MatcapAddRGBValue {
    vec4 matcapAddColor;
    float matcapAddStrengthR;
    float matcapAddStrengthG;
    float matcapAddStrengthB;
  };

  vec2 GetMatcapAddUV(vec3 worldNormal) {
    vec3 viewNormal = normalize(mat3(cc_matView) * worldNormal);
    vec2 muv = viewNormal.xy * 0.5 + 0.5;
    return vec2(muv.x, 1.0 - muv.y);
  }`;
    } else {
      return `
  #if USE_MATCAP_ADD
    uniform MatcapAddValue {
      vec4 matcapAddColor;
      float matcapAddStrength;
    };
  #endif`;
    }
  },
  
  fragmentMain: (params) => {
    const isRGBMode = params.isRGBMode === true;
    
    if (isRGBMode) {
      return `
    // RGB 通道遮罩 Matcap Add
    {
      vec4 addMaskColor = texture(matcapAddMaskTexture, v_uv);
      vec3 addMaskType = addMaskColor.rgb;
      vec2 matcapAdd_uv = GetMatcapAddUV(finalNormal);
      vec3 matcapAddResult = vec3(0.0);

      if (addMaskType.r > 0.0) {
        vec3 colR = SRGBToLinear(texture(matcapAddTextureR, matcapAdd_uv).rgb);
        matcapAddResult += colR * matcapAddStrengthR * addMaskType.r * matcapAddColor.rgb;
      }

      if (addMaskType.g > 0.0) {
        vec3 colG = SRGBToLinear(texture(matcapAddTextureG, matcapAdd_uv).rgb);
        matcapAddResult += colG * matcapAddStrengthG * addMaskType.g * matcapAddColor.rgb;
      }

      if (addMaskType.b > 0.0) {
        vec3 colB = SRGBToLinear(texture(matcapAddTextureB, matcapAdd_uv).rgb);
        matcapAddResult += colB * matcapAddStrengthB * addMaskType.b * matcapAddColor.rgb;
      }

      o.rgb += matcapAddResult;
    }`;
    } else {
      return `
    #if USE_MATCAP_ADD
      vec3 viewNormal = normalize(mat3(cc_matView) * finalNormal);
      vec2 matcapAddUV = viewNormal.xy * 0.5 + 0.5;
      vec3 matcapAddSample = SRGBToLinear(texture(matcapAddTexture, vec2(matcapAddUV.x, 1.0 - matcapAddUV.y)).rgb);
      vec3 matcapAddFinal = matcapAddSample * matcapAddColor.rgb * matcapAddStrength;
      
      float matcapAddMask = 1.0;
      #if USE_MATCAP_ADD_MASK
        matcapAddMask = texture(matcapAddMaskTexture, v_uv).r;
      #endif
      
      o.rgb += matcapAddFinal * matcapAddMask;
    #endif`;
    }
  },
  
  dependencies: []
};
