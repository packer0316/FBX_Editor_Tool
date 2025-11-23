import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import type { ShaderFeature, ShaderGroup } from '../types/shaderTypes';

export interface SceneViewerRef {
    play: () => void;
    pause: () => void;
    seekTo: (time: number) => void;
    getCurrentTime: () => number;
    getDuration: () => number;
}

interface SceneViewerProps {
    model: THREE.Group | null;
    playingClip: THREE.AnimationClip | null;
    onTimeUpdate?: (time: number) => void;
    shaderGroups: ShaderGroup[];
    loop?: boolean;
    onFinish?: () => void;
    backgroundColor?: string;
    cameraSettings?: {
        fov: number;
        near: number;
        far: number;
    };
}

// Camera Controller Component to update camera settings dynamically
function CameraController({ cameraSettings }: { cameraSettings?: { fov: number; near: number; far: number } }) {
    const { camera } = useThree();

    useEffect(() => {
        if (cameraSettings && camera instanceof THREE.PerspectiveCamera) {
            camera.fov = cameraSettings.fov;
            camera.near = cameraSettings.near;
            camera.far = cameraSettings.far;
            camera.updateProjectionMatrix();
        }
    }, [cameraSettings, camera]);

    return null;
}

type ModelProps = {
    model: THREE.Group;
    clip: THREE.AnimationClip | null;
    onTimeUpdate?: (time: number) => void;
    shaderGroups: ShaderGroup[];
    loop?: boolean;
    onFinish?: () => void;
};

