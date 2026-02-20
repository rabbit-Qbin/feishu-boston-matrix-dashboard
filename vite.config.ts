import { defineConfig } from 'vite';
import { addVersionParams } from './vite-plugin-add-version';

export default defineConfig({
  // 使用相对路径，适配 GitHub Pages（飞书插件要求）
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        // 强制每次构建生成新 hash（添加动态时间戳）
        assetFileNames: `assets/[name]-[hash]-${Date.now()}.[ext]`,
        chunkFileNames: `assets/[name]-[hash]-${Date.now()}.js`,
        entryFileNames: `assets/[name]-[hash]-${Date.now()}.js`,
      }
    }
  },
  plugins: [
    // 构建完成后自动添加版本号参数到 HTML 中的资源引用
    addVersionParams()
  ]
});

