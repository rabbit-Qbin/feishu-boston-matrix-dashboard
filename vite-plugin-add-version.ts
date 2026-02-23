import { Plugin } from 'vite';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Vite 插件：在构建完成后自动为 HTML 中的 JS/CSS 资源添加版本号参数
 * 这样可以避免依赖 GitHub Actions，直接在构建时处理
 */
export function addVersionParams(): Plugin {
  return {
    name: 'add-version-params',
    apply: 'build',
    closeBundle() {
      const distDir = join(process.cwd(), 'dist');
      
      if (!existsSync(distDir)) {
        console.warn('⚠️  dist 目录不存在，跳过版本号参数添加');
        return;
      }

      // 获取构建时间戳
      const BUILD_TIMESTAMP = Math.floor(Date.now() / 1000);
      const VERSION_PARAM = `?v=${BUILD_TIMESTAMP}`;

      console.log(`\n🔧 [add-version-params] 开始添加版本号参数: ${VERSION_PARAM}`);

      // 查找所有 HTML 文件
      function findHtmlFiles(dir: string): string[] {
        const files: string[] = [];
        const items = readdirSync(dir);

        for (const item of items) {
          const fullPath = join(dir, item);
          const stat = statSync(fullPath);

          if (stat.isDirectory()) {
            files.push(...findHtmlFiles(fullPath));
          } else if (item.endsWith('.html')) {
            files.push(fullPath);
          }
        }

        return files;
      }

      const htmlFiles = findHtmlFiles(distDir);

      if (htmlFiles.length === 0) {
        console.warn('⚠️  未找到 HTML 文件');
        return;
      }

      console.log(`📋 找到 ${htmlFiles.length} 个 HTML 文件`);

      htmlFiles.forEach(filePath => {
        let content = readFileSync(filePath, 'utf8');
        const originalContent = content;
        let modified = false;

        // 为 JS 文件添加版本号参数
        const jsPattern = /(src\s*=\s*["'])([^"']*assets\/[^"']+\.js)(\?v=[^"']+)?(["'])/gi;
        content = content.replace(jsPattern, (match: string, prefix: string, filepath: string, existingParam: string | undefined, suffix: string) => {
          if (!existingParam) {
            modified = true;
            const normalizedPath = filepath.startsWith('./') ? filepath : `./${filepath.replace(/^\/+/, '')}`;
            return `${prefix}${normalizedPath}${VERSION_PARAM}${suffix}`;
          }
          return match;
        });

        // 为 CSS 文件添加版本号参数
        const cssPattern = /(href\s*=\s*["'])([^"']*assets\/[^"']+\.css)(\?v=[^"']+)?(["'])/gi;
        content = content.replace(cssPattern, (match: string, prefix: string, filepath: string, existingParam: string | undefined, suffix: string) => {
          if (!existingParam) {
            modified = true;
            const normalizedPath = filepath.startsWith('./') ? filepath : `./${filepath.replace(/^\/+/, '')}`;
            return `${prefix}${normalizedPath}${VERSION_PARAM}${suffix}`;
          }
          return match;
        });

        if (modified) {
          writeFileSync(filePath, content, 'utf8');
          console.log(`✅ 已处理: ${filePath.replace(process.cwd(), '.')}`);
          
          // 显示修改示例
          const beforeMatch = originalContent.match(/(src|href)=["'][^"']*assets\/[^"']+\.(js|css)["']/);
          const afterMatch = content.match(/(src|href)=["'][^"']*assets\/[^"']+\.(js|css)(\?v=[^"']+)?["']/);
          if (beforeMatch && afterMatch) {
            console.log(`   修改前: ${beforeMatch[0]}`);
            console.log(`   修改后: ${afterMatch[0]}`);
          }
        } else {
          console.log(`⏭️  跳过: ${filePath.replace(process.cwd(), '.')} (已包含版本号)`);
        }
      });

      console.log(`✅ [add-version-params] 处理完成！\n`);
    }
  };
}

