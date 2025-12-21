import { useState } from 'react';
import { Moon, Sun, Zap, Snowflake, Ghost } from 'lucide-react';

export type ThemeMode = 'dark' | 'light' | 'cyberpunk' | 'nord' | 'dracula';

export interface ThemeStyle {
  bg: string;
  text: string;
  toolbarBg: string;
  toolbarBorder: string;
  panelBg: string;
  panelBorder: string;
  button: string;
  activeButton: string;
  sceneBg: string;
  gridColor: string;
  gridCellColor: string;
  accent: string;
  accentActive: string;
  accentShadow: string;
  itemHover: string;
  tooltipBg: string;
  tooltipText: string;
  inputBg: string;
  inputBorder: string;
  cardBg: string;
  cardBorder: string;
  sectionLabel: string;
  dividerBorder: string;
  dividerBg: string;
}

export interface ThemeOption {
  id: ThemeMode;
  name: string;
  icon: typeof Moon;
  color: string;
}

const themeStyles: Record<ThemeMode, ThemeStyle> = {
  dark: {
    bg: 'bg-premium-dark-900',
    text: 'text-gray-100',
    toolbarBg: 'bg-[#1e293b]/60',
    toolbarBorder: 'border-white/10',
    panelBg: 'glass-panel',
    panelBorder: 'border-white/10',
    button: 'bg-white/5 border border-white/5 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/10 transition-all shadow-sm',
    activeButton: 'bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] border-t border-white/10',
    sceneBg: '#0f172a',
    gridColor: '#334155',
    gridCellColor: '#1e293b',
    accent: 'bg-blue-500',
    accentActive: 'bg-gradient-to-b from-blue-500 to-blue-600',
    accentShadow: 'shadow-[0_0_20px_rgba(59,130,246,0.4)]',
    itemHover: 'hover:bg-white/10',
    tooltipBg: 'bg-gray-900/95',
    tooltipText: 'text-white',
    inputBg: 'bg-black/40',
    inputBorder: 'border-white/10',
    cardBg: 'bg-black/30',
    dividerBorder: 'border-white/10',
    dividerBg: 'bg-white/10'
  },
  light: {
    bg: 'bg-slate-50',
    text: 'text-slate-800',
    toolbarBg: 'bg-white/70',
    toolbarBorder: 'border-slate-200',
    panelBg: 'bg-white/90 backdrop-blur-xl shadow-2xl',
    panelBorder: 'border-slate-200',
    button: 'bg-slate-100/50 border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm',
    activeButton: 'bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-[0_5px_15px_rgba(59,130,246,0.3),inset_0_1px_0_rgba(255,255,255,0.3)] border-t border-white/20',
    sceneBg: '#f1f5f9',
    gridColor: '#cbd5e1',
    gridCellColor: '#e2e8f0',
    accent: 'bg-blue-500',
    accentActive: 'bg-gradient-to-b from-blue-500 to-blue-600',
    accentShadow: 'shadow-[0_5px_15px_rgba(59,130,246,0.3)]',
    itemHover: 'hover:bg-slate-200/50',
    tooltipBg: 'bg-white/95',
    tooltipText: 'text-slate-800',
    inputBg: 'bg-slate-100',
    inputBorder: 'border-slate-200',
    cardBg: 'bg-white',
    cardBorder: 'border-slate-200',
    sectionLabel: 'text-slate-500',
    dividerBorder: 'border-slate-200',
    dividerBg: 'bg-slate-200'
  },
  cyberpunk: {
    bg: 'bg-[#050510]',
    text: 'text-neon-blue-glow',
    toolbarBg: 'bg-[#0a0a1a]/60',
    toolbarBorder: 'border-neon-blue/30',
    panelBg: 'bg-[#0a0a1a]/80 backdrop-blur-2xl border border-neon-purple/30 shadow-[0_0_30px_rgba(168,85,247,0.15)]',
    panelBorder: 'border-neon-purple/30',
    button: 'bg-neon-blue/5 border border-neon-blue/20 text-neon-purple/70 hover:text-neon-blue hover:bg-neon-blue/10 hover:border-neon-blue/40 transition-all shadow-[0_0_10px_rgba(59,130,246,0.1)]',
    activeButton: 'bg-gradient-to-b from-neon-blue to-blue-700 text-white border border-neon-blue shadow-[0_0_20px_rgba(59,130,246,0.6),inset_0_1px_0_rgba(255,255,255,0.4)]',
    sceneBg: '#020205',
    gridColor: '#a855f7',
    gridCellColor: '#3b82f6',
    accent: 'bg-neon-blue',
    accentActive: 'bg-gradient-to-b from-neon-blue to-blue-700',
    accentShadow: 'shadow-[0_0_20px_rgba(59,130,246,0.5)]',
    itemHover: 'hover:bg-neon-blue/20',
    tooltipBg: 'bg-[#0a0a1a]/95',
    tooltipText: 'text-neon-blue-glow',
    inputBg: 'bg-[#0a0a1a]/60',
    inputBorder: 'border-neon-blue/20',
    cardBg: 'bg-[#0a0a1a]/40',
    cardBorder: 'border-neon-purple/20',
    sectionLabel: 'text-neon-purple/60',
    dividerBorder: 'border-neon-blue/10',
    dividerBg: 'bg-neon-blue/10'
  },
  nord: {
    bg: 'bg-[#2e3440]',
    text: 'text-[#eceff4]',
    toolbarBg: 'bg-[#3b4252]/80',
    toolbarBorder: 'border-[#4c566a]',
    panelBg: 'bg-[#3b4252]/90 backdrop-blur-xl border border-[#4c566a] shadow-xl',
    panelBorder: 'border-[#4c566a]',
    button: 'bg-[#434c5e]/50 border border-[#4c566a] text-[#d8dee9]/70 hover:text-[#88c0d0] hover:bg-[#434c5e] hover:border-[#88c0d0]/50 transition-colors shadow-sm',
    activeButton: 'bg-gradient-to-b from-[#88c0d0] to-[#5e81ac] text-[#2e3440] font-semibold shadow-[0_4px_12px_rgba(136,192,208,0.3),inset_0_1px_0_rgba(255,255,255,0.4)] border-t border-white/20',
    sceneBg: '#2e3440',
    gridColor: '#4c566a',
    gridCellColor: '#434c5e',
    accent: 'bg-[#88c0d0]',
    accentActive: 'bg-gradient-to-b from-[#88c0d0] to-[#5e81ac]',
    accentShadow: 'shadow-[0_4px_12px_rgba(136,192,208,0.3)]',
    itemHover: 'hover:bg-[#434c5e]',
    tooltipBg: 'bg-[#3b4252]/95',
    tooltipText: 'text-[#eceff4]',
    inputBg: 'bg-[#434c5e]/60',
    inputBorder: 'border-[#4c566a]/50',
    cardBg: 'bg-[#3b4252]/60',
    cardBorder: 'border-[#4c566a]/30',
    sectionLabel: 'text-[#d8dee9]/50',
    dividerBorder: 'border-[#4c566a]/20',
    dividerBg: 'bg-[#4c566a]/20'
  },
  dracula: {
    bg: 'bg-[#282a36]',
    text: 'text-[#f8f8f2]',
    toolbarBg: 'bg-[#44475a]/80',
    toolbarBorder: 'border-[#6272a4]',
    panelBg: 'bg-[#44475a]/90 backdrop-blur-xl border border-[#bd93f9]/30 shadow-xl',
    panelBorder: 'border-[#bd93f9]/30',
    button: 'bg-[#6272a4]/30 border border-[#6272a4]/50 text-[#bd93f9]/70 hover:text-[#ff79c6] hover:bg-[#6272a4]/50 hover:border-[#ff79c6]/50 transition-all shadow-sm',
    activeButton: 'bg-gradient-to-b from-[#ff79c6] to-[#bd93f9] text-[#282a36] font-bold shadow-[0_5px_15px_rgba(255,121,198,0.4),inset_0_1px_0_rgba(255,255,255,0.4)] border-t border-white/20',
    sceneBg: '#282a36',
    gridColor: '#6272a4',
    gridCellColor: '#44475a',
    accent: 'bg-[#bd93f9]',
    accentActive: 'bg-gradient-to-b from-[#ff79c6] to-[#bd93f9]',
    accentShadow: 'shadow-[0_5px_15px_rgba(255,121,198,0.3)]',
    itemHover: 'hover:bg-[#6272a4]/50',
    tooltipBg: 'bg-[#44475a]/95',
    tooltipText: 'text-[#f8f8f2]',
    inputBg: 'bg-[#44475a]/60',
    inputBorder: 'border-[#6272a4]/30',
    cardBg: 'bg-[#44475a]/40',
    cardBorder: 'border-[#bd93f9]/20',
    sectionLabel: 'text-[#6272a4]',
    dividerBorder: 'border-[#6272a4]/20',
    dividerBg: 'bg-[#6272a4]/20'
  }
};

