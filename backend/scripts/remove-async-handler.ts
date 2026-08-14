import { Project, SyntaxKind } from 'ts-morph';
import * as path from 'path';

const project = new Project({
  tsConfigFilePath: path.join(__dirname, '../tsconfig.json'),
});

const sourceFiles = project.getSourceFiles('src/**/*.ts');

for (const sourceFile of sourceFiles) {
  let changed = false;
  
  // Find all CallExpressions of asyncHandler
  const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  
  for (const callExpr of callExpressions.reverse()) {
    const expr = callExpr.getExpression();
    if (expr.getText() === 'asyncHandler') {
      const args = callExpr.getArguments();
      if (args.length > 0) {
        const handlerText = args[0].getText();
        callExpr.replaceWithText(handlerText);
        changed = true;
      }
    }
  }

  // Remove the asyncHandler import
  const importDeclarations = sourceFile.getImportDeclarations();
  for (const imp of importDeclarations) {
    if (imp.getModuleSpecifierValue().includes('asyncHandler')) {
      imp.remove();
      changed = true;
    }
  }

  if (changed) {
    sourceFile.saveSync();
    console.log(`Updated ${sourceFile.getFilePath()}`);
  }
}
