import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import packageJson from './package.json'
import { exec } from 'child_process'
import path from 'path'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * 自動生成 Effekseer Manifest 的 Vite 插件
 * 
 * 功能：
 * 1. 監聽 public/effekseer 目錄的變化
 * 2. 當檢測到 .efk 檔案新增或資料夾變動時，自動重新生成 manifest.json
 * 3. 確保前端始終能讀取到最新的資料夾列表
 */
function autoGenerateEfkManifest() {
  let isGenerating = false
  let debounceTimer: NodeJS.Timeout | null = null

  const generateManifest = async () => {
    if (isGenerating) {
      console.log('⏳ [EFK Manifest] 已有生成任務進行中，跳過...')
      return { success: false, message: '已有生成任務進行中' }
    }

    isGenerating = true
    try {
      console.log('🔄 [EFK Manifest] 開始重新生成 manifest.json...')
      const { stdout, stderr } = await execAsync('node scripts/generate-efk-manifest.js')
      
      if (stderr) {
        console.error('⚠️ [EFK Manifest] 生成時出現警告:', stderr)
      }
      
      console.log('✅ [EFK Manifest] Manifest 已更新')
      if (stdout) console.log(stdout)
      return { success: true, message: 'Manifest 已更新', output: stdout }
    } catch (err: any) {
      console.error('❌ [EFK Manifest] 生成失敗:', err)
      return { success: false, message: err.message }
    } finally {
      isGenerating = false
    }
  }

  // 防抖函數，避免短時間內多次觸發
  const debouncedGenerate = () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      generateManifest()
    }, 500) // 延遲 500ms
  }

  return {
    name: 'auto-generate-efk-manifest',
    
    // 開發伺服器啟動時執行一次，確保 manifest 是最新的
    async buildStart() {
      console.log('🚀 [EFK Manifest] 初始化檢查...')
      await generateManifest()
    },

    configureServer(server: any) {
      const effekseerDir = path.resolve(__dirname, 'public/effekseer')
      
      console.log('👀 [EFK Manifest] 監聽資料夾:', effekseerDir)
      
      // 🆕 添加 API 端點 - 讓前端可以手動觸發重新生成
      server.middlewares.use('/api/efk/refresh-manifest', async (req: any, res: any) => {
        // 只允許 POST 請求
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: false, message: 'Method Not Allowed' }))
          return
        }

        console.log('📡 [EFK Manifest] 收到手動刷新請求...')
        const result = await generateManifest()
        
        res.statusCode = result.success ? 200 : 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(result))
      })
      
      // 監聽整個 effekseer 目錄
      server.watcher.add(effekseerDir + '/**/*')

      // 監聽檔案新增事件
      server.watcher.on('add', (filePath: string) => {
        if (filePath.includes('public\\effekseer') || filePath.includes('public/effekseer')) {
          // 忽略 manifest.json 本身的變化，避免無限循環
          if (filePath.endsWith('manifest.json')) return
          
          if (filePath.endsWith('.efk')) {
            console.log('📁 [EFK Manifest] 檢測到新 .efk 檔案:', path.basename(filePath))
            debouncedGenerate()
          }
        }
      })

      // 監聽資料夾變動（例如新增資料夾）
      server.watcher.on('addDir', (dirPath: string) => {
        if (dirPath.includes('public\\effekseer') || dirPath.includes('public/effekseer')) {
          console.log('📂 [EFK Manifest] 檢測到新資料夾:', path.basename(dirPath))
          debouncedGenerate()
        }
      })

      // 監聽檔案刪除
      server.watcher.on('unlink', (filePath: string) => {
        if ((filePath.includes('public\\effekseer') || filePath.includes('public/effekseer')) 
            && filePath.endsWith('.efk')) {
          console.log('🗑️ [EFK Manifest] 檢測到 .efk 檔案被刪除:', path.basename(filePath))
          debouncedGenerate()
        }
      })

      // 監聽資料夾刪除
      server.watcher.on('unlinkDir', (dirPath: string) => {
        if (dirPath.includes('public\\effekseer') || dirPath.includes('public/effekseer')) {
          console.log('🗑️ [EFK Manifest] 檢測到資料夾被刪除:', path.basename(dirPath))
          debouncedGenerate()
        }
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    autoGenerateEfkManifest() // 添加自動生成插件
  ],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
})