export const themeOptions: ThemeOption[] = [
  { id: 'dark', name: '深色', icon: Moon, color: '#111827' },
  { id: 'light', name: '亮色', icon: Sun, color: '#d0d0d0' },
  { id: 'cyberpunk', name: 'Cyberpunk', icon: Zap, color: '#050510' },
  { id: 'nord', name: 'Nord', icon: Snowflake, color: '#2e3440' },
  { id: 'dracula', name: 'Dracula', icon: Ghost, color: '#282a36' },
];

/**
 * 主題管理 Hook
 * 
 * 提供應用程式主題切換功能，支援多種預設主題（深色、亮色、Cyberpunk、Nord、Dracula）。
 * 此 Hook 管理當前主題狀態，並提供對應的樣式類別和選項。
 * 
 * @param initialTheme - 初始主題模式，預設為 'dark'
 * @returns 包含主題模式、設定函數、當前主題樣式和主題選項的物件
 * 
 * @example
 * ```typescript
 * const { themeMode, setThemeMode, currentTheme, themeOptions } = useTheme('dark');
 * 
 * return (
 *   <div className={currentTheme.bg}>
 *     <button onClick={() => setThemeMode('cyberpunk')}>
 *       切換主題
 *     </button>
 *   </div>
 * );
 * ```
 */
export function useTheme(initialTheme: ThemeMode = 'dark') {
  const [themeMode, setThemeMode] = useState<ThemeMode>(initialTheme);
  const currentTheme = themeStyles[themeMode];

  return {
    themeMode,
    setThemeMode,
    currentTheme,
    themeOptions,
  };
}