const Model = forwardRef<SceneViewerRef, ModelProps>(
    ({ model, clip, onTimeUpdate, shaderGroups, loop = true, onFinish }, ref) => {
        const mixerRef = useRef<THREE.AnimationMixer | null>(null);
        const actionRef = useRef<THREE.AnimationAction | null>(null);
        const isPlayingRef = useRef(true);

        useEffect(() => {
            if (model) {
                mixerRef.current = new THREE.AnimationMixer(model);
            }
            return () => {
                mixerRef.current?.stopAllAction();
                mixerRef.current = null;
            };
        }, [model]);

        const onFinishRef = useRef(onFinish);

        useEffect(() => {
            onFinishRef.current = onFinish;
        }, [onFinish]);

        useEffect(() => {
            if (mixerRef.current && clip) {
                // Clean up previous listeners
                const handleFinish = () => {
                    if (onFinishRef.current) onFinishRef.current();
                };

                // Stop only the current action instead of all actions for smoother transition
                if (actionRef.current) {
                    actionRef.current.stop();
                }

                const action = mixerRef.current.clipAction(clip);

                if (!loop) {
                    action.setLoop(THREE.LoopOnce, 1);
                    action.clampWhenFinished = true;
                    mixerRef.current.addEventListener('finished', handleFinish);
                } else {
                    action.setLoop(THREE.LoopRepeat, Infinity);
                }

                action.reset();
                action.play();
                actionRef.current = action;

                return () => {
                    if (mixerRef.current) {
                        mixerRef.current.removeEventListener('finished', handleFinish);
                    }
                };
            }
        }, [clip, model, loop]);

        useImperativeHandle(ref, () => ({
            play: () => {
                if (actionRef.current) {
                    actionRef.current.paused = false;
                    isPlayingRef.current = true;
                }
            },
            pause: () => {
                if (actionRef.current) {
                    actionRef.current.paused = true;
                    isPlayingRef.current = false;
                }
            },
            seekTo: (time: number) => {
                if (actionRef.current) {
                    actionRef.current.time = time;
                    if (!isPlayingRef.current && mixerRef.current) {
                        const wasPaused = actionRef.current.paused;
                        actionRef.current.paused = false;
                        mixerRef.current.update(0);
                        actionRef.current.paused = wasPaused;
                    }
                }
            },
            getCurrentTime: () => actionRef.current?.time ?? 0,
            getDuration: () => actionRef.current?.getClip().duration ?? 0,
        }));

        useFrame((_state, delta) => {
            if (mixerRef.current && isPlayingRef.current) {
                mixerRef.current.update(delta);
                if (onTimeUpdate && actionRef.current) {
                    onTimeUpdate(actionRef.current.time);
                }
            }
        });

        const materialsRef = useRef<THREE.ShaderMaterial[]>([]);

        useFrame((state) => {
            materialsRef.current.forEach(mat => {
                if (mat.uniforms.uTime) {
                    mat.uniforms.uTime.value = state.clock.elapsedTime;
                }
            });
        });

        useEffect(() => {
            if (!model) return;

            const textureLoader = new THREE.TextureLoader();
            materialsRef.current = [];

            model.traverse((child: any) => {
                if (!child.isMesh) return;

                if (!child.userData.originalMaterial) {
                    child.userData.originalMaterial = child.material;
                }

                // 找到包含此 mesh 的組
                const meshGroup = shaderGroups.find(group =>
                    group.selectedMeshes.includes(child.name)
                );

                // 如果沒有組包含此 mesh，恢復原始材質
                if (!meshGroup) {
                    child.material = child.userData.originalMaterial;
                    return;
                }

                // 從該組的 features 中提取各種效果
                const shaderFeatures = meshGroup.features;

                // Separate Base Matcap and Additive Matcap
                const baseMatcapFeature = shaderFeatures.find(
                    (f: ShaderFeature) => f.type === 'matcap' && f.params.texture
                );
                const addMatcapFeature = shaderFeatures.find(
                    (f: ShaderFeature) => f.type === 'matcap_add' && f.params.texture
                );

                const rimLightFeature = shaderFeatures.find((f: ShaderFeature) => f.type === 'rim_light');
                const flashFeature = shaderFeatures.find((f: ShaderFeature) => f.type === 'flash');
                const dissolveFeature = shaderFeatures.find((f: ShaderFeature) => f.type === 'dissolve');
                const alphaTestFeature = shaderFeatures.find((f: ShaderFeature) => f.type === 'alpha_test');
                const normalMapFeature = shaderFeatures.find((f: ShaderFeature) => f.type === 'normal_map');

                const shouldUseShader = baseMatcapFeature || addMatcapFeature || rimLightFeature || flashFeature || dissolveFeature || alphaTestFeature || normalMapFeature;

                if (shouldUseShader) {
                    // Load Base Matcap Texture
                    let baseMatcapTex = null;
                    if (baseMatcapFeature && baseMatcapFeature.params.texture) {
                        const texUrl = typeof baseMatcapFeature.params.texture === 'string'
                            ? baseMatcapFeature.params.texture
                            : URL.createObjectURL(baseMatcapFeature.params.texture);
                        baseMatcapTex = textureLoader.load(texUrl);
                    }

                    // Load Base Matcap Mask Texture
                    let baseMatcapMaskTex = null;
                    if (baseMatcapFeature && baseMatcapFeature.params.maskTexture) {
                        const texUrl = typeof baseMatcapFeature.params.maskTexture === 'string'
                            ? baseMatcapFeature.params.maskTexture
                            : URL.createObjectURL(baseMatcapFeature.params.maskTexture);
                        baseMatcapMaskTex = textureLoader.load(texUrl);
                    }

                    // Load Additive Matcap Texture
                    let addMatcapTex = null;
                    if (addMatcapFeature && addMatcapFeature.params.texture) {
                        const texUrl = typeof addMatcapFeature.params.texture === 'string'
                            ? addMatcapFeature.params.texture
                            : URL.createObjectURL(addMatcapFeature.params.texture);
                        addMatcapTex = textureLoader.load(texUrl);
                    }

                    // Load Additive Matcap Mask Texture
                    let addMatcapMaskTex = null;
                    if (addMatcapFeature && addMatcapFeature.params.maskTexture) {
                        const texUrl = typeof addMatcapFeature.params.maskTexture === 'string'
                            ? addMatcapFeature.params.maskTexture
                            : URL.createObjectURL(addMatcapFeature.params.maskTexture);
                        addMatcapMaskTex = textureLoader.load(texUrl);
                    }

                    let dissolveTex = null;
                    if (dissolveFeature && dissolveFeature.params.texture) {
                        const texUrl = typeof dissolveFeature.params.texture === 'string'
                            ? dissolveFeature.params.texture
                            : URL.createObjectURL(dissolveFeature.params.texture);
                        dissolveTex = textureLoader.load(texUrl);
                    }

                    let normalMapTex = null;
                    if (normalMapFeature && normalMapFeature.params.texture) {
                        const texUrl = typeof normalMapFeature.params.texture === 'string'
                            ? normalMapFeature.params.texture
                            : URL.createObjectURL(normalMapFeature.params.texture);
                        normalMapTex = textureLoader.load(texUrl);
                    }

                    let flashTex = null;
                    if (flashFeature && flashFeature.params.texture) {
                        const texUrl = typeof flashFeature.params.texture === 'string'
                            ? flashFeature.params.texture
                            : URL.createObjectURL(flashFeature.params.texture);
                        flashTex = textureLoader.load(texUrl, (tex) => {
                            console.log('[Flash Texture Loaded]', tex);
                            // Force material update when texture loads
                            if (child.material) {
                                child.material.needsUpdate = true;
                            }
                        });
                        console.log('[Flash Texture Loading...]', flashTex);
                    }

                    let flashMaskTex = null;
                    if (flashFeature && flashFeature.params.maskTexture) {
                        const texUrl = typeof flashFeature.params.maskTexture === 'string'
                            ? flashFeature.params.maskTexture
                            : URL.createObjectURL(flashFeature.params.maskTexture);
                        flashMaskTex = textureLoader.load(texUrl, (tex) => {
                            console.log('[Flash Mask Texture Loaded]', tex);
                            // Force material update when texture loads
                            if (child.material) {
                                child.material.needsUpdate = true;
                            }
                        });
                        console.log('[Flash Mask Texture Loading...]', flashMaskTex);
                    }


                    const isCustomShader = child.material instanceof THREE.ShaderMaterial &&
                        (child.material as any).isCustomShader;

                    let shaderMat: THREE.ShaderMaterial;

                    // ALWAYS recreate shader when features change to ensure defines are updated
                    // (especially important when textures are added/removed)
                    const originalMaterial = child.userData.originalMaterial as THREE.MeshStandardMaterial;
                    const baseTexture = originalMaterial.map || null;
                    const baseColor = originalMaterial.color ? originalMaterial.color.clone() : new THREE.Color(0xffffff);
                    const isSkinnedMesh = (child as any).isSkinnedMesh;

                    console.log('[Creating Shader] flashTex:', !!flashTex, 'flashMaskTex:', !!flashMaskTex);

                    shaderMat = new THREE.ShaderMaterial({
                        uniforms: {
                            // Base
                            baseTexture: { value: baseTexture },
                            baseColor: { value: baseColor },
                            uTime: { value: 0 },

                            // Base Matcap
                            matcapTexture: { value: null },
                            matcapMaskTexture: { value: null },
                            matcapProgress: { value: 0 },
                            useMatcap: { value: 0.0 },

                            // Additive Matcap
                            matcapAddTexture: { value: null },
                            matcapAddMaskTexture: { value: null },
                            matcapAddStrength: { value: 1.0 },
                            matcapAddColor: { value: new THREE.Color(0xffffff) },
                            useMatcapAdd: { value: 0.0 },

                            // Rim Light
                            rimColor: { value: new THREE.Color(0xffffff) },
                            rimIntensity: { value: 0.0 },
                            rimPower: { value: 3.0 },
                            useRimLight: { value: 0.0 },

                            // Flash
                            flashTexture: { value: null },
                            flashMaskTexture: { value: null },
                            flashColor: { value: new THREE.Color(0xffffff) },
                            flashIntensity: { value: 0.0 },
                            flashSpeed: { value: 1.0 },
                            flashWidth: { value: 0.5 },
                            flashReverse: { value: 0.0 },
                            useFlash: { value: 0.0 },

                            // Dissolve
                            dissolveTexture: { value: null },
                            dissolveThreshold: { value: 0.0 },
                            dissolveEdgeWidth: { value: 0.1 },
                            dissolveColor1: { value: new THREE.Color(0xffff00) },
                            dissolveColor2: { value: new THREE.Color(0xff0000) },
                            useDissolve: { value: 0.0 },

                            // Alpha Test
                            alphaTestThreshold: { value: 0.5 },
                            useAlphaTest: { value: 0.0 },

                            // Normal Map
                            normalMap: { value: null },
                            normalScale: { value: new THREE.Vector2(1, 1) },
                            useNormalMap: { value: 0.0 },
                        },
                        vertexShader: `
                                varying vec3 vNormal;
                                varying vec2 vUv;
                                varying vec3 vViewPosition;
                                
                                #include <common>
                                #include <skinning_pars_vertex>
                                
                                void main() {
                                    vUv = uv;
                                    
                                    #include <skinbase_vertex>
                                    #include <begin_vertex>
                                    #include <skinning_vertex>
                                    
                                    // Handle Normal with Skinning
                                    vec3 objectNormal = normal;
                                    #include <skinnormal_vertex>
                                    vNormal = normalize(normalMatrix * objectNormal);

                                    // Handle Position with Skinning
                                    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
                                    vViewPosition = -mvPosition.xyz;
                                    gl_Position = projectionMatrix * mvPosition;
                                }
                            `,
                        fragmentShader: `
                                uniform sampler2D baseTexture;
                                uniform vec3 baseColor;
                                uniform float uTime;

                                // Base Matcap
                                uniform sampler2D matcapTexture;
                                uniform sampler2D matcapMaskTexture;
                                uniform float matcapProgress;
                                uniform float useMatcap;

                                // Additive Matcap
                                uniform sampler2D matcapAddTexture;
                                uniform sampler2D matcapAddMaskTexture;
                                uniform float matcapAddStrength;
                                uniform vec3 matcapAddColor;
                                uniform float useMatcapAdd;

                                // Rim Light
                                uniform vec3 rimColor;
                                uniform float rimIntensity;
                                uniform float rimPower;
                                uniform float useRimLight;

                                // Flash
                                uniform sampler2D flashTexture;
                                uniform sampler2D flashMaskTexture;
                                uniform vec3 flashColor;
                                uniform float flashIntensity;
                                uniform float flashSpeed;
                                uniform float flashWidth;
                                uniform float flashReverse;
                                uniform float useFlash;

                                // Dissolve
                                uniform sampler2D dissolveTexture;
                                uniform float dissolveThreshold;
                                uniform float dissolveEdgeWidth;
                                uniform vec3 dissolveColor1;
                                uniform vec3 dissolveColor2;
                                uniform float useDissolve;

                                // Alpha Test
                                uniform float alphaTestThreshold;
                                uniform float useAlphaTest;

                                // Normal Map
                                uniform sampler2D normalMap;
                                uniform vec2 normalScale;
                                uniform float useNormalMap;
                                
                                varying vec3 vNormal;
                                varying vec2 vUv;
                                varying vec3 vViewPosition;

                                // Function to perturb normal based on normal map
                                vec3 perturbNormal2Arb( vec3 eye_pos, vec3 surf_norm, vec2 uv, vec2 scale ) {
                                    vec3 q0 = dFdx( eye_pos.xyz );
                                    vec3 q1 = dFdy( eye_pos.xyz );
                                    vec2 st0 = dFdx( uv.st );
                                    vec2 st1 = dFdy( uv.st );

                                    vec3 N = surf_norm; // normalized

                                    vec3 q1perp = cross( q1, N );
                                    vec3 q0perp = cross( N, q0 );

                                    vec3 T = q1perp * st0.x + q0perp * st1.x;
                                    vec3 B = q1perp * st0.y + q0perp * st1.y;

                                    float det = max( dot( T, T ), dot( B, B ) );
                                    float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
                                    float scaleFactor = ( det == 0.0 ) ? 0.0 : faceDirection * inversesqrt( det );

                                    vec3 mapN = texture2D( normalMap, uv ).xyz * 2.0 - 1.0;
                                    mapN.xy *= scale;
                                    
                                    return normalize( T * ( mapN.x * scaleFactor ) + B * ( mapN.y * scaleFactor ) + N * mapN.z );
                                }
                                
                                void main() {
                                    vec3 finalColor = baseColor;
                                    vec4 baseTexColor = vec4(1.0);
                                    #ifdef USE_MAP
                                        baseTexColor = texture2D(baseTexture, vUv);
                                        finalColor *= baseTexColor.rgb;
                                    #endif

                                    // --- Alpha Test ---
                                    if (useAlphaTest > 0.5) {
                                        if (baseTexColor.a < alphaTestThreshold) discard;
                                    }

                                    // --- Dissolve Effect ---
                                    if (useDissolve > 0.5) {
                                        float noiseValue = texture2D(dissolveTexture, vUv).r;
                                        
                                        if (noiseValue < dissolveThreshold) {
                                            discard;
                                        }

                                        float edge = smoothstep(dissolveThreshold, dissolveThreshold + dissolveEdgeWidth, noiseValue);
                                        // Invert edge to get the glowing rim part
                                        float edgeFactor = 1.0 - edge;
                                        
                                        if (edgeFactor > 0.0) {
                                            vec3 edgeColor = mix(dissolveColor2, dissolveColor1, edgeFactor); // Gradient edge
                                            finalColor = mix(finalColor, edgeColor, edgeFactor * 2.0); // Boost intensity
                                        }
                                    }
                                    
                                    vec3 viewNormal = normalize(vNormal);
                                    vec3 viewDir = normalize(vViewPosition);

                                    // --- Normal Map ---
                                    if (useNormalMap > 0.5) {
                                        viewNormal = perturbNormal2Arb( -vViewPosition, viewNormal, vUv, normalScale );
                                    }

                                    // --- Base Matcap (Mix) ---
                                    if (useMatcap > 0.5) {
                                        vec2 matcapUv;
                                        matcapUv.x = viewNormal.x * 0.49 + 0.5;
                                        matcapUv.y = -viewNormal.y * 0.49 + 0.5;
                                        
                                        vec3 matcapCol = texture2D(matcapTexture, matcapUv).rgb;

                                        // Apply mask if available
                                        float matcapMask = 1.0;
                                        #ifdef USE_MATCAP_MASK
                                            matcapMask = texture2D(matcapMaskTexture, vUv).r;
                                        #endif

                                        finalColor = mix(finalColor, matcapCol, matcapProgress * matcapMask);
                                    }

                                    // --- Additive Matcap (Add) ---
                                    if (useMatcapAdd > 0.5) {
                                        vec2 matcapAddUv;
                                        matcapAddUv.x = viewNormal.x * 0.49 + 0.5;
                                        matcapAddUv.y = -viewNormal.y * 0.49 + 0.5;

                                        vec3 matcapAddCol = texture2D(matcapAddTexture, matcapAddUv).rgb;
                                        matcapAddCol *= matcapAddColor; // Apply tint

                                        // Apply mask if available
                                        float matcapAddMask = 1.0;
                                        #ifdef USE_MATCAP_ADD_MASK
                                            matcapAddMask = texture2D(matcapAddMaskTexture, vUv).r;
                                        #endif

                                        // Additive blending logic
                                        float dotNV = dot(viewDir, viewNormal);
                                        dotNV = clamp(dotNV, 0.0, 1.0);
                                        
                                        // Simple additive for now, controlled by strength and mask
                                        finalColor += matcapAddCol * matcapAddStrength * matcapAddMask;
                                    }

                                    // --- Rim Light ---
                                    if (useRimLight > 0.5) {
                                        float dotNV = dot(viewDir, viewNormal);
                                        float rim = 1.0 - clamp(dotNV, 0.0, 1.0);
                                        rim = pow(rim, rimPower);
                                        finalColor += rimColor * rim * rimIntensity;
                                    }


                                    // --- Flash Effect ---
                                    if (useFlash > 0.5) {
                                        // Sample mask texture or use defaults
                                        vec3 maskColor = vec3(1.0, vUv.x, 1.0); // Default: R=1, G=UV.x for direction, B=1
                                        #ifdef USE_FLASH_MASK
                                            maskColor = texture2D(flashMaskTexture, vUv).rgb;
                                        #endif

                                        // Reference Logic from azureDrag_body.effect:
                                        // maskColor.r: Static weight (for constant glow)
                                        // maskColor.g: Time/Phase (Direction) - this creates the sweeping effect
                                        // maskColor.b: Flash Mask (Intensity) - controls where flash appears

                                        float t = mod(uTime * flashSpeed, 1.0);
                                        
                                        // Reverse direction if flashReverse is enabled
                                        if (flashReverse > 0.5) {
                                            t = 1.0 - t;
                                        }
                                        
                                        // Calculate offset based on Green channel (Direction/Time)
                                        // This creates the animated sweep across the model
                                        float offset = abs(mod(maskColor.g - t, 1.0));
                                        
                                        // Calculate Light Value (Gradient)
                                        float lightVal = 0.0;
                                        
                                        #ifdef USE_FLASH_TEXTURE
                                            // Use flashTexture as a gradient lookup (LUT)
                                            // Reference uses: texture(lightTexture, vec2(0.5, offset * lightRange)).r
                                            // We map offset to V coordinate, using flashWidth as the range multiplier
                                            lightVal = texture2D(flashTexture, vec2(0.5, offset * flashWidth)).r;
                                        #else
                                            // Fallback: Calculated gradient with smooth falloff
                                            // Create a sharp pulse that fades smoothly
                                            lightVal = 1.0 - smoothstep(0.0, flashWidth, offset);
                                        #endif

                                        // Reference shader combines like this:
                                        // float maskAdd = maskWeight * maskWeight2 * maskColor.r + maskWeight * maskColor.b * lightColor;
                                        // finalColor = textureColor * (1.0 + maskAdd);
                                        
                                        // We'll use additive blending for the dynamic flash:
                                        vec3 flashEffect = flashColor * lightVal * maskColor.b * flashIntensity;
                                        
                                        // Add to final color (additive blending)
                                        finalColor += flashEffect;
                                    }
                                    
                                    gl_FragColor = vec4(finalColor, 1.0);
                                }
                            `,
                        defines: {
                            ...(baseTexture ? { USE_MAP: '' } : {}),
                            ...(baseMatcapMaskTex ? { USE_MATCAP_MASK: '' } : {}),
                            ...(addMatcapMaskTex ? { USE_MATCAP_ADD_MASK: '' } : {}),
                            ...(flashTex ? { USE_FLASH_TEXTURE: '' } : {}),
                            ...(flashMaskTex ? { USE_FLASH_MASK: '' } : {}),
                        },
                        extensions: {
                            derivatives: true
                        },
                        skinning: isSkinnedMesh
                    });
                    (shaderMat as any).isCustomShader = true;
                    child.material = shaderMat;

                    // Update Uniforms

                    // Base Matcap
                    if (baseMatcapFeature && baseMatcapTex) {
                        shaderMat.uniforms.useMatcap.value = 1.0;
                        shaderMat.uniforms.matcapTexture.value = baseMatcapTex;
                        if (baseMatcapMaskTex) shaderMat.uniforms.matcapMaskTexture.value = baseMatcapMaskTex;
                        shaderMat.uniforms.matcapProgress.value = baseMatcapFeature.params.progress ?? 0.5;
                    } else {
                        shaderMat.uniforms.useMatcap.value = 0.0;
                    }

                    // Additive Matcap
                    if (addMatcapFeature && addMatcapTex) {
                        shaderMat.uniforms.useMatcapAdd.value = 1.0;
                        shaderMat.uniforms.matcapAddTexture.value = addMatcapTex;
                        if (addMatcapMaskTex) shaderMat.uniforms.matcapAddMaskTexture.value = addMatcapMaskTex;
                        shaderMat.uniforms.matcapAddStrength.value = addMatcapFeature.params.strength ?? 1.0;
                        shaderMat.uniforms.matcapAddColor.value = new THREE.Color(addMatcapFeature.params.color || '#ffffff');
                    } else {
                        shaderMat.uniforms.useMatcapAdd.value = 0.0;
                    }

                    // Rim Light
                    if (rimLightFeature) {
                        shaderMat.uniforms.useRimLight.value = 1.0;
                        shaderMat.uniforms.rimColor.value = new THREE.Color(rimLightFeature.params.color || '#ffffff');
                        shaderMat.uniforms.rimIntensity.value = rimLightFeature.params.intensity ?? 1.0;
                        shaderMat.uniforms.rimPower.value = rimLightFeature.params.power ?? 3.0;
                    } else {
                        shaderMat.uniforms.useRimLight.value = 0.0;
                    }

                    // Flash
                    if (flashFeature) {
                        shaderMat.uniforms.useFlash.value = 1.0;
                        if (flashTex) shaderMat.uniforms.flashTexture.value = flashTex;
                        if (flashMaskTex) shaderMat.uniforms.flashMaskTexture.value = flashMaskTex;
                        shaderMat.uniforms.flashColor.value = new THREE.Color(flashFeature.params.color || '#ffffff');
                        shaderMat.uniforms.flashIntensity.value = flashFeature.params.intensity ?? 1.0;
                        shaderMat.uniforms.flashSpeed.value = flashFeature.params.speed ?? 1.0;
                        shaderMat.uniforms.flashWidth.value = flashFeature.params.width ?? 0.5;
                        shaderMat.uniforms.flashReverse.value = flashFeature.params.reverse ? 1.0 : 0.0;
                    } else {
                        shaderMat.uniforms.useFlash.value = 0.0;
                    }

                    // Dissolve
                    if (dissolveFeature) {
                        shaderMat.uniforms.useDissolve.value = 1.0;
                        if (dissolveTex) shaderMat.uniforms.dissolveTexture.value = dissolveTex;
                        shaderMat.uniforms.dissolveThreshold.value = dissolveFeature.params.threshold ?? 0.0;
                        shaderMat.uniforms.dissolveEdgeWidth.value = dissolveFeature.params.edgeWidth ?? 0.1;
                        shaderMat.uniforms.dissolveColor1.value = new THREE.Color(dissolveFeature.params.color1 || '#ffff00');
                        shaderMat.uniforms.dissolveColor2.value = new THREE.Color(dissolveFeature.params.color2 || '#ff0000');
                        shaderMat.transparent = true;
                    } else {
                        shaderMat.uniforms.useDissolve.value = 0.0;
                    }

                    // Alpha Test
                    if (alphaTestFeature) {
                        shaderMat.uniforms.useAlphaTest.value = 1.0;
                        shaderMat.uniforms.alphaTestThreshold.value = alphaTestFeature.params.threshold ?? 0.5;
                    } else {
                        shaderMat.uniforms.useAlphaTest.value = 0.0;
                    }

                    // Normal Map
                    if (normalMapFeature && normalMapTex) {
                        shaderMat.uniforms.useNormalMap.value = 1.0;
                        shaderMat.uniforms.normalMap.value = normalMapTex;
                        shaderMat.uniforms.normalScale.value = new THREE.Vector2(
                            normalMapFeature.params.strength ?? 1.0,
                            normalMapFeature.params.strength ?? 1.0
                        );
                    } else {
                        shaderMat.uniforms.useNormalMap.value = 0.0;
                    }

                    materialsRef.current.push(shaderMat);

                } else {
                    // Revert to original material if no shader features are active
                    if (child.material instanceof THREE.ShaderMaterial && (child.material as any).isCustomShader) {
                        if (child.userData.originalMaterial) {
                            child.material = child.userData.originalMaterial.clone();
                        }
                    }
                }
            });
        }, [model, shaderGroups]);

        if (!model) return null;
        return <primitive object={model} scale={0.01} />;
    }
);

