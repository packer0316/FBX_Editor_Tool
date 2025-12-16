/**
 * SpineSlotTab - 插槽分頁
 * 
 * 管理 Spine 插槽的 Attachment 切換。
 * 可用於動態換裝、部件顯示/隱藏等。
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { Layers, ChevronDown, ChevronRight, Eye, EyeOff, Package } from 'lucide-react';
import type { SpineInstance } from '../../../../domain/value-objects/SpineInstance';
import { getSpineWebglRuntimeAdapter } from '../../../../infrastructure/spine-webgl/SpineWebglRuntimeAdapter';

// ============================================================================
// 類型定義
// ============================================================================

interface SpineSlotTabProps {
  spineInstance: SpineInstance;
}

interface SlotState {
  index: number;
  name: string;
  boneName: string;
  currentAttachment: string | null;
  availableAttachments: string[];
}

// ============================================================================
// 子組件
// ============================================================================

const SlotItem: React.FC<{
  slot: SlotState;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSetAttachment: (attachmentName: string | null) => void;
}> = ({ slot, isExpanded, onToggleExpand, onSetAttachment }) => {
  const hasAttachments = slot.availableAttachments.length > 0;
  const isVisible = slot.currentAttachment !== null;

  return (
    <div className="bg-white/5 rounded-lg overflow-hidden">
      {/* Slot 標題欄 */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={onToggleExpand}
      >
        {/* 展開/收起圖示 */}
        <button className="text-gray-500 hover:text-gray-300 transition-colors">
          {hasAttachments ? (
            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
            <div className="w-[14px]" />
          )}
        </button>

        {/* Slot 圖示 */}
        <Layers size={14} className="text-purple-400" />

        {/* Slot 名稱 */}
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-200 truncate">{slot.name}</div>
          <div className="text-[10px] text-gray-500 truncate">骨骼: {slot.boneName}</div>
        </div>

        {/* 可見性切換 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isVisible) {
              onSetAttachment(null);
            } else if (slot.availableAttachments.length > 0) {
              onSetAttachment(slot.availableAttachments[0]);
            }
          }}
          className={`p-1 rounded transition-colors ${
            isVisible 
              ? 'text-purple-400 hover:bg-purple-500/20' 
              : 'text-gray-600 hover:bg-white/10'
          }`}
          title={isVisible ? '隱藏' : '顯示'}
        >
          {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>

        {/* 當前 Attachment 標籤 */}
        {slot.currentAttachment && (
          <div className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded">
            {slot.currentAttachment}
          </div>
        )}
      </div>

      {/* Attachment 列表 */}
      {isExpanded && hasAttachments && (
        <div className="border-t border-white/5 bg-black/20 p-2 space-y-1">
          {/* 無 Attachment 選項 */}
          <button
            onClick={() => onSetAttachment(null)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm transition-colors ${
              slot.currentAttachment === null
                ? 'bg-gray-500/30 text-gray-200'
                : 'text-gray-400 hover:bg-white/5'
            }`}
          >
            <EyeOff size={12} className="text-gray-500" />
            <span className="italic">(無)</span>
          </button>

          {/* Attachment 選項 */}
          {slot.availableAttachments.map((attachmentName) => (
            <button
              key={attachmentName}
              onClick={() => onSetAttachment(attachmentName)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm transition-colors ${
                slot.currentAttachment === attachmentName
                  ? 'bg-purple-500/30 text-purple-200'
                  : 'text-gray-400 hover:bg-white/5'
              }`}
            >
              <Package size={12} className={slot.currentAttachment === attachmentName ? 'text-purple-400' : 'text-gray-500'} />
              <span className="truncate">{attachmentName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 主組件
// ============================================================================

export const SpineSlotTab: React.FC<SpineSlotTabProps> = ({
  spineInstance,
}) => {
  const [slotsState, setSlotsState] = useState<SlotState[]>([]);
  const [expandedSlots, setExpandedSlots] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // 從 SpineRuntimeAdapter 獲取即時 Slot 狀態
  useEffect(() => {
    const adapter = getSpineWebglRuntimeAdapter();
    const state = adapter.getSlotsState(spineInstance.id);
    setSlotsState(state);
  }, [spineInstance.id, spineInstance.currentSkin]);

  // 過濾 Slots
  const filteredSlots = useMemo(() => {
    if (!searchQuery.trim()) return slotsState;
    const query = searchQuery.toLowerCase();
    return slotsState.filter(
      slot => 
        slot.name.toLowerCase().includes(query) ||
        slot.boneName.toLowerCase().includes(query)
    );
  }, [slotsState, searchQuery]);

  // 按骨骼分組
  const slotsByBone = useMemo(() => {
    const groups = new Map<string, SlotState[]>();
    for (const slot of filteredSlots) {
      const existing = groups.get(slot.boneName) || [];
      existing.push(slot);
      groups.set(slot.boneName, existing);
    }
    return groups;
  }, [filteredSlots]);

  // 切換 Slot 展開狀態
  const handleToggleExpand = useCallback((slotName: string) => {
    setExpandedSlots(prev => {
      const next = new Set(prev);
      if (next.has(slotName)) {
        next.delete(slotName);
      } else {
        next.add(slotName);
      }
      return next;
    });
  }, []);

  // 設定 Slot 的 Attachment
  const handleSetAttachment = useCallback((slotName: string, attachmentName: string | null) => {
    const adapter = getSpineWebglRuntimeAdapter();
    adapter.setSlotAttachment(spineInstance.id, slotName, attachmentName);
    
    // 更新本地狀態
    setSlotsState(prev => prev.map(slot => 
      slot.name === slotName 
        ? { ...slot, currentAttachment: attachmentName }
        : slot
    ));
  }, [spineInstance.id]);

  // 統計資訊
  const visibleCount = slotsState.filter(s => s.currentAttachment !== null).length;
  const totalCount = slotsState.length;

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* 搜尋欄 */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜尋 Slot 或骨骼..."
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          >
            ✕
          </button>
        )}
      </div>

      {/* 統計資訊 */}
      <div className="flex items-center justify-between text-xs text-gray-500 px-1">
        <span>
          <Layers size={12} className="inline mr-1" />
          {totalCount} 個插槽
        </span>
        <span>
          <Eye size={12} className="inline mr-1" />
          {visibleCount} 個可見
        </span>
      </div>

      {/* Slot 列表 */}
      <div className="flex-1 space-y-1 overflow-y-auto pr-1 custom-scrollbar min-h-0">
        {filteredSlots.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-8">
            <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>{searchQuery ? '找不到符合的 Slot' : '沒有可用的 Slot'}</p>
          </div>
        ) : (
          filteredSlots.map((slot) => (
            <SlotItem
              key={slot.name}
              slot={slot}
              isExpanded={expandedSlots.has(slot.name)}
              onToggleExpand={() => handleToggleExpand(slot.name)}
              onSetAttachment={(attachmentName) => handleSetAttachment(slot.name, attachmentName)}
            />
          ))
        )}
      </div>

      {/* 說明 */}
      <div className="text-xs text-gray-500 bg-black/20 rounded-lg p-3">
        <p className="mb-1">💡 提示</p>
        <p>插槽用於掛載不同的附件（Attachment），可實現換裝、表情切換等功能。</p>
      </div>
    </div>
  );
};

export default SpineSlotTab;

