import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import * as THREE from 'three';
import type { ShaderFeature, ShaderGroup } from '../../../../domain/value-objects/ShaderFeature';
import { loadTexture } from '../../../../utils/texture/textureLoaderUtils';
import { InitEffekseerRuntimeUseCase } from '../../../../application/use-cases/InitEffekseerRuntimeUseCase';
import { getEffekseerRuntimeAdapter } from '../../../../application/use-cases/effectRuntimeStore';
import { KeyboardCameraControls } from './KeyboardCameraControls';

export interface ModelRef {
    play: () => void;
    pause: () => void;
    seekTo: (time: number) => void;
    getCurrentTime: () => number;
    getDuration: () => number;
}

export interface SceneViewerRef extends ModelRef {
    resetCamera: () => void;
    takeScreenshot: () => void;
    startRecording: () => void;
    stopRecording: () => void;
    isRecording: () => boolean;
}

interface ModelInstanceForRender {
    id?: string; // 模型 ID，用於識別活動模型
    model: THREE.Group | null;
    clip: THREE.AnimationClip | null;
    shaderGroups: ShaderGroup[];
    isShaderEnabled: boolean;
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
    visible: boolean;
}

interface SceneViewerProps {
    // 單模型模式（向後兼容）
    model?: THREE.Group | null;
    playingClip?: THREE.AnimationClip | null;
    shaderGroups?: ShaderGroup[];
    isShaderEnabled?: boolean;
    // 多模型模式
    models?: ModelInstanceForRender[];
    activeModelId?: string | null; // 活動模型 ID
    onTimeUpdate?: (time: number) => void;
    loop?: boolean;
    onFinish?: () => void;
    backgroundColor?: string;
    cameraSettings?: {
        fov: number;
        near: number;
        far: number;
    };
    boundBone?: THREE.Bone | null;
    isCameraBound?: boolean;
    showGroundPlane?: boolean;
    groundPlaneColor?: string;
    groundPlaneOpacity?: number;
    enableShadows?: boolean;
    showGrid?: boolean;
    gridColor?: string;
    gridCellColor?: string;
    toneMappingExposure?: number;
    whitePoint?: number;
    hdriUrl?: string;
    environmentIntensity?: number;
    // 鍵盤相機控制
    keyboardControlsEnabled?: boolean;
    cameraMoveSpeed?: number;
    cameraSprintMultiplier?: number;
}

// Scene Settings Controller
function SceneSettings({ toneMappingExposure, environmentIntensity }: { toneMappingExposure?: number, environmentIntensity?: number }) {
    const { gl, scene } = useThree();

    useEffect(() => {
        if (toneMappingExposure !== undefined) {
            gl.toneMappingExposure = toneMappingExposure;
        }
    }, [toneMappingExposure, gl]);

    useEffect(() => {
        if (environmentIntensity !== undefined) {
            // For newer Three.js versions
            if ('environmentIntensity' in scene) {
                (scene as any).environmentIntensity = environmentIntensity;
            } else {
                // Fallback for older versions: traverse and update environment map intensity if possible, 
                // or rely on Environment component's background intensity if it supports it.
                // Since we can't easily change global env map intensity on older three.js without traversing materials
                // or using a specific prop on Environment (which might be 'environmentIntensity' prop on Environment in v9+),
                // we will try setting it on the scene if supported.
            }
        }
    }, [environmentIntensity, scene]);

    return null;
}

// 創建一個全局的錄影狀態管理
const recordingState = {
    isRecording: false,
    captureStream: null as MediaStream | null
};

function EffekseerFrameBridge() {
    const { gl, camera, scene } = useThree();
    const [initialized, setInitialized] = React.useState(false);

    // 初始化 Effekseer（使用 Three.js 的 WebGL Context）
    React.useEffect(() => {
        const webglContext = gl.getContext() as WebGLRenderingContext;
        
        console.log('[EffekseerFrameBridge] 開始初始化 Effekseer Runtime...');
        InitEffekseerRuntimeUseCase.execute({ webglContext })
            .then(() => {
                console.log('[EffekseerFrameBridge] ✓ Effekseer Runtime 初始化成功');
                setInitialized(true);
            })
            .catch((error) => {
                console.error('[EffekseerFrameBridge] ✗ 初始化 Effekseer Runtime 失敗:', error);
            });
    }, [gl]);

    // Effekseer 更新（只更新邏輯，不渲染）
    useFrame((_state, delta) => {
        if (!initialized) return;
        
        const adapter = getEffekseerRuntimeAdapter();
        const context = adapter.effekseerContext;
        if (context) {
            // 只更新 Effekseer 的邏輯狀態
            context.update(delta * 60);
        }
    });

    // 在 Three.js 渲染完成後繪製 Effekseer
    React.useEffect(() => {
        if (!initialized || !scene || !camera) return;

        const adapter = getEffekseerRuntimeAdapter();
        const context = adapter.effekseerContext;
        if (!context) return;

        // 掛載 onAfterRender 回調
        const originalOnAfterRender = scene.onAfterRender;
        
        scene.onAfterRender = (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) => {
            // 先呼叫原始的 onAfterRender（如果有）
            if (originalOnAfterRender) {
                // Scene.onAfterRender 只需要 3 個參數，但 Object3D 的類型定義要求 6 個
                // 使用類型斷言來避免類型錯誤
                (originalOnAfterRender as (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) => void)(renderer, scene, camera);
            }

            // 同步相機矩陣
            const projMatrix = (camera as any).projectionMatrix.elements;
            const camMatrix = (camera as any).matrixWorldInverse.elements;
            context.setProjectionMatrix(projMatrix);
            context.setCameraMatrix(camMatrix);
            
            // 繪製 Effekseer（在 Three.js 渲染完成後）
            context.draw();
            
            // 重置 Three.js 狀態（避免 Effekseer 破壞 WebGL 狀態）
            renderer.resetState();
            
            // 如果正在錄影，手動請求新幀（確保 Effekseer 渲染內容被捕獲）
            if (recordingState.isRecording && recordingState.captureStream) {
                const videoTrack = recordingState.captureStream.getVideoTracks()[0];
                if (videoTrack && typeof (videoTrack as any).requestFrame === 'function') {
                    (videoTrack as any).requestFrame();
                }
            }
        };

        // 清理函數
        return () => {
            scene.onAfterRender = originalOnAfterRender;
        };
    }, [initialized, scene, camera]);
    
    return null;
}

