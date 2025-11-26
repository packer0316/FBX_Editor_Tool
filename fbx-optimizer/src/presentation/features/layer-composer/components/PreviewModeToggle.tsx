import React from 'react';
import { ArrowUp, ArrowDown, Monitor } from 'lucide-react';

interface PreviewModeToggleProps {
  show2DFront: boolean;
  show2DBack: boolean;
  show3D: boolean;
  onToggle2DFront: () => void;
  onToggle2DBack: () => void;
  onToggle3D: () => void;
}

/**
 * 預覽模式切換
 * 順序：2D U (前景) | 3D | 2D D (背景)
 */
export const PreviewModeToggle: React.FC<PreviewModeToggleProps> = ({
  show2DFront,
  show2DBack,
  show3D,
  onToggle2DFront,
  onToggle2DBack,
  onToggle3D
}) => {
  return (
    <div className="absolute top-4 right-4 z-[500] flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-2 py-1.5 rounded-full shadow-lg border border-white/10">
      {/* 2D 前景層 (Upper) */}
      <button
        type="button"
        onClick={onToggle2DFront}
        title="2D 前景層"
        className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full transition-colors ${
          show2DFront ? 'bg-teal-500/90 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-gray-200'
        }`}
      >
        <ArrowUp size={12} />
        2D
      </button>
      
      {/* 3D */}
      <button
        type="button"
        onClick={onToggle3D}
        title="3D 場景"
        className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full transition-colors ${
          show3D ? 'bg-blue-500/90 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-gray-200'
        }`}
      >
        <Monitor size={12} />
        3D
      </button>
      
      {/* 2D 背景層 (Down) */}
      <button
        type="button"
        onClick={onToggle2DBack}
        title="2D 背景層"
        className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full transition-colors ${
          show2DBack ? 'bg-purple-500/90 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-gray-200'
        }`}
      >
        <ArrowDown size={12} />
        2D
      </button>
    </div>
  );
};




