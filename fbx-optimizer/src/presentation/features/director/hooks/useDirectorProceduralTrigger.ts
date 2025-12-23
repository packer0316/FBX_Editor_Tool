/**
 * useDirectorProceduralTrigger - Director Mode 程式化動畫觸發 Hook
 * 
 * 訂閱 EventBus 的 ProceduralUpdateEvent，
 * 更新對應模型的 renderState（visible, opacity）。
 */

import { useEffect, useRef, useCallback } from 'react';
import { directorEventBus } from '../../../../infrastructure/events';
import type { ProceduralUpdateEvent } from '../../../../domain/entities/director/directorEvents.types';
import type { ModelInstance } from '../../../../domain/value-objects/ModelInstance';

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
  const lastStateRef = useRef<Map<string, { visible: boolean; opacity: number }>>(new Map());

  // 更新 refs
  useEffect(() => {
    modelsRef.current = models;
    onUpdateModelRef.current = onUpdateModel;
  }, [models, onUpdateModel]);

  // 處理程式化動畫事件
  const handleProceduralUpdate = useCallback((event: ProceduralUpdateEvent) => {
    const { modelId, targetVisible, targetOpacity } = event;
    
    // 檢查狀態是否改變（避免不必要的更新）
    // 注意：當 opacity 接近邊界值（0 或 1）時，使用更小的門檻以確保精確
    const lastState = lastStateRef.current.get(modelId);
    const opacityThreshold = (targetOpacity <= 0.01 || targetOpacity >= 0.99) ? 0.001 : 0.01;
    
    if (lastState && 
        lastState.visible === targetVisible && 
        Math.abs(lastState.opacity - targetOpacity) < opacityThreshold) {
      return;
    }
    
    // 更新追蹤狀態
    lastStateRef.current.set(modelId, { visible: targetVisible, opacity: targetOpacity });
    
    // 調用更新回調
    if (onUpdateModelRef.current) {
      onUpdateModelRef.current(modelId, {
        visible: targetVisible,
        opacity: targetOpacity,
      });
    }
  }, []);

  // 訂閱事件
  useEffect(() => {
    if (!enabled) {
      // 禁用時清除狀態追蹤
      lastStateRef.current.clear();
      return;
    }

    const unsubscribe = directorEventBus.onProceduralUpdate(handleProceduralUpdate);

    return () => {
      unsubscribe();
      // 退出時重置所有模型的顯示狀態
      modelsRef.current.forEach(model => {
        if (onUpdateModelRef.current) {
          onUpdateModelRef.current(model.id, {
            visible: true,
            opacity: 1,
          });
        }
      });
      lastStateRef.current.clear();
    };
  }, [enabled, handleProceduralUpdate]);
}

export default useDirectorProceduralTrigger;

