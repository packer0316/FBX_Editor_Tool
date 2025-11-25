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
    toolbarBg: 'glass',
    toolbarBorder: 'border-white/10',
    panelBg: 'glass-panel',
    panelBorder: 'border-white/10',
    button: 'glass-button text-gray-300',
    activeButton: 'bg-neon-blue text-white shadow-[0_0_15px_rgba(59,130,246,0.5)] border border-neon-blue/50',
    sceneBg: '#0f172a',
    gridColor: '#334155',
    gridCellColor: '#1e293b'
  },
  light: {
    bg: 'bg-slate-50',
    text: 'text-slate-800',
    toolbarBg: 'bg-white/80 backdrop-blur-md border border-slate-200/60 shadow-lg',
    toolbarBorder: 'border-slate-200/60',
    panelBg: 'bg-white/90 backdrop-blur-xl shadow-2xl',
    panelBorder: 'border-slate-200/60',
    button: 'bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all duration-200',
    activeButton: 'bg-blue-500 text-white shadow-lg shadow-blue-500/30',
    sceneBg: '#f1f5f9',
    gridColor: '#cbd5e1',
    gridCellColor: '#e2e8f0'
  },
  cyberpunk: {
    bg: 'bg-[#050510]',
    text: 'text-neon-blue-glow',
    toolbarBg: 'bg-[#0a0a1a]/60 backdrop-blur-xl border border-neon-blue/30 shadow-[0_0_20px_rgba(59,130,246,0.2)]',
    toolbarBorder: 'border-neon-blue/30',
    panelBg: 'bg-[#0a0a1a]/80 backdrop-blur-2xl border border-neon-purple/30 shadow-[0_0_30px_rgba(168,85,247,0.15)]',
    panelBorder: 'border-neon-purple/30',
    button: 'text-neon-purple hover:text-neon-blue hover:bg-neon-blue/10 hover:shadow-[0_0_15px_rgba(59,130,246,0.4)] transition-all duration-300',
    activeButton: 'bg-neon-blue/20 text-neon-blue border border-neon-blue shadow-[0_0_20px_rgba(59,130,246,0.5)]',
    sceneBg: '#020205',
    gridColor: '#a855f7',
    gridCellColor: '#3b82f6'
  },
  nord: {
    bg: 'bg-[#2e3440]',
    text: 'text-[#eceff4]',
    toolbarBg: 'bg-[#3b4252]/80 backdrop-blur-md border border-[#4c566a]',
    toolbarBorder: 'border-[#4c566a]',
    panelBg: 'bg-[#3b4252]/90 backdrop-blur-xl border border-[#4c566a] shadow-xl',
    panelBorder: 'border-[#4c566a]',
    button: 'text-[#d8dee9] hover:text-[#88c0d0] hover:bg-[#434c5e] transition-colors duration-200',
    activeButton: 'bg-[#88c0d0] text-[#2e3440] font-semibold shadow-md shadow-[#88c0d0]/20',
    sceneBg: '#2e3440',
    gridColor: '#4c566a',
    gridCellColor: '#434c5e'
  },
  dracula: {
    bg: 'bg-[#282a36]',
    text: 'text-[#f8f8f2]',
    toolbarBg: 'bg-[#44475a]/80 backdrop-blur-md border border-[#6272a4]',
    toolbarBorder: 'border-[#6272a4]',
    panelBg: 'bg-[#44475a]/90 backdrop-blur-xl border border-[#bd93f9]/30 shadow-xl',
    panelBorder: 'border-[#bd93f9]/30',
    button: 'text-[#bd93f9] hover:text-[#ff79c6] hover:bg-[#6272a4]/50 transition-all duration-200',
    activeButton: 'bg-[#ff79c6] text-[#282a36] font-bold shadow-lg shadow-[#ff79c6]/30',
    sceneBg: '#282a36',
    gridColor: '#6272a4',
    gridCellColor: '#44475a'
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

