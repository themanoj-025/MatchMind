const fs = require('fs');
const path = require('path');

function getFiles(dir, files = []) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getFiles(fullPath, files);
    } else if (fullPath.endsWith('.ts') && !fullPath.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

const routesDir = path.join(__dirname, '../src/routes');
const routeFiles = getFiles(routesDir);

let totalRoutes = 0;
let missingCoverage = 0;

for (const file of routeFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/router\.(get|post|put|patch|delete)\(/);
    if (match) {
      totalRoutes++;
      // Check previous lines (up to 15 lines back) for openapiRegistry.registerPath
      let hasRegistry = false;
      for (let j = Math.max(0, i - 15); j < i; j++) {
        if (lines[j].includes('openapiRegistry.registerPath')) {
          hasRegistry = true;
          break;
        }
      }
      if (!hasRegistry) {
        console.error(`Missing OpenAPI registry for route at ${file}:${i + 1}`);
        console.error(`  ${line.trim()}`);
        missingCoverage++;
      }
    }
  }
}

if (missingCoverage > 0) {
  console.error(`\nAPI Coverage Check Failed! ${missingCoverage}/${totalRoutes} routes are missing OpenAPI registration.`);
  process.exit(1);
} else {
  console.log(`\nAPI Coverage Check Passed! All ${totalRoutes} routes have OpenAPI registration.`);
  process.exit(0);
}
