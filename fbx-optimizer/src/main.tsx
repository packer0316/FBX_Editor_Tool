import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as THREE from 'three'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'

// 鎖定色彩管理設定，避免 r3f 不同版本的預設差異
THREE.ColorManagement.enabled = true

// 🔧 Electron 拖放修復：阻止全域拖放的預設行為（導航到檔案）
// 用「capture 階段」保證一定吃到事件，避免預覽框出現禁止符號且收不到 drop
// 只對外部檔案（Files）做 preventDefault，不影響 App 內部拖曳（例如 application/json）
const isExternalFileDrag = (e: DragEvent) => {
  const types = e.dataTransfer?.types;
  if (!types) return false;
  // DOMStringList / string[] 兩種形態都相容
  return Array.from(types).includes('Files') && !Array.from(types).includes('application/json');
};

const preventDefaultIfFileDrag = (e: DragEvent) => {
  if (isExternalFileDrag(e)) {
    e.preventDefault();
  }
};

document.addEventListener('dragenter', preventDefaultIfFileDrag, { capture: true, passive: false });
document.addEventListener('dragover', preventDefaultIfFileDrag, { capture: true, passive: false });
document.addEventListener('drop', preventDefaultIfFileDrag, { capture: true, passive: false });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
