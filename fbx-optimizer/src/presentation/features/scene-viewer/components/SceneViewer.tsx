import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import type { ShaderFeature, ShaderGroup } from '../../../../domain/value-objects/ShaderFeature';
import { loadTexture } from '../../../../utils/texture/textureLoaderUtils';
import { InitEffekseerRuntimeUseCase } from '../../../../application/use-cases/InitEffekseerRuntimeUseCase';
import { getEffekseerRuntimeAdapter } from '../../../../application/use-cases/effectRuntimeStore';
import { KeyboardCameraControls } from './KeyboardCameraControls';
import { FrameEmitter } from './FrameEmitter';
import { directorEventBus } from '../../../../infrastructure/events';

export interface ModelRef {
    play: () => void;
    pause: () => void;
    seekTo: (time: number) => void;
    getCurrentTime: () => number;
    getDuration: () => number;
    /** 直接設置動畫時間（不觸發播放邏輯，用於 Director Mode） */
    setAnimationTime: (time: number) => void;
    /** 動態切換動畫片段（用於 Director Mode） */
    setClip: (newClip: THREE.AnimationClip) => void;
}

export interface RendererInfo {
    render: {
        calls: number;
        triangles: number;
        points: number;
        lines: number;
    };
    memory: {
        geometries: number;
        textures: number;
    };
    programs: number | null;
}

/** 相機狀態（用於視圖快照） */
export interface CameraState {
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
    isOrthographic: boolean;
    orthoZoom: number;
}

export interface SceneViewerRef extends ModelRef {
    resetCamera: () => void;
    takeScreenshot: () => void;
    startRecording: () => void;
    stopRecording: () => void;
    isRecording: () => boolean;
    getRendererInfo: () => RendererInfo | null;
    /** 聚焦到指定模型，相機以 45 度俯角看向模型 */
    focusOnModel: (modelId: string) => void;
    /** 獲取當前相機狀態（用於視圖快照） */
    getCameraState: () => CameraState | null;
    /** 設置相機狀態（用於套用視圖快照） */
    setCameraState: (state: CameraState) => void;
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
    showWireframe?: boolean;
    opacity?: number;
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
    isOrthographic?: boolean;
    orthoZoom?: number;
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
    // Director Mode
    isDirectorMode?: boolean;
    // Transform Gizmo
    showTransformGizmo?: boolean;
    onModelPositionChange?: (modelId: string, position: [number, number, number]) => void;
    // 截圖尺寸設定
    screenshotWidth?: number;
    screenshotHeight?: number;
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
    isCameraBound,
    isOrthographic,
    orthoZoom
}: {
    cameraSettings?: { fov: number; near: number; far: number };
    boundBone?: THREE.Bone | null;
    isCameraBound?: boolean;
    isOrthographic?: boolean;
    orthoZoom?: number;
}) {
    const { camera, size, set } = useThree();

    // Update camera settings for perspective camera
    useEffect(() => {
        if (cameraSettings && camera instanceof THREE.PerspectiveCamera && !isOrthographic) {
            camera.fov = cameraSettings.fov;
            camera.near = cameraSettings.near;
            camera.far = cameraSettings.far;
            camera.updateProjectionMatrix();
        }
    }, [cameraSettings, camera, isOrthographic]);

    // Update camera settings for orthographic camera
    useEffect(() => {
        if (camera instanceof THREE.OrthographicCamera && isOrthographic && orthoZoom !== undefined) {
            const aspect = size.width / size.height;
            const frustumSize = 10;
            const zoom = orthoZoom / 10; // 轉換縮放值
            camera.left = -frustumSize * aspect / zoom;
            camera.right = frustumSize * aspect / zoom;
            camera.top = frustumSize / zoom;
            camera.bottom = -frustumSize / zoom;
            camera.near = cameraSettings?.near ?? 0.1;
            camera.far = cameraSettings?.far ?? 1000;
            camera.updateProjectionMatrix();
        }
    }, [camera, isOrthographic, orthoZoom, size, cameraSettings]);

    // 創建正交相機並在模式切換時替換
    useEffect(() => {
        if (isOrthographic && camera instanceof THREE.PerspectiveCamera) {
            // 從透視切換到正交
            const aspect = size.width / size.height;
            const frustumSize = 10;
            const zoom = (orthoZoom ?? 50) / 10;
            
            const orthoCamera = new THREE.OrthographicCamera(
                -frustumSize * aspect / zoom,
                frustumSize * aspect / zoom,
                frustumSize / zoom,
                -frustumSize / zoom,
                cameraSettings?.near ?? 0.1,
                cameraSettings?.far ?? 1000
            );
            
            // 複製位置和旋轉
            orthoCamera.position.copy(camera.position);
            orthoCamera.quaternion.copy(camera.quaternion);
            
            set({ camera: orthoCamera });
        } else if (!isOrthographic && camera instanceof THREE.OrthographicCamera) {
            // 從正交切換到透視
            const perspCamera = new THREE.PerspectiveCamera(
                cameraSettings?.fov ?? 50,
                size.width / size.height,
                cameraSettings?.near ?? 0.1,
                cameraSettings?.far ?? 1000
            );
            
            // 複製位置和旋轉
            perspCamera.position.copy(camera.position);
            perspCamera.quaternion.copy(camera.quaternion);
            
            set({ camera: perspCamera });
        }
    }, [isOrthographic, camera, set, size, cameraSettings, orthoZoom]);

    // Camera bone binding - update camera position and rotation every frame
    useFrame(() => {
        if (isCameraBound && boundBone && camera) {
            // 位置跟隨
            const boneWorldPos = new THREE.Vector3();
            boundBone.getWorldPosition(boneWorldPos);
            camera.position.copy(boneWorldPos);
            
            // 旋轉跟隨
            const boneWorldQuat = new THREE.Quaternion();
            boundBone.getWorldQuaternion(boneWorldQuat);
            camera.quaternion.copy(boneWorldQuat);
        }
    });

    return null;
}

