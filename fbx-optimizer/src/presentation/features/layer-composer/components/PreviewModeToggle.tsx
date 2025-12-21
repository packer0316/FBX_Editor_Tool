import React, { useState } from 'react';
import { ArrowUp, ArrowDown, Monitor, ChevronRight, ChevronLeft } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { type ThemeStyle } from '../../../hooks/useTheme';

/**
 * 類名合併工具
 */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PreviewModeToggleProps {
  show2DFront: boolean;
  show2DBack: boolean;
  show3D: boolean;
  onToggle2DFront: () => void;
  onToggle2DBack: () => void;
  onToggle3D: () => void;
  theme: ThemeStyle;
}

/**
 * 預覽模式切換 - 專業高級感 + 可收縮版本
 */
export const PreviewModeToggle: React.FC<PreviewModeToggleProps> = ({
  show2DFront,
  show2DBack,
  show3D,
  onToggle2DFront,
  onToggle2DBack,
  onToggle3D,
  theme
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 統一的高級感按鈕基礎樣式
  const baseBtnClass = "relative flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-3 py-1.5 rounded-full transition-all duration-300 hover:scale-105 active:scale-95 z-10 border";

  // 啟用狀態樣式（統一使用主題 activeButton）
  const activeClass = theme.activeButton;
  
  // 未啟用狀態樣式
  const inactiveClass = cn(theme.button, "border-transparent bg-white/5", theme.itemHover);

  return (
    <div 
      className={cn(
        "absolute top-6 right-6 z-[500] flex items-center transition-all duration-500 ease-in-out backdrop-blur-2xl rounded-full shadow-2xl border overflow-hidden h-[40px]",
        theme.toolbarBg,
        theme.toolbarBorder,
        isCollapsed ? "px-1" : "px-1.5 gap-1"
      )}
    >
      {/* 頂部微弱光暈，增加材質感 */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />

      {/* 內容區塊 - 帶有動畫 */}
      <div className={cn(
        "flex items-center gap-1 transition-all duration-500 ease-in-out origin-right",
        isCollapsed ? "w-0 opacity-0 pointer-events-none -translate-x-4" : "w-auto opacity-100"
      )}>
        {/* 2D 前景層 (Upper) */}
        <button
          type="button"
          onClick={onToggle2DFront}
          className={cn(baseBtnClass, show2DFront ? activeClass : inactiveClass)}
        >
          <ArrowUp size={12} className={show2DFront ? "text-white" : "text-gray-500"} />
          <span>Front</span>
        </button>
        
        {/* 微細分隔線 */}
        {!show2DFront && !show3D && <div className="w-px h-3 bg-white/10 mx-px" />}

        {/* 3D */}
        <button
          type="button"
          onClick={onToggle3D}
          className={cn(baseBtnClass, show3D ? activeClass : inactiveClass)}
        >
          <Monitor size={12} className={show3D ? "text-white" : "text-gray-500"} />
          <span>3D</span>
        </button>

        {/* 微細分隔線 */}
        {!show3D && !show2DBack && <div className="w-px h-3 bg-white/10 mx-px" />}

        {/* 2D 背景層 (Down) */}
        <button
          type="button"
          onClick={onToggle2DBack}
          className={cn(baseBtnClass, show2DBack ? activeClass : inactiveClass)}
        >
          <ArrowDown size={12} className={show2DBack ? "text-white" : "text-gray-500"} />
          <span>Back</span>
        </button>
      </div>

      {/* 收縮/展開切換按鈕 */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={cn("p-1.5 rounded-full transition-all duration-300 z-20", theme.button, theme.itemHover)}
        title={isCollapsed ? "展開" : "收起"}
      >
        {isCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>
    </div>
  );
};