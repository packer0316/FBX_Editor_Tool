/**
 * Flash (閃光效果) 功能模組
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

export const flashModule: ShaderFeatureModule = {
  name: 'flash',
  
  properties: (params) => {
    const color = hexToRGBA(params.color || '#ffffff');
    return `
        flashTexture:   { value: grey }
        flashMaskTexture: { value: white }
        flashColor:     { value: [${color[0].toFixed(2)}, ${color[1].toFixed(2)}, ${color[2].toFixed(2)}, ${color[3].toFixed(2)}], linear: true, editor: { type: color, parent: USE_FLASH } }
        flashIntensity: { value: ${(params.intensity ?? 1.0).toFixed(2)}, range: [0.0, 5.0], editor: { type: slider, parent: USE_FLASH } }
        flashSpeed:     { value: ${(params.speed ?? 1.5).toFixed(2)}, range: [0.0, 5.0], editor: { type: slider, parent: USE_FLASH } }
        flashWidth:     { value: ${(params.width ?? 0.5).toFixed(2)}, range: [0.1, 1.0], editor: { type: slider, parent: USE_FLASH } }`;
  },
  
  uniforms: `
  #if USE_FLASH
    uniform sampler2D flashTexture;
    uniform sampler2D flashMaskTexture;
  #endif`,
  
  vertexDeclarations: '',
  
  vertexMain: '',
  
  fragmentDeclarations: `
  #if USE_FLASH
    uniform FlashValue {
      vec4 flashColor;
      float flashIntensity;
      float flashSpeed;
      float flashWidth;
    };
  #endif`,
  
  fragmentMain: `
    #if USE_FLASH
      float flashMask = texture(flashMaskTexture, v_uv).r;
      if (flashMask > 0.5) {
        float time = cc_time.x * flashSpeed;
        float flashUV = fract(v_uv.x + v_uv.y - time);
        float flashValue = smoothstep(0.0, flashWidth, flashUV) * smoothstep(flashWidth * 2.0, flashWidth, flashUV);
        vec3 flashSample = texture(flashTexture, v_uv).rgb;
        o.rgb += flashSample * flashColor.rgb * flashValue * flashIntensity;
      }
    #endif`,
  
  dependencies: []
};

