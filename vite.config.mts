import { defineConfig } from "vite";

// 对 GitHub Pages 友好的配置：
// - root 仍然是当前目录
// - base 使用相对路径，这样打包出来的 index.html 会用 ./assets/xxx.js
//   而不是 /assets/xxx.js，避免在仓库子路径下被当成根路径加载出错
export default defineConfig({
  root: ".",
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});

