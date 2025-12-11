/**
 * 生成 EFK Manifest
 * 
 * 掃描 public/effekseer 目錄，生成 manifest.json
 * 用於前端動態載入資料夾中的所有 EFK 檔案
 * 
 * 使用方式: node scripts/generate-efk-manifest.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EFFEKSEER_DIR = path.resolve(__dirname, '../public/effekseer');
const OUTPUT_FILE = path.resolve(EFFEKSEER_DIR, 'manifest.json');

function scanDirectory(dir, basePath = '') {
    const result = {
        efk: [],
        subdirs: {}
    };

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
            // 遞迴掃描子目錄
            result.subdirs[entry.name] = scanDirectory(fullPath, relativePath);
        } else if (entry.isFile() && entry.name.endsWith('.efk')) {
            // 收集 EFK 檔案
            result.efk.push({
                name: entry.name,
                path: relativePath
            });
        }
    }

    return result;
}

function main() {
    console.log('Scanning:', EFFEKSEER_DIR);

    if (!fs.existsSync(EFFEKSEER_DIR)) {
        console.error('Error: Directory not found:', EFFEKSEER_DIR);
        process.exit(1);
    }

    const manifest = {
        generated: new Date().toISOString(),
        root: scanDirectory(EFFEKSEER_DIR)
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2));
    console.log('Generated:', OUTPUT_FILE);

    // 顯示統計
    const countEfk = (obj) => {
        let count = obj.efk?.length || 0;
        for (const subdir of Object.values(obj.subdirs || {})) {
            count += countEfk(subdir);
        }
        return count;
    };

    console.log('Total EFK files:', countEfk(manifest.root));
}

main();

