/**
 * 陣列操作工具函數
 * 提供常用的陣列更新模式
 */

/**
 * 更新陣列中符合條件的項目
 * @param array 原始陣列
 * @param predicate 判斷條件函數
 * @param updater 更新函數
 * @returns 更新後的陣列
 */
export function updateArrayItem<T>(
    array: T[],
    predicate: (item: T) => boolean,
    updater: (item: T) => T
): T[] {
    return array.map(item => predicate(item) ? updater(item) : item);
}

/**
 * 更新陣列中指定 ID 的項目
 * @param array 原始陣列
 * @param id 要更新的項目 ID
 * @param updater 更新函數
 * @returns 更新後的陣列
 */
export function updateArrayItemById<T extends { id: string }>(
    array: T[],
    id: string,
    updater: (item: T) => T
): T[] {
    return updateArrayItem(array, item => item.id === id, updater);
}

/**
 * 更新陣列中指定 ID 項目的屬性
 * @param array 原始陣列
 * @param id 要更新的項目 ID
 * @param updates 要更新的屬性
 * @returns 更新後的陣列
 */
export function updateArrayItemProperties<T extends { id: string }>(
    array: T[],
    id: string,
    updates: Partial<T>
): T[] {
    return updateArrayItemById(array, id, item => ({ ...item, ...updates }));
}




