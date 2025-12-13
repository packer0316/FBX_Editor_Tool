import React from 'react';
import { X, Wand2 } from 'lucide-react';
import { AlphaRemoverTool } from './AlphaRemoverTool';

interface ImageToolsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 圖片工具面板 - 容納各種圖片處理小工具
 * 目前包含：Alpha 去背工具
 */
export const ImageToolsPanel: React.FC<ImageToolsPanelProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="mb-4 p-4 rounded-xl border border-cyan-400/30 bg-cyan-500/5 backdrop-blur-sm">
      {/* 標題列 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-cyan-200 font-medium">
          <Wand2 size={16} />
          圖片工具
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* 工具內容 - 目前只有 Alpha 去背 */}
      <AlphaRemoverTool />
    </div>
  );
};

