const fs = require('fs');
const path = require('path');

function getFiles(dir, files = []) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getFiles(fullPath, files);
    } else if (fullPath.endsWith('.ts') && !fullPath.endsWith('.test.ts')) {
      // Exclude env.ts itself
      if (!fullPath.endsWith('env.ts')) {
         files.push(fullPath);
      }
    }
  }
  return files;
}

const srcDir = path.join(__dirname, '../src');
const tsFiles = getFiles(srcDir);

let replacedCount = 0;

for (const file of tsFiles) {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('process.env')) {
    // calculate relative path from this file's dir to src/config/env.ts
    const dir = path.dirname(file);
    const envPath = path.join(srcDir, 'config', 'env.ts');
    let relative = path.relative(dir, envPath).replace(/\\/g, '/').replace('.ts', '');
    if (!relative.startsWith('.')) relative = './' + relative;

    const importStmt = `import { env } from '${relative}'\n`;

    // replace all process.env with env
    // Watch out for `process.env.NODE_ENV !== 'production'`
    // it will become `env.NODE_ENV !== 'production'`
    content = content.replace(/process\.env/g, 'env');

    // add import to top, after imports but before actual code
    // simple way: just prepend it.
    if (!content.includes(importStmt)) {
      content = importStmt + content;
    }
    
    fs.writeFileSync(file, content, 'utf8');
    replacedCount++;
  }
}

console.log(`Replaced process.env in ${replacedCount} files.`);
