import React, { useState } from 'react';
import { ArrowUp, ArrowDown, Monitor, ChevronRight, ChevronLeft } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
  onToggle3D
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 統一的高級感按鈕基礎樣式
  const baseBtnClass = "relative flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold px-3.5 py-1.5 rounded-full transition-all duration-500 hover:scale-105 active:scale-95 z-10 border";

  // 啟用狀態樣式（統一使用 neon-blue 質感）
  const activeClass = "bg-neon-blue/20 text-white border-neon-blue/50 shadow-[0_0_15px_rgba(59,130,246,0.25)] ring-1 ring-neon-blue/30";
  
  // 未啟用狀態樣式
  const inactiveClass = "bg-white/5 text-gray-500 border-transparent hover:bg-white/10 hover:text-gray-300";

  return (
    <div 
      className={cn(
        "absolute top-6 right-6 z-[500] flex items-center transition-all duration-500 ease-in-out bg-[#0a0a0c]/60 backdrop-blur-2xl rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden h-[44px]",
        isCollapsed ? "px-1.5" : "px-2 gap-2"
      )}
    >
      {/* 頂部微弱光暈，增加材質感 */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />

      {/* 內容區塊 - 帶有動畫 */}
      <div className={cn(
        "flex items-center gap-2 transition-all duration-500 ease-in-out origin-right",
        isCollapsed ? "w-0 opacity-0 pointer-events-none -translate-x-4" : "w-auto opacity-100"
      )}>
        {/* 2D 前景層 (Upper) */}
        <button
          type="button"
          onClick={onToggle2DFront}
          className={cn(baseBtnClass, show2DFront ? activeClass : inactiveClass)}
        >
          <ArrowUp size={12} className={show2DFront ? "text-neon-blue" : "text-gray-600"} />
          <span>2D Front</span>
        </button>
        
        {/* 分隔點（視覺裝飾，增加專業感） */}
        <div className="w-1 h-1 rounded-full bg-white/10 mx-0.5 shrink-0" />

        {/* 3D */}
        <button
          type="button"
          onClick={onToggle3D}
          className={cn(baseBtnClass, show3D ? activeClass : inactiveClass)}
        >
          <Monitor size={12} className={show3D ? "text-neon-blue" : "text-gray-600"} />
          <span>3D Scene</span>
        </button>

        {/* 分隔點 */}
        <div className="w-1 h-1 rounded-full bg-white/10 mx-0.5 shrink-0" />
        
        {/* 2D 背景層 (Down) */}
        <button
          type="button"
          onClick={onToggle2DBack}
          className={cn(baseBtnClass, show2DBack ? activeClass : inactiveClass)}
        >
          <ArrowDown size={12} className={show2DBack ? "text-neon-blue" : "text-gray-600"} />
          <span>2D Back</span>
        </button>
      </div>

      {/* 收縮/展開切換按鈕 */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="p-1.5 rounded-full bg-white/5 text-gray-400 hover:bg-white/10 hover:text-neon-blue transition-all duration-300 z-20"
        title={isCollapsed ? "展開" : "收起"}
      >
        {isCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>
    </div>
  );
};