import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import type { ShaderFeature } from '../types/shaderTypes';

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
    shaderFeatures: ShaderFeature[];
}

type ModelProps = {
    model: THREE.Group;
    clip: THREE.AnimationClip | null;
    onTimeUpdate?: (time: number) => void;
    shaderFeatures: ShaderFeature[];
};

const Model = forwardRef<SceneViewerRef, ModelProps>(
    ({ model, clip, onTimeUpdate, shaderFeatures }, ref) => {
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

        useEffect(() => {
            if (mixerRef.current && clip) {
                mixerRef.current.stopAllAction();
                const action = mixerRef.current.clipAction(clip);
                action.play();
                actionRef.current = action;
            }
        }, [clip, model]);

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

                const matcapFeature = shaderFeatures.find(
                    (f) => (f.type === 'matcap' || f.type === 'matcap_add') && f.params.texture
                );
                const rimLightFeature = shaderFeatures.find(f => f.type === 'rim_light');
                const flashFeature = shaderFeatures.find(f => f.type === 'flash');
                const dissolveFeature = shaderFeatures.find(f => f.type === 'dissolve');
                const alphaTestFeature = shaderFeatures.find(f => f.type === 'alpha_test');
                const normalMapFeature = shaderFeatures.find(f => f.type === 'normal_map');

                const shouldUseShader = matcapFeature || rimLightFeature || flashFeature || dissolveFeature || alphaTestFeature || normalMapFeature;

                if (shouldUseShader) {
                    let matcapTex = null;
                    if (matcapFeature) {
                        const texUrl = typeof matcapFeature.params.texture === 'string'
                            ? matcapFeature.params.texture
                            : URL.createObjectURL(matcapFeature.params.texture);
                        matcapTex = textureLoader.load(texUrl);
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

                    const isCustomShader = child.material instanceof THREE.ShaderMaterial &&
                        (child.material as any).isCustomShader;

                    let shaderMat: THREE.ShaderMaterial;

                    if (isCustomShader) {
                        shaderMat = child.material as THREE.ShaderMaterial;
                    } else {
                        const originalMaterial = child.userData.originalMaterial as THREE.MeshStandardMaterial;
                        const baseTexture = originalMaterial.map || null;
                        const baseColor = originalMaterial.color ? originalMaterial.color.clone() : new THREE.Color(0xffffff);

                        shaderMat = new THREE.ShaderMaterial({
                            uniforms: {
                                // Base
                                baseTexture: { value: baseTexture },
                                baseColor: { value: baseColor },
                                uTime: { value: 0 },

                                // Matcap
                                matcapTexture: { value: null },
                                matcapProgress: { value: 0 },
                                matcapLdrBoost: { value: 1.2 },
                                matcapStrength: { value: 1.0 },
                                matcapIsAdd: { value: 0.0 },
                                useMatcap: { value: 0.0 },

                                // Rim Light
                                rimColor: { value: new THREE.Color(0xffffff) },
                                rimIntensity: { value: 0.0 },
                                rimPower: { value: 3.0 },
                                useRimLight: { value: 0.0 },

                                // Flash
                                flashColor: { value: new THREE.Color(0xffffff) },
                                flashIntensity: { value: 0.0 },
                                flashSpeed: { value: 1.0 },
                                flashWidth: { value: 0.5 },
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
                                
                                void main() {
                                    vUv = uv;
                                    vNormal = normalize(normalMatrix * normal);
                                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                                    vViewPosition = -mvPosition.xyz;
                                    gl_Position = projectionMatrix * mvPosition;
                                }
                            `,
                            fragmentShader: `
                                uniform sampler2D baseTexture;
                                uniform vec3 baseColor;
                                uniform float uTime;

                                // Matcap
                                uniform sampler2D matcapTexture;
                                uniform float matcapProgress;
                                uniform float matcapLdrBoost;
                                uniform float matcapStrength;
                                uniform float matcapIsAdd;
                                uniform float useMatcap;

                                // Rim Light
                                uniform vec3 rimColor;
                                uniform float rimIntensity;
                                uniform float rimPower;
                                uniform float useRimLight;

                                // Flash
                                uniform vec3 flashColor;
                                uniform float flashIntensity;
                                uniform float flashSpeed;
                                uniform float flashWidth;
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

                                    // --- Matcap ---
                                    if (useMatcap > 0.5) {
                                        vec2 matcapUv;
                                        matcapUv.x = viewNormal.x * 0.49 + 0.5;
                                        matcapUv.y = -viewNormal.y * 0.49 + 0.5;
                                        
                                        vec3 matcapCol = texture2D(matcapTexture, matcapUv).rgb;
                                        matcapCol *= matcapLdrBoost;

                                        if (matcapIsAdd > 0.5) {
                                            // Matcap Add
                                            float dotNV = dot(viewDir, viewNormal);
                                            dotNV = clamp(dotNV, 0.0, 1.0);
                                            float edgeValue = 1.0 - dotNV;
                                            float blendFactor = edgeValue * matcapProgress * 3.0;
                                            blendFactor = clamp(blendFactor, 0.0, 1.0);
                                            finalColor += matcapCol * matcapStrength * blendFactor;
                                        } else {
                                            // Matcap Mix
                                            finalColor = mix(finalColor, matcapCol, matcapProgress);
                                        }
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
                                        float flashPos = mod(uTime * flashSpeed, 2.0) - 0.5; 
                                        vec2 rotatedUv = vec2(
                                            vUv.x * 0.707 - vUv.y * 0.707,
                                            vUv.x * 0.707 + vUv.y * 0.707
                                        );
                                        
                                        float dist = abs(rotatedUv.x - flashPos);
                                        float flash = 1.0 - smoothstep(0.0, flashWidth, dist);
                                        finalColor += flashColor * flash * flashIntensity;
                                    }
                                    
                                    gl_FragColor = vec4(finalColor, 1.0);
                                }
                            `,
                            defines: baseTexture ? { USE_MAP: '' } : {},
                            extensions: {
                                derivatives: true
                            }
                        });
                        (shaderMat as any).isCustomShader = true;
                        child.material = shaderMat;
                    }

                    // Update Uniforms
                    if (matcapFeature && matcapTex) {
                        shaderMat.uniforms.useMatcap.value = 1.0;
                        shaderMat.uniforms.matcapTexture.value = matcapTex;
                        shaderMat.uniforms.matcapProgress.value = matcapFeature.params.progress ?? 0.5;
                        shaderMat.uniforms.matcapLdrBoost.value = matcapFeature.params.ldrBoost || 1.2;
                        shaderMat.uniforms.matcapStrength.value = matcapFeature.params.strength || 1.0;
                        shaderMat.uniforms.matcapIsAdd.value = matcapFeature.type === 'matcap_add' ? 1.0 : 0.0;
                    } else {
                        shaderMat.uniforms.useMatcap.value = 0.0;
                    }

                    if (rimLightFeature) {
                        shaderMat.uniforms.useRimLight.value = 1.0;
                        shaderMat.uniforms.rimColor.value = new THREE.Color(rimLightFeature.params.color || '#ffffff');
                        shaderMat.uniforms.rimIntensity.value = rimLightFeature.params.intensity ?? 1.0;
                        shaderMat.uniforms.rimPower.value = rimLightFeature.params.power ?? 3.0;
                    } else {
                        shaderMat.uniforms.useRimLight.value = 0.0;
                    }

                    if (flashFeature) {
                        shaderMat.uniforms.useFlash.value = 1.0;
                        shaderMat.uniforms.flashColor.value = new THREE.Color(flashFeature.params.color || '#ffffff');
                        shaderMat.uniforms.flashIntensity.value = flashFeature.params.intensity ?? 1.0;
                        shaderMat.uniforms.flashSpeed.value = flashFeature.params.speed ?? 1.0;
                        shaderMat.uniforms.flashWidth.value = flashFeature.params.width ?? 0.5;
                    } else {
                        shaderMat.uniforms.useFlash.value = 0.0;
                    }

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

                    if (alphaTestFeature) {
                        shaderMat.uniforms.useAlphaTest.value = 1.0;
                        shaderMat.uniforms.alphaTestThreshold.value = alphaTestFeature.params.threshold ?? 0.5;
                    } else {
                        shaderMat.uniforms.useAlphaTest.value = 0.0;
                    }

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

                    // Handle standard material properties (dissolve, bleach, etc. - existing logic)
                    const material = child.material as THREE.MeshStandardMaterial;
                    if (material.isMeshStandardMaterial) {
                        // Reset standard props
                        material.emissive = new THREE.Color(0x000000);
                        material.emissiveIntensity = 0;
                        material.transparent = false;
                        material.opacity = 1;
                        material.alphaTest = 0;
                        if (material.normalMap) material.normalScale.set(1, 1);

                        shaderFeatures.forEach((feature) => {
                            switch (feature.type) {
                                case 'bleach':
                                    if (feature.params.intensity > 0) {
                                        material.color.lerp(new THREE.Color(feature.params.color), feature.params.intensity);
                                    }
                                    break;
                                case 'normal_map':
                                    if (material.normalMap && feature.params.strength) {
                                        material.normalScale.set(feature.params.strength, feature.params.strength);
                                    }
                                    break;
                            }
                        });
                        material.needsUpdate = true;
                    }
                }
            });
        }, [model, shaderFeatures]);

        if (!model) return null;
        return <primitive object={model} scale={0.01} />;
    }
);

const SceneViewer = forwardRef<SceneViewerRef, SceneViewerProps>(
    ({ model, playingClip, onTimeUpdate, shaderFeatures }, ref) => {
        return (
            <div className="w-full h-full bg-gray-900 rounded-lg overflow-hidden shadow-xl border border-gray-700">
                <Canvas camera={{ position: [0, 2, 5], fov: 50 }}>
                    <ambientLight intensity={0.8} />
                    <hemisphereLight args={["#ffffff", "#444444", 0.6]} />
                    <directionalLight position={[10, 10, 5]} intensity={1.2} castShadow />
                    <directionalLight position={[-10, 5, -5]} intensity={0.6} />
                    <directionalLight position={[0, -5, 0]} intensity={0.4} />
                    <Grid infiniteGrid fadeDistance={30} sectionColor="#4a4a4a" cellColor="#2a2a2a" />
                    {model && (
                        <Model
                            ref={ref}
                            model={model}
                            clip={playingClip}
                            onTimeUpdate={onTimeUpdate}
                            shaderFeatures={shaderFeatures}
                        />
                    )}
                    <OrbitControls makeDefault />
                </Canvas>
            </div>
        );
    }
);

export default SceneViewer;