// Camera Controller Component to update camera settings dynamically
function CameraController({
    cameraSettings,
    boundBone,
    isCameraBound
}: {
    cameraSettings?: { fov: number; near: number; far: number };
    boundBone?: THREE.Bone | null;
    isCameraBound?: boolean;
}) {
    const { camera } = useThree();

    // Update camera settings
    useEffect(() => {
        if (cameraSettings && camera instanceof THREE.PerspectiveCamera) {
            camera.fov = cameraSettings.fov;
            camera.near = cameraSettings.near;
            camera.far = cameraSettings.far;
            camera.updateProjectionMatrix();
        }
    }, [cameraSettings, camera]);

    // Camera bone binding - update camera position every frame
    useFrame(() => {
        if (isCameraBound && boundBone && camera) {
            const boneWorldPos = new THREE.Vector3();
            boundBone.getWorldPosition(boneWorldPos);
            camera.position.copy(boneWorldPos);
        }
    });

    return null;
}

// Camera State Broadcaster - 廣播相機狀態給外部組件
function CameraStateBroadcaster() {
    const { camera, controls } = useThree();

    useFrame(() => {
        if (camera && controls) {
            const orbitControls = controls as any;
            // 廣播相機狀態
            const event = new CustomEvent('camera-update', {
                detail: {
                    position: camera.position.toArray(),
                    target: orbitControls.target ? orbitControls.target.toArray() : [0, 0, 0],
                    zoom: (camera as THREE.PerspectiveCamera).zoom || 1
                }
            });
            window.dispatchEvent(event);
        }
    });

    return null;
}

type ModelProps = {
    model: THREE.Group;
    clip: THREE.AnimationClip | null;
    onTimeUpdate?: (time: number) => void;
    shaderGroups: ShaderGroup[];
    isShaderEnabled?: boolean;
    loop?: boolean;
    onFinish?: () => void;
    enableShadows?: boolean;
    initialPlaying?: boolean; // 初始播放狀態
    initialTime?: number; // 初始時間位置
};

