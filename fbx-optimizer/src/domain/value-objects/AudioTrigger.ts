export interface AudioTrigger {
  id: string;
  clipId: string;     // 使用 customId 確保唯一匹配（取代原 clipUuid）
  clipName: string;   // 片段名稱（僅供顯示）
  frame: number;      // 觸發的幀數
}

