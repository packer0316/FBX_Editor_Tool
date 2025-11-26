import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useKeyboardCameraControls } from '../hooks/useKeyboardCameraControls';

/**
 * 鍵盤相機控制組件的屬性
 */
interface KeyboardCameraControlsProps {
  /** 是否啟用鍵盤控制 */
  enabled?: boolean;
  /** 移動速度（單位/秒） */
  moveSpeed?: number;
  /** 加速倍數（按住 Shift 時） */
  sprintMultiplier?: number;
  /** 最大移動距離限制（從原點） */
  maxDistance?: number;
}

/**
 * 鍵盤相機控制組件
 * 
 * 提供 WASD/QE 鍵盤控制相機移動的功能，類似 Blender 的視角控制
 * 
 * 按鍵映射：
 * - W: 向前移動（相機朝向方向）
 * - S: 向後移動
 * - A: 向左平移
 * - D: 向右平移
 * - Q: 向上移動
 * - E: 向下移動
 * - Shift: 按住加速移動
 * 
 * @example
 * ```tsx
 * <Canvas>
 *   <OrbitControls />
 *   <KeyboardCameraControls 
 *     enabled={true}
 *     moveSpeed={5.0}
 *     sprintMultiplier={2.0}
 *   />
 * </Canvas>
 * ```
 */
export function KeyboardCameraControls({
  enabled = true,
  moveSpeed = 5.0,
  sprintMultiplier = 2.0,
  maxDistance = 500,
}: KeyboardCameraControlsProps) {
  const { camera, controls } = useThree();
  const keyStateRef = useKeyboardCameraControls({ enabled });

  useFrame((state, delta) => {
    if (!enabled) return;

    const keyState = keyStateRef.current;

    // 檢查是否有任何按鍵被按下
    const isAnyKeyPressed =
      keyState.forward ||
      keyState.backward ||
      keyState.left ||
      keyState.right ||
      keyState.up ||
      keyState.down;

    if (!isAnyKeyPressed) return;

    // 計算實際移動速度（考慮 delta time 和加速）
    const actualSpeed = moveSpeed * delta * (keyState.shift ? sprintMultiplier : 1);

    // 獲取相機的世界方向（朝向）
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);

    // 將方向投影到水平面（移除 Y 分量）以實現水平移動
    const horizontalDirection = direction.clone();
    horizontalDirection.y = 0;
    horizontalDirection.normalize();

    // 計算相機的右向量（用於左右平移）
    const right = new THREE.Vector3();
    right.crossVectors(horizontalDirection, camera.up).normalize();

    // 累積移動向量
    const moveVector = new THREE.Vector3();

    // 前後移動（W/S）
    if (keyState.forward) {
      moveVector.add(horizontalDirection.clone().multiplyScalar(actualSpeed));
    }
    if (keyState.backward) {
      moveVector.sub(horizontalDirection.clone().multiplyScalar(actualSpeed));
    }

    // 左右平移（A/D）
    if (keyState.right) {
      moveVector.add(right.clone().multiplyScalar(actualSpeed));
    }
    if (keyState.left) {
      moveVector.sub(right.clone().multiplyScalar(actualSpeed));
    }

    // 上下移動（Q/E）
    if (keyState.up) {
      moveVector.y += actualSpeed;
    }
    if (keyState.down) {
      moveVector.y -= actualSpeed;
    }

    // 應用移動到相機
    const newPosition = camera.position.clone().add(moveVector);

    // 檢查是否超出最大距離限制
    if (maxDistance && newPosition.length() > maxDistance) {
      // 限制在最大距離內
      newPosition.normalize().multiplyScalar(maxDistance);
    }

    camera.position.copy(newPosition);

    // 如果有 OrbitControls，同步更新目標點
    // 這樣可以保持相機和控制器的一致性
    if (controls && 'target' in controls) {
      const orbitControls = controls as any;
      if (orbitControls.target) {
        orbitControls.target.add(moveVector);
      }
    }
  });

  // 這個組件不渲染任何視覺元素
  return null;
}

