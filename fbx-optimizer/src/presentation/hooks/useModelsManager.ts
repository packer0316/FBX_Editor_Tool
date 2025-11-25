import { useState, useCallback } from 'react';
import type { ModelInstance } from '../../domain/value-objects/ModelInstance';

/**
 * 多模型管理 Hook
 * 
 * 提供模型實例的 CRUD 操作和活動模型管理功能。
 * 
 * @returns 包含模型列表、活動模型、以及各種操作函數的物件
 * 
 * @example
 * ```typescript
 * const { models, activeModel, addModel, removeModel, updateModel } = useModelsManager();
 * 
 * // 新增模型
 * addModel(newModelInstance);
 * 
 * // 切換活動模型
 * setActiveModelId(modelId);
 * 
 * // 更新模型資料
 * updateModel(modelId, { name: '新名稱' });
 * ```
 */
export function useModelsManager() {
  const [models, setModels] = useState<Map<string, ModelInstance>>(new Map());
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  
  /**
   * 新增模型
   */
  const addModel = useCallback((instance: ModelInstance) => {
    setModels(prev => {
      const next = new Map(prev);
      next.set(instance.id, instance);
      return next;
    });
    // 如果沒有活動模型，自動設為活動模型
    if (!activeModelId) {
      setActiveModelId(instance.id);
    }
  }, [activeModelId]);
  
  /**
   * 移除模型
   */
  const removeModel = useCallback((id: string) => {
    setModels(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    // 如果刪除的是活動模型，切換到其他模型
    if (activeModelId === id) {
      const remaining = Array.from(models.keys()).filter(k => k !== id);
      setActiveModelId(remaining.length > 0 ? remaining[0] : null);
    }
  }, [activeModelId, models]);
  
  /**
   * 更新模型資料
   */
  const updateModel = useCallback((id: string, updates: Partial<ModelInstance>) => {
    setModels(prev => {
      const next = new Map(prev);
      const model = next.get(id);
      if (model) {
        next.set(id, {
          ...model,
          ...updates,
          updatedAt: Date.now()
        });
      }
      return next;
    });
  }, []);
  
  /**
   * 獲取指定模型
   */
  const getModel = useCallback((id: string): ModelInstance | null => {
    return models.get(id) || null;
  }, [models]);
  
  // 計算活動模型
  const activeModel = activeModelId ? models.get(activeModelId) || null : null;
  
  return {
    /** 所有模型列表 */
    models: Array.from(models.values()),
    /** 當前活動模型 */
    activeModel,
    /** 當前活動模型 ID */
    activeModelId,
    /** 設置活動模型 ID */
    setActiveModelId,
    /** 新增模型 */
    addModel,
    /** 移除模型 */
    removeModel,
    /** 更新模型資料 */
    updateModel,
    /** 獲取指定模型 */
    getModel
  };
}

