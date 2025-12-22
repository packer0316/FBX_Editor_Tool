import React from 'react';
import type { ThemeStyle } from '../hooks/useTheme';
import updates from '../../data/updates.json';

interface VersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeStyle;
}

export const VersionModal: React.FC<VersionModalProps> = ({ isOpen, onClose, theme }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-300">
      <div 
        className={`relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-3xl border ${theme.dividerBorder} ${theme.panelBg} shadow-[0_20px_70px_-10px_rgba(0,0,0,0.5)] flex flex-col animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 ease-out`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 背景裝飾光暈 */}
        <div className="absolute -top-[10%] -right-[10%] w-[40%] h-[30%] bg-blue-500/10 blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-[10%] -left-[10%] w-[40%] h-[30%] bg-indigo-500/10 blur-[100px] pointer-events-none" />

        {/* Header */}
        <div className="relative px-8 pt-8 pb-6 flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className={`text-2xl font-black tracking-tight ${theme.text}`}>
                Release Notes
              </h2>
            </div>
            <p className={`text-sm ${theme.text} opacity-40 font-medium pl-1`}>
              Explore the latest features and improvements
            </p>
          </div>
          
          <button 
            onClick={onClose}
            className={`p-2 rounded-xl transition-all duration-200 hover:rotate-90 ${theme.button} hover:bg-red-500/10 hover:text-red-500 border-none`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-4 space-y-12 custom-scrollbar relative">
          {updates.map((update, index) => (
            <div key={update.version} className="group relative">
              {/* 版本標籤與日期 */}
              <div className="flex items-end justify-between mb-6">
                <div className="flex items-center gap-4">
                  <h3 className={`text-4xl font-black italic tracking-tighter pr-4 ${index === 0 ? 'text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500' : 'text-gray-500/40'}`}>
                    {update.version}
                  </h3>
                  {index === 0 && (
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-blue-500 text-white shadow-lg shadow-blue-500/30 animate-pulse">
                      LATEST RELEASE
                    </span>
                  )}
                </div>
                <div className={`text-xs font-mono font-bold px-3 py-1 rounded-lg border ${theme.dividerBorder} ${theme.text} opacity-30`}>
                  {update.date}
                </div>
              </div>

              {/* 更新清單卡片 */}
              <div className={`relative p-6 rounded-2xl border ${index === 0 ? 'border-blue-500/30 bg-blue-500/[0.02]' : theme.dividerBorder + ' opacity-60'} transition-all duration-300 group-hover:border-blue-500/40 group-hover:bg-blue-500/[0.04]`}>
                <ul className="grid grid-cols-1 gap-4">
                  {update.content.map((item, i) => (
                    <li key={i} className="flex items-start gap-4 group/item">
                      <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 transition-all duration-300 ${index === 0 ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] group-hover/item:scale-125' : 'bg-gray-600'}`} />
                      <p className={`text-[15px] leading-relaxed font-medium ${theme.text} opacity-80 group-hover/item:opacity-100 transition-opacity`}>
                        {item}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Timeline 線條 */}
              {index !== updates.length - 1 && (
                <div className="absolute left-1/2 -bottom-8 w-px h-8 bg-gradient-to-b from-blue-500/20 to-transparent" />
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className={`px-8 py-6 flex justify-end items-center gap-4 border-t ${theme.dividerBorder}`}>
          <p className={`text-xs ${theme.text} opacity-20 font-mono italic`}>
            JR 3D VIEWER PROJECT • 2025
          </p>
          <button
            onClick={onClose}
            className={`px-10 py-3 rounded-2xl ${theme.activeButton} font-bold text-sm tracking-wider uppercase shadow-xl transition-all duration-300 hover:scale-105 active:scale-95`}
          >
            Got it
          </button>
        </div>
      </div>
      
      {/* Click outside to close */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
};

