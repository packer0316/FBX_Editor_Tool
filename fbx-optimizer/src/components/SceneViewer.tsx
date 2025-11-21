import React, { useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';

interface SceneViewerProps {
    model: THREE.Group | null;
    playingClip: THREE.AnimationClip | null;
}

function Model({ model, clip }: { model: THREE.Group; clip: THREE.AnimationClip | null }) {
    const mixerRef = useRef<THREE.AnimationMixer | null>(null);

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
        }
    }, [clip, model]);

    // 每幀更新 Mixer
    useFrame((state, delta) => {
        mixerRef.current?.update(delta);
    });

    if (!model) return null;

    return <primitive object={model} scale={0.01} />;
}

export default function SceneViewer({ model, playingClip }: SceneViewerProps) {
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
                    <Model model={model} clip={playingClip} />
                )}

                <OrbitControls makeDefault />
            </Canvas>
        </div>
    );
}
