/**
 * ModelWithMixer - 使用 useAnimationMixer Hook 的簡化版 Model 組件
 * 
 * 這是重構版本，使用封裝好的 Hook 來管理 AnimationMixer 生命週期。
 * 相比原版 Model 組件，這個版本：
 * - 自動管理 Mixer 快取清理
 * - 防禦性錯誤處理
 * - 更清晰的狀態管理
 * - 避免記憶體洩漏
 */

import { forwardRef, useEffect, useRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { type ShaderGroup } from '../../../../domain/value-objects/ShaderFeature';
import { useAnimationMixer } from '../../../hooks/useAnimationMixer';
import { applyShaderGroups } from '../../../../utils/shader/shaderUtils';

export interface ModelRef {
  play: () => void;
  pause: () => void;
  seekTo: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  setAnimationTime: (time: number) => void;
}

interface ModelWithMixerProps {
  model: THREE.Group;
  clip: THREE.AnimationClip | null;
  onTimeUpdate?: (time: number) => void;
  shaderGroups?: ShaderGroup[];
  isShaderEnabled?: boolean;
  loop?: boolean;
  onFinish?: () => void;
  enableShadows?: boolean;
  initialPlaying?: boolean;
  initialTime?: number;
}

export const ModelWithMixer = forwardRef<ModelRef, ModelWithMixerProps>(
  (
    {
      model,
      clip,
      onTimeUpdate,
      shaderGroups = [],
      isShaderEnabled = true,
      loop = true,
      onFinish,
      enableShadows,
      initialPlaying = false,
      initialTime
    },
    ref
  ) => {
    // 使用封裝好的 AnimationMixer Hook
    const {
      play,
      pause,
      seekTo,
      setAnimationTime,
      getCurrentTime,
      getDuration,
      update
    } = useAnimationMixer(model, clip, {
      loop,
      autoPlay: initialPlaying,
      initialTime,
      initialPlaying,
      onFinish
    });

    // 暴露控制方法給父組件
    useImperativeHandle(ref, () => ({
      play,
      pause,
      seekTo,
      getCurrentTime,
      getDuration,
      setAnimationTime
    }));

    // 管理陰影
    useEffect(() => {
      if (!model) return;

      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = !!enableShadows;
          child.receiveShadow = false; // 不接收陰影，避免模型變暗
        }
      });
    }, [model, enableShadows]);

    // 應用 Shader
    useEffect(() => {
      if (!model || !isShaderEnabled || shaderGroups.length === 0) return;

      applyShaderGroups(model, shaderGroups, isShaderEnabled);
    }, [model, shaderGroups, isShaderEnabled]);

    // 時間更新回調
    const onTimeUpdateRef = useRef(onTimeUpdate);
    useEffect(() => {
      onTimeUpdateRef.current = onTimeUpdate;
    }, [onTimeUpdate]);

    // 每幀更新 Mixer
    useFrame((_state, delta) => {
      update(delta);

      // 回報時間更新
      if (onTimeUpdateRef.current) {
        const currentTime = getCurrentTime();
        onTimeUpdateRef.current(currentTime);

        // 同步到 model.userData
        if (model) {
          model.userData.animationTime = currentTime;
        }
      }
    });

    return <primitive object={model} />;
  }
);

ModelWithMixer.displayName = 'ModelWithMixer';

