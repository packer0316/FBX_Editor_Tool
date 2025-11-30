/**
 * Spine Instance Manager Store
 * 
 * 使用 Zustand 集中管理所有 Spine 實例的狀態。
 * 
 * 職責：
 * - 管理 Spine 實例的新增、更新、刪除
 * - 提供跨組件的狀態共享
 * - 整合 SpineRuntimeAdapter 進行資源清理
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { SpineInstance } from '../../domain/value-objects/SpineInstance';
import { getSpineRuntimeAdapter } from '../../infrastructure/spine/SpineRuntimeAdapter';

// ============================================================================
// Store 類型定義
// ============================================================================

interface SpineState {
  /** Spine 實例 Map（id -> instance） */
  instances: Map<string, SpineInstance>;
  
  /** 實例數量 */
  instanceCount: number;
}

interface SpineActions {
  // CRUD 操作
  /** 新增 Spine 實例 */
  addInstance: (instance: SpineInstance) => void;
  
  /** 更新 Spine 實例 */
  updateInstance: (id: string, updates: Partial<SpineInstance>) => void;
  
  /** 移除 Spine 實例（同時清理 Runtime 資源） */
  removeInstance: (id: string) => void;
  
  /** 取得 Spine 實例 */
  getInstance: (id: string) => SpineInstance | undefined;
  
  /** 檢查實例是否存在 */
  hasInstance: (id: string) => boolean;
  
  /** 取得所有實例 */
  getAllInstances: () => SpineInstance[];
  
  /** 取得所有實例 ID */
  getAllInstanceIds: () => string[];
  
  // 批量操作
  /** 清理所有實例（應用關閉時使用） */
  cleanupAll: () => void;
  
  /** 清理未使用的實例（垃圾回收） */
  cleanupUnused: (usedIds: string[]) => void;
}

type SpineStore = SpineState & SpineActions;

// ============================================================================
// Store 實作
// ============================================================================

export const useSpineStore = create<SpineStore>()(
  devtools(
    (set, get) => ({
      // ========== State ==========
      instances: new Map(),
      instanceCount: 0,

      // ========== CRUD Actions ==========
      
      addInstance: (instance: SpineInstance) => {
        set(
          (state) => {
            const newInstances = new Map(state.instances);
            newInstances.set(instance.id, instance);
            return {
              instances: newInstances,
              instanceCount: newInstances.size,
            };
          },
          false,
          'spineStore/addInstance'
        );
        console.log(`[SpineStore] 新增實例: ${instance.id} (${instance.name})`);
      },

      updateInstance: (id: string, updates: Partial<SpineInstance>) => {
        set(
          (state) => {
            const existing = state.instances.get(id);
            if (!existing) {
              console.warn(`[SpineStore] 更新失敗: 找不到實例 ${id}`);
              return state;
            }
            
            const newInstances = new Map(state.instances);
            newInstances.set(id, {
              ...existing,
              ...updates,
              updatedAt: Date.now(),
            });
            
            return { instances: newInstances };
          },
          false,
          'spineStore/updateInstance'
        );
      },

      removeInstance: (id: string) => {
        const state = get();
        const instance = state.instances.get(id);
        
        if (!instance) {
          console.warn(`[SpineStore] 移除失敗: 找不到實例 ${id}`);
          return;
        }
        
        // 清理 SpineRuntimeAdapter 中的資源
        try {
          const adapter = getSpineRuntimeAdapter();
          adapter.cleanup(id);
        } catch (error) {
          console.error(`[SpineStore] 清理 Runtime 資源失敗: ${id}`, error);
        }
        
        set(
          (state) => {
            const newInstances = new Map(state.instances);
            newInstances.delete(id);
            return {
              instances: newInstances,
              instanceCount: newInstances.size,
            };
          },
          false,
          'spineStore/removeInstance'
        );
        
        console.log(`[SpineStore] 移除實例: ${id} (${instance.name})`);
      },

      getInstance: (id: string) => {
        return get().instances.get(id);
      },

      hasInstance: (id: string) => {
        return get().instances.has(id);
      },

      getAllInstances: () => {
        return Array.from(get().instances.values());
      },

      getAllInstanceIds: () => {
        return Array.from(get().instances.keys());
      },

      // ========== 批量操作 ==========
      
      cleanupAll: () => {
        const state = get();
        const instanceIds = Array.from(state.instances.keys());
        
        // 清理所有 SpineRuntimeAdapter 資源
        try {
          const adapter = getSpineRuntimeAdapter();
          adapter.cleanupAll();
        } catch (error) {
          console.error('[SpineStore] 清理所有 Runtime 資源失敗', error);
        }
        
        set(
          {
            instances: new Map(),
            instanceCount: 0,
          },
          false,
          'spineStore/cleanupAll'
        );
        
        console.log(`[SpineStore] 清理所有實例: ${instanceIds.length} 個`);
      },

      cleanupUnused: (usedIds: string[]) => {
        const state = get();
        const usedIdSet = new Set(usedIds);
        const unusedIds: string[] = [];
        
        // 找出未使用的實例
        for (const id of state.instances.keys()) {
          if (!usedIdSet.has(id)) {
            unusedIds.push(id);
          }
        }
        
        if (unusedIds.length === 0) return;
        
        // 清理未使用的實例
        const adapter = getSpineRuntimeAdapter();
        for (const id of unusedIds) {
          try {
            adapter.cleanup(id);
          } catch (error) {
            console.error(`[SpineStore] 清理未使用資源失敗: ${id}`, error);
          }
        }
        
        set(
          (state) => {
            const newInstances = new Map(state.instances);
            for (const id of unusedIds) {
              newInstances.delete(id);
            }
            return {
              instances: newInstances,
              instanceCount: newInstances.size,
            };
          },
          false,
          'spineStore/cleanupUnused'
        );
        
        console.log(`[SpineStore] 清理未使用實例: ${unusedIds.length} 個`);
      },
    }),
    { name: 'SpineStore' }
  )
);

// ============================================================================
// Selector Hooks（效能優化）
// ============================================================================

/**
 * 取得單一實例（避免不必要的重新渲染）
 */
export const useSpineInstance = (id: string): SpineInstance | undefined => {
  return useSpineStore((state) => state.instances.get(id));
};

/**
 * 取得實例數量
 */
export const useSpineInstanceCount = (): number => {
  return useSpineStore((state) => state.instanceCount);
};

/**
 * 取得所有實例（陣列形式）
 */
export const useAllSpineInstances = (): SpineInstance[] => {
  return useSpineStore((state) => Array.from(state.instances.values()));
};

/**
 * 檢查實例是否存在
 */
export const useHasSpineInstance = (id: string): boolean => {
  return useSpineStore((state) => state.instances.has(id));
};

// ============================================================================
// 非 React 環境使用（如 Use Cases）
// ============================================================================

/**
 * 取得 Store 實例（用於非 React 環境）
 */
export const getSpineStore = () => useSpineStore.getState();

export default useSpineStore;

