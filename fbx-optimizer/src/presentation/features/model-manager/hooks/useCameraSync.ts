import { useState, useEffect } from 'react';

export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
  zoom: number;
}

/**
 * Hook to sync camera state from main scene
 */
export function useCameraSync() {
  const [cameraState, setCameraState] = useState<CameraState>({
    position: [0, 2, 5],
    target: [0, 0, 0],
    zoom: 1
  });

  useEffect(() => {
    // 監聽全局相機狀態更新事件
    const handleCameraUpdate = (event: CustomEvent<CameraState>) => {
      setCameraState(event.detail);
    };

    window.addEventListener('camera-update' as any, handleCameraUpdate);

    return () => {
      window.removeEventListener('camera-update' as any, handleCameraUpdate);
    };
  }, []);

  return cameraState;
}

