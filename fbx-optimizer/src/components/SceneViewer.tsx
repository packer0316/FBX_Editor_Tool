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

        useEffect(() => {
            if (!model) return;

            const textureLoader = new THREE.TextureLoader();

            model.traverse((child: any) => {
                if (!child.isMesh) return;

                if (!child.userData.originalMaterial) {
                    child.userData.originalMaterial = child.material;
                }

                const matcapFeature = shaderFeatures.find(
                    (f) => (f.type === 'matcap' || f.type === 'matcap_add') && f.params.texture
                );

                if (matcapFeature) {
                    const texUrl =
                        typeof matcapFeature.params.texture === 'string'
                            ? matcapFeature.params.texture
                            : URL.createObjectURL(matcapFeature.params.texture);
                    const matcapTex = textureLoader.load(texUrl);

                    const isMatcapShader = child.material instanceof THREE.ShaderMaterial &&
                        (child.material as any).isMatcapShader;

                    if (isMatcapShader) {
                        const mat = child.material as THREE.ShaderMaterial;
                        mat.uniforms.matcapTexture.value = matcapTex;
                        mat.uniforms.progress.value = matcapFeature.params.progress !== undefined ? matcapFeature.params.progress : 0.5;
                        mat.uniforms.ldrBoost.value = matcapFeature.params.ldrBoost || 1.2;
                        mat.uniforms.strength.value = matcapFeature.params.strength || 1.0;
                        mat.uniforms.isAdd.value = matcapFeature.type === 'matcap_add' ? 1.0 : 0.0;
                    } else {
                        const originalMaterial = child.userData.originalMaterial as THREE.MeshStandardMaterial;
                        const baseTexture = originalMaterial.map || null;
                        const baseColor = originalMaterial.color ? originalMaterial.color.clone() : new THREE.Color(0xffffff);

                        const shaderMat = new THREE.ShaderMaterial({
                            uniforms: {
                                matcapTexture: { value: matcapTex },
                                baseTexture: { value: baseTexture },
                                baseColor: { value: baseColor },
                                progress: { value: matcapFeature.params.progress !== undefined ? matcapFeature.params.progress : 0.5 },
                                ldrBoost: { value: matcapFeature.params.ldrBoost || 1.2 },
                                strength: { value: matcapFeature.params.strength || 1.0 },
                                isAdd: { value: matcapFeature.type === 'matcap_add' ? 1.0 : 0.0 }
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
                                uniform sampler2D matcapTexture;
                                uniform sampler2D baseTexture;
                                uniform vec3 baseColor;
                                uniform float progress;
                                uniform float ldrBoost;
                                uniform float strength;
                                uniform float isAdd;
                                
                                varying vec3 vNormal;
                                varying vec2 vUv;
                                varying vec3 vViewPosition;
                                
                                void main() {
                                    vec3 baseCol = baseColor;
                                    #ifdef USE_MAP
                                        baseCol *= texture2D(baseTexture, vUv).rgb;
                                    #endif
                                    
                                    vec3 viewNormal = normalize(vNormal);
                                    vec2 matcapUv;
                                    matcapUv.x = viewNormal.x * 0.49 + 0.5;
                                    matcapUv.y = -viewNormal.y * 0.49 + 0.5;
                                    
                                    vec3 matcapCol = texture2D(matcapTexture, matcapUv).rgb;
                                    matcapCol *= ldrBoost;
                                    
                                    vec3 finalColor;
                                    if (isAdd > 0.5) {
                                        // Matcap Add: edge-based additive blending
                                        vec3 viewDir = normalize(vViewPosition);
                                        float dotNV = dot(viewDir, viewNormal);
                                        dotNV = clamp(dotNV, 0.0, 1.0);
                                        float edgeValue = 1.0 - dotNV;
                                        float blendFactor = edgeValue * progress * 3.0;
                                        blendFactor = clamp(blendFactor, 0.0, 1.0);
                                        finalColor = baseCol + matcapCol * strength * blendFactor;
                                    } else {
                                        // Matcap: direct material replacement based on progress
                                        finalColor = mix(baseCol, matcapCol, progress);
                                    }
                                    
                                    gl_FragColor = vec4(finalColor, 1.0);
                                }
                            `,
                            defines: baseTexture ? { USE_MAP: '' } : {}
                        });

                        (shaderMat as any).isMatcapShader = true;
                        child.material = shaderMat;
                    }
                    return;
                }

                if (child.material instanceof THREE.ShaderMaterial && (child.material as any).isMatcapShader) {
                    if (child.userData.originalMaterial) {
                        child.material = child.userData.originalMaterial.clone();
                    }
                }

                const material = child.material as THREE.MeshStandardMaterial;

                if (material.isMeshStandardMaterial) {
                    material.emissive = new THREE.Color(0x000000);
                    material.emissiveIntensity = 0;
                    material.transparent = false;
                    material.opacity = 1;
                    material.alphaTest = 0;

                    shaderFeatures.forEach((feature) => {
                        switch (feature.type) {
                            case 'rim_light':
                                if (feature.params.intensity > 0) {
                                    material.emissive = new THREE.Color(feature.params.color);
                                    material.emissiveIntensity = feature.params.intensity * 0.3;
                                }
                                break;
                            case 'bleach':
                                if (feature.params.intensity > 0) {
                                    material.color.lerp(new THREE.Color(feature.params.color), feature.params.intensity);
                                }
                                break;
                            case 'dissolve':
                                if (feature.params.threshold > 0) {
                                    material.transparent = true;
                                    material.opacity = 1 - feature.params.threshold;
                                }
                                break;
                            case 'alpha_test':
                                material.alphaTest = feature.params.threshold;
                                break;
                            case 'normal_map':
                                if (material.normalMap && feature.params.strength) {
                                    material.normalScale = new THREE.Vector2(
                                        feature.params.strength,
                                        feature.params.strength
                                    );
                                }
                                break;
                        }
                    });
                    material.needsUpdate = true;
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
