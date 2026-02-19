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
  let modified = false;
  
  // 为 JS 文件添加版本号参数
  // 匹配: src="./assets/xxx.js" 或 src='/assets/xxx.js' 或 src="/assets/xxx.js"
  // 关键：统一转换为相对路径 ./assets/，然后添加版本号
  const jsPattern = /(src=["'])(\/)?(\.\/)?assets\/([^"']+\.js)(\?v=[^"']+)?(["'])/g;
  content = content.replace(jsPattern, (match, prefix, absSlash, relSlash, filename, existingParam, suffix) => {
    if (!existingParam) {
      modified = true;
      // 统一使用相对路径 ./assets/
      return `${prefix}./assets/${filename}${VERSION_PARAM}${suffix}`;
    }
    return match;
  });
  
  // 为 CSS 文件添加版本号参数
  const cssPattern = /(href=["'])(\/)?(\.\/)?assets\/([^"']+\.css)(\?v=[^"']+)?(["'])/g;
  content = content.replace(cssPattern, (match, prefix, absSlash, relSlash, filename, existingParam, suffix) => {
    if (!existingParam) {
      modified = true;
      // 统一使用相对路径 ./assets/
      return `${prefix}./assets/${filename}${VERSION_PARAM}${suffix}`;
    }
    return match;
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ 已处理: ${filePath}`);
    console.log(`   版本号参数: ${VERSION_PARAM}`);
  } else {
    console.log(`⏭️  跳过: ${filePath} (已包含版本号或无需修改)`);
  }
}

// 主函数
function main() {
  if (!fs.existsSync(distDir)) {
    console.error(`❌ dist 目录不存在: ${distDir}`);
    process.exit(1);
  }
  
  const htmlFiles = findHtmlFiles(distDir);
  
  if (htmlFiles.length === 0) {
    console.warn(`⚠️  未找到 HTML 文件`);
    return;
  }
  
  console.log(`📋 找到 ${htmlFiles.length} 个 HTML 文件`);
  console.log(`🔧 开始添加版本号参数: ${VERSION_PARAM}\n`);
  
  htmlFiles.forEach(processHtmlFile);
  
  console.log(`\n✅ 处理完成！`);
}

main();

