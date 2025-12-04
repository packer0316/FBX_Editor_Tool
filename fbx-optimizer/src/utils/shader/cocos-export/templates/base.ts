/**
 * Cocos Creator Shader 基礎模板
 */

/**
 * Vertex Shader 基礎 include
 */
export const vertexIncludes = `  precision highp float;
  #include <legacy/input-standard>
  #include <builtin/uniforms/cc-global>
  #include <legacy/decode-base>
  #include <legacy/local-batch>
  #include <legacy/fog-vs>`;

/**
 * Vertex Shader 基礎輸入/輸出
 */
export const vertexBaseIO = `
  #if USE_VERTEX_COLOR
    in lowp vec4 a_color;
    out lowp vec4 v_color;
  #endif

  #if USE_TEXTURE
    out vec2 v_uv;
    uniform TexCoords {
      vec4 tilingOffset;
    };
  #endif

  out vec3 v_worldNormal;
  out vec3 v_worldPos;`;

/**
 * Vertex Shader 主函數基礎結構
 */
export const vertexMainBase = `
  vec4 vert () {
    StandardVertInput In; 
    CCVertInput(In);

    mat4 matWorld, matWorldIT;
    CCGetWorldMatrixFull(matWorld, matWorldIT);
    v_worldNormal = normalize((matWorldIT * vec4(In.normal, 0.)).xyz);
    v_worldPos = (matWorld * In.position).xyz;

    #if USE_TEXTURE
      v_uv = a_texCoord * tilingOffset.xy + tilingOffset.zw;
      #if SAMPLE_FROM_RT
        CC_HANDLE_RT_SAMPLE_FLIP(v_uv);
      #endif
    #endif

    #if USE_VERTEX_COLOR
      v_color = a_color;
    #endif

    {{VERTEX_CUSTOM}}

    CC_TRANSFER_FOG(matWorld * In.position);
    return cc_matProj * (cc_matView * matWorld) * In.position;
  }`;

/**
 * Fragment Shader 基礎 include
 */
export const fragmentIncludes = `  precision highp float;
  #include <legacy/output-standard>
  #include <legacy/fog-fs>
  #include <builtin/uniforms/cc-global>`;

/**
 * Fragment Shader 基礎輸入
 */
export const fragmentBaseIO = `
  #if USE_ALPHA_TEST
    #pragma define-meta ALPHA_TEST_CHANNEL options([a, r, g, b])
  #endif

  #if USE_TEXTURE
    in vec2 v_uv;
    uniform sampler2D mainTexture;
  #endif

  in vec3 v_worldPos;
  in vec3 v_worldNormal;

  #if USE_VERTEX_COLOR
    in lowp vec4 v_color;
  #endif`;

/**
 * Fragment Shader 基礎 Uniform
 */
export const fragmentBaseUniforms = `
  uniform Constant {
    vec4 mainColor;
    vec4 colorScaleAndCutoff;
    {{CONSTANT_UNIFORMS}}
  };`;

/**
 * Fragment Shader 主函數開頭
 */
export const fragmentMainStart = `
  vec4 frag () {
    vec4 o = mainColor;
    o.rgb *= colorScaleAndCutoff.xyz;

    #if USE_VERTEX_COLOR
      o.rgb *= SRGBToLinear(v_color.rgb);
      o.a *= v_color.a;
    #endif

    #if USE_TEXTURE
      vec4 rawTexColor = texture(mainTexture, v_uv);
      rawTexColor.rgb = SRGBToLinear(rawTexColor.rgb);
      o *= rawTexColor;
    #endif

    vec3 finalNormal = normalize(v_worldNormal);`;

/**
 * Fragment Shader 主函數結尾
 */
export const fragmentMainEnd = `
    #if USE_ALPHA_TEST
      if (o.ALPHA_TEST_CHANNEL < colorScaleAndCutoff.w) discard;
    #endif

    #if CC_USE_FOG != CC_FOG_NONE
      #if CC_USE_HDR
        o.rgb = ACESToneMap(o.rgb);
      #endif
      o.rgb = LinearToSRGB(o.rgb);
      CC_APPLY_FOG(o, v_worldPos.xyz);
      return o;
    #else
      return CCFragOutput(o);
    #endif
  }`;

/**
 * 基礎 properties（必要的屬性）
 */
export const baseProperties = `        mainTexture:    { value: grey }
        tilingOffset:   { value: [1, 1, 0, 0] }
        mainColor:      { value: [1, 1, 1, 1], linear: true, editor: { type: color } }
        colorScale:     { value: [1, 1, 1], target: colorScaleAndCutoff.xyz }
        alphaThreshold: { value: 0.5, target: colorScaleAndCutoff.w, editor: { parent: USE_ALPHA_TEST } }`;

