import type { ShaderGroup } from '../../domain/value-objects/ShaderFeature';

/**
 * Shader Group 操作工具函數
 * 
 * 提供常用的 ShaderGroup 陣列更新模式，簡化不可變更新的操作。
 * 這些函數遵循函數式程式設計原則，不會修改原始陣列。
 */

/**
 * 更新 ShaderGroup 陣列中符合條件的組
 * 
 * 通用函數，用於更新陣列中符合特定條件的 ShaderGroup。
 * 此函數會建立新陣列，不會修改原始陣列。
 * 
 * @param groups - 原始 ShaderGroup 陣列
 * @param predicate - 判斷條件函數，返回 true 表示該組需要更新
 * @param updater - 更新函數，接收符合條件的組，返回更新後的組
 * @returns 更新後的陣列（新陣列，原始陣列不變）
 * 
 * @example
 * ```typescript
 * const updated = updateShaderGroup(
 *   groups,
 *   group => group.id === 'group1',
 *   group => ({ ...group, expanded: !group.expanded })
 * );
 * ```
 */
export function updateShaderGroup(
    groups: ShaderGroup[],
    predicate: (group: ShaderGroup) => boolean,
    updater: (group: ShaderGroup) => ShaderGroup
): ShaderGroup[] {
    return groups.map(group => predicate(group) ? updater(group) : group);
}

/**
 * 更新 ShaderGroup 陣列中指定 ID 的組
 * 
 * 便利函數，用於更新陣列中指定 ID 的 ShaderGroup。
 * 這是 `updateShaderGroup` 的特化版本，專門用於 ID 匹配。
 * 
 * @param groups - 原始 ShaderGroup 陣列
 * @param groupId - 要更新的組 ID
 * @param updater - 更新函數，接收符合 ID 的組，返回更新後的組
 * @returns 更新後的陣列（新陣列，原始陣列不變）
 * 
 * @example
 * ```typescript
 * const updated = updateShaderGroupById(
 *   groups,
 *   'group1',
 *   group => ({ ...group, name: '新名稱' })
 * );
 * ```
 */
export function updateShaderGroupById(
    groups: ShaderGroup[],
    groupId: string,
    updater: (group: ShaderGroup) => ShaderGroup
): ShaderGroup[] {
    return updateShaderGroup(groups, group => group.id === groupId, updater);
}

/**
 * 更新 ShaderGroup 中指定 Feature 的參數
 * 
 * 便利函數，用於更新 ShaderGroup 中特定 Feature 的特定參數。
 * 此函數會自動找到對應的組和 Feature，並更新指定的參數。
 * 
 * @param groups - 原始 ShaderGroup 陣列
 * @param groupId - 要更新的組 ID
 * @param featureId - 要更新的 Feature ID
 * @param paramName - 要更新的參數名稱
 * @param value - 新的參數值
 * @returns 更新後的陣列（新陣列，原始陣列不變）
 * 
 * @example
 * ```typescript
 * const updated = updateShaderGroupFeatureParam(
 *   groups,
 *   'group1',
 *   'feature1',
 *   'intensity',
 *   0.8
 * );
 * ```
 */
export function updateShaderGroupFeatureParam(
    groups: ShaderGroup[],
    groupId: string,
    featureId: string,
    paramName: string,
    value: any
): ShaderGroup[] {
    return updateShaderGroupById(groups, groupId, group => ({
        ...group,
        features: group.features.map(feature =>
            feature.id === featureId
                ? { ...feature, params: { ...feature.params, [paramName]: value } }
                : feature
        )
    }));
}