// Camera Ref Sync - 同步外部 cameraRef 以便快照功能正常工作
function CameraRefSync({ cameraRef }: { cameraRef: React.MutableRefObject<THREE.Camera | null> }) {
    const { camera } = useThree();
    
    useEffect(() => {
        // 當 R3F 的 camera 改變時，同步更新外部的 cameraRef
        if (camera && cameraRef.current !== camera) {
            cameraRef.current = camera;
        }
    }, [camera, cameraRef]);
    
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
                
                // 禁用視錐體剔除，避免相機綁定骨骼時模型因 bounding box 未更新而消失
                model.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.frustumCulled = false;
                    }
                });
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
                    
                    // 同步時間到 model.userData
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
            setAnimationTime: (time: number) => {
                if (actionRef.current && mixerRef.current) {
                    // 確保 action 處於可更新狀態
                    const wasRunning = actionRef.current.isRunning();
                    if (!wasRunning) {
                        actionRef.current.play();
                    }
                    
                    // 設置時間
                    actionRef.current.time = time;
                    actionRef.current.paused = true; // Director Mode 下保持暫停
                    
                    // 強制更新骨架
                    mixerRef.current.update(0);
                }
            },
            setClip: (newClip: THREE.AnimationClip) => {
                if (!mixerRef.current) return;
                
                // 停止當前動作
                if (actionRef.current) {
                    actionRef.current.stop();
                }
                
                // 創建新的 action
                const action = mixerRef.current.clipAction(newClip);
                action.setLoop(loopRef.current ? THREE.LoopRepeat : THREE.LoopOnce, loopRef.current ? Infinity : 1);
                action.clampWhenFinished = !loopRef.current;
                action.reset();
                action.play();
                action.paused = true; // Director Mode 下保持暫停
                
                actionRef.current = action;
                currentClipRef.current = newClip;
            },
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
                    
                    // 將當前動畫時間存到 model.userData 中
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
        // 🔧 修復記憶體洩漏：追蹤所有動態載入的貼圖
        const loadedTexturesRef = useRef<THREE.Texture[]>([]);

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
            
            // 🔧 清理上一次的貼圖（模型切換或 shader 設定變更時）
            loadedTexturesRef.current.forEach(tex => {
                if (tex && tex.dispose) {
                    tex.dispose();
                }
            });
            loadedTexturesRef.current = [];

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
                // 支援主貼圖模式或 RGB 通道模式（任一有貼圖即可）
                const baseMatcapFeature = shaderFeatures.find(
                    (f: ShaderFeature) => f.type === 'matcap' && (
                        f.params.texture || f.params.textureR || f.params.textureG || f.params.textureB
                    )
                );
                const addMatcapFeature = shaderFeatures.find(
                    (f: ShaderFeature) => f.type === 'matcap_add' && (
                        f.params.texture || f.params.textureR || f.params.textureG || f.params.textureB
                    )
                );

                const unlitFeature = shaderFeatures.find((f: ShaderFeature) => f.type === 'unlit');
                const rimLightFeature = shaderFeatures.find((f: ShaderFeature) => f.type === 'rim_light');
                const flashFeature = shaderFeatures.find((f: ShaderFeature) => f.type === 'flash');
                const dissolveFeature = shaderFeatures.find((f: ShaderFeature) => f.type === 'dissolve');
                const alphaTestFeature = shaderFeatures.find((f: ShaderFeature) => f.type === 'alpha_test');
                const normalMapFeature = shaderFeatures.find((f: ShaderFeature) => f.type === 'normal_map');
                const setTextureFeature = shaderFeatures.find((f: ShaderFeature) => f.type === 'set_texture' && f.params.texture);

                const shouldUseShader = unlitFeature || baseMatcapFeature || addMatcapFeature || rimLightFeature || flashFeature || dissolveFeature || alphaTestFeature || normalMapFeature || setTextureFeature;

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

                // Base Matcap RGB 通道貼圖
                const baseMatcapTexR = loadTexture(textureLoader, baseMatcapFeature?.params.textureR);
                setTextureColorSpace(baseMatcapTexR, 'sRGB');
                const baseMatcapTexG = loadTexture(textureLoader, baseMatcapFeature?.params.textureG);
                setTextureColorSpace(baseMatcapTexG, 'sRGB');
                const baseMatcapTexB = loadTexture(textureLoader, baseMatcapFeature?.params.textureB);
                setTextureColorSpace(baseMatcapTexB, 'sRGB');

                // Additive Matcap RGB 通道貼圖
                const addMatcapTexR = loadTexture(textureLoader, addMatcapFeature?.params.textureR);
                setTextureColorSpace(addMatcapTexR, 'sRGB');
                const addMatcapTexG = loadTexture(textureLoader, addMatcapFeature?.params.textureG);
                setTextureColorSpace(addMatcapTexG, 'sRGB');
                const addMatcapTexB = loadTexture(textureLoader, addMatcapFeature?.params.textureB);
                setTextureColorSpace(addMatcapTexB, 'sRGB');

                const dissolveTex = loadTexture(textureLoader, dissolveFeature?.params.texture);
                setTextureColorSpace(dissolveTex, 'linear'); // Dissolve noise → Linear

                const normalMapTex = loadTexture(textureLoader, normalMapFeature?.params.texture);
                // 根據 nonColor 設定決定使用 Linear 還是 sRGB（預設 true = Linear，與 Blender 相同）
                const normalMapColorSpace = normalMapFeature?.params.nonColor !== false ? 'linear' : 'sRGB';
                setTextureColorSpace(normalMapTex, normalMapColorSpace);

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

                // Set Texture（更換主貼圖）
                const setTextureTex = loadTexture(textureLoader, setTextureFeature?.params.texture);
                setTextureColorSpace(setTextureTex, 'sRGB'); // 主貼圖 → sRGB

                // 🔧 收集所有動態載入的貼圖以便後續清理
                const dynamicTextures = [
                    baseMatcapTex, baseMatcapMaskTex,
                    baseMatcapTexR, baseMatcapTexG, baseMatcapTexB,
                    addMatcapTex, addMatcapMaskTex,
                    addMatcapTexR, addMatcapTexG, addMatcapTexB,
                    dissolveTex, normalMapTex,
                    flashTex, flashMaskTex,
                    setTextureTex
                ].filter((tex): tex is THREE.Texture => tex !== null);
                loadedTexturesRef.current.push(...dynamicTextures);

                let shaderMat: THREE.ShaderMaterial;

                // ALWAYS recreate shader when features change to ensure defines are updated
                // (especially important when textures are added/removed)
                
                // 🔧 修復記憶體洩漏：在創建新 ShaderMaterial 前，釋放舊的
                if (child.material instanceof THREE.ShaderMaterial) {
                    // 釋放舊 ShaderMaterial 的 uniforms 中的貼圖（但不釋放 originalMaterial 中的貼圖）
                    const oldMat = child.material;
                    if (oldMat.uniforms) {
                        const textureUniforms = [
                            'matcapTexture', 'matcapMaskTexture',
                            'matcapAddTexture', 'matcapAddMaskTexture',
                            'flashTexture', 'flashMaskTexture',
                            'dissolveTexture', 'normalMap'
                        ];
                        textureUniforms.forEach(name => {
                            const uniform = oldMat.uniforms[name];
                            if (uniform?.value && uniform.value.dispose) {
                                uniform.value.dispose();
                            }
                        });
                    }
                    oldMat.dispose();
                }
                
                // 🔧 處理多材質情況：originalMaterial 可能是陣列或單一材質
                const originalMaterial = child.userData.originalMaterial;
                let baseTexture: THREE.Texture | null = null;
                let baseColor = new THREE.Color(0xffffff);
                
                if (Array.isArray(originalMaterial)) {
                    // 多材質：取第一個材質的屬性作為基礎
                    const firstMat = originalMaterial[0] as THREE.MeshStandardMaterial;
                    if (firstMat) {
                        baseTexture = firstMat.map || null;
                        baseColor = firstMat.color?.clone() || new THREE.Color(0xffffff);
                    }
                } else if (originalMaterial) {
                    const mat = originalMaterial as THREE.MeshStandardMaterial;
                    baseTexture = mat.map || null;
                    baseColor = mat.color?.clone() || new THREE.Color(0xffffff);
                }
                
                // 🖼️ Set Texture（更換主貼圖）：如果啟用則替換 baseTexture
                if (setTextureTex) {
                    baseTexture = setTextureTex;
                    // 設置 tiling 和 offset
                    const tilingX = setTextureFeature?.params.tilingX ?? 1.0;
                    const tilingY = setTextureFeature?.params.tilingY ?? 1.0;
                    const offsetX = setTextureFeature?.params.offsetX ?? 0.0;
                    const offsetY = setTextureFeature?.params.offsetY ?? 0.0;
                    baseTexture.repeat.set(tilingX, tilingY);
                    baseTexture.offset.set(offsetX, offsetY);
                    baseTexture.wrapS = THREE.RepeatWrapping;
                    baseTexture.wrapT = THREE.RepeatWrapping;
                }
                
                const isSkinnedMesh = (child as any).isSkinnedMesh;

                // 保存當前的 wireframe 和 side 設置
                const currentWireframe = child.material instanceof THREE.Material ? (child.material as any).wireframe || false : false;
                const currentSide = child.material instanceof THREE.Material ? (child.material as any).side || THREE.FrontSide : THREE.FrontSide;
                
                // 檢查 geometry 是否有 uv2 屬性
                const geometry = (child as THREE.Mesh).geometry as THREE.BufferGeometry;
                const hasUV2 = geometry?.attributes?.uv2 !== undefined;
                
                // FBX 的第二層 UV 可能命名為 uv1（FBXLoader 的命名慣例）
                // 如果沒有 uv2 但有 uv1，則複製 uv1 到 uv2
                if (!hasUV2 && geometry?.attributes?.uv1) {
                    geometry.setAttribute('uv2', geometry.attributes.uv1);
                }
                // 如果完全沒有第二層 UV，則複製 uv 到 uv2 作為 fallback
                else if (!hasUV2 && geometry?.attributes?.uv) {
                    geometry.setAttribute('uv2', geometry.attributes.uv.clone());
                }
                
                shaderMat = new THREE.ShaderMaterial({
                    uniforms: {
                        // Base
                        baseTexture: { value: baseTexture },
                        baseColor: { value: baseColor },
                        uTime: { value: 0 },
                        uOpacity: { value: 1.0 },

                        // Unlit Mode
                        useUnlit: { value: 0.0 },

                        // Base Matcap
                        matcapTexture: { value: null },
                        matcapMaskTexture: { value: null },
                        matcapProgress: { value: 0 },
                        useMatcap: { value: 0.0 },
                        // RGB 通道遮罩 Matcap
                        matcapTextureR: { value: null },
                        matcapTextureG: { value: null },
                        matcapTextureB: { value: null },
                        matcapUseMaskR: { value: 0.0 },
                        matcapUseMaskG: { value: 0.0 },
                        matcapUseMaskB: { value: 0.0 },
                        matcapStrengthR: { value: 1.0 },
                        matcapStrengthG: { value: 1.0 },
                        matcapStrengthB: { value: 1.0 },

                        // Additive Matcap
                        matcapAddTexture: { value: null },
                        matcapAddMaskTexture: { value: null },
                        matcapAddStrength: { value: 1.0 },
                        matcapAddColor: { value: new THREE.Color(0xffffff) },
                        useMatcapAdd: { value: 0.0 },
                        // RGB 通道遮罩 Matcap Add
                        matcapAddTextureR: { value: null },
                        matcapAddTextureG: { value: null },
                        matcapAddTextureB: { value: null },
                        matcapAddUseMaskR: { value: 0.0 },
                        matcapAddUseMaskG: { value: 0.0 },
                        matcapAddUseMaskB: { value: 0.0 },
                        matcapAddStrengthR: { value: 1.0 },
                        matcapAddStrengthG: { value: 1.0 },
                        matcapAddStrengthB: { value: 1.0 },

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
                        normalMapUseUV2: { value: 0.0 },  // 使用第二層 UV
                    },
                    vertexShader: `
                                varying vec3 vNormal;
                                varying vec2 vUv;
                                varying vec2 vUv2;
                                varying vec3 vViewPosition;
                                
                                // 第二層 UV - Three.js 會自動綁定 uv2 attribute（如果模型有的話）
                                attribute vec2 uv2;
                                
                                #include <common>
                                #include <skinning_pars_vertex>
                                
                                void main() {
                                    vUv = uv;
                                    // 傳遞第二層 UV（如果模型沒有 uv2，會是 vec2(0,0)）
                                    vUv2 = uv2;
                                    
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
                                uniform float uOpacity;
                                
                                // Unlit Mode (無光照模式)
                                uniform float useUnlit;
                                
                                // Base Matcap
                                uniform sampler2D matcapTexture;
                                uniform sampler2D matcapMaskTexture;
                                uniform float matcapProgress;
                                uniform float useMatcap;
                                // RGB 通道遮罩 Matcap
                                uniform sampler2D matcapTextureR;
                                uniform sampler2D matcapTextureG;
                                uniform sampler2D matcapTextureB;
                                uniform float matcapUseMaskR;
                                uniform float matcapUseMaskG;
                                uniform float matcapUseMaskB;
                                uniform float matcapStrengthR;
                                uniform float matcapStrengthG;
                                uniform float matcapStrengthB;
                                
                                // Additive Matcap
                                uniform sampler2D matcapAddTexture;
                                uniform sampler2D matcapAddMaskTexture;
                                uniform float matcapAddStrength;
                                uniform vec3 matcapAddColor;
                                uniform float useMatcapAdd;
                                // RGB 通道遮罩 Matcap Add
                                uniform sampler2D matcapAddTextureR;
                                uniform sampler2D matcapAddTextureG;
                                uniform sampler2D matcapAddTextureB;
                                uniform float matcapAddUseMaskR;
                                uniform float matcapAddUseMaskG;
                                uniform float matcapAddUseMaskB;
                                uniform float matcapAddStrengthR;
                                uniform float matcapAddStrengthG;
                                uniform float matcapAddStrengthB;
                                
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
                                uniform float normalMapUseUV2;
                                
                                varying vec3 vNormal;
                                varying vec2 vUv;
                                varying vec2 vUv2;
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
                                        // 根據 normalMapUseUV2 選擇 UV 層
                                        vec2 normalUv = normalMapUseUV2 > 0.5 ? vUv2 : vUv;
                                        viewNormal = perturbNormal2Arb( -vViewPosition, viewNormal, normalUv, normalScale );
                                    }
                                
                                    // --- Base Matcap (Mix) ---
                                    // Unlit 模式下跳过 Matcap
                                    if (useMatcap > 0.5 && useUnlit < 0.5) {
                                        vec2 matcapUv;
                                        matcapUv.x = viewNormal.x * 0.49 + 0.5;
                                        matcapUv.y = viewNormal.y * 0.49 + 0.5;
                                        
                                        // 檢查是否使用 RGB 通道遮罩模式
                                        float useRGBMask = matcapUseMaskR + matcapUseMaskG + matcapUseMaskB;
                                        
                                        if (useRGBMask > 0.5) {
                                            // RGB 通道遮罩模式：根據遮罩的 R/G/B 通道分別使用不同的 Matcap
                                            #ifdef USE_MATCAP_MASK
                                                vec3 maskSample = texture2D(matcapMaskTexture, vUv).rgb;
                                                vec3 matcapResult = vec3(0.0);
                                                
                                                // R 通道（使用各自的強度）
                                                if (matcapUseMaskR > 0.5 && maskSample.r > 0.01) {
                                                    vec3 colR = texture2D(matcapTextureR, matcapUv).rgb;
                                                    matcapResult += colR * maskSample.r * matcapStrengthR;
                                                }
                                                // G 通道（使用各自的強度）
                                                if (matcapUseMaskG > 0.5 && maskSample.g > 0.01) {
                                                    vec3 colG = texture2D(matcapTextureG, matcapUv).rgb;
                                                    matcapResult += colG * maskSample.g * matcapStrengthG;
                                                }
                                                // B 通道（使用各自的強度）
                                                if (matcapUseMaskB > 0.5 && maskSample.b > 0.01) {
                                                    vec3 colB = texture2D(matcapTextureB, matcapUv).rgb;
                                                    matcapResult += colB * maskSample.b * matcapStrengthB;
                                                }
                                                
                                                // 計算有效遮罩（考慮 strength 的影響）
                                                float effectiveMask = 0.0;
                                                if (matcapUseMaskR > 0.5) effectiveMask += maskSample.r * matcapStrengthR;
                                                if (matcapUseMaskG > 0.5) effectiveMask += maskSample.g * matcapStrengthG;
                                                if (matcapUseMaskB > 0.5) effectiveMask += maskSample.b * matcapStrengthB;
                                                effectiveMask = clamp(effectiveMask, 0.0, 1.0);
                                                
                                                finalColor = finalColor * (1.0 - effectiveMask) + matcapResult;
                                            #endif
                                        } else {
                                            // 原有模式：使用單一 Matcap 貼圖
                                            vec3 matcapCol = texture2D(matcapTexture, matcapUv).rgb;
                                            
                                            float matcapMask = 1.0;
                                            #ifdef USE_MATCAP_MASK
                                                matcapMask = texture2D(matcapMaskTexture, vUv).r;
                                            #endif
                                            
                                            finalColor = mix(finalColor, matcapCol, matcapProgress * matcapMask);
                                        }
                                    }
                                
                                    // --- Additive Matcap (Add) ---
                                    // Unlit 模式下跳过 Additive Matcap
                                    if (useMatcapAdd > 0.5 && useUnlit < 0.5) {
                                        vec2 matcapAddUv;
                                        matcapAddUv.x = viewNormal.x * 0.49 + 0.5;
                                        matcapAddUv.y = viewNormal.y * 0.49 + 0.5;
                                
                                        // 檢查是否使用 RGB 通道遮罩模式
                                        float useAddRGBMask = matcapAddUseMaskR + matcapAddUseMaskG + matcapAddUseMaskB;
                                        
                                        if (useAddRGBMask > 0.5) {
                                            // RGB 通道遮罩模式
                                            #ifdef USE_MATCAP_ADD_MASK
                                                vec3 addMaskSample = texture2D(matcapAddMaskTexture, vUv).rgb;
                                                vec3 matcapAddResult = vec3(0.0);
                                                
                                                // R 通道（使用各自的強度）
                                                if (matcapAddUseMaskR > 0.5 && addMaskSample.r > 0.01) {
                                                    vec3 colR = texture2D(matcapAddTextureR, matcapAddUv).rgb;
                                                    matcapAddResult += colR * addMaskSample.r * matcapAddColor * matcapAddStrengthR;
                                                }
                                                // G 通道（使用各自的強度）
                                                if (matcapAddUseMaskG > 0.5 && addMaskSample.g > 0.01) {
                                                    vec3 colG = texture2D(matcapAddTextureG, matcapAddUv).rgb;
                                                    matcapAddResult += colG * addMaskSample.g * matcapAddColor * matcapAddStrengthG;
                                                }
                                                // B 通道（使用各自的強度）
                                                if (matcapAddUseMaskB > 0.5 && addMaskSample.b > 0.01) {
                                                    vec3 colB = texture2D(matcapAddTextureB, matcapAddUv).rgb;
                                                    matcapAddResult += colB * addMaskSample.b * matcapAddColor * matcapAddStrengthB;
                                                }
                                                
                                                finalColor += matcapAddResult;
                                            #endif
                                        } else {
                                            // 原有模式
                                            vec3 matcapAddCol = texture2D(matcapAddTexture, matcapAddUv).rgb;
                                            matcapAddCol *= matcapAddColor;
                                            
                                            float matcapAddMask = 1.0;
                                            #ifdef USE_MATCAP_ADD_MASK
                                                matcapAddMask = texture2D(matcapAddMaskTexture, vUv).r;
                                            #endif
                                            
                                            finalColor += matcapAddCol * matcapAddStrength * matcapAddMask;
                                        }
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
                                    // 應用透明度
                                    float finalAlpha = baseTexColor.a * uOpacity;
                                    gl_FragColor = vec4(finalColor, finalAlpha);

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
                // 恢復 wireframe 和 side 設置
                (shaderMat as any).wireframe = currentWireframe;
                (shaderMat as any).side = currentSide;
                // 設置透明度相關
                shaderMat.transparent = true;
                shaderMat.depthWrite = true; // 保持深度寫入以正確渲染
                child.material = shaderMat;

                // Update Uniforms

                // Unlit Mode
                if (unlitFeature) {
                    shaderMat.uniforms.useUnlit.value = 1.0;
                } else {
                    shaderMat.uniforms.useUnlit.value = 0.0;
                }

                // Base Matcap
                if (baseMatcapFeature) {
                    const hasRGBMode = baseMatcapFeature.params.useMaskR || baseMatcapFeature.params.useMaskG || baseMatcapFeature.params.useMaskB;
                    // 檢查是否有任一 RGB 通道貼圖
                    const hasAnyRGBTexture = baseMatcapTexR || baseMatcapTexG || baseMatcapTexB;
                    
                    if (hasRGBMode && baseMatcapMaskTex && hasAnyRGBTexture) {
                        // RGB 通道遮罩模式：需要遮罩貼圖 + 至少一個通道貼圖
                        shaderMat.uniforms.useMatcap.value = 1.0;
                        shaderMat.uniforms.matcapMaskTexture.value = baseMatcapMaskTex;
                        shaderMat.uniforms.matcapProgress.value = baseMatcapFeature.params.progress ?? 0.5;
                        
                        // RGB 通道設定（只有當有對應貼圖時才啟用）
                        shaderMat.uniforms.matcapUseMaskR.value = (baseMatcapFeature.params.useMaskR && baseMatcapTexR) ? 1.0 : 0.0;
                        shaderMat.uniforms.matcapUseMaskG.value = (baseMatcapFeature.params.useMaskG && baseMatcapTexG) ? 1.0 : 0.0;
                        shaderMat.uniforms.matcapUseMaskB.value = (baseMatcapFeature.params.useMaskB && baseMatcapTexB) ? 1.0 : 0.0;
                        
                        // RGB 通道強度
                        shaderMat.uniforms.matcapStrengthR.value = baseMatcapFeature.params.strengthR ?? 1.0;
                        shaderMat.uniforms.matcapStrengthG.value = baseMatcapFeature.params.strengthG ?? 1.0;
                        shaderMat.uniforms.matcapStrengthB.value = baseMatcapFeature.params.strengthB ?? 1.0;
                        
                        // RGB 通道貼圖
                        if (baseMatcapTexR) shaderMat.uniforms.matcapTextureR.value = baseMatcapTexR;
                        if (baseMatcapTexG) shaderMat.uniforms.matcapTextureG.value = baseMatcapTexG;
                        if (baseMatcapTexB) shaderMat.uniforms.matcapTextureB.value = baseMatcapTexB;
                    } else if (baseMatcapTex) {
                        // 原有單一貼圖模式
                        shaderMat.uniforms.useMatcap.value = 1.0;
                        shaderMat.uniforms.matcapTexture.value = baseMatcapTex;
                        if (baseMatcapMaskTex) shaderMat.uniforms.matcapMaskTexture.value = baseMatcapMaskTex;
                        shaderMat.uniforms.matcapProgress.value = baseMatcapFeature.params.progress ?? 0.5;
                        shaderMat.uniforms.matcapUseMaskR.value = 0.0;
                        shaderMat.uniforms.matcapUseMaskG.value = 0.0;
                        shaderMat.uniforms.matcapUseMaskB.value = 0.0;
                    } else {
                        shaderMat.uniforms.useMatcap.value = 0.0;
                    }
                } else {
                    shaderMat.uniforms.useMatcap.value = 0.0;
                    shaderMat.uniforms.matcapUseMaskR.value = 0.0;
                    shaderMat.uniforms.matcapUseMaskG.value = 0.0;
                    shaderMat.uniforms.matcapUseMaskB.value = 0.0;
                }

                // Additive Matcap
                if (addMatcapFeature) {
                    const hasAddRGBMode = addMatcapFeature.params.useMaskR || addMatcapFeature.params.useMaskG || addMatcapFeature.params.useMaskB;
                    // 檢查是否有任一 RGB 通道貼圖
                    const hasAnyAddRGBTexture = addMatcapTexR || addMatcapTexG || addMatcapTexB;
                    
                    if (hasAddRGBMode && addMatcapMaskTex && hasAnyAddRGBTexture) {
                        // RGB 通道遮罩模式：需要遮罩貼圖 + 至少一個通道貼圖
                        shaderMat.uniforms.useMatcapAdd.value = 1.0;
                        shaderMat.uniforms.matcapAddMaskTexture.value = addMatcapMaskTex;
                        shaderMat.uniforms.matcapAddStrength.value = addMatcapFeature.params.strength ?? 1.0;
                        shaderMat.uniforms.matcapAddColor.value = new THREE.Color(addMatcapFeature.params.color || '#ffffff');
                        
                        // RGB 通道設定（只有當有對應貼圖時才啟用）
                        shaderMat.uniforms.matcapAddUseMaskR.value = (addMatcapFeature.params.useMaskR && addMatcapTexR) ? 1.0 : 0.0;
                        shaderMat.uniforms.matcapAddUseMaskG.value = (addMatcapFeature.params.useMaskG && addMatcapTexG) ? 1.0 : 0.0;
                        shaderMat.uniforms.matcapAddUseMaskB.value = (addMatcapFeature.params.useMaskB && addMatcapTexB) ? 1.0 : 0.0;
                        
                        // RGB 通道強度
                        shaderMat.uniforms.matcapAddStrengthR.value = addMatcapFeature.params.strengthR ?? 1.0;
                        shaderMat.uniforms.matcapAddStrengthG.value = addMatcapFeature.params.strengthG ?? 1.0;
                        shaderMat.uniforms.matcapAddStrengthB.value = addMatcapFeature.params.strengthB ?? 1.0;
                        
                        // RGB 通道貼圖
                        if (addMatcapTexR) shaderMat.uniforms.matcapAddTextureR.value = addMatcapTexR;
                        if (addMatcapTexG) shaderMat.uniforms.matcapAddTextureG.value = addMatcapTexG;
                        if (addMatcapTexB) shaderMat.uniforms.matcapAddTextureB.value = addMatcapTexB;
                    } else if (addMatcapTex) {
                        // 原有單一貼圖模式
                        shaderMat.uniforms.useMatcapAdd.value = 1.0;
                        shaderMat.uniforms.matcapAddTexture.value = addMatcapTex;
                        if (addMatcapMaskTex) shaderMat.uniforms.matcapAddMaskTexture.value = addMatcapMaskTex;
                        shaderMat.uniforms.matcapAddStrength.value = addMatcapFeature.params.strength ?? 1.0;
                        shaderMat.uniforms.matcapAddColor.value = new THREE.Color(addMatcapFeature.params.color || '#ffffff');
                        shaderMat.uniforms.matcapAddUseMaskR.value = 0.0;
                        shaderMat.uniforms.matcapAddUseMaskG.value = 0.0;
                        shaderMat.uniforms.matcapAddUseMaskB.value = 0.0;
                    } else {
                        shaderMat.uniforms.useMatcapAdd.value = 0.0;
                    }
                } else {
                    shaderMat.uniforms.useMatcapAdd.value = 0.0;
                    shaderMat.uniforms.matcapAddUseMaskR.value = 0.0;
                    shaderMat.uniforms.matcapAddUseMaskG.value = 0.0;
                    shaderMat.uniforms.matcapAddUseMaskB.value = 0.0;
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
                    // 使用第二層 UV
                    shaderMat.uniforms.normalMapUseUV2.value = normalMapFeature.params.useUV2 ? 1.0 : 0.0;
                } else {
                    shaderMat.uniforms.useNormalMap.value = 0.0;
                    shaderMat.uniforms.normalMapUseUV2.value = 0.0;
                }

                materialsRef.current.push(shaderMat);
            });
            
            // 🔧 Cleanup：當模型切換或組件卸載時釋放貼圖和材質
            return () => {
                // 釋放所有追蹤的貼圖
                loadedTexturesRef.current.forEach(tex => {
                    if (tex && tex.dispose) {
                        tex.dispose();
                    }
                });
                loadedTexturesRef.current = [];
                
                // 釋放所有追蹤的 ShaderMaterial
                materialsRef.current.forEach(mat => {
                    if (mat && mat.dispose) {
                        mat.dispose();
                    }
                });
                materialsRef.current = [];
            };
        }, [model, shaderGroups, isShaderEnabled]);

        if (!model) return null;
        return <primitive object={model} scale={0.01} />;
    }
);

// MultiModel Component for rendering multiple models with individual transforms
type MultiModelProps = {
    modelInstance: {
        id: string; // 模型 ID（用於 Director Mode 事件匹配）
        model: THREE.Group | null;
        clip: THREE.AnimationClip | null;
        allClips?: THREE.AnimationClip[]; // 🔥 所有可用動畫片段（Director Mode 動態切換用）
        shaderGroups: ShaderGroup[];
        isShaderEnabled: boolean;
        position: [number, number, number];
        rotation: [number, number, number];
        scale: [number, number, number];
        visible: boolean;
        showWireframe?: boolean; // 是否顯示線框
        opacity?: number; // 模型透明度
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
    isDirectorMode?: boolean; // Director Mode 下使用 EventBus
    onGroupRefMount?: (groupRef: THREE.Group | null) => void; // Transform Gizmo 用
};

const MultiModel = forwardRef<ModelRef, MultiModelProps>(
    ({ modelInstance, onTimeUpdate, loop = true, onFinish, enableShadows, isActiveModel = false, isDirectorMode = false, onGroupRefMount }, ref) => {
        const { 
            id: modelId,
            model, clip, allClips = [], shaderGroups, isShaderEnabled, position, rotation, scale, visible, 
            showWireframe = false,
            opacity = 1.0,
            isPlaying = false, currentTime, isLoopEnabled,
            isCameraOrbiting = false, cameraOrbitSpeed = 30,
            isModelRotating = false, modelRotationSpeed = 30
        } = modelInstance;
        
        // 🔥 Director Mode：追蹤當前動畫 ID
        const currentAnimationIdRef = useRef<string | null>(null);
        
        // 使用模型自己的 loop 設置，如果有的話
        const modelLoop = isLoopEnabled !== undefined ? isLoopEnabled : loop;
        
        // 使用現有的 Model 組件處理動畫和 shader
        const modelRef = useRef<ModelRef>(null);
        const groupRef = useRef<THREE.Group>(null);

        // 通知 groupRef 掛載（用於 Transform Gizmo）
        useEffect(() => {
            if (onGroupRefMount && isActiveModel) {
                onGroupRefMount(groupRef.current);
            }
            return () => {
                if (onGroupRefMount && isActiveModel) {
                    onGroupRefMount(null);
                }
            };
        }, [onGroupRefMount, isActiveModel, model]);
        
        // Wireframe 設置（使用 material.wireframe，跟隨骨骼動畫）
        useEffect(() => {
            if (!model) return;
            
            model.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    // 保存原始設置
                    if (child.userData.originalWireframe === undefined) {
                        child.userData.originalWireframe = false;
                    }
                    if (child.userData.originalSide === undefined) {
                        child.userData.originalSide = child.material instanceof THREE.Material 
                            ? (child.material as any).side 
                            : THREE.FrontSide;
                    }
                    
                    // 應用 wireframe 和背面剔除
                    if (child.material) {
                        const applyToMaterial = (mat: THREE.Material) => {
                            (mat as any).wireframe = showWireframe;
                            // 背面剔除：wireframe 模式下強制只渲染正面
                            if (showWireframe) {
                                (mat as any).side = THREE.FrontSide;
                            } else {
                                (mat as any).side = child.userData.originalSide || THREE.FrontSide;
                            }
                            mat.needsUpdate = true;
                        };
                        
                        if (Array.isArray(child.material)) {
                            child.material.forEach(applyToMaterial);
                        } else {
                            applyToMaterial(child.material);
                        }
                    }
                }
            });
        }, [model, showWireframe]);
        
        // 應用透明度到所有 Mesh
        useEffect(() => {
            if (!model) return;
            
            // 當開啟 wireframe 時，自動設置透明度為 50%
            const effectiveOpacity = showWireframe ? 0.5 : opacity;
            
            const applyOpacity = () => {
                model.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        // 應用透明度
                        if (child.material) {
                            const applyToMaterial = (mat: THREE.Material) => {
                                // 對於 ShaderMaterial，使用 uniform
                                if ((mat as any).uniforms?.uOpacity !== undefined) {
                                    (mat as any).uniforms.uOpacity.value = effectiveOpacity;
                                }
                                // 對於普通材質，設置 opacity 屬性
                                (mat as any).transparent = effectiveOpacity < 1.0;
                                (mat as any).opacity = effectiveOpacity;
                                mat.needsUpdate = true;
                            };
                            
                            if (Array.isArray(child.material)) {
                                child.material.forEach(applyToMaterial);
                            } else {
                                applyToMaterial(child.material);
                            }
                        }
                    }
                });
            };
            
            // 立即應用
            applyOpacity();
            
            // 延遲應用確保 shader 更新後也能生效
            const timeoutId = setTimeout(applyOpacity, 100);
            
            return () => {
                clearTimeout(timeoutId);
            };
        }, [model, opacity, showWireframe, isShaderEnabled, shaderGroups]);
        
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
        
        // 監聯外部 currentTime 變化（非 Director Mode 時）
        useEffect(() => {
            if (!isDirectorMode && currentTime !== undefined && modelRef.current) {
                modelRef.current.seekTo(currentTime);
            }
        }, [currentTime, isDirectorMode]);

        // Director Mode：訂閱 clipUpdate 事件，動態切換動畫並設置時間
        useEffect(() => {
            if (!isDirectorMode) return;

            const unsubscribe = directorEventBus.onClipUpdate((event) => {
                if (event.modelId === modelId && modelRef.current) {
                    // 🔥 檢查是否需要切換動畫
                    if (event.animationId !== currentAnimationIdRef.current) {
                        // 找到對應的 clip
                        const targetClip = allClips.find(c => {
                            // 使用 customId 或 name 匹配
                            const clipId = (c as any).customId || c.name;
                            return clipId === event.animationId;
                        });
                        
                        if (targetClip) {
                            modelRef.current.setClip(targetClip);
                            currentAnimationIdRef.current = event.animationId;
                        }
                    }
                    
                    // 設置動畫時間
                    modelRef.current.setAnimationTime(event.localTime);
                }
            });

            return unsubscribe;
        }, [isDirectorMode, modelId, allClips]);

        useImperativeHandle(ref, () => ({
            play: () => modelRef.current?.play(),
            pause: () => modelRef.current?.pause(),
            seekTo: (time: number) => modelRef.current?.seekTo(time),
            getCurrentTime: () => modelRef.current?.getCurrentTime() ?? 0,
            getDuration: () => modelRef.current?.getDuration() ?? 0,
            setAnimationTime: (time: number) => modelRef.current?.setAnimationTime(time),
            setClip: (newClip: THREE.AnimationClip) => modelRef.current?.setClip(newClip),
        }));

        if (!model) return null;

        // 將度數轉換為弧度
        const rotationRad = rotation.map(deg => (deg * Math.PI) / 180) as [number, number, number];

        return (
            <group
                ref={groupRef}
                position={position}
                rotation={rotationRad}
                scale={scale}
                visible={visible}
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

// TransformGizmo 組件 - 用於顯示和控制模型位置
interface TransformGizmoProps {
    object: THREE.Object3D | null;
    modelId: string;
    visible: boolean; // 控制 Gizmo 可見性（不重建組件）
    onPositionChange: (modelId: string, position: [number, number, number]) => void;
    orbitControlsRef: React.RefObject<any>;
}

function TransformGizmo({ object, modelId, visible, onPositionChange, orbitControlsRef }: TransformGizmoProps) {
    const transformRef = useRef<any>(null);

    // 控制 TransformControls 可見性
    useEffect(() => {
        if (transformRef.current) {
            transformRef.current.visible = visible;
        }
    }, [visible]);

    useEffect(() => {
        if (!transformRef.current) return;

        const controls = transformRef.current;
        
        // 當拖曳時禁用 OrbitControls
        const handleDraggingChanged = (event: { value: boolean }) => {
            if (orbitControlsRef.current) {
                orbitControlsRef.current.enabled = !event.value;
            }
        };

        // 當變換結束時更新位置
        const handleObjectChange = () => {
            if (object) {
                const pos = object.position;
                onPositionChange(modelId, [pos.x, pos.y, pos.z]);
            }
        };

        controls.addEventListener('dragging-changed', handleDraggingChanged);
        controls.addEventListener('objectChange', handleObjectChange);

        return () => {
            controls.removeEventListener('dragging-changed', handleDraggingChanged);
            controls.removeEventListener('objectChange', handleObjectChange);
        };
    }, [object, modelId, onPositionChange, orbitControlsRef]);

    if (!object) return null;

    return (
        <TransformControls
            ref={transformRef}
            object={object}
            mode="translate"
            space="local"
            size={0.7}
            showX
            showY
            showZ
        />
    );
}

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
        isOrthographic = false,
        orthoZoom = 50,
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
        cameraSprintMultiplier = 2.0,
        isDirectorMode = false,
        showTransformGizmo = false,
        onModelPositionChange,
        screenshotWidth,
        screenshotHeight
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

        // 獲取活動模型實例（用於 Transform Gizmo 可見性檢查）
        const activeModelInstance = isMultiModelMode && activeModelIndex >= 0 && models
            ? models[activeModelIndex]
            : null;

        const modelRef = useRef<ModelRef>(null);
        const orbitControlsRef = useRef<any>(null);
        const glRef = useRef<THREE.WebGLRenderer | null>(null);
        const sceneRef = useRef<THREE.Scene | null>(null);
        const cameraRef = useRef<THREE.Camera | null>(null);
        const mediaRecorderRef = useRef<MediaRecorder | null>(null);
        const recordedChunksRef = useRef<Blob[]>([]);
        const isRecordingRef = useRef<boolean>(false);
        const captureStreamRef = useRef<MediaStream | null>(null);
        
        // Transform Gizmo: 追蹤活動模型的 Object3D
        const [activeModelObject, setActiveModelObject] = useState<THREE.Group | null>(null);

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
            setAnimationTime: (time: number) => modelRef.current?.setAnimationTime(time),
            setClip: (newClip: THREE.AnimationClip) => modelRef.current?.setClip(newClip),
            resetCamera: () => {
                console.log('resetCamera called', orbitControlsRef.current);
                if (orbitControlsRef.current) {
                    orbitControlsRef.current.reset();
                }
            },
            takeScreenshot: () => {
                if (glRef.current && sceneRef.current && cameraRef.current) {
                    try {
                        const gl = glRef.current;
                        const scene = sceneRef.current;
                        const camera = cameraRef.current;
                        const canvas = gl.domElement;
                        
                        // 確定目標尺寸：優先使用用戶指定的尺寸，否則使用當前 canvas 尺寸
                        const targetWidth = screenshotWidth || canvas.width;
                        const targetHeight = screenshotHeight || canvas.height;
                        
                        // 儲存當前狀態
                        const currentWidth = canvas.width;
                        const currentHeight = canvas.height;
                        const currentClearAlpha = gl.getClearAlpha();
                        const currentClearColor = gl.getClearColor(new THREE.Color());
                        const currentPixelRatio = gl.getPixelRatio();
                        
                        // 儲存相機狀態（如果是透視相機）
                        let originalAspect: number | undefined;
                        if (camera instanceof THREE.PerspectiveCamera) {
                            originalAspect = camera.aspect;
                        }
                        
                        console.log(`Screenshot: Current ${currentWidth}x${currentHeight} → Target ${targetWidth}x${targetHeight}`);
                        
                        // 臨時設定為透明背景
                        gl.setClearAlpha(0);
                        gl.setClearColor(new THREE.Color(0x000000), 0);
                        
                        // 如果需要不同尺寸，調整渲染器
                        const needsResize = targetWidth !== currentWidth || targetHeight !== currentHeight;
                        if (needsResize) {
                            // 設定渲染器尺寸為目標尺寸
                            gl.setPixelRatio(1); // 使用 1:1 pixel ratio 確保精確尺寸
                            gl.setSize(targetWidth, targetHeight, false); // false = 不更新 canvas style
                            
                            // 更新相機 aspect ratio
                            if (camera instanceof THREE.PerspectiveCamera) {
                                camera.aspect = targetWidth / targetHeight;
                                camera.updateProjectionMatrix();
                            }
                        }
                        
                        // 立即渲染一幀
                        gl.render(scene, camera);
                        
                        try {
                            // 使用 canvas.toDataURL 生成圖片（透明背景）
                            const dataURL = canvas.toDataURL('image/png', 1.0);
                            
                            console.log(`Screenshot captured: ${targetWidth}x${targetHeight}, DataURL length: ${dataURL.length}`);
                            
                            // 驗證截圖不是空白的
                            if (dataURL === 'data:,' || dataURL.length < 100) {
                                throw new Error('Canvas appears to be empty');
                            }
                            
                            // 創建下載連結
                            const link = document.createElement('a');
                            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                            link.download = `screenshot_${targetWidth}x${targetHeight}_${timestamp}.png`;
                            link.href = dataURL;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            
                            console.log('Screenshot saved successfully:', link.download);
                        } finally {
                            // 恢復原始狀態
                            gl.setClearAlpha(currentClearAlpha);
                            gl.setClearColor(currentClearColor, currentClearAlpha);
                            
                            if (needsResize) {
                                // 恢復原始尺寸
                                gl.setPixelRatio(currentPixelRatio);
                                gl.setSize(currentWidth, currentHeight, false);
                                
                                // 恢復相機 aspect ratio
                                if (camera instanceof THREE.PerspectiveCamera && originalAspect !== undefined) {
                                    camera.aspect = originalAspect;
                                    camera.updateProjectionMatrix();
                                }
                                
                                // 重新渲染一幀以恢復顯示
                                gl.render(scene, camera);
                            }
                        }
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
                    
                    // 從 canvas 獲取視頻流（使用 60 FPS 自動捕獲）
                    const stream = canvas.captureStream(60); // 60 FPS
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
            isRecording: () => isRecordingRef.current,
            getRendererInfo: () => {
                if (!glRef.current) return null;
                const info = glRef.current.info;
                return {
                    render: {
                        calls: info.render.calls,
                        triangles: info.render.triangles,
                        points: info.render.points,
                        lines: info.render.lines
                    },
                    memory: {
                        geometries: info.memory.geometries,
                        textures: info.memory.textures
                    },
                    programs: info.programs?.length ?? null
                };
            },
            focusOnModel: (modelId: string) => {
                if (!models || !cameraRef.current || !orbitControlsRef.current) {
                    console.warn('[focusOnModel] Missing models, camera, or controls');
                    return;
                }

                // 找到目標模型
                const targetModelInstance = models.find(m => m.id === modelId);
                if (!targetModelInstance || !targetModelInstance.model) {
                    console.warn(`[focusOnModel] Model not found: ${modelId}`);
                    return;
                }

                const modelGroup = targetModelInstance.model;

                // 計算模型的 bounding box（使用世界矩陣）
                const box = new THREE.Box3();
                
                // 遍歷所有 mesh 計算邊界
                modelGroup.traverse((child) => {
                    if ((child as THREE.Mesh).isMesh) {
                        const mesh = child as THREE.Mesh;
                        if (mesh.geometry) {
                            mesh.geometry.computeBoundingBox();
                            if (mesh.geometry.boundingBox) {
                                const meshBox = mesh.geometry.boundingBox.clone();
                                meshBox.applyMatrix4(mesh.matrixWorld);
                                box.union(meshBox);
                            }
                        }
                    }
                });

                // 如果沒有找到任何 mesh，使用模型位置作為中心
                if (box.isEmpty()) {
                    const pos = targetModelInstance.position || [0, 0, 0];
                    box.setFromCenterAndSize(
                        new THREE.Vector3(pos[0], pos[1], pos[2]),
                        new THREE.Vector3(1, 1, 1)
                    );
                }

                const worldCenter = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());

                // 計算適當的觀看距離（基於模型最大維度）
                const maxDim = Math.max(size.x, size.y, size.z);
                const distance = Math.max(maxDim * 2.5, 3); // 最小距離 3

                // 45 度俯角計算相機位置
                const angle = Math.PI / 4; // 45 度
                const cameraY = worldCenter.y + distance * Math.sin(angle);
                const cameraZ = worldCenter.z + distance * Math.cos(angle);

                // 設置相機位置
                const camera = cameraRef.current;
                camera.position.set(worldCenter.x, cameraY, cameraZ);

                // 設置 OrbitControls 的 target
                const controls = orbitControlsRef.current;
                controls.target.copy(worldCenter);
                controls.update();

                console.log(`[focusOnModel] Focused on model: ${modelId}, center:`, worldCenter, 'distance:', distance);
            },
            getCameraState: (): CameraState | null => {
                const camera = cameraRef.current;
                const controls = orbitControlsRef.current;
                
                if (!camera || !controls) {
                    return null;
                }
                
                const isOrtho = camera instanceof THREE.OrthographicCamera;
                
                return {
                    position: camera.position.toArray() as [number, number, number],
                    target: controls.target.toArray() as [number, number, number],
                    fov: isOrtho ? 50 : (camera as THREE.PerspectiveCamera).fov,
                    isOrthographic: isOrtho,
                    orthoZoom: isOrtho ? orthoZoom : 50,
                };
            },
            setCameraState: (state: CameraState) => {
                const camera = cameraRef.current;
                const controls = orbitControlsRef.current;
                
                if (!camera || !controls) {
                    console.warn('[setCameraState] Camera or controls not available');
                    return;
                }
                
                // 設置相機位置
                camera.position.set(state.position[0], state.position[1], state.position[2]);
                
                // 設置 OrbitControls 的 target
                controls.target.set(state.target[0], state.target[1], state.target[2]);
                controls.update();
                
                // 注意：isOrthographic 和 orthoZoom 需要透過 props 更新，
                // 這裡只處理相機位置和 target
                console.log('[setCameraState] Camera state applied:', state);
            }
        }));

        // Effekseer 初始化已移至 EffekseerFrameBridge 組件中

        return (
            <div
                className="w-full h-full rounded-lg overflow-hidden shadow-xl border border-gray-700 transition-colors duration-300"
                style={{ backgroundColor }}
            >
                <Canvas
                    shadows={enableShadows}
                    dpr={2}
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
                    onCreated={({ gl, scene, camera }) => {
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
                        // 保存 gl, scene, camera 引用以供截圖使用
                        glRef.current = gl;
                        sceneRef.current = scene;
                        cameraRef.current = camera;
                    }}>
                    <EffekseerFrameBridge />
                    <FrameEmitter enabled={isDirectorMode} />
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
                    <CameraController 
                        cameraSettings={cameraSettings} 
                        boundBone={boundBone} 
                        isCameraBound={isCameraBound}
                        isOrthographic={isOrthographic}
                        orthoZoom={orthoZoom}
                    />
                    <CameraRefSync cameraRef={cameraRef} />
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
                                    id: modelInstance.id || `model-${index}`,
                                    clip
                                }}
                                onTimeUpdate={isActive ? onTimeUpdate : undefined}
                                loop={loop}
                                onFinish={isActive ? onFinish : undefined}
                                enableShadows={enableShadows}
                                isActiveModel={isActive}
                                isDirectorMode={isDirectorMode}
                                onGroupRefMount={isActive ? setActiveModelObject : undefined}
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
                    {/* Transform Gizmo - 始終掛載，通過 visible 控制顯示 */}
                    {activeModelObject && onModelPositionChange && activeModelId && (
                        <TransformGizmo
                            object={activeModelObject}
                            modelId={activeModelId}
                            visible={showTransformGizmo && (activeModelInstance?.visible ?? true)}
                            onPositionChange={onModelPositionChange}
                            orbitControlsRef={orbitControlsRef}
                        />
                    )}
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

