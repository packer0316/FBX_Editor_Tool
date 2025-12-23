/**
 * useDirectorProceduralTrigger - Director Mode 程式化動畫觸發 Hook
 * 
 * 訂閱 EventBus 的 ProceduralUpdateEvent，
 * 更新對應模型的 renderState（visible, opacity, scale, position）。
 * 
 * 每個 clip 開始時記錄模型的當前狀態作為起始狀態，
 * 這樣連續的 clip 可以正確地基於前一個 clip 的結束狀態繼續。
 */

import { useEffect, useRef, useCallback } from 'react';
import { directorEventBus } from '../../../../infrastructure/events';
import type { ProceduralUpdateEvent } from '../../../../domain/entities/director/directorEvents.types';
import type { ModelInstance } from '../../../../domain/value-objects/ModelInstance';

interface ModelBaseState {
  visible: boolean;
  opacity: number;
  scale: [number, number, number];
  position: [number, number, number];
}

interface ClipStartState {
  scale: [number, number, number];
  position: [number, number, number];
}

interface UseDirectorProceduralTriggerOptions {
  /** 是否啟用（通常在 Director Mode 時為 true） */
  enabled: boolean;
  /** 模型列表 */
  models: ModelInstance[];
  /** 更新模型的回調 */
  onUpdateModel?: (modelId: string, updates: Partial<ModelInstance>) => void;
}

/**
 * Director Mode 程式化動畫觸發 Hook
 */