const SceneViewer = forwardRef<SceneViewerRef, SceneViewerProps>(
    ({ model, playingClip, onTimeUpdate, shaderGroups, loop, onFinish, backgroundColor = '#111827', cameraSettings }, ref) => {
        return (
            <div
                className="w-full h-full rounded-lg overflow-hidden shadow-xl border border-gray-700 transition-colors duration-300"
                style={{ backgroundColor }}
            >
                <Canvas camera={{
                    position: [0, 2, 5],
                    fov: cameraSettings?.fov || 50,
                    near: cameraSettings?.near || 0.1,
                    far: cameraSettings?.far || 1000
                }}>
                    <ambientLight intensity={0.8} />
                    <hemisphereLight args={["#ffffff", "#444444", 0.6]} />
                    <directionalLight position={[10, 10, 5]} intensity={1.2} castShadow />
                    <directionalLight position={[-10, 5, -5]} intensity={0.6} />
                    <directionalLight position={[0, -5, 0]} intensity={0.4} />
                    <CameraController cameraSettings={cameraSettings} />
                    <Grid infiniteGrid fadeDistance={30} sectionColor="#4a4a4a" cellColor="#2a2a2a" />
                    {model && (
                        <Model
                            ref={ref}
                            model={model}
                            clip={playingClip}
                            onTimeUpdate={onTimeUpdate}
                            shaderGroups={shaderGroups}
                            loop={loop}
                            onFinish={onFinish}
                        />
                    )}
                    <OrbitControls
                        makeDefault
                        enableDamping
                        dampingFactor={0.05}
                        screenSpacePanning={false}
                        rotateSpeed={1.0}
                        zoomSpeed={1.0}
                        panSpeed={0.8}
                    />
                </Canvas>
            </div>
        );
    }
);

export default SceneViewer;
