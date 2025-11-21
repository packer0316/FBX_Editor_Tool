import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';

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
}

const Model = forwardRef<SceneViewerRef, { model: THREE.Group; clip: THREE.AnimationClip | null; onTimeUpdate?: (time: number) => void }>(
    ({ model, clip, onTimeUpdate }, ref) => {
        const mixerRef = useRef<THREE.AnimationMixer | null>(null);
        const actionRef = useRef<THREE.AnimationAction | null>(null);
        const isPlayingRef = useRef(true);

        // 初始化 Mixer
        useEffect(() => {
            if (model) {
                mixerRef.current = new THREE.AnimationMixer(model);
            }
            return () => {
                mixerRef.current?.stopAllAction();
                mixerRef.current = null;
            };
        }, [model]);

        // 當 Clip 改變時播放
        useEffect(() => {
            if (mixerRef.current && clip) {
                mixerRef.current.stopAllAction();
                const action = mixerRef.current.clipAction(clip);
                action.play();
                actionRef.current = action;
            }
        }, [clip, model]);

        // 暴露控制方法
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
                    // 關鍵：直接設置 action 的時間
                    // 這是 Three.js 推薦的 seek 方法
                    actionRef.current.time = time;

                    // 如果當前暫停，需要手動觸發一次更新來刷新視覺
                    // 這裡不使用 mixer.update，而是標記需要更新
                    if (!isPlayingRef.current && mixerRef.current) {
                        // 暫停時強制更新一幀以顯示新位置
                        const wasPaused = actionRef.current.paused;
                        actionRef.current.paused = false;
                        mixerRef.current.update(0);
                        actionRef.current.paused = wasPaused;
                    }
                }
            },
            getCurrentTime: () => actionRef.current?.time || 0,
            getDuration: () => actionRef.current?.getClip().duration || 0
        }));

        // 每幀更新 Mixer
        useFrame((state, delta) => {
            if (mixerRef.current && isPlayingRef.current) {
                mixerRef.current.update(delta);
                if (onTimeUpdate && actionRef.current) {
                    onTimeUpdate(actionRef.current.time);
                }
            }
        });

        if (!model) return null;

        return <primitive object={model} scale={0.01} />;
    });

const SceneViewer = forwardRef<SceneViewerRef, SceneViewerProps>(({ model, playingClip, onTimeUpdate }, ref) => {
    return (
        <div className="w-full h-full bg-gray-900 rounded-lg overflow-hidden shadow-xl border border-gray-700">
            <Canvas camera={{ position: [0, 2, 5], fov: 50 }}>
                {/* 環境光 - 提供基礎照明，避免全黑 */}
                <ambientLight intensity={0.8} />

                {/* 半球光 - 模擬天空與地面的反射光 */}
                <hemisphereLight args={['#ffffff', '#444444', 0.6]} />

                {/* 主光源 */}
                <directionalLight position={[10, 10, 5]} intensity={1.2} castShadow />

                {/* 補光 - 從不同角度照亮模型 */}
                <directionalLight position={[-10, 5, -5]} intensity={0.6} />
                <directionalLight position={[0, -5, 0]} intensity={0.4} />

                <Grid infiniteGrid fadeDistance={30} sectionColor="#4a4a4a" cellColor="#2a2a2a" />

                {model && (
                    <Model ref={ref} model={model} clip={playingClip} onTimeUpdate={onTimeUpdate} />
                )}

                <OrbitControls makeDefault />
            </Canvas>
        </div>
    );
});

export default SceneViewer;
