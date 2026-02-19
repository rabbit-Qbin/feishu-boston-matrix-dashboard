const fs = require('fs');
const path = require('path');

// 获取构建时间戳
const BUILD_TIMESTAMP = Math.floor(Date.now() / 1000);
const VERSION_PARAM = `?v=${BUILD_TIMESTAMP}`;

// dist 目录路径
const distDir = path.join(__dirname, '..', 'dist');

// 查找所有 HTML 文件
function findHtmlFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...findHtmlFiles(fullPath));
    } else if (item.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// 处理 HTML 文件
function processHtmlFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let modified = false;
  
  // 为 JS 文件添加版本号参数
  // 匹配: src="./assets/xxx.js" 或 src='/assets/xxx.js' 或 src="/assets/xxx.js"
  // 改进：更宽松的匹配，确保能匹配到所有格式
  const jsPattern = /(src\s*=\s*["'])([^"']*assets\/[^"']+\.js)(\?v=[^"']+)?(["'])/gi;
  content = content.replace(jsPattern, (match, prefix, filepath, existingParam, suffix) => {
    if (!existingParam) {
      modified = true;
      // 确保路径是相对路径格式
      const normalizedPath = filepath.startsWith('./') ? filepath : `./${filepath.replace(/^\/+/, '')}`;
      return `${prefix}${normalizedPath}${VERSION_PARAM}${suffix}`;
    }
    return match;
  });
  
  // 为 CSS 文件添加版本号参数
  const cssPattern = /(href\s*=\s*["'])([^"']*assets\/[^"']+\.css)(\?v=[^"']+)?(["'])/gi;
  content = content.replace(cssPattern, (match, prefix, filepath, existingParam, suffix) => {
    if (!existingParam) {
      modified = true;
      // 确保路径是相对路径格式
      const normalizedPath = filepath.startsWith('./') ? filepath : `./${filepath.replace(/^\/+/, '')}`;
      return `${prefix}${normalizedPath}${VERSION_PARAM}${suffix}`;
    }
    return match;
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ 已处理: ${filePath}`);
    console.log(`   版本号参数: ${VERSION_PARAM}`);
    
    // 显示修改前后的对比（仅显示关键部分）
    const beforeMatch = originalContent.match(/(src|href)=["'][^"']*assets\/[^"']+\.(js|css)["']/);
    const afterMatch = content.match(/(src|href)=["'][^"']*assets\/[^"']+\.(js|css)(\?v=[^"']+)?["']/);
    if (beforeMatch && afterMatch) {
      console.log(`   修改前: ${beforeMatch[0]}`);
      console.log(`   修改后: ${afterMatch[0]}`);
    }
  } else {
    console.log(`⏭️  跳过: ${filePath} (已包含版本号或无需修改)`);
    // 调试：显示为什么跳过
    const hasAssets = content.match(/(src|href)=["'][^"']*assets\/[^"']+\.(js|css)["']/);
    if (hasAssets) {
      console.log(`   发现资源引用: ${hasAssets[0]}`);
      if (hasAssets[0].includes('?v=')) {
        console.log(`   已包含版本号参数`);
      }
    }
  }
}

// 主函数
function main() {
  console.log('🚀 脚本开始执行...');
  console.log(`📂 dist 目录路径: ${distDir}`);
  
  if (!fs.existsSync(distDir)) {
    console.error(`❌ dist 目录不存在: ${distDir}`);
    console.error(`   当前工作目录: ${process.cwd()}`);
    process.exit(1);
  }
  
  console.log(`✅ dist 目录存在`);
  
  const htmlFiles = findHtmlFiles(distDir);
  
  if (htmlFiles.length === 0) {
    console.warn(`⚠️  未找到 HTML 文件`);
    console.log(`   检查目录内容:`);
    try {
      const items = fs.readdirSync(distDir);
      console.log(`   目录内容: ${items.join(', ')}`);
    } catch (e) {
      console.error(`   无法读取目录: ${e.message}`);
    }
    process.exit(1);
  }
  
  console.log(`📋 找到 ${htmlFiles.length} 个 HTML 文件`);
  htmlFiles.forEach(f => console.log(`   - ${f}`));
  console.log(`🔧 开始添加版本号参数: ${VERSION_PARAM}\n`);
  
  let processedCount = 0;
  htmlFiles.forEach(file => {
    try {
      processHtmlFile(file);
      processedCount++;
    } catch (e) {
      console.error(`❌ 处理文件失败: ${file}`);
      console.error(`   错误: ${e.message}`);
      process.exit(1);
    }
  });
  
  console.log(`\n✅ 处理完成！共处理 ${processedCount}/${htmlFiles.length} 个文件`);
}

// 捕获未处理的错误
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的错误:', error);
  process.exit(1);
});

main();