const Model = forwardRef<ModelRef, ModelProps>(
    ({ model, clip, onTimeUpdate, shaderGroups, isShaderEnabled = true, loop = true, onFinish, enableShadows, initialPlaying = false, initialTime }, ref) => {
        const mixerRef = useRef<THREE.AnimationMixer | null>(null);
        const actionRef: React.MutableRefObject<THREE.AnimationAction | null> = useRef<THREE.AnimationAction | null>(null);
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
            if (model) {
                // Update shadow casting without recreating the mixer
                model.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.castShadow = !!enableShadows;
                        // Disable self-shadowing to prevent the model from looking darker
                        // The user only requested shadows on the ground
                        child.receiveShadow = false;
                    }
                });
            }
        }, [model, enableShadows]);

        const onFinishRef = useRef(onFinish);
        const loopRef = useRef(loop);

        useEffect(() => {
            onFinishRef.current = onFinish;
        }, [onFinish]);

        useEffect(() => {
            loopRef.current = loop;
        }, [loop]);

        // 追蹤當前的 clip 和 loop，避免不必要的重置
        const currentClipRef = useRef<THREE.AnimationClip | null>(null);
        const currentLoopRef = useRef<boolean>(loop);
        const initializedRef = useRef(false);

        useEffect(() => {
            if (mixerRef.current && clip) {
                // 如果 clip 和 loop 都沒有改變且已經初始化，保持當前狀態，不重置
                const clipChanged = currentClipRef.current !== clip;
                const loopChanged = currentLoopRef.current !== loop;
                
                if (!clipChanged && !loopChanged && initializedRef.current && actionRef.current) {
                    // clip 和 loop 都相同且已初始化，不重置，讓模型繼續自己的播放狀態
                    return;
                }

                // Clean up previous listeners
                const handleFinish = () => {
                    if (onFinishRef.current) onFinishRef.current();
                };

                // 如果只是 loop 改變，不需要重新創建 action，只需要更新 loop 設置
                if (!clipChanged && loopChanged && actionRef.current) {
                    // 移除舊的 finished 監聽器
                    if (mixerRef.current) {
                        mixerRef.current.removeEventListener('finished', handleFinish);
                    }
                    
                    // 更新 loop 設置
                    if (!loop) {
                        actionRef.current.setLoop(THREE.LoopOnce, 1);
                        actionRef.current.clampWhenFinished = true;
                        mixerRef.current.addEventListener('finished', handleFinish);
                    } else {
                        actionRef.current.setLoop(THREE.LoopRepeat, Infinity);
                        actionRef.current.clampWhenFinished = false;
                    }
                    
                    currentLoopRef.current = loop;
                    
                    // 返回清理函數
                    return () => {
                        if (mixerRef.current) {
                            mixerRef.current.removeEventListener('finished', handleFinish);
                        }
                    };
                }

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
                    action.clampWhenFinished = false;
                }

                action.reset();
                // 根據 initialPlaying 設置初始播放狀態
                action.paused = !initialPlaying;
                isPlayingRef.current = initialPlaying;
                // 設置初始時間位置（如果有的話）
                if (initialTime !== undefined && initialTime !== null && !isNaN(initialTime)) {
                    action.time = initialTime;
                }
                if (initialPlaying) {
                    action.play();
                }
                actionRef.current = action;
                currentClipRef.current = clip;
                currentLoopRef.current = loop;
                initializedRef.current = true;

                return () => {
                    if (mixerRef.current) {
                        mixerRef.current.removeEventListener('finished', handleFinish);
                    }
                };
            } else if (!clip && actionRef.current) {
                // 如果 clip 被移除，停止 action
                actionRef.current.stop();
                actionRef.current = null;
                currentClipRef.current = null;
                currentLoopRef.current = loop;
                initializedRef.current = false;
                isPlayingRef.current = false;
            }
        }, [clip, model, loop, initialPlaying, initialTime]);

        useImperativeHandle(ref, () => ({
            play: () => {
                if (actionRef.current) {
                    // If the action was finished (clamped) and we want to play again, we might need to reset it
                    // However, usually we want to resume. But if it's at the end and not looping, we should probably restart?
                    // Let's check if it's effectively finished.
                    // But simpler: just unpause. If the user wants to replay, they usually seek to 0 or we handle it here.
                    // If we are at the end and play is clicked, we should probably restart.

                    if (!actionRef.current.isRunning() && actionRef.current.time >= actionRef.current.getClip().duration && !loop) {
                        actionRef.current.reset();
                    }

                    // 確保 action 已經啟動
                    if (!actionRef.current.isRunning()) {
                        actionRef.current.play();
                    }
                    actionRef.current.paused = false;
                    isPlayingRef.current = true;
                } else if (mixerRef.current && clip) {
                    // 如果 action 還沒有創建，創建它
                    const action = mixerRef.current.clipAction(clip);
                    if (!loop) {
                        action.setLoop(THREE.LoopOnce, 1);
                        action.clampWhenFinished = true;
                    } else {
                        action.setLoop(THREE.LoopRepeat, Infinity);
                    }
                    action.reset();
                    action.play();
                    actionRef.current = action;
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
                if (actionRef.current && mixerRef.current) {
                    // 設置動畫時間
                    actionRef.current.time = time;
                    
                    // 同步時間到 model.userData 供 ModelPreview 使用
                    if (model) {
                        model.userData.animationTime = time;
                    }
                    
                    // 強制更新骨架位置（即使動畫暫停）
                    // 關鍵：必須先取消暫停，更新 mixer，再恢復暫停狀態
                    const wasPaused = actionRef.current.paused;
                    const wasPlaying = isPlayingRef.current;
                    
                    // 確保 action 處於可更新狀態
                    actionRef.current.paused = false;
                    if (!actionRef.current.isRunning()) {
                        actionRef.current.play();
                    }
                    
                    // 更新 mixer 以應用新的時間到骨架
                    mixerRef.current.update(0.001); // 使用極小的 delta 強制更新
                    
                    // 恢復原狀態
                    actionRef.current.paused = wasPaused;
                    isPlayingRef.current = wasPlaying;
                }
            },
            getCurrentTime: () => actionRef.current?.time ?? 0,
            getDuration: () => actionRef.current?.getClip().duration ?? 0,
        }));

        const onTimeUpdateRef = useRef(onTimeUpdate);
        useEffect(() => {
            onTimeUpdateRef.current = onTimeUpdate;
        }, [onTimeUpdate]);

        useFrame((_state, delta) => {
            if (mixerRef.current && isPlayingRef.current) {
                mixerRef.current.update(delta);
                if (onTimeUpdateRef.current && actionRef.current) {
                    // console.log('SceneViewer: sending time', actionRef.current.time);
                    onTimeUpdateRef.current(actionRef.current.time);
                    
                    // 將當前動畫時間存到 model.userData 中，供 ModelPreview 同步使用
                    if (model) {
                        model.userData.animationTime = actionRef.current.time;
                    }
                    
                    // 檢查動畫是否結束（非循環模式下）
                    if (!loopRef.current && actionRef.current.time >= actionRef.current.getClip().duration) {
                        // 動畫已結束，觸發 onFinish 回調並停止播放
                        if (onFinishRef.current) {
                            onFinishRef.current();
                        }
                        // 停止播放
                        actionRef.current.paused = true;
                        isPlayingRef.current = false;
                    }
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

                if (!isShaderEnabled) {
                    child.material = child.userData.originalMaterial;
                    return;
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

                // 從該組的 features 中提取各種效果（只取啟用的）
                const shaderFeatures = meshGroup.features.filter((f: ShaderFeature) => f.enabled !== false);

                // Separate Base Matcap and Additive Matcap
                const baseMatcapFeature = shaderFeatures.find(
                    (f: ShaderFeature) => f.type === 'matcap' && f.params.texture
                );
                const addMatcapFeature = shaderFeatures.find(
                    (f: ShaderFeature) => f.type === 'matcap_add' && f.params.texture
                );

                const unlitFeature = shaderFeatures.find((f: ShaderFeature) => f.type === 'unlit');
                const rimLightFeature = shaderFeatures.find((f: ShaderFeature) => f.type === 'rim_light');
                const flashFeature = shaderFeatures.find((f: ShaderFeature) => f.type === 'flash');
                const dissolveFeature = shaderFeatures.find((f: ShaderFeature) => f.type === 'dissolve');
                const alphaTestFeature = shaderFeatures.find((f: ShaderFeature) => f.type === 'alpha_test');
                const normalMapFeature = shaderFeatures.find((f: ShaderFeature) => f.type === 'normal_map');

                const shouldUseShader = unlitFeature || baseMatcapFeature || addMatcapFeature || rimLightFeature || flashFeature || dissolveFeature || alphaTestFeature || normalMapFeature;

                if (!shouldUseShader) {
                    child.material = child.userData.originalMaterial;
                    return;
                }

                // Helper function to set texture color space
                const setTextureColorSpace = (texture: THREE.Texture | null, type: 'sRGB' | 'linear') => {
                    if (!texture) return;
                    if (type === 'sRGB') {
                        texture.colorSpace = THREE.SRGBColorSpace;
                    } else {
                        texture.colorSpace = THREE.LinearSRGBColorSpace;
                    }
                };

                // Load textures using utility function
                const baseMatcapTex = loadTexture(textureLoader, baseMatcapFeature?.params.texture);
                setTextureColorSpace(baseMatcapTex, 'sRGB'); // Matcap → sRGB

                const baseMatcapMaskTex = loadTexture(textureLoader, baseMatcapFeature?.params.maskTexture);
                setTextureColorSpace(baseMatcapMaskTex, 'linear'); // Mask → Linear

                const addMatcapTex = loadTexture(textureLoader, addMatcapFeature?.params.texture);
                setTextureColorSpace(addMatcapTex, 'sRGB'); // Matcap → sRGB

                const addMatcapMaskTex = loadTexture(textureLoader, addMatcapFeature?.params.maskTexture);
                setTextureColorSpace(addMatcapMaskTex, 'linear'); // Mask → Linear

                const dissolveTex = loadTexture(textureLoader, dissolveFeature?.params.texture);
                setTextureColorSpace(dissolveTex, 'linear'); // Dissolve noise → Linear

                const normalMapTex = loadTexture(textureLoader, normalMapFeature?.params.texture);
                setTextureColorSpace(normalMapTex, 'linear'); // Normal → Linear

                // Flash textures need callback for material update
                const flashTex = loadTexture(
                    textureLoader,
                    flashFeature?.params.texture,
                    (tex) => {
                        setTextureColorSpace(tex, 'sRGB'); // Flash texture → sRGB
                        if (child.material) {
                            child.material.needsUpdate = true;
                        }
                    }
                );
                setTextureColorSpace(flashTex, 'sRGB'); // Set immediately if already loaded

                const flashMaskTex = loadTexture(
                    textureLoader,
                    flashFeature?.params.maskTexture,
                    (tex) => {
                        setTextureColorSpace(tex, 'linear'); // Flash mask → Linear
                        if (child.material) {
                            child.material.needsUpdate = true;
                        }
                    }
                );
                setTextureColorSpace(flashMaskTex, 'linear'); // Set immediately if already loaded

                let shaderMat: THREE.ShaderMaterial;

                // ALWAYS recreate shader when features change to ensure defines are updated
                // (especially important when textures are added/removed)
                const originalMaterial = child.userData.originalMaterial as THREE.MeshStandardMaterial;
                const baseTexture = originalMaterial.map || null;
                const baseColor = originalMaterial.color ? originalMaterial.color.clone() : new THREE.Color(0xffffff);
                const isSkinnedMesh = (child as any).isSkinnedMesh;

                shaderMat = new THREE.ShaderMaterial({
                    uniforms: {
                        // Base
                        baseTexture: { value: baseTexture },
                        baseColor: { value: baseColor },
                        uTime: { value: 0 },

                        // Unlit Mode
                        useUnlit: { value: 0.0 },

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
                                #include <common>

                                uniform sampler2D baseTexture;
                                uniform vec3 baseColor;
                                uniform float uTime;
                                
                                // Unlit Mode (無光照模式)
                                uniform float useUnlit;
                                
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
                                    // 在 Linear 色域中進行所有顏色運算
                                    vec3 finalColor = baseColor;
                                    vec4 baseTexColor = vec4(1.0);
                                    #ifdef USE_MAP
                                        baseTexColor = texture2D(baseTexture, vUv);
                                        // baseTexture 已透過 colorSpace 設為 sRGB，three.js / GPU 會自動解碼到 Linear
                                        // 這裡直接使用 sample 結果，避免重複 gamma 解碼
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
                                    // 只在非 Unlit 模式下使用 Normal Map
                                    if (useNormalMap > 0.5 && useUnlit < 0.5) {
                                        viewNormal = perturbNormal2Arb( -vViewPosition, viewNormal, vUv, normalScale );
                                    }
                                
                                    // --- Base Matcap (Mix) ---
                                    // Unlit 模式下跳过 Matcap
                                    if (useMatcap > 0.5 && useUnlit < 0.5) {
                                        vec2 matcapUv;
                                        matcapUv.x = viewNormal.x * 0.49 + 0.5;
                                        matcapUv.y = -viewNormal.y * 0.49 + 0.5;
                                        
                                        vec3 matcapCol = texture2D(matcapTexture, matcapUv).rgb;
                                        // matcapTexture 也設為 sRGB，sample 結果已是 Linear
                                
                                        // Apply mask if available
                                        float matcapMask = 1.0;
                                        #ifdef USE_MATCAP_MASK
                                            matcapMask = texture2D(matcapMaskTexture, vUv).r;
                                        #endif
                                
                                        finalColor = mix(finalColor, matcapCol, matcapProgress * matcapMask);
                                    }
                                
                                    // --- Additive Matcap (Add) ---
                                    // Unlit 模式下跳过 Additive Matcap
                                    if (useMatcapAdd > 0.5 && useUnlit < 0.5) {
                                        vec2 matcapAddUv;
                                        matcapAddUv.x = viewNormal.x * 0.49 + 0.5;
                                        matcapAddUv.y = -viewNormal.y * 0.49 + 0.5;
                                
                                        vec3 matcapAddCol = texture2D(matcapAddTexture, matcapAddUv).rgb;
                                        // matcapAddTexture 也設為 sRGB，sample 結果已是 Linear
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
                                    // Unlit 模式下跳过 Rim Light
                                    if (useRimLight > 0.5 && useUnlit < 0.5) {
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
                                    
                                    // 將 Linear 顏色輸出給 three.js，後續由 toneMapping_fragment / colorspace_fragment 統一處理
                                    gl_FragColor = vec4(finalColor, baseTexColor.a);

                                    #include <tonemapping_fragment>
                                    #include <colorspace_fragment>
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
                    } as any
                } as any);
                // 在建立後再設定 skinning，避免 three.js 對建構參數提出警告
                (shaderMat as any).skinning = isSkinnedMesh;
                child.material = shaderMat;

                // Update Uniforms

                // Unlit Mode
                if (unlitFeature) {
                    shaderMat.uniforms.useUnlit.value = 1.0;
                } else {
                    shaderMat.uniforms.useUnlit.value = 0.0;
                }

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
            });
        }, [model, shaderGroups, isShaderEnabled]);

        if (!model) return null;
        return <primitive object={model} scale={0.01} />;
    }
);

// MultiModel Component for rendering multiple models with individual transforms
type MultiModelProps = {
    modelInstance: {
        model: THREE.Group | null;
        clip: THREE.AnimationClip | null;
        shaderGroups: ShaderGroup[];
        isShaderEnabled: boolean;
        position: [number, number, number];
        rotation: [number, number, number];
        scale: [number, number, number];
        visible: boolean;
        isPlaying?: boolean; // 播放狀態
        currentTime?: number; // 當前時間
        isLoopEnabled?: boolean; // 循環設置
        isCameraOrbiting?: boolean; // 相機是否公轉
        cameraOrbitSpeed?: number; // 相機公轉速度
        isModelRotating?: boolean; // 模型是否自轉
        modelRotationSpeed?: number; // 模型自轉速度
    };
    onTimeUpdate?: (time: number) => void;
    loop?: boolean;
    onFinish?: () => void;
    enableShadows?: boolean;
    isActiveModel?: boolean; // 是否為活動模型（只有活動模型才執行相機公轉）
};

const MultiModel = forwardRef<ModelRef, MultiModelProps>(
    ({ modelInstance, onTimeUpdate, loop = true, onFinish, enableShadows, isActiveModel = false }, ref) => {
        const { 
            model, clip, shaderGroups, isShaderEnabled, position, rotation, scale, visible, 
            isPlaying = false, currentTime, isLoopEnabled,
            isCameraOrbiting = false, cameraOrbitSpeed = 30,
            isModelRotating = false, modelRotationSpeed = 30
        } = modelInstance;
        
        // 使用模型自己的 loop 設置，如果有的話
        const modelLoop = isLoopEnabled !== undefined ? isLoopEnabled : loop;
        
        // 使用現有的 Model 組件處理動畫和 shader
        const modelRef = useRef<ModelRef>(null);
        const groupRef = useRef<THREE.Group>(null);
        
        // 相機公轉累積角度
        const cameraOrbitAngleRef = useRef(0);
        
        // 模型自轉累積角度
        const modelRotationAngleRef = useRef(rotation[1]); // 儲存 Y 軸初始角度
        
        const { camera } = useThree();
        
        // 每個模型都應該更新時間，即使不是活動模型
        // 但只有活動模型的時間更新會觸發 onTimeUpdate 回調（用於 UI 同步）
        const handleTimeUpdate = (time: number) => {
            // 只有當有 onTimeUpdate 回調時才調用（活動模型）
            if (onTimeUpdate) {
                onTimeUpdate(time);
            }
            // 所有模型都會繼續播放和更新，但只有活動模型會同步到 UI
        };
        
        // 相機公轉邏輯（只在活動模型上執行）
        useFrame((state, delta) => {
            if (isCameraOrbiting && isActiveModel && model) {
                const controls = state.controls as any;
                const modelPosition = new THREE.Vector3(...position);
                
                // 確保 OrbitControls 目標點設置為模型位置
                if (controls && controls.target) {
                    controls.target.copy(modelPosition);
                }
                
                // 計算當前相機到模型的實時距離（允許用戶用滾輪調整）
                const currentDistance = camera.position.distanceTo(modelPosition);
                
                // 獲取相機的高度（Y 軸位置相對於模型）
                const heightOffset = camera.position.y - modelPosition.y;
                
                // 計算水平距離（用於圓周運動）
                const horizontalDistance = Math.sqrt(currentDistance * currentDistance - heightOffset * heightOffset);
                
                // 更新累積角度
                cameraOrbitAngleRef.current += (cameraOrbitSpeed * delta * Math.PI) / 180;
                
                // 計算新的相機位置（水平圓周運動，保持高度）
                const newX = modelPosition.x + horizontalDistance * Math.sin(cameraOrbitAngleRef.current);
                const newZ = modelPosition.z + horizontalDistance * Math.cos(cameraOrbitAngleRef.current);
                const newY = modelPosition.y + heightOffset;
                
                camera.position.set(newX, newY, newZ);
                
                // 讓相機始終朝向模型中心
                camera.lookAt(modelPosition);
            }
        });
        
        // 模型自轉邏輯
        useFrame((_state, delta) => {
            if (isModelRotating && groupRef.current) {
                // 更新累積角度（度數）
                modelRotationAngleRef.current += modelRotationSpeed * delta;
                
                // 將度數轉換為弧度並應用到 Y 軸旋轉
                const rotationRad = [
                    (rotation[0] * Math.PI) / 180,
                    (modelRotationAngleRef.current * Math.PI) / 180,
                    (rotation[2] * Math.PI) / 180
                ] as [number, number, number];
                
                groupRef.current.rotation.set(...rotationRad);
            }
        });
        
        // 監聽外部 currentTime 變化（用於 Director Mode）
        useEffect(() => {
            if (currentTime !== undefined && modelRef.current) {
                modelRef.current.seekTo(currentTime);
            }
        }, [currentTime]);

        useImperativeHandle(ref, () => ({
            play: () => modelRef.current?.play(),
            pause: () => modelRef.current?.pause(),
            seekTo: (time: number) => modelRef.current?.seekTo(time),
            getCurrentTime: () => modelRef.current?.getCurrentTime() ?? 0,
            getDuration: () => modelRef.current?.getDuration() ?? 0,
        }));

        if (!model || !visible) return null;

        // 將度數轉換為弧度
        const rotationRad = rotation.map(deg => (deg * Math.PI) / 180) as [number, number, number];

        return (
            <group
                ref={groupRef}
                position={position}
                rotation={rotationRad}
                scale={scale}
            >
                <Model
                    ref={modelRef}
                    model={model}
                    clip={clip}
                    onTimeUpdate={handleTimeUpdate}
                    shaderGroups={shaderGroups}
                    isShaderEnabled={isShaderEnabled}
                    loop={modelLoop}
                    onFinish={onFinish}
                    enableShadows={enableShadows}
                    initialPlaying={isPlaying}
                    initialTime={currentTime}
                />
            </group>
        );
    }
);

const SceneViewer = forwardRef<SceneViewerRef, SceneViewerProps>(
    ({ 
        model, 
        playingClip, 
        models,
        activeModelId,
        onTimeUpdate, 
        shaderGroups = [], 
        isShaderEnabled = true, 
        loop, 
        onFinish, 
        backgroundColor = '#111827', 
        cameraSettings, 
        boundBone, 
        isCameraBound, 
        showGroundPlane, 
        groundPlaneColor = '#444444', 
        groundPlaneOpacity = 1.0, 
        enableShadows = false, 
        showGrid = true, 
        gridColor = '#4a4a4a', 
        gridCellColor = '#2a2a2a', 
        toneMappingExposure, 
        whitePoint: _whitePoint, 
        hdriUrl, 
        environmentIntensity,
        keyboardControlsEnabled = true,
        cameraMoveSpeed = 5.0,
        cameraSprintMultiplier = 2.0
    }, ref) => {
        // 決定使用單模型還是多模型模式
        const isMultiModelMode = models && models.length > 0;
        const activeModel = isMultiModelMode ? null : model;
        const activeClip = isMultiModelMode ? null : playingClip;
        const activeShaderGroups = isMultiModelMode ? [] : shaderGroups;
        const activeIsShaderEnabled = isMultiModelMode ? true : isShaderEnabled;

        // 在多模型模式下，找到活動模型的索引
        const activeModelIndex = isMultiModelMode && activeModelId && models
            ? models.findIndex(m => m.id === activeModelId)
            : 0;

        const modelRef = useRef<ModelRef>(null);
        const orbitControlsRef = useRef<any>(null);
        const glRef = useRef<THREE.WebGLRenderer | null>(null);
        const mediaRecorderRef = useRef<MediaRecorder | null>(null);
        const recordedChunksRef = useRef<Blob[]>([]);
        const isRecordingRef = useRef<boolean>(false);
        const captureStreamRef = useRef<MediaStream | null>(null);

        useEffect(() => {
            if (!glRef.current) {
                return;
            }
            if (backgroundColor === 'transparent') {
                glRef.current.setClearAlpha(0);
            } else {
                glRef.current.setClearAlpha(1);
                glRef.current.setClearColor(new THREE.Color(backgroundColor), 1);
            }
        }, [backgroundColor]);

        useImperativeHandle(ref, () => ({
            play: () => modelRef.current?.play(),
            pause: () => modelRef.current?.pause(),
            seekTo: (time: number) => modelRef.current?.seekTo(time),
            getCurrentTime: () => modelRef.current?.getCurrentTime() ?? 0,
            getDuration: () => modelRef.current?.getDuration() ?? 0,
            resetCamera: () => {
                console.log('resetCamera called', orbitControlsRef.current);
                if (orbitControlsRef.current) {
                    orbitControlsRef.current.reset();
                }
            },
            takeScreenshot: () => {
                if (glRef.current) {
                    try {
                        // 獲取 canvas 元素
                        const canvas = glRef.current.domElement;
                        
                        console.log('Canvas dimensions:', canvas.width, 'x', canvas.height);
                        
                        // 使用 canvas.toDataURL 生成圖片
                        const dataURL = canvas.toDataURL('image/png', 1.0);
                        
                        console.log('DataURL length:', dataURL.length);
                        
                        // 驗證截圖不是空白的
                        if (dataURL === 'data:,' || dataURL.length < 100) {
                            throw new Error('Canvas appears to be empty');
                        }
                        
                        // 創建下載連結
                        const link = document.createElement('a');
                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                        link.download = `screenshot_${timestamp}.png`;
                        link.href = dataURL;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        
                        console.log('Screenshot saved successfully:', link.download);
                    } catch (error) {
                        console.error('Failed to take screenshot:', error);
                        alert(`截圖失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
                    }
                } else {
                    console.error('WebGL renderer not available');
                    alert('渲染器未就緒，請稍後再試');
                }
            },
            startRecording: () => {
                if (!glRef.current) {
                    console.error('WebGL renderer not available');
                    alert('渲染器未就緒，請稍後再試');
                    return;
                }

                if (isRecordingRef.current) {
                    console.warn('Recording already in progress');
                    return;
                }

                try {
                    const canvas = glRef.current.domElement;
                    
                    // 從 canvas 獲取視頻流（使用 0 FPS 表示手動捕獲模式）
                    // 這樣可以確保在 Effekseer 渲染完成後才捕獲畫面
                    const stream = canvas.captureStream(0); // 0 FPS = 手動捕獲
                    captureStreamRef.current = stream;
                    
                    // 設置 MediaRecorder
                    let mimeType = 'video/webm;codecs=vp9';
                    
                    // 檢查瀏覽器支持的格式
                    if (!MediaRecorder.isTypeSupported(mimeType)) {
                        console.warn('vp9 not supported, trying vp8');
                        mimeType = 'video/webm;codecs=vp8';
                        if (!MediaRecorder.isTypeSupported(mimeType)) {
                            console.warn('vp8 not supported, using default');
                            mimeType = 'video/webm';
                        }
                    }
                    
                    const options: MediaRecorderOptions = {
                        mimeType: mimeType,
                        videoBitsPerSecond: 8000000 // 8 Mbps
                    };
                    
                    const mediaRecorder = new MediaRecorder(stream, options);
                    recordedChunksRef.current = [];
                    
                    // 更新全局錄影狀態
                    recordingState.isRecording = true;
                    recordingState.captureStream = stream;
                    
                    mediaRecorder.ondataavailable = (event) => {
                        if (event.data.size > 0) {
                            recordedChunksRef.current.push(event.data);
                            console.log('Recorded chunk:', event.data.size, 'bytes');
                        }
                    };
                    
                    mediaRecorder.onstop = () => {
                        console.log('Recording stopped, total chunks:', recordedChunksRef.current.length);
                        
                        if (recordedChunksRef.current.length > 0) {
                            const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                            const url = URL.createObjectURL(blob);
                            
                            // 創建下載連結
                            const link = document.createElement('a');
                            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                            link.download = `recording_${timestamp}.webm`;
                            link.href = url;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            
                            // 清理
                            setTimeout(() => URL.revokeObjectURL(url), 100);
                            
                            console.log('Recording saved successfully:', link.download);
                        } else {
                            console.error('No recorded data');
                            alert('錄影失敗：沒有錄製到資料');
                        }
                        
                        recordedChunksRef.current = [];
                        isRecordingRef.current = false;
                        // 清理全局錄影狀態
                        recordingState.isRecording = false;
                        recordingState.captureStream = null;
                    };
                    
                    mediaRecorder.onerror = (event: Event) => {
                        console.error('MediaRecorder error:', event);
                        alert('錄影過程中發生錯誤');
                        isRecordingRef.current = false;
                    };
                    
                    mediaRecorder.start(100); // 每 100ms 收集一次數據
                    mediaRecorderRef.current = mediaRecorder;
                    isRecordingRef.current = true;
                    
                    console.log('Recording started with', mimeType);
                } catch (error) {
                    console.error('Failed to start recording:', error);
                    alert(`開始錄影失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
                    isRecordingRef.current = false;
                }
            },
            stopRecording: () => {
                if (!isRecordingRef.current || !mediaRecorderRef.current) {
                    console.warn('No recording in progress');
                    return;
                }

                try {
                    mediaRecorderRef.current.stop();
                    console.log('Stop recording requested');
                    captureStreamRef.current = null;
                    // 更新全局錄影狀態
                    recordingState.isRecording = false;
                    recordingState.captureStream = null;
                } catch (error) {
                    console.error('Failed to stop recording:', error);
                    alert(`停止錄影失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
                    isRecordingRef.current = false;
                    captureStreamRef.current = null;
                    // 更新全局錄影狀態
                    recordingState.isRecording = false;
                    recordingState.captureStream = null;
                }
            },
            isRecording: () => isRecordingRef.current
        }));

        // Effekseer 初始化已移至 EffekseerFrameBridge 組件中

        return (
            <div
                className="w-full h-full rounded-lg overflow-hidden shadow-xl border border-gray-700 transition-colors duration-300"
                style={{ backgroundColor }}
            >
                <Canvas
                    shadows={enableShadows}
                    camera={{
                        position: [0, 2, 5],
                        fov: cameraSettings?.fov || 50,
                        near: cameraSettings?.near || 0.1,
                        far: cameraSettings?.far || 1000
                    }}
                    gl={{
                        preserveDrawingBuffer: true,
                        antialias: true,
                        alpha: true
                    }}
                    onCreated={({ gl }) => {
                        // 統一輸出色彩空間為 sRGB
                        gl.outputColorSpace = THREE.SRGBColorSpace;
                        // 改用 Linear Tone Mapping 以匹配 Cocos Creator（保持顏色鮮豔度）
                        gl.toneMapping = THREE.LinearToneMapping;
                        if (backgroundColor === 'transparent') {
                            gl.setClearAlpha(0);
                        } else {
                            gl.setClearAlpha(1);
                            gl.setClearColor(new THREE.Color(backgroundColor), 1);
                        }
                        if (toneMappingExposure !== undefined) {
                            gl.toneMappingExposure = toneMappingExposure;
                        }
                        // 保存 gl 引用以供截圖使用
                        glRef.current = gl;
                    }}>
                    <EffekseerFrameBridge />
                    <SceneSettings toneMappingExposure={toneMappingExposure} environmentIntensity={environmentIntensity} />
                    {hdriUrl && <Environment files={hdriUrl} background blur={0.5} />}
                    <ambientLight intensity={0.8 * (environmentIntensity ?? 1.0)} />
                    <hemisphereLight args={["#ffffff", "#444444", 0.6]} />
                    <directionalLight
                        position={[5, 10, 7.5]}
                        intensity={1.2}
                        castShadow={enableShadows}
                        shadow-mapSize-width={2048}
                        shadow-mapSize-height={2048}
                        shadow-camera-near={0.1}
                        shadow-camera-far={100}
                        shadow-camera-left={-10}
                        shadow-camera-right={10}
                        shadow-camera-top={10}
                        shadow-camera-bottom={-10}
                        shadow-bias={-0.0001}
                    />
                    <directionalLight position={[-10, 5, -5]} intensity={0.6} />
                    <directionalLight position={[0, -5, 0]} intensity={0.4} />
                    <CameraController cameraSettings={cameraSettings} boundBone={boundBone} isCameraBound={isCameraBound} />
                    <CameraStateBroadcaster />
                    {showGrid && <Grid args={[30, 30]} sectionColor={gridColor} cellColor={gridCellColor} side={THREE.DoubleSide} />}

                    {/* Ground Plane */}
                    {showGroundPlane && (
                        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow={enableShadows}>
                            <planeGeometry args={[30, 30]} />
                            <meshStandardMaterial
                                key={`ground-${groundPlaneColor}-${groundPlaneOpacity}`}
                                color={groundPlaneColor}
                                transparent={groundPlaneOpacity < 1.0}
                                opacity={groundPlaneOpacity}
                                side={THREE.DoubleSide}
                            />
                        </mesh>
                    )}
                    {/* 多模型模式 */}
                    {isMultiModelMode && models && models.map((modelInstance, index) => {
                        const clip = modelInstance.clip || null;
                        // 只有活動模型才綁定 ref 和 onTimeUpdate
                        const isActive = index === activeModelIndex;
                        return (
                            <MultiModel
                                key={`model-${modelInstance.id || index}`}
                                ref={isActive ? modelRef : undefined}
                                modelInstance={{
                                    ...modelInstance,
                                    clip
                                }}
                                onTimeUpdate={isActive ? onTimeUpdate : undefined}
                                loop={loop}
                                onFinish={isActive ? onFinish : undefined}
                                enableShadows={enableShadows}
                                isActiveModel={isActive}
                            />
                        );
                    })}
                    {/* 單模型模式（向後兼容） */}
                    {!isMultiModelMode && activeModel && (
                        <Model
                            ref={modelRef}
                            model={activeModel}
                            clip={activeClip || null}
                            onTimeUpdate={onTimeUpdate}
                            shaderGroups={activeShaderGroups}
                            isShaderEnabled={activeIsShaderEnabled}
                            loop={loop}
                            onFinish={onFinish}
                            enableShadows={enableShadows}
                            initialPlaying={false}
                        />
                    )}
                    <OrbitControls
                        ref={orbitControlsRef}
                        makeDefault
                        enableDamping={false}
                        screenSpacePanning={true}
                        rotateSpeed={1.0}
                        zoomSpeed={1.2}
                        panSpeed={1.0}
                        mouseButtons={{
                            LEFT: THREE.MOUSE.ROTATE,
                            MIDDLE: THREE.MOUSE.ROTATE,
                            RIGHT: THREE.MOUSE.PAN
                        }}
                    />
                    <KeyboardCameraControls
                        enabled={keyboardControlsEnabled}
                        moveSpeed={cameraMoveSpeed}
                        sprintMultiplier={cameraSprintMultiplier}
                    />
                </Canvas>
            </div>
        );
    }
);

export default React.memo(SceneViewer);

