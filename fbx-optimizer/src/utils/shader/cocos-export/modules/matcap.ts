/**
 * Matcap 功能模組
 * 支援單一模式和 RGB 通道遮罩模式
 */
import type { ShaderFeatureModule } from '../types';

export const matcapModule: ShaderFeatureModule = {
  name: 'matcap',
  
  properties: (params) => {
    const isRGBMode = params.isRGBMode === true;
    
    if (isRGBMode) {
      // RGB 模式：遮罩 + 三個通道貼圖 + 三個通道強度
      const strengthR = params.strengthR ?? 1.0;
      const strengthG = params.strengthG ?? 1.0;
      const strengthB = params.strengthB ?? 1.0;
      return `
        matcapMaskTexture:  { value: grey }
        matcapTextureR:     { value: grey }
        matcapTextureG:     { value: grey }
        matcapTextureB:     { value: grey }
        matcapStrengthR:    { value: ${strengthR.toFixed(2)}, range: [0.0, 2.0], editor: { type: slider } }
        matcapStrengthG:    { value: ${strengthG.toFixed(2)}, range: [0.0, 2.0], editor: { type: slider } }
        matcapStrengthB:    { value: ${strengthB.toFixed(2)}, range: [0.0, 2.0], editor: { type: slider } }`;
    } else {
      // 單一模式：主貼圖 + 遮罩 + 混合程度
      return `
        matcapTexture:      { value: grey }
        matcapMaskTexture:  { value: white }
        matcapProgress:     { value: ${params.progress?.toFixed(2) ?? '1.00'}, range: [0.0, 1.0], editor: { type: slider, parent: USE_MATCAP } }`;
    }
  },
  
  uniforms: (params) => {
    const isRGBMode = params.isRGBMode === true;
    
    if (isRGBMode) {
      return `
  uniform sampler2D matcapMaskTexture;
  uniform sampler2D matcapTextureR;
  uniform sampler2D matcapTextureG;
  uniform sampler2D matcapTextureB;`;
    } else {
      return `
  #if USE_MATCAP
    uniform sampler2D matcapTexture;
  #endif
  #if USE_MATCAP_MASK
    uniform sampler2D matcapMaskTexture;
  #endif`;
    }
  },
  
  vertexDeclarations: '',
  
  vertexMain: '',
  
  fragmentDeclarations: (params) => {
    const isRGBMode = params.isRGBMode === true;
    
    if (isRGBMode) {
      return `
  uniform MatcapRGBValue {
    float matcapStrengthR;
    float matcapStrengthG;
    float matcapStrengthB;
  };

  vec2 GetMatcapUV(vec3 worldNormal) {
    vec3 viewNormal = normalize(mat3(cc_matView) * worldNormal);
    vec2 muv = viewNormal.xy * 0.5 + 0.5;
    return vec2(muv.x, 1.0 - muv.y);
  }`;
    } else {
      return `
  #if USE_MATCAP
    uniform MatcapValue {
      float matcapProgress;
    };
  #endif`;
    }
  },
  
  fragmentMain: (params) => {
    const isRGBMode = params.isRGBMode === true;
    
    if (isRGBMode) {
      return `
    // RGB 通道遮罩 Matcap
    {
      vec4 maskColor = texture(matcapMaskTexture, v_uv);
      vec3 matcapColorType = maskColor.rgb;
      vec2 matcap_uv = GetMatcapUV(finalNormal);
      vec3 matcapResult = vec3(0.0);

      if (matcapColorType.r > 0.0) {
        vec3 colR = SRGBToLinear(texture(matcapTextureR, matcap_uv).rgb);
        matcapResult += colR * matcapStrengthR * matcapColorType.r;
      }

      if (matcapColorType.g > 0.0) {
        vec3 colG = SRGBToLinear(texture(matcapTextureG, matcap_uv).rgb);
        matcapResult += colG * matcapStrengthG * matcapColorType.g;
      }

      if (matcapColorType.b > 0.0) {
        vec3 colB = SRGBToLinear(texture(matcapTextureB, matcap_uv).rgb);
        matcapResult += colB * matcapStrengthB * matcapColorType.b;
      }

      // 計算有效遮罩（考慮 strength 的影響）
      float effectiveMask = 0.0;
      if (matcapColorType.r > 0.0) effectiveMask += matcapColorType.r * matcapStrengthR;
      if (matcapColorType.g > 0.0) effectiveMask += matcapColorType.g * matcapStrengthG;
      if (matcapColorType.b > 0.0) effectiveMask += matcapColorType.b * matcapStrengthB;
      effectiveMask = clamp(effectiveMask, 0.0, 1.0);

      o.rgb = o.rgb * (1.0 - effectiveMask) + matcapResult;
    }`;
    } else {
      return `
    #if USE_MATCAP
      vec3 viewNormal = normalize(mat3(cc_matView) * finalNormal);
      vec2 matcapUV = viewNormal.xy * 0.5 + 0.5;
      matcapUV.y = 1.0 - matcapUV.y;
      vec3 matcapColor = SRGBToLinear(texture(matcapTexture, matcapUV).rgb);
      
      float matcapMask = 1.0;
      #if USE_MATCAP_MASK
        matcapMask = texture(matcapMaskTexture, v_uv).r;
      #endif
      
      o.rgb = mix(o.rgb, matcapColor, matcapProgress * matcapMask);
    #endif`;
    }
  },
  
  dependencies: []
};
