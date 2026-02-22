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
        assetFileNames: 'assets/[name]-[hash].[ext]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      }
    }
  },
  plugins: [
    // 构建完成后自动添加版本号参数到 HTML 中的资源引用
    addVersionParams()
  ]
});

