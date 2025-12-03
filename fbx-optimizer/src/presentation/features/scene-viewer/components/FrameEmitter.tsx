/**
 * FrameEmitter - 幀事件發送器
 * 
 * 在 R3F Canvas 內部使用 useFrame，發送 tick 事件給 Director
 * SceneViewer 不需要知道 Director 的存在
 */

import { useFrame } from '@react-three/fiber';
import { directorEventBus } from '../../../../infrastructure/events';

interface FrameEmitterProps {
  enabled: boolean;
}

export function FrameEmitter({ enabled }: FrameEmitterProps): null {
  useFrame(() => {
    if (enabled) {
      directorEventBus.emitTick({ delta: 0 }); // delta 不再使用，保留以向後兼容
    }
  });
  
  return null;
}

