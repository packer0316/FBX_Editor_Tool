import React from 'react';
import { X, Wand2 } from 'lucide-react';
import { AlphaRemoverTool } from './AlphaRemoverTool';
import type { ThemeStyle, ThemeMode } from '../../../hooks/useTheme';

interface ImageToolsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: ThemeStyle;
  themeMode: ThemeMode;
}

/**
 * 圖片工具面板 - 容納各種圖片處理小工具
 * 目前包含：Alpha 去背工具
 */
export const ImageToolsPanel: React.FC<ImageToolsPanelProps> = ({ isOpen, onClose, currentTheme, themeMode }) => {
  if (!isOpen) return null;

  return (
    <div className={`mb-4 p-4 rounded-xl border border-cyan-400/30 ${currentTheme.inputBg} backdrop-blur-sm shadow-xl shadow-cyan-500/5`}>
      {/* 標題列 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-cyan-500 font-bold">
          <Wand2 size={16} />
          圖片工具
        </div>
        <button
          type="button"
          onClick={onClose}
          className={`p-1 rounded ${currentTheme.itemHover} text-gray-400 hover:text-cyan-500 transition-colors`}
        >
          <X size={14} />
        </button>
      </div>

      {/* 工具內容 - 目前只有 Alpha 去背 */}
      <AlphaRemoverTool currentTheme={currentTheme} themeMode={themeMode} />
    </div>
  );
};