export function useDirectorProceduralTrigger({
  enabled,
  models,
  onUpdateModel,
}: UseDirectorProceduralTriggerOptions): void {
  // Refs 以避免閉包問題
  const modelsRef = useRef(models);
  const onUpdateModelRef = useRef(onUpdateModel);
  
  // 追蹤每個模型的當前狀態，避免重複更新
  const lastStateRef = useRef<Map<string, ModelBaseState>>(new Map());
  
  // 記錄每個 clip 開始時的模型狀態（key: clipId）
  const clipStartStatesRef = useRef<Map<string, ClipStartState>>(new Map());
  
  // 記錄進入 Director Mode 時的原始狀態（用於退出時恢復）
  const originalStateRef = useRef<Map<string, { scale: [number, number, number]; position: [number, number, number] }>>(new Map());
  
  // 追蹤上一次 enabled 狀態
  const prevEnabledRef = useRef(false);

  // 更新 refs
  useEffect(() => {
    modelsRef.current = models;
    onUpdateModelRef.current = onUpdateModel;
  }, [models, onUpdateModel]);
  
  // 記錄原始狀態（僅在 enabled 從 false 變為 true 時執行一次）
  useEffect(() => {
    if (enabled && !prevEnabledRef.current) {
      // 剛進入 Director Mode，記錄所有模型的原始狀態
      originalStateRef.current.clear();
      clipStartStatesRef.current.clear();
      models.forEach(model => {
        originalStateRef.current.set(model.id, {
          scale: [...model.scale] as [number, number, number],
          position: [...model.position] as [number, number, number],
        });
      });
    }
    prevEnabledRef.current = enabled;
  }, [enabled, models]);

  // 獲取模型最新狀態（從 modelsRef 中獲取，確保獲取用戶手動調整後的狀態）
  const getModelLatestState = useCallback((modelId: string): ClipStartState | null => {
    // 直接從 modelsRef 獲取最新狀態（用戶可能手動調整過）
    const model = modelsRef.current.find(m => m.id === modelId);
    if (model) {
      return {
        scale: [...model.scale] as [number, number, number],
        position: [...model.position] as [number, number, number],
      };
    }
    
    // 如果找不到模型，嘗試使用 lastState
    const lastState = lastStateRef.current.get(modelId);
    if (lastState) {
      return {
        scale: [...lastState.scale] as [number, number, number],
        position: [...lastState.position] as [number, number, number],
      };
    }
    
    return null;
  }, []);

  // 處理程式化動畫事件
  const handleProceduralUpdate = useCallback((event: ProceduralUpdateEvent) => {
    const { clipId, modelId, type, progress, isClipStart, targetVisible, targetOpacity, targetScale, targetPosition } = event;
    
    // 如果是 clip 的第一幀，記錄當時模型的最新狀態
    if (isClipStart) {
      // 每次 clip 開始時，都從 modelsRef 獲取最新狀態
      // 這確保了用戶手動調整模型後，再次播放能正確使用新的起始狀態
      const latestState = getModelLatestState(modelId);
      if (latestState) {
        clipStartStatesRef.current.set(clipId, latestState);
      }
    }
    
    // 獲取該 clip 的起始狀態
    const clipStartState = clipStartStatesRef.current.get(clipId);
    if (!clipStartState && (type === 'scaleTo' || type === 'moveBy')) {
      // 沒有起始狀態，嘗試獲取最新狀態
      const latestState = getModelLatestState(modelId);
      if (latestState) {
        clipStartStatesRef.current.set(clipId, latestState);
      }
    }
    
    const startState = clipStartStatesRef.current.get(clipId);
    
    // 計算新狀態
    const updates: Partial<ModelInstance> = {};
    
    // FadeIn/FadeOut: 只更新 opacity，不修改 visible
    // 這樣用戶手動調整透明度時不會因為 visible=false 而失效
    if (type === 'fadeIn' || type === 'fadeOut') {
      updates.opacity = targetOpacity;
      // 注意：不設置 updates.visible，讓用戶可以手動控制
    }
    
    // ScaleTo: 從起始縮放漸變到目標縮放
    if (type === 'scaleTo' && targetScale !== undefined && startState) {
      const baseScale = startState.scale;
      // progress 從 0 到 1，縮放從 baseScale 漸變到 baseScale * targetScale
      // 但實際上用戶設定的是絕對目標值（例如 1.5 表示最終縮放為 1.5 倍）
      // 所以我們需要從當前縮放漸變到目標縮放
      const startScaleValue = baseScale[0]; // 假設等比縮放
      const endScaleValue = targetScale;
      const currentScaleValue = startScaleValue + (endScaleValue - startScaleValue) * progress;
      
      updates.scale = [
        currentScaleValue,
        currentScaleValue,
        currentScaleValue,
      ];
    }
    
    // MoveBy: 從起始位置漸變到起始位置 + 位移量
    if (type === 'moveBy' && targetPosition && startState) {
      const basePos = startState.position;
      updates.position = [
        basePos[0] + targetPosition.x * progress,
        basePos[1] + targetPosition.y * progress,
        basePos[2] + targetPosition.z * progress,
      ];
    }
    
    // 檢查狀態是否改變（避免不必要的更新）
    const lastState = lastStateRef.current.get(modelId);
    const opacityThreshold = (targetOpacity <= 0.01 || targetOpacity >= 0.99) ? 0.001 : 0.01;
    
    const hasOpacityChange = updates.opacity !== undefined && (!lastState || 
      Math.abs(lastState.opacity - targetOpacity) >= opacityThreshold);
    
    const hasScaleChange = updates.scale && (!lastState || 
      Math.abs(lastState.scale[0] - updates.scale[0]) > 0.001 ||
      Math.abs(lastState.scale[1] - updates.scale[1]) > 0.001 ||
      Math.abs(lastState.scale[2] - updates.scale[2]) > 0.001);
    
    const hasPositionChange = updates.position && (!lastState || 
      Math.abs(lastState.position[0] - updates.position[0]) > 0.001 ||
      Math.abs(lastState.position[1] - updates.position[1]) > 0.001 ||
      Math.abs(lastState.position[2] - updates.position[2]) > 0.001);
    
    if (!hasOpacityChange && !hasScaleChange && !hasPositionChange) {
      return;
    }
    
    // 更新追蹤狀態（不再追蹤 visible，因為程式動作不修改 visible）
    lastStateRef.current.set(modelId, {
      visible: true,  // 始終為 true，程式動作不控制 visible
      opacity: updates.opacity ?? lastState?.opacity ?? 1,
      scale: updates.scale || lastState?.scale || startState?.scale || [1, 1, 1],
      position: updates.position || lastState?.position || startState?.position || [0, 0, 0],
    });
    
    // 調用更新回調
    if (onUpdateModelRef.current && Object.keys(updates).length > 0) {
      onUpdateModelRef.current(modelId, updates);
    }
  }, [getModelLatestState]);

  // 訂閱事件
  useEffect(() => {
    if (!enabled) {
      // 禁用時清除狀態追蹤
      lastStateRef.current.clear();
      clipStartStatesRef.current.clear();
      return;
    }

    const unsubscribe = directorEventBus.onProceduralUpdate(handleProceduralUpdate);

    return () => {
      unsubscribe();
      // 退出時重置所有模型的狀態（恢復原始值）
      modelsRef.current.forEach(model => {
        const originalState = originalStateRef.current.get(model.id);
        if (onUpdateModelRef.current) {
          onUpdateModelRef.current(model.id, {
            visible: true,
            opacity: 1,
            scale: originalState?.scale || model.scale,
            position: originalState?.position || model.position,
          });
        }
      });
      lastStateRef.current.clear();
      clipStartStatesRef.current.clear();
      originalStateRef.current.clear();
    };
  }, [enabled, handleProceduralUpdate]);
}

export default useDirectorProceduralTrigger;
